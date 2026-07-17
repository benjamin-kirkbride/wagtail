/**
 * Regression guards for the Puck webpack build (client/webpack.puck.config.js).
 *
 * These pin the build-configuration invariants behind two production-only bugs
 * that were invisible to jest and to a naive browser smoke-test, so the config
 * is the only place they can be caught cheaply:
 *
 *  - ChunkLoadError (commit 1477e25de4): Puck lazy-loads tiptap/its Editor
 *    shells via dynamic import(), which webpack emitted as async chunks whose
 *    runtime URL Django staticfiles never serves — the editor died at mount as
 *    soon as a document contained a RichText block. Fix: force each bundle into
 *    a single file with LimitChunkCountPlugin({ maxChunks: 1 }).
 *
 *  - Production-optimization breakage (same commit family): tree-shaking /
 *    scope-hoisting pruned exports that dnd-kit / @preact/signals access
 *    dynamically ("(0, ee.i) is not a function" at mount). Fix: disable
 *    concatenateModules / usedExports / sideEffects and keep class/function
 *    names in Terser. Plus the dual-React invariant: react/react-dom aliased to
 *    the react18 / react-dom18 paths so Puck never shares the admin's React 16.
 *
 * The config is imported and executed here; we assert on the resulting webpack
 * config objects, not on source text.
 */
// eslint-disable-next-line import/no-unresolved, import/extensions
import buildWebpackConfig from '../../../webpack.puck.config.js';

type AnyPlugin = { constructor: { name: string }; options?: any };

function configs() {
  const result = (buildWebpackConfig as any)({}, { mode: 'production' });
  expect(Array.isArray(result)).toBe(true);
  // [editor (web), ssr (node)]
  expect(result).toHaveLength(2);
  return result as any[];
}

function findPlugin(cfg: any, name: string): AnyPlugin | undefined {
  return (cfg.plugins ?? []).find(
    (p: AnyPlugin) => p?.constructor?.name === name,
  );
}

describe('webpack.puck.config.js — single-file bundling (ChunkLoadError guard)', () => {
  it('forces BOTH bundles into a single chunk via LimitChunkCountPlugin(maxChunks:1)', () => {
    for (const cfg of configs()) {
      const plugin = findPlugin(cfg, 'LimitChunkCountPlugin');
      expect(plugin).toBeDefined();
      expect(plugin!.options.maxChunks).toBe(1);
    }
  });
});

describe('webpack.puck.config.js — production optimization disabled (dnd-kit/signals guard)', () => {
  it('disables scope-hoisting, tree-shaking and side-effect pruning on both bundles', () => {
    for (const cfg of configs()) {
      expect(cfg.optimization.concatenateModules).toBe(false);
      expect(cfg.optimization.usedExports).toBe(false);
      expect(cfg.optimization.sideEffects).toBe(false);
    }
  });

  it('keeps class and function names through Terser minification on both bundles', () => {
    for (const cfg of configs()) {
      const terser = (cfg.optimization.minimizer ?? []).find(
        (p: AnyPlugin) => p?.constructor?.name === 'TerserPlugin',
      );
      expect(terser).toBeDefined();
      // terser-webpack-plugin normalizes { terserOptions } into
      // options.minimizer.options.
      const terserOptions = terser.options.minimizer.options;
      expect(terserOptions.keep_classnames).toBe(true);
      expect(terserOptions.keep_fnames).toBe(true);
    }
  });
});

describe('webpack.puck.config.js — dual-React invariant', () => {
  it('aliases react / react-dom to the isolated react18 / react-dom18 packages', () => {
    for (const cfg of configs()) {
      const alias = cfg.resolve.alias;
      expect(typeof alias.react).toBe('string');
      expect(typeof alias['react-dom']).toBe('string');
      // Absolute paths into node_modules/react18 and node_modules/react-dom18 —
      // the whole point is that Puck must not resolve the admin's React 16.
      expect(alias.react.replace(/\\/g, '/')).toMatch(/node_modules\/react18$/);
      expect(alias['react-dom'].replace(/\\/g, '/')).toMatch(
        /node_modules\/react-dom18$/,
      );
    }
  });
});
