import hashlib
import json
import logging
import os
import re
import shutil
import subprocess

from django.conf import settings
from django.core.cache import cache
from django.utils.safestring import SafeString, mark_safe

from wagtail.contrib.puck.fields import default_puck_document

logger = logging.getLogger(__name__)

# The internal-page link token stored by the editor: `page:<id>`. Resolved here,
# at render time, to the page's live URL — so an internal link survives the
# target page moving / changing slug, and the static bake emits correct paths.
# See client/src/components/Puck/links/linkValue.ts for the client contract.
_PAGE_TOKEN_RE = re.compile(r"^page:(\d+)$")
# The same token inside an HTML href attribute (rich-text link marks store
# `<a href="page:3">`), captured so only real link targets are rewritten — never
# an incidental "page:3" in body prose.
_PAGE_HREF_RE = re.compile(r"""(href=["'])page:(\d+)(["'])""")


def _resolve_page_url(page_id, cache_map):
    """Resolve a page id to its served URL, memoized within one render.

    Missing / unroutable pages resolve to '#' (a dead but harmless link) with a
    one-line warning, rather than raising and blanking the whole page.
    """
    if page_id in cache_map:
        return cache_map[page_id]

    # Imported lazily so this module stays importable without the app registry
    # ready (e.g. when only get_render_class is used).
    from wagtail.models import Page

    url = "#"
    page = Page.objects.filter(id=page_id).first()
    if page is None:
        logger.warning("Puck link: page id %s not found; linking to '#'.", page_id)
    else:
        resolved = page.get_url()
        if resolved:
            url = resolved
        else:
            logger.warning(
                "Puck link: page id %s has no URL (unpublished/no site?); "
                "linking to '#'.",
                page_id,
            )
    cache_map[page_id] = url
    return url


def _resolve_page_links(data, cache_map=None):
    """Return a copy of the Puck document with `page:<id>` tokens resolved.

    Walks the document generically (no per-block knowledge): every string value
    that is a bare `page:<id>` token (a Button/Hero href) is replaced with the
    resolved URL, and every `href="page:<id>"` inside a string (a rich-text link
    mark) is rewritten in place. All other values pass through untouched.
    """
    if cache_map is None:
        cache_map = {}

    if isinstance(data, dict):
        return {k: _resolve_page_links(v, cache_map) for k, v in data.items()}
    if isinstance(data, list):
        return [_resolve_page_links(v, cache_map) for v in data]
    if isinstance(data, str):
        token = _PAGE_TOKEN_RE.match(data.strip())
        if token:
            return _resolve_page_url(int(token.group(1)), cache_map)
        if "page:" in data:
            return _PAGE_HREF_RE.sub(
                lambda m: m.group(1)
                + _resolve_page_url(int(m.group(2)), cache_map)
                + m.group(3),
                data,
            )
        return data
    return data

BUNDLE_PATH = os.path.join(
    os.path.dirname(__file__), "static", "wagtailpuck", "js", "puck-ssr.js"
)

# Guard so the "SSR unavailable" warning is only emitted once per process.
_warned_unavailable = False


def get_render_class() -> str:
    """The CSS class applied to the Puck content wrapper (the drop zone).

    The drop zone is the element that directly contains the top-level blocks, so
    a site's content-column rules (e.g. a ``.stream > *`` measure) apply to the
    blocks when this class is set to that column class. Because every block
    renders ``inline`` (its own ``block-*`` root is the drag element, so Puck
    adds no wrapper), the blocks are direct children of this element on both the
    published page and the editor canvas — the measure matches in both.

    Read from the ``WAGTAILPUCK_RENDER_CLASS`` setting; if unset, a
    ``WAGTAILPUCK_RENDER_CLASS`` environment variable is used as a fallback
    (mirrors ``WAGTAILPUCK_PREVIEW_CSS``, handy for a consuming site's dev
    server). Defaults to empty (no class), so the fork/testapp renders under the
    neutral defaults in ``puck-render.css``.
    """
    configured = getattr(settings, "WAGTAILPUCK_RENDER_CLASS", None)
    if configured is None:
        configured = os.environ.get("WAGTAILPUCK_RENDER_CLASS", "")
    return (configured or "").strip()


def _warn_unavailable(message):
    global _warned_unavailable
    if not _warned_unavailable:
        logger.warning(message)
        _warned_unavailable = True


def render_puck(data) -> SafeString:
    """Render a Puck document to HTML via the Node SSR bundle.

    ``data`` may be a dict, a JSON string, or None. None/empty normalizes to
    the default empty document. Degrades gracefully to an empty string when
    the Node bundle is missing or ``node`` is not on PATH, so pages still
    render (without Puck content) in environments without the JS build.

    SSR contract: ``node puck-ssr.js`` reads the Puck JSON document on stdin
    and writes rendered HTML to stdout, exiting 0 on success.
    """
    if data is None:
        data = default_puck_document()
    elif isinstance(data, str):
        if not data.strip():
            data = default_puck_document()
        else:
            try:
                data = json.loads(data)
            except (ValueError, TypeError):
                data = default_puck_document()
    if not data:
        data = default_puck_document()

    # Resolve internal-page link tokens (`page:<id>`) to live URLs before both
    # hashing and SSR, so the cache key reflects the resolved output — a target
    # page's slug change yields a different payload and invalidates the entry.
    data = _resolve_page_links(data)

    render_class = get_render_class()
    payload = json.dumps(data)
    # The render class is part of the output, so it must be part of the cache
    # key: the same document under a different wrapper class renders different
    # HTML (and a bundle/class change must not serve a stale entry).
    cache_key = (
        "puck:render:"
        + hashlib.sha256(
            json.dumps(data, sort_keys=True).encode()
        ).hexdigest()
        + ":"
        + render_class
    )

    cached = cache.get(cache_key)
    if cached is not None:
        return mark_safe(cached)

    node = shutil.which("node")
    if node is None or not os.path.exists(BUNDLE_PATH):
        _warn_unavailable(
            "Puck SSR unavailable: node binary or puck-ssr.js bundle not found. "
            "Published Puck content will render empty."
        )
        return mark_safe("")

    # The class rides to the SSR bundle via the environment (not stdin) so the
    # stdin contract stays "just the Puck document" — puck-ssr.js reads it and
    # threads it into Puck's `metadata` for the root render.
    env = {**os.environ, "WAGTAILPUCK_RENDER_CLASS": render_class}
    try:
        result = subprocess.run(
            [node, BUNDLE_PATH],
            input=payload,
            capture_output=True,
            text=True,
            timeout=30,
            env=env,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        logger.warning("Puck SSR subprocess failed: %s", exc)
        return mark_safe("")

    if result.returncode != 0:
        logger.warning("Puck SSR exited %s: %s", result.returncode, result.stderr)
        return mark_safe("")

    html = result.stdout
    ttl = getattr(settings, "WAGTAILPUCK_RENDER_CACHE_TTL", 3600)
    cache.set(cache_key, html, ttl)
    return mark_safe(html)
