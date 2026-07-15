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

## The editor↔widget contract

`PuckWidget` renders a hidden input with `data-controller="w-init" data-w-init-event-value="w-puck:init"` plus a sibling `<div data-puck-editor-root>`. The `w-init` Stimulus controller (already in admin core) fires `w-puck:init` on the input; `client/src/entrypoints/admin/puck.tsx` listens for it, mounts Puck with `createRoot`, and on every `onChange` writes `JSON.stringify(data)` back into the input and dispatches a **bubbling `change`** (so `w-unsaved` and form submit/preview pick it up). Do not register a new Stimulus controller and do not use a telepath adapter — both would pull React 18 into the admin's React-16 world.

## SSR

`rendering.py` `render_puck(data)` runs `node puck-ssr.js` (stdin JSON → stdout HTML), cached, degrading to `""` if node/bundle absent. `client/src/entrypoints/ssr/puck-ssr.tsx` and the editor both import the same `buildConfig()` from `client/src/components/Puck/config.tsx` — that is the single source of truth for the 13 blocks. Change blocks there, once.

## Where things live

- Python: this directory (`fields.py`, `widgets.py`, `models.py`, `rendering.py`, `templates/wagtailpuck/`).
- Client: `client/src/components/Puck/` (config + `blocks/` + `components/` helpers), `client/src/entrypoints/admin/puck.tsx`, `client/src/entrypoints/ssr/puck-ssr.tsx`.
- Build/test config: `client/webpack.puck.config.js`, `.npmrc`, `package.json` (jest `projects`: `default` vs `puck`; `build`/`build:puck`/`start:puck` scripts), root `tsconfig.json` (Puck excluded).
- Test fixture: `PuckTestPage` in `wagtail/test/testapp/models.py` (Django app label `tests`, Python module `wagtail.test.testapp.models`), migration `0062_pucktestpage.py`, template `templates/tests/puck_test_page.html`; `"wagtail.contrib.puck"` registered in `wagtail/test/settings.py`.

## Verifying changes

- Python: `python runtests.py wagtail.contrib.puck` (needs an env with the fork installed editable — `pip install -e ".[testing]"`).
- JS unit: `npx jest --selectProjects puck`. Note the `puck` project **mocks** `@puckeditor/core` in `PuckEditor.test.tsx` because dnd-kit/signals ship untransformed ESM that jest's default `transformIgnorePatterns` skips; the real editor is verified via the webpack build + browser, not jest.
- Build: `npm run build:puck` must emit `static/wagtailpuck/js/puck.js`, `js/puck-ssr.js`, `css/puck.css`.
- SSR smoke: `echo '{"content":[{"type":"Heading","props":{"id":"a","text":"Hi"}}],"root":{"props":{}}}' | node wagtail/contrib/puck/static/wagtailpuck/js/puck-ssr.js` should print HTML containing "Hi".
- Browser (the important one): run the testapp (`DATABASE_NAME=/path/dev.sqlite3 python wagtail/test/manage.py migrate && createcachetable && runserver`), create a `PuckTestPage`, confirm the editor mounts and the **production** (minified) bundle has no console errors, then save → check a revision holds `puck_body`, publish → the live page is server-rendered HTML, and revert loads a prior revision. The mounted document MUST include a **RichText** block: Puck lazy-loads the tiptap editor for it via dynamic `import()`, so RichText exercises code paths (single-file bundling, formerly chunk loading) that empty/Heading/Text documents never touch — an editor that mounts an empty page proves very little. That exact gap shipped a ChunkLoadError once.

## Scope (v1)

Out: comments-on-blocks, Wagtail image-chooser in blocks (image fields are URL strings), persistent Node SSR sidecar. Hero/Template are simplified; Puck's RichText is Puck-native (not Draftail).
