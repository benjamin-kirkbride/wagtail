# CLAUDE.md — wagtail.contrib.puck

Guidance for Claude Code when working on the Puck editor integration. Read `README.md` here first for the user-facing overview.

## What this is

A Rally Suite addition to the Wagtail fork (branch `rally/7.4` and descendants): the Puck visual editor (`@puckeditor/core`, MIT) as the body editor for an opt-in page type, replacing StreamField/rich-text editing while preserving Wagtail revisions/history/revert/preview. Published pages render server-side to plain HTML. Not upstream Wagtail.

## The load-bearing design decision

Puck content is a plain `models.JSONField` (`PuckField`) surfaced by a hidden-input widget (`PuckWidget`). **The revision/history/revert/preview machinery is completely decoupled from the widget** — it snapshots the model and round-trips form data. So:

- Do **not** modify `wagtail/models/revisions.py`, `draft_state.py`, `actions/publish_revision.py`, or the history/revert/preview views to make Puck work. If you think you need to, you've broken the decoupling — reconsider.
- The only bespoke server logic is `PuckWidget` + `PuckField`. Value marshalling (JSON string ↔ dict) is handled by Django's `forms.JSONField`, not by the widget — the widget behaves like a plain `HiddenInput`. Keep it that way.

## The other load-bearing constraint: two Reacts

The Wagtail admin runs on **React 16** (Draftail/Draft.js); Puck needs **React 18/19**. They must not share React.

