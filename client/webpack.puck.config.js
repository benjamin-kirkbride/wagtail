import path from 'path';
import webpack from 'webpack';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import TerserPlugin from 'terser-webpack-plugin';

/**
 * Isolated build for the Puck visual editor.
 *
 * The Wagtail admin runs on React 16 (exposed as a global via
 * client/webpack.config.js). Puck (@puckeditor/core) requires React 18/19, so
 * this config builds the Puck bundles completely separately, aliasing `react`
 * and `react-dom` to the `react18` / `react-dom18` npm aliases and bundling
 * them in — no expose-loader, no shared React with the admin.
 *
 * Files are transpiled with Babel (automatic JSX runtime), NOT ts-loader, so we
 * sidestep the repo's React-16 `@types/react`. Puck source is therefore
 * excluded from the root tsconfig's `tsc --noEmit` check.
 *
 * Outputs:
 *   wagtail/contrib/puck/static/wagtailpuck/js/puck.js       (admin editor bundle, browser)
 *   wagtail/contrib/puck/static/wagtailpuck/css/puck.css     (Puck stylesheet, extracted)
 *   wagtail/contrib/puck/static/wagtailpuck/js/puck-ssr.js   (server-side renderer, node CLI)
 */

const OUT = path.join('wagtail', 'contrib', 'puck', 'static', 'wagtailpuck');

const reactAlias = {
  react: path.resolve('node_modules/react18'),
  'react-dom': path.resolve('node_modules/react-dom18'),
};

const babelRule = {
  test: /\.(js|jsx|ts|tsx)$/,
  exclude: /node_modules/,
  use: {
    loader: 'babel-loader',
    options: {
      // Ignore the repo's root .babelrc.json (classic JSX runtime); use our own.
      babelrc: false,
      configFile: false,
      presets: [
        ['@babel/preset-env', { targets: 'defaults', bugfixes: true }],
        ['@babel/preset-react', { runtime: 'automatic' }],
        '@babel/preset-typescript',
      ],
    },
  },
};

export default function exports(env, argv) {
  const isProduction = argv.mode === 'production';

  const common = {
    mode: argv.mode || 'development',
    devtool: isProduction ? false : 'eval-cheap-module-source-map',
    resolve: {
      extensions: ['.tsx', '.ts', '.jsx', '.js'],
      alias: reactAlias,
    },
    performance: { hints: false },
    stats: { chunks: false, hash: false, colors: true, reasons: false, version: false },
    watchOptions: { poll: 1000, aggregateTimeout: 300 },
    optimization: {
      // Puck's runtime (dnd-kit, @preact/signals) breaks under webpack's
      // production optimizations (`(0, ee.i) is not a function` at editor
      // mount): tree-shaking prunes exports it accesses dynamically, and scope
      // hoisting mangles the interop. Disable tree-shaking / concatenation for
      // these bundles (dev mode already does) but keep Terser minification,
      // with names preserved since dnd-kit relies on them.
      concatenateModules: false,
      usedExports: false,
      sideEffects: false,
      minimizer: [
        new TerserPlugin({
          terserOptions: { keep_classnames: true, keep_fnames: true },
        }),
      ],
    },
  };

  // Each bundle must be a single file. Puck lazy-loads parts of itself
  // (tiptap/RichText, its Editor/Render shells) via dynamic import(), and
  // webpack would emit those as async chunks whose runtime URL is
  // publicPath + the source-tree output prefix — a path Django's staticfiles
  // never serves (it strips everything above the app's static/ dir). The
  // editor then dies at mount with ChunkLoadError as soon as a document
  // contains a lazy-loaded block (e.g. RichText); an empty document mounts
  // fine, which is exactly how this slipped past initial verification.
  const singleFile = new webpack.optimize.LimitChunkCountPlugin({
    maxChunks: 1,
  });

  // Browser bundle: the Puck editor, mounted in the Wagtail admin.
  const editor = {
    ...common,
    name: 'puck-editor',
    target: 'web',
    entry: { puck: './client/src/entrypoints/admin/puck.tsx' },
    output: {
      path: path.resolve('.'),
      filename: path.join(OUT, 'js', '[name].js'),
      publicPath: '/static/',
    },
    module: {
      rules: [
        babelRule,
        {
          test: /\.css$/,
          use: [
            MiniCssExtractPlugin.loader,
            { loader: 'css-loader', options: { url: false } },
          ],
        },
      ],
    },
    plugins: [
      new MiniCssExtractPlugin({ filename: path.join(OUT, 'css', '[name].css') }),
      singleFile,
    ],
  };

  // Node bundle: reads a Puck document as JSON on stdin, writes rendered HTML
  // to stdout. Invoked by wagtail/contrib/puck/rendering.py as `node puck-ssr.js`.
  const ssr = {
    ...common,
    name: 'puck-ssr',
    target: 'node',
    entry: { 'puck-ssr': './client/src/entrypoints/ssr/puck-ssr.tsx' },
    output: {
      path: path.resolve('.'),
      filename: path.join(OUT, 'js', '[name].js'),
    },
    module: {
      rules: [
        babelRule,
        // The SSR entry must not import CSS; if any slips in, inline it as a
        // harmless string module (built-in, no extra loader needed).
        { test: /\.css$/, type: 'asset/source' },
      ],
    },
    // Single file for the node bundle too: rendering.py invokes one
    // BUNDLE_PATH, and the wheel should not depend on sibling chunk files.
    plugins: [singleFile],
  };

  return [editor, ssr];
}
