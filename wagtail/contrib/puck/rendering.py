import hashlib
import json
import logging
import os
import shutil
import subprocess

from django.conf import settings
from django.core.cache import cache
from django.utils.safestring import SafeString, mark_safe

from wagtail.contrib.puck.fields import default_puck_document

logger = logging.getLogger(__name__)

BUNDLE_PATH = os.path.join(
    os.path.dirname(__file__), "static", "wagtailpuck", "js", "puck-ssr.js"
)

# Guard so the "SSR unavailable" warning is only emitted once per process.
_warned_unavailable = False


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

    payload = json.dumps(data)
    cache_key = (
        "puck:render:"
        + hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()
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

    try:
        result = subprocess.run(
            [node, BUNDLE_PATH],
            input=payload,
            capture_output=True,
            text=True,
            timeout=30,
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
