# Regression tests — wagtail.contrib.puck

Every bug fixed in the Puck ↔ Wagtail integration is now pinned by a test, at the
cheapest layer that can actually observe it. This file maps each fixed bug to its
guard; see `CLAUDE.md` for the mechanisms and `git log` for the fixes themselves.

## The layers

- **JS unit / config tripwires** — `npx jest --selectProjects puck`. Fast, no
  browser. The `puck` jest project mocks `@puckeditor/core` (dnd-kit/signals ship
  untransformed ESM), so these guard config, invariants, the build, and the
  jsdom-observable theme relabel — not real editor runtime.
- **Playwright integration** — `client/tests/integration/puck.test.js`. Browser
  truth against a live Django server and the real production Puck bundles. This is
  where the production-only bugs (async chunks, CSS-geometry drag, compositional
  frame) are actually exercised.

## Bug → guard

| Fixed bug (commit) | Guard | Layer |
| --- | --- | --- |
| Async-chunk ChunkLoadError (`1477e25de4`) | `build-config.test.ts` asserts `LimitChunkCountPlugin({maxChunks:1})` on both bundles; integration mounts a **RichText-bearing** page with no console errors and no `/wagtailpuck/` 404 | config + integration |
| Production-optimization break — dnd-kit/signals interop (`1477e25de4` family) | `build-config.test.ts` asserts `concatenateModules/usedExports/sideEffects === false`, Terser `keep_classnames`/`keep_fnames`, and the react18/react-dom18 aliases | config |
| contentEditable overlay portals (`382f6af3fe`) | `invariants.test.tsx` walks every component's fields (incl. `arrayFields`/`objectFields`) and asserts no `contentEditable` anywhere; also asserts all 13 blocks + root | unit |
| Field-transform prop loss (`382f6af3fe`) | `patch-puck.test.ts` exercises the pure `patchSource` transform (patches, idempotent, no-op on non-match) and asserts the marker is baked into the installed `@puckeditor/core`; integration edits a Hero field and asserts the sibling text still renders | unit + integration |
| Dead drag-and-drop (`2ea07ed9f7`) | `admin-overrides.test.ts` tripwire asserts the `html[data-puck-takeover] .Puck { position:absolute; inset:0 }` rule survives (untestable geometry); integration performs a real pointer drag from the drawer and asserts the stored document grows by one block | tripwire + integration |
| White-on-white canvas / theme relabel (`5b327fab8c`) | `theme-relabel.test.tsx` drives a jsdom canvas iframe: both `w-theme-system` and `w-theme-dark` relabel to `w-theme-light`, and the MutationObserver re-asserts on AutoFrame re-sync; integration asserts the iframe root never carries a dark class | unit + integration |
| Editor canvas parity (`44e7f00efe`) | covered by `PuckEditor.test.tsx` (syncHostStyles flag, previewCss injection) | unit |

The refactor: `scripts/patch-puck.mjs` now imports its pure string transform from
`scripts/patch-puck-lib.js` (CJS) so the transform is unit-testable in isolation;
the CLI/`postinstall` behaviour is unchanged.

## Running the integration suite

Needs a Wagtail dev install and Node. Following
`docs/contributing/developing.md → Integration tests`:

```sh
export DJANGO_SETTINGS_MODULE=wagtail.test.settings_ui   # already registers wagtail.contrib.puck
./wagtail/test/manage.py migrate
./wagtail/test/manage.py createcachetable
DJANGO_SUPERUSER_EMAIL=admin@example.com DJANGO_SUPERUSER_USERNAME=admin \
  DJANGO_SUPERUSER_PASSWORD=changeme ./wagtail/test/manage.py createsuperuser --noinput
./wagtail/test/manage.py runserver 0:8000
# in another terminal:
npm --prefix client/tests/integration install
./client/tests/integration/node_modules/.bin/playwright install chromium chromium-headless-shell
npm run test:integration        # or scope to this file: ... jest puck.test.js
```

The production Puck bundles must exist under `wagtail/contrib/puck/static/` (they
are a build artifact). If missing:
`npx webpack --config ./client/webpack.puck.config.js --mode production`.

`puck.test.js` seeds its own `PuckTestPage` through the admin add view (no
fixtures), following Wagtail's save-draft redirect to the new page's edit URL. It
is resilient (generous waits) and skips with a clear message if the harness
globals or the seeded page are unavailable.
