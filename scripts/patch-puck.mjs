/**
 * Vendored patch for @puckeditor/core (MIT) — applied via `postinstall`.
 *
 * Fixes a Puck 0.22.x editor bug: editing ONE field of a component that has two
 * or more text/textarea fields blanks the OTHER (unedited) text/textarea props
 * in the canvas render, while the stored data stays intact.
 *
 * Root cause lives in `useFieldTransformsTracked`
 * (lib/field-transforms/use-field-transforms-tracked.tsx). On each edit it
 * builds `changedProps` — only the fields that changed — then runs
 * `mapFields({...item, props: changedProps}, ...)`. But `mapFields` walks with
 * `ownedFields: true`, whose defaulting loop RE-ADDS every field that has a
 * registered mapper but is absent from the (partial) `changedProps`. The
 * built-in inline-text transform registers a mapper for `text`/`textarea`/
 * `custom` unconditionally (it just returns `value` when the field is not
 * contentEditable). So every unedited text/textarea field is re-added with
 * `value === undefined`, the no-op mapper returns that `undefined`, and the
 * result is merged over the previously-good `prevResult.current`
 * (`{...prevResult.current, ...mapped}`) — and again over `item.props`
 * (`{...item.props, ...transformedProps}`). Keys stay present; values become
 * undefined. The component then renders those props as blank.
 *
 * The function's own intent ("Filter to changed fields only") is defeated by
 * that re-expansion. The fix restricts the merged `mapped` back to the keys we
 * actually fed in (`changedProps`), so unedited fields keep their prior value.
 *
 * Idempotent and version-tolerant: scans the built dist files for the exact
 * compiled merge line and skips any file already patched. Run automatically on
 * `npm install` (postinstall); the fork's wheel build then bundles the patched
 * code into puck.js / puck-ssr.js.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// The pure string transform + constants live in a CJS sibling so they can be
// unit-tested in isolation (see scripts/patch-puck-lib.js and
// client/src/components/Puck/patch-puck.test.ts). Behaviour here is unchanged.
import lib from './patch-puck-lib.js';

const { patchSource } = lib;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(
  __dirname,
  '..',
  'node_modules',
  '@puckeditor',
  'core',
  'dist',
);

function main() {
  if (!fs.existsSync(distDir)) {
    // @puckeditor/core not installed (e.g. a partial install); nothing to do.
    return;
  }

  const files = fs
    .readdirSync(distDir)
    .filter((f) => f.endsWith('.mjs') || f.endsWith('.js'))
    .map((f) => path.join(distDir, f));

  let patched = 0;
  let alreadyPatched = 0;

  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    const { code, status } = patchSource(src);

    if (status === 'already') {
      alreadyPatched += 1;
      continue;
    }
    if (status === 'notfound') continue;

    fs.writeFileSync(file, code);
    patched += 1;
    // eslint-disable-next-line no-console
    console.log(`[patch-puck] patched ${path.basename(file)}`);
  }

  if (patched === 0 && alreadyPatched === 0) {
    // eslint-disable-next-line no-console
    console.warn(
      '[patch-puck] WARNING: no @puckeditor/core dist file matched the target ' +
        'line. Puck may have changed; re-verify the useFieldTransformsTracked fix.',
    );
  } else {
    // eslint-disable-next-line no-console
    console.log(
      `[patch-puck] done (patched ${patched}, already patched ${alreadyPatched}).`,
    );
  }
}

main();