- The Puck bundles are built by `client/webpack.puck.config.js` (separate from `client/webpack.config.js`), aliasing `react`/`react-dom` to the `react18`/`react-dom18` npm aliases and bundling them in. No `expose-loader`, no shared global React.
- Puck source is transpiled with **Babel** (automatic JSX runtime), not `ts-loader`, to avoid the repo's React-16 `@types/react`. It is therefore excluded from the root `tsconfig.json` and from `tsc --noEmit`. Don't add Puck files to the tsc include.
- Production builds disable tree-shaking/scope-hoisting for these bundles (`usedExports:false`, `sideEffects:false`, `concatenateModules:false`, Terser `keep_fnames`/`keep_classnames`). This is **required** — Puck's runtime (dnd-kit, `@preact/signals`) breaks under those optimizations (`(0, ee.i) is not a function` at editor mount). If you touch the optimization block, re-verify the minified editor mounts in a browser, not just that it builds.
- `.npmrc` sets `legacy-peer-deps=true` (Puck's `react@^18||^19` peer is satisfied via the webpack alias, not the root `react@16`) and `engine-strict=false` (local/CI Node is 22; repo declares >=24). Both are intentional.

## Vendored Puck patch (`scripts/patch-puck.mjs`, via `postinstall`)

We carry ONE patch against `@puckeditor/core` (0.22.x), applied automatically on `npm install` by the root `postinstall` script (`node ./scripts/patch-puck.mjs`). `patch-package` is not installed; the script instead does an idempotent, version-tolerant string replacement on the built `dist/*.{mjs,js}` files (it skips any file already patched and warns if the target line is gone). Because the fork ships a **pre-built** `puck.js`/`puck-ssr.js` in its wheel, the patch only needs to run in the fork's own build env before `npm run build:puck` — consuming sites (e.g. the marketing site) get the fixed code baked into the bundle.

**The bug it fixes:** editing ONE field of a component that has **two or more `text`/`textarea` fields** blanks the OTHER (unedited) text/textarea props in the canvas render, while the stored data stays intact — e.g. editing the Hero's title made its description vanish. Root cause is in Puck's `useFieldTransformsTracked` (`lib/field-transforms/use-field-transforms-tracked.tsx`): on each edit it builds a *partial* `changedProps` (only changed fields), then runs `mapFields(..., {props: changedProps}, ...)`. `mapFields` walks with `ownedFields: true`, whose defaulting loop re-adds every field that has a registered mapper but is absent from `changedProps`. The built-in inline-text transform registers a mapper for `text`/`textarea`/`custom` unconditionally (it just returns `value` when the field isn't `contentEditable`), so each unedited text field is re-added with `value === undefined`; the no-op mapper returns that `undefined`, and it is merged over the previously-good `prevResult.current` (`{...prevResult.current, ...mapped}`) and again over `item.props` (`{...item.props, ...transformedProps}`). Keys stay present, values become `undefined`, render goes blank. The fix restricts the merged `mapped` back to the keys actually fed in (`changedProps`), matching the function's own "Filter to changed fields only" intent. (This is orthogonal to the earlier `contentEditable` removal — that was a separate overlay-portal issue. Do not re-add `contentEditable`.)

If you bump the Puck version, re-verify the patch still targets the right line (the script warns if not) and re-run the browser check below with a multi-text-field block (Hero, Card, Text): edit a non-text field and confirm the other text fields keep rendering.

## The editor↔widget contract

`PuckWidget` renders a hidden input with `data-controller="w-init" data-w-init-event-value="w-puck:init"` plus a sibling `<div data-puck-editor-root>`. The `w-init` Stimulus controller (already in admin core) fires `w-puck:init` on the input; `client/src/entrypoints/admin/puck.tsx` listens for it, mounts Puck with `createRoot`, and on every `onChange` writes `JSON.stringify(data)` back into the input and dispatches a **bubbling `change`** (so `w-unsaved` and form submit/preview pick it up). Do not register a new Stimulus controller and do not use a telepath adapter — both would pull React 18 into the admin's React-16 world.

## The takeover frame

On page create/edit views (`form#page-edit-form` present) the entrypoint mounts a full-viewport **takeover**: `<Puck>` renders our `TakeoverFrame.tsx` as children (Puck's compositional API — `Puck.Components`/`Puck.Fields`/`Puck.Preview`/`Puck.Outline` + `usePuck()`; **no fork of Puck**). Rules that keep it working:

- **Form integrity is the #1 invariant.** The takeover host and the hidden "parking" element are direct children of `form#page-edit-form`, and every relocated Wagtail piece (nav sidebar, title/promote fields, action menu, messages, side panels) is Wagtail's **live DOM `appendChild`ed** into ref'd host divs React treats as opaque. Never re-implement Wagtail fields in React; never let React 18 reconcile inside a reparented node.
- **Puck remounts the frame once** (its DragDropContext changes shape leaving LOADING status). The `useReparent` cleanup rescues each node into `[data-puck-parking]` (still inside the form) and the next mount re-homes it. Breaking this destroys the reparented nodes.
- Takeover CSS is scoped to `html[data-puck-takeover]` in `admin-overrides.css`; leftover Wagtail chrome sits under the opaque overlay. Non-Puck admin pages must remain untouched — verify one when changing the CSS.
- **Puck's own root `.Puck` div (`id={instanceId}`) MUST geometrically cover the canvas.** `admin-overrides.css` gives it `position:absolute;inset:0` for exactly this reason — do not remove it. Puck's drag collision engine (`NestedDroppablePlugin`) gates *every* collision update on `document.elementsFromPoint(pointer).some(el => el.id === instanceId)` — the drag pointer must be over that `.Puck` element. Because our `.w-puck-takeover` child is absolutely positioned, `.Puck` otherwise collapses to `height:0` and is never under the canvas pointer, so **drag-and-drop silently half-works**: dragging a block from the drawer starts (an overlay + `[data-puck-dragging]` appear) but no drop preview is ever computed and nothing inserts, reorders, or drops — no console errors. This bit once (round: "can't drag from Blocks drawer"). If drops mysteriously stop working, first check `getComputedStyle(document.getElementById(instanceId))` covers the canvas and that `elementsFromPoint` at the canvas center includes that div.
- **Autosave races saves**: Wagtail's `w-autosave` posts the form on an interval; a save clicked around that tick can 400 on the revision conflict. Known rough edge (exists in stock Wagtail too); when driving the UI in tests, act well inside the interval.
- Viewport controls are a canvas max-width toggle, not Puck's zoom/device frames (Puck's internal `<Canvas>` is not exposed compositionally — the one composition limitation found).

## Canvas style parity

The preview iframe must render content under the **site's** CSS, not the admin's, so the canvas matches the published page. Mechanism (all sanctioned Puck API, no fork):

- **`<Puck iframe={{ syncHostStyles: false }}>`** (PuckEditor.tsx) turns off AutoFrame's host-style cloning — the 0.22 `IframeConfig.syncHostStyles` control. This stops the admin stylesheets (and, as a side effect, the parent `<html>` attribute sync, so `w-theme-dark` no longer clones in) from entering the iframe. **Do not** remove it. Puck's *own* iframe-internal interaction CSS (drag/drop/selection) is injected by `useInjectIframeCss` regardless of this flag (marked `data-puck-style-source="puck"`), so drag-and-drop visuals keep working — verify after any change here.
- The site's stylesheets are injected in place: `PuckWidget.get_preview_css()` builds `options["previewCss"]` (always `puck-render.css`, plus `WAGTAILPUCK_PREVIEW_CSS` — a list setting, or a comma-separated env var fallback). It rides the `w-init` detail to the entrypoint, which threads it to `TakeoverFrame`, whose iframe-adopt effect appends `<link data-puck-site-css>` tags into the iframe head (idempotent). Extend that existing effect (the dark-mode relabel machinery) — do not add a parallel iframe observer.
- The dark-mode relabel is now largely moot (no attribute sync to fight) but kept harmless; the canvas stays light-themed for screenshots because Playwright defaults to a light `prefers-color-scheme`.

## Site-compatible block markup (the content blocks)

The five blocks the marketing conversion uses — **Hero, Heading, RichText, Text, Button** — do NOT emit presentational inline styles. They emit the site's own semantic markup so a consuming site's stylesheet styles them directly (matching the old StreamField block templates verbatim):

- Hero → `<section class="block-hero hero">` with `.hero__heading` / `.hero__intro` / `.hero__image` / `.hero__actions > a.button`.
- Heading → `.block-heading` root, `<h2>` (or `h{level}`) inside.
- RichText → `.block-paragraph` root wrapping Puck's `.rich-text` HTML (so `.block-paragraph p` / `strong` apply).
- Text → `.block-paragraph` root, semantic `<p>`.
- Button → `.block-cta` root, `<p><a class="button">` (matching the old `cta` block).

**Every one of these blocks is `inline` and attaches `puck.dragRef` to its `block-*` root.** That is load-bearing for canvas parity: an `inline` block whose root is the drag element gets NO Puck wrapper `<div>` in the editor, so its `block-*` root stays a *direct child* of the drop zone — the same as on the published page (`<Render>` never wraps). A non-inline block gets a `[data-puck-component][data-puck-dnd]` wrapper injected between it and the drop zone, which breaks `.stream > .block-*` direct-child rules in the canvas only. If you add or convert a content block, make it `inline` + `dragRef` on the classed root, or the canvas and the page will diverge. (The `withLayout` HOC already does this; it now also forwards a `block-*` class to its `Layout` root — see its second arg.)

The other seven demo blocks (Card, Flex, Grid, Logos, Space, Stats, Template) keep their generic inline styles for now.

## The content-column class (`WAGTAILPUCK_RENDER_CLASS`)

The drop zone is the element that directly contains the top-level blocks, so it is where a site's content-column class goes (the marketing site's `stream`, whose `.stream > *` gives the readable measure and `.stream > .block-hero` the wider centred hero). The class is NOT hardcoded:

- `get_render_class()` (`rendering.py`) reads the **`WAGTAILPUCK_RENDER_CLASS`** setting, falling back to a same-named env var (mirrors `WAGTAILPUCK_PREVIEW_CSS`). Default empty.
- It reaches the block container via Puck **`metadata.renderClass`**, applied by the root render to `renderDropZone`'s `className`. Both paths thread it as metadata (kept out of the saved document): **SSR** — `rendering.py` passes it to `node` via the environment, `puck-ssr.tsx` reads `process.env.WAGTAILPUCK_RENDER_CLASS` into `<Render metadata>`; **editor** — `widgets.py` puts it on the `w-init` detail, the entrypoint threads it to `<PuckEditor renderClass>` → `<Puck metadata>`. The render class is part of the SSR **cache key** (same doc, different class → different HTML).
- The root render adds **no wrapper `<div>`** (an extra level would sit between the class and the blocks and break the direct-child measure).
- `render.html`'s inert `<div data-puck-render>` is `display:contents` (in `puck-render.css`) so a site template that *also* wraps the include in its column class doesn't double up and cap the drop zone.

## puck.css vs puck-render.css

`css/puck.css` is the ~120 KB **editor** stylesheet — loaded only by the admin editor (`PuckWidget.media`). The **published** page (`templates/wagtailpuck/puck/render.html`) links `css/puck-render.css` instead. That sheet carries three things: the `.rich-text` content rules (margin collapse, whitespace, blockquote/code) for the RichText block; the `display:contents` passthrough on `[data-puck-render]`; and **neutral fallback defaults for the content blocks' `block-*` / design classes, every rule wrapped in `:where(...)` (zero specificity) so any site CSS wins** — this is what lets a classless environment (the fork testapp) still render the declassed blocks acceptably while the sheet can be linked on the public page and injected into the canvas alongside the site's own CSS without fighting it. `puck-render.css` is a hand-written source file at `client/src/components/Puck/puck-render.css`, copied verbatim into the app's static dir by `webpack.puck.config.js` (an `EmitStaticFilePlugin`, since the whole `static/` dir is a build artifact). If you touch RichText's output wrapper, the block markup, or bump Puck, re-check these rules still match.

## SSR

`rendering.py` `render_puck(data)` runs `node puck-ssr.js` (stdin JSON → stdout HTML), cached, degrading to `""` if node/bundle absent. `client/src/entrypoints/ssr/puck-ssr.tsx` and the editor both import the same `buildConfig()` from `client/src/components/Puck/config.tsx` — that is the single source of truth for the 12 blocks. Change blocks there, once.

## Where things live

- Python: this directory (`fields.py`, `widgets.py`, `models.py`, `rendering.py`, `templates/wagtailpuck/`).
- Client: `client/src/components/Puck/` (config + `blocks/` + `components/` helpers), `client/src/entrypoints/admin/puck.tsx`, `client/src/entrypoints/ssr/puck-ssr.tsx`.
- Build/test config: `client/webpack.puck.config.js`, `.npmrc`, `package.json` (jest `projects`: `default` vs `puck`; `build`/`build:puck`/`start:puck` scripts), root `tsconfig.json` (Puck excluded).
- Test fixture: `PuckTestPage` in `wagtail/test/testapp/models.py` (Django app label `tests`, Python module `wagtail.test.testapp.models`), migration `0062_pucktestpage.py`, template `templates/tests/puck_test_page.html`; `"wagtail.contrib.puck"` registered in `wagtail/test/settings.py`.

## Verifying changes

**Every fix gets a regression test, in the same round as the fix**, at the layer the bug actually lived: unit test where the logic is unit-testable, a config/tripwire assertion for build- or CSS-level invariants jsdom cannot exercise, and a Playwright integration test for anything that only fails at runtime (mount errors, drag-and-drop, geometry). This integration's bug history is exactly the "works in the demo flow, breaks on real content" class that unit tests miss. See `TESTING.md` in this directory for the full test inventory, which guard covers which fixed bug, and how to run the integration harness (`client/tests/integration/puck.test.js`).

- Python: `python runtests.py wagtail.contrib.puck` (needs an env with the fork installed editable — `pip install -e ".[testing]"`).
- JS unit: `npx jest --selectProjects puck`. Note the `puck` project **mocks** `@puckeditor/core` in `PuckEditor.test.tsx` because dnd-kit/signals ship untransformed ESM that jest's default `transformIgnorePatterns` skips; the real editor is verified via the webpack build + browser, not jest.
- Build: `npm run build:puck` must emit `static/wagtailpuck/js/puck.js`, `js/puck-ssr.js`, `css/puck.css`, and `css/puck-render.css`.
- SSR smoke: `echo '{"content":[{"type":"Heading","props":{"id":"a","text":"Hi"}}],"root":{"props":{}}}' | node wagtail/contrib/puck/static/wagtailpuck/js/puck-ssr.js` should print HTML containing "Hi".
- Browser (the important one): run the testapp (`DATABASE_NAME=/path/dev.sqlite3 python wagtail/test/manage.py migrate && createcachetable && runserver`), create a `PuckTestPage`, confirm the editor mounts and the **production** (minified) bundle has no console errors, then save → check a revision holds `puck_body`, publish → the live page is server-rendered HTML, and revert loads a prior revision. The mounted document MUST include a **RichText** block: Puck lazy-loads the tiptap editor for it via dynamic `import()`, so RichText exercises code paths (single-file bundling, formerly chunk loading) that empty/Heading/Text documents never touch — an editor that mounts an empty page proves very little. That exact gap shipped a ChunkLoadError once.

## Scope (v1)

Out: comments-on-blocks, Wagtail image-chooser in blocks (image fields are URL strings), persistent Node SSR sidecar. Hero/Template are simplified; Puck's RichText is Puck-native (not Draftail).
