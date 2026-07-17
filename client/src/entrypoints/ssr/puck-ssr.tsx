import { renderToStaticMarkup } from 'react-dom/server';
import { Render } from '@puckeditor/core';
import { buildConfig, normalizeData } from '../../components/Puck/config';

/**
 * Server-side renderer CLI for published Puck pages.
 *
 * Contract (must match wagtail/contrib/puck/rendering.py):
 *   - reads a Puck JSON document on stdin
 *   - writes rendered HTML on stdout
 *   - exits 0 on success, 1 on parse / render failure (error to stderr)
 *
 * Uses the same isolated React 18 and the same `buildConfig()` as the editor,
 * so the 13 blocks render identically in the admin and on published pages.
 */

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

async function main() {
  const raw = await readStdin();

  let parsed: unknown;
  try {
    parsed = raw.trim() ? JSON.parse(raw) : {};
  } catch (err) {
    process.stderr.write(
      `puck-ssr: failed to parse input JSON: ${String(err)}\n`,
    );
    process.exit(1);
    return;
  }

  try {
    const data = normalizeData(parsed);
    // The content-column wrapper class rides in on the environment (set by
    // rendering.py) and is threaded into Puck's `metadata` so the root render
    // can apply it to the drop zone. Kept out of the document/stdin so the SSR
    // contract stays "just the Puck JSON document".
    const renderClass = process.env.WAGTAILPUCK_RENDER_CLASS || '';
    const html = renderToStaticMarkup(
      <Render
        config={buildConfig()}
        data={data}
        metadata={{ renderClass }}
      />,
    );
    process.stdout.write(html);
    process.exit(0);
  } catch (err) {
    process.stderr.write(
      `puck-ssr: failed to render: ${String(
        (err as Error)?.stack || err,
      )}\n`,
    );
    process.exit(1);
  }
}

main().catch((err) => {
  process.stderr.write(`puck-ssr: ${String((err as Error)?.stack || err)}\n`);
  process.exit(1);
});
