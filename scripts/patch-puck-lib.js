/**
 * Pure, side-effect-free core of the vendored @puckeditor/core patch.
 *
 * Split out of `patch-puck.mjs` so the string transform can be unit-tested in
 * isolation (jest, in-memory fixtures) without touching node_modules or the
 * filesystem. `patch-puck.mjs` remains the CLI/`postinstall` entrypoint and
 * imports these from here — its behaviour is unchanged.
 *
 * See `patch-puck.mjs` and `wagtail/contrib/puck/CLAUDE.md` for the full
 * description of the Puck 0.22.x field-transform bug this fixes.
 *
 * CommonJS on purpose: the repo has no `"type": "module"`, so this `.js` file is
 * CJS and is importable both from the ESM `patch-puck.mjs` (default import) and
 * from the babel-jest-transpiled `.ts` test (named import interop).
 */

const TARGET =
  'prevResult.current = __spreadValues(__spreadValues({}, prevResult.current), mapped);';

const REPLACEMENT =
  'const __rallyMappedChangedOnly = {}; ' +
  'for (const __rallyKey in changedProps) __rallyMappedChangedOnly[__rallyKey] = mapped[__rallyKey]; ' +
  'prevResult.current = __spreadValues(__spreadValues({}, prevResult.current), __rallyMappedChangedOnly);';

const MARKER = '__rallyMappedChangedOnly';

/**
 * Apply the patch to a single file's source text.
 *
 * Idempotent and version-tolerant, mirroring the original inline logic exactly:
 *   - already patched (contains MARKER)  -> { code: <unchanged>, status: 'already' }
 *   - target line absent                 -> { code: <unchanged>, status: 'notfound' }
 *   - target line present                -> { code: <patched>,   status: 'patched' }
 *
 * @param {string} code source of a @puckeditor/core dist file
 * @returns {{ code: string, status: 'patched' | 'already' | 'notfound' }}
 */
function patchSource(code) {
  if (code.includes(MARKER)) {
    return { code, status: 'already' };
  }
  if (!code.includes(TARGET)) {
    return { code, status: 'notfound' };
  }
  return { code: code.split(TARGET).join(REPLACEMENT), status: 'patched' };
}

module.exports = { TARGET, REPLACEMENT, MARKER, patchSource };
