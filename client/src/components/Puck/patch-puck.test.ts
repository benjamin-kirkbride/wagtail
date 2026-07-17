/**
 * Regression guard for the Puck field-transform prop-loss bug
 * (commit 382f6af3fe).
 *
 * Editing one field of a block with two or more text/textarea fields blanked the
 * OTHER text props in the canvas (e.g. the Hero lost its description the moment
 * any field was touched). The fix is a vendored, idempotent string patch applied
 * to @puckeditor/core's built dist by `scripts/patch-puck.mjs` (via postinstall),
 * restricting the field-transform merge back to the keys actually changed.
 *
 * Two layers here:
 *  1. The pure transform (`patchSource`, factored into scripts/patch-puck-lib.js)
 *     is exercised against in-memory fixtures: it patches the target, is
 *     idempotent, and leaves non-matching source untouched.
 *  2. The REAL installed @puckeditor/core dist is asserted to carry the patch
 *     marker — i.e. postinstall actually ran. If it hasn't, the browser bug is
 *     back, so fail loudly with the fix.
 *
 * (The end-to-end behaviour — editing one field keeps the siblings rendering —
 * is covered by the Playwright integration test.)
 */
import fs from 'fs';
import path from 'path';
// eslint-disable-next-line import/extensions
import { patchSource, TARGET, MARKER } from '../../../../scripts/patch-puck-lib.js';

describe('patch-puck transform (unit)', () => {
  // A minimal facsimile of the compiled useFieldTransformsTracked line the patch
  // targets, wrapped in plausible surrounding code.
  const UNPATCHED = [
    'function useFieldTransformsTracked() {',
    '  const mapped = runTransforms(changedProps);',
    `  ${TARGET}`,
    '  return prevResult.current;',
    '}',
  ].join('\n');

  it('patches the target line and injects the change-only merge marker', () => {
    const { code, status } = patchSource(UNPATCHED);
    expect(status).toBe('patched');
    expect(code).toContain(MARKER);
    // The exact vulnerable line is gone (its blanket `mapped` merge replaced).
    expect(code).not.toContain(TARGET);
    // The change-only loop is keyed off changedProps (the function's own intent).
    expect(code).toContain('for (const __rallyKey in changedProps)');
  });

  it('is idempotent: a second application is a no-op', () => {
    const once = patchSource(UNPATCHED);
    const twice = patchSource(once.code);
    expect(twice.status).toBe('already');
    expect(twice.code).toBe(once.code);
  });

  it('leaves source without the target line unchanged and reports not-found', () => {
    const unrelated = 'export const x = 1;\n// nothing to patch here\n';
    const { code, status } = patchSource(unrelated);
    expect(status).toBe('notfound');
    expect(code).toBe(unrelated);
  });
});

describe('patch-puck applied to the real installed @puckeditor/core', () => {
  it('has the patch marker baked into dist/index.js (postinstall ran)', () => {
    const distIndex = path.resolve(
      __dirname,
      '../../../../node_modules/@puckeditor/core/dist/index.js',
    );

    if (!fs.existsSync(distIndex)) {
      throw new Error(
        `@puckeditor/core is not installed at ${distIndex}. ` +
          'Run `npm install` — its postinstall applies the vendored Puck patch.',
      );
    }

    const src = fs.readFileSync(distIndex, 'utf8');
    expect(
      src.includes(MARKER)
        ? true
        : // Surface an actionable message instead of a bare `false`.
          `@puckeditor/core dist/index.js is MISSING the field-transform patch ` +
            `(marker "${MARKER}"). Run \`npm install\` — its postinstall runs ` +
            `scripts/patch-puck.mjs to apply the vendored Puck patch. Without it, ` +
            `editing one text field of a multi-text block blanks the siblings.`,
    ).toBe(true);
  });
});
