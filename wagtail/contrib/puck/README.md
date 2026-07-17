# wagtail.contrib.puck

Puck visual editor as a page body for Wagtail. Puck (`@puckeditor/core`, MIT) becomes the content-editing surface for an opt-in page type, replacing the StreamField/rich-text editor, while Wagtail's page shell — title/slug, save/publish, revisions/history/revert, and preview — keeps working unchanged. Published pages are rendered **server-side** to plain HTML (no client-side React).

This is a Rally Suite addition to the fork; it is not part of upstream Wagtail.

## How it works

A page's Puck document (`{ "content": [...], "root": {...}, "zones": {...} }`) is stored as an opaque JSON blob in a `PuckField` (a `models.JSONField` subclass). The field renders with `PuckWidget`, a hidden-input widget that a separate React 18 bundle mounts onto — the same pattern Draftail uses. Because the content is a normal model field fed through a Django form, the whole revision/history/revert/preview stack is inherited with **no changes**: a revision snapshots the field like any other, revert re-instantiates the form from a prior revision, and preview round-trips the posted form value.

On page create/edit views the editor **takes over the whole viewport**: a composed Puck frame (built from Puck's compositional API, no fork) whose left icon rail has four sections — **Main** (the real Wagtail nav sidebar, relocated), **Page** (the title and promote fields plus status/checks/history, relocated), **Blocks**, and **Outline** — with Wagtail's Save draft / Publish / Submit-for-moderation action menu relocated to the top left of the frame's header. All relocated pieces are Wagtail's live server-rendered DOM moved (not re-implemented) into the frame while staying inside `<form id="page-edit-form">`, so saving, validation errors, and every Stimulus behavior keep working. Outside a page edit form the widget falls back to an inline mount.

The Puck editor runs on its own **isolated React 18** (the Wagtail admin is on React 16). It is built by `client/webpack.puck.config.js` into two bundles, shipped under this app's `static/wagtailpuck/`:

- `js/puck.js` + `css/puck.css` — the admin editor (browser).
- `css/puck-render.css` — the minimal rich-text content styles linked on the published page (and injected into the editor canvas). See "Editor canvas parity" below.
- `js/puck-ssr.js` — a Node CLI that renders a Puck document to HTML.

## Using it in a page model

```python
from wagtail.contrib.puck.models import PuckPageMixin
from wagtail.admin.panels import FieldPanel
from wagtail.models import Page


class LandingPage(PuckPageMixin, Page):
    content_panels = Page.content_panels + [FieldPanel("puck_body")]
    template = "app/landing_page.html"
```

`PuckPageMixin` provides the `puck_body = PuckField(...)` field and a `get_context()` that exposes the server-rendered HTML as `rendered_puck`. In the page template, include the render partial:

```django
{% include "wagtailpuck/puck/render.html" %}
```

You don't have to use the mixin — adding a `PuckField` and a `FieldPanel` for it is enough; the mixin just also wires `get_context`/rendering. Add `"wagtail.contrib.puck"` to `INSTALLED_APPS`.

## Server-side rendering

`render_puck(data)` (in `rendering.py`) shells out to `node puck-ssr.js`, passing the Puck JSON on stdin and reading HTML from stdout. Results are cached in Django's cache keyed by a hash of the document (TTL from `WAGTAILPUCK_RENDER_CACHE_TTL`, default 3600s). If `node` or the built bundle is missing, it degrades gracefully to an empty string (warning once) so pages still render.

This means:

- **Static-baked sites** (e.g. wagtail-bakery → Cloudflare Pages): SSR happens at bake time; production stays fully static, no server.
- **Dynamic sites**: the container serving Wagtail must have **Node available at runtime** for on-request rendering. A long-running Node sidecar (instead of subprocess-per-render) is a possible future optimization.

## Editor canvas parity

The editor renders page content in an isolated preview iframe. By default Puck's
AutoFrame clones the surrounding document's stylesheets into that iframe — in the
Wagtail admin that means the content shows *admin* fonts/colours/resets, not the
site's. To make the canvas match the published page, the integration:

1. Disables that cloning (`<Puck iframe={{ syncHostStyles: false }}>`), so admin
   CSS no longer leaks in. Puck's own iframe-internal interaction styles (drag
   previews, drop placeholders, selection outlines) are injected separately by
   Puck and are unaffected.
2. Injects the site's stylesheet(s) into the iframe instead, listed by the
   `WAGTAILPUCK_PREVIEW_CSS` setting.

```python
# settings.py — URLs or already-resolved static paths of the site's own CSS.
WAGTAILPUCK_PREVIEW_CSS = ["/static/css/site.css"]
```

`puck-render.css` (the minimal rich-text content stylesheet, see below) is always
injected too, so with the setting absent the canvas still renders content under
neutral UA defaults rather than admin styles. If the setting is unset, a
comma-separated `WAGTAILPUCK_PREVIEW_CSS` environment variable is used as a
fallback — convenient for pointing a consuming site's editor at its stylesheet
without editing that site's settings.

The published page's render partial (`wagtailpuck/puck/render.html`) links
`puck-render.css` rather than the full 120 KB editor stylesheet: every block is
inline-styled, so the only editor CSS the published markup needs is the handful
of rules covering the RichText block's `.rich-text` content wrapper. Linking the
same slim sheet on both sides keeps the page light and the canvas and published
page rendering rich text identically.

## The blocks

All 13 blocks from the Puck demo are ported in `client/src/components/Puck/blocks/`: Blank, Button, Card, Flex, Grid, Heading, Hero, Logos, RichText, Space, Stats, Template, Text. `client/src/components/Puck/config.tsx` (`buildConfig()`) is the single source of truth for the editor and the SSR renderer. Hero and Template are simplified for v1 (no external data fetching), and RichText is Puck-native rich text — it is not Wagtail's Draftail.

## Building

```bash
npm run build         # admin (React 16) + puck bundles
npm run build:puck    # puck bundles only
npm run start:puck    # watch-build the puck bundles during development
```

The built `static/wagtailpuck/**` is gitignored (a build artifact) and produced during the wheel build via `setup.py`; it is included in the wheel by setuptools package-data.

## Tests

```bash
python runtests.py wagtail.contrib.puck   # Python: widget, views (save/revision/revert/preview), rendering
npx jest --selectProjects puck            # JS: config, blocks, editor (React 18 + Testing Library)
```

The JS `puck` jest project is separate from the default (React 16 / Enzyme) project so it can run on React 18. The live-SSR Python test is skipped unless `node` and the built `puck-ssr.js` are both present.

## Not included in v1

Comments-on-blocks, a Wagtail image-chooser inside blocks (image fields are URL strings for now), and server-side rendering via a persistent Node process (subprocess + cache only).
