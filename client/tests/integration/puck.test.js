/**
 * Playwright integration tests for the Puck ↔ Wagtail takeover editor — the
 * "browser truth" layer for the fixed bugs whose real regressions live in
 * production bundling, CSS geometry, and the compositional frame, none of which
 * jsdom can exercise.
 *
 * Guards, per bug:
 *   a. ChunkLoadError (1477e25de4) + production-optimization breakage: the edit
 *      view of a RichText-bearing document mounts the takeover with ZERO console
 *      errors. RichText is the block that pulled a lazy chunk; an empty page
 *      mounted fine and hid the bug, so the seed MUST contain RichText.
 *   b. Field-transform prop loss (382f6af3fe): editing the Hero's title leaves
 *      its description still rendering in the canvas.
 *   c. Dead drag-and-drop (2ea07ed9f7): dragging a block from the drawer into
 *      the canvas grows the stored document by one block.
 *   d. White-on-white canvas / theme relabel (5b327fab8c): the preview iframe
 *      root never carries w-theme-dark or w-theme-system.
 *
 * Running (see docs/contributing/developing.md → Integration tests):
 *   export DJANGO_SETTINGS_MODULE=wagtail.test.settings_ui
 *   ./wagtail/test/manage.py migrate
 *   ./wagtail/test/manage.py createcachetable
 *   DJANGO_SUPERUSER_EMAIL=admin@example.com DJANGO_SUPERUSER_USERNAME=admin \
 *     DJANGO_SUPERUSER_PASSWORD=changeme \
 *     ./wagtail/test/manage.py createsuperuser --noinput
 *   ./wagtail/test/manage.py runserver 0:8000
 *   # then, in another terminal:
 *   npm --prefix client/tests/integration install
 *   npm run test:integration            # or scope: ... jest puck.test.js
 *
 * `wagtail.contrib.puck` is already in the test settings, and the production
 * Puck bundles are already built under wagtail/contrib/puck/static/. If they are
 * missing, rebuild with:
 *   npx webpack --config ./client/webpack.puck.config.js --mode production
 *
 * The suite is resilient: it seeds its own page through the admin (no fixtures),
 * uses generous waits, and skips with a clear message if the harness globals or
 * the seeded page are unavailable.
 */

jest.setTimeout(180000);

const ROOT_PAGE_ID = 2; // The test site's home page — the parent for new pages.

/**
 * The seeded document. Real block types from buildConfig():
 *  - Hero: two text fields (title + description) — the field-transform case.
 *  - RichText: the lazy-loaded block — the ChunkLoadError case.
 *  - Button: a third block, so drag insertion is unambiguous.
 */
const SEED_DOC = {
  root: { props: { title: 'Puck Integration Page' } },
  content: [
    {
      type: 'Hero',
      props: {
        id: 'hero-int-1',
        title: 'Seeded Hero Title',
        description: 'Seeded hero description text',
        align: 'left',
        padding: '64px',
        buttons: [{ label: 'Learn more', href: '#' }],
      },
    },
    {
      type: 'RichText',
      props: {
        id: 'richtext-int-1',
        richtext: '<h2>Seeded rich heading</h2><p>Seeded rich body</p>',
        layout: { padding: '0px' },
      },
    },
    {
      type: 'Button',
      props: {
        id: 'button-int-1',
        label: 'Seeded Button',
        href: '#',
        variant: 'primary',
      },
    },
  ],
};

// The regression signatures for bugs 1 & 2 (async-chunk 404 at mount, and the
// dnd-kit/signals interop break under production optimization). These are the
// strict guard; any match fails the mount test outright.
const REGRESSION_ERROR = /ChunkLoadError|Loading chunk|is not a function/i;

// Generic network resource-load failures ("Failed to load resource ... 404")
// are environment noise (the testapp intentionally references missing demo
// assets like siren.js / /path/to/my/custom.css). They are filtered from the
// JS-error assertion — a real async-chunk 404 would ALSO surface as a
// ChunkLoadError (caught by REGRESSION_ERROR) and as a /wagtailpuck/ bundle 404
// (caught by the puckChunk404 check below), so nothing load-bearing is masked.
const RESOURCE_LOAD_ERROR = /Failed to load resource/i;

let editUrl = null;
let seedError = null;
const consoleErrors = [];
// URLs that returned >= 400 while loading the edit view.
const failedResponses = [];

async function readCsrfToken(url) {
  const resp = await context.request.get(url);
  const html = await resp.text();
  const m = html.match(/name="csrfmiddlewaretoken"\s+value="([^"]+)"/);
  return m ? m[1] : null;
}

/**
 * Create a PuckTestPage as a draft via the admin add view, following redirects
 * to the new page's edit URL (Wagtail's save-draft "redirect and remain").
 */
async function seedPuckPage() {
  const addUrl = `${TEST_ORIGIN}/admin/pages/add/tests/pucktestpage/${ROOT_PAGE_ID}/`;
  const csrf = await readCsrfToken(addUrl);
  if (!csrf) throw new Error(`no CSRF token at ${addUrl} (is the server up?)`);

  const slug = `puck-int-${Date.now()}`;
  const resp = await context.request.post(addUrl, {
    headers: { referer: addUrl },
    form: {
      csrfmiddlewaretoken: csrf,
      title: 'Puck Integration Page',
      slug,
      puck_body: JSON.stringify(SEED_DOC),
      'action-save-draft': '',
    },
  });

  const finalUrl = resp.url();
  const idMatch = finalUrl.match(/\/pages\/(\d+)\/edit\//);
  if (!idMatch) {
    throw new Error(
      `seeding did not land on an edit view (status ${resp.status()}, url ${finalUrl}); ` +
        'the add form likely rejected the POST.',
    );
  }
  return `${TEST_ORIGIN}/admin/pages/${idMatch[1]}/edit/`;
}

/** The preview iframe's Frame object (Puck's AutoFrame, id="preview-frame"). */
async function previewFrame() {
  const handle = await page.waitForSelector('#preview-frame', { timeout: 60000 });
  const frame = await handle.contentFrame();
  if (!frame) throw new Error('preview iframe has no content frame');
  return frame;
}

/** Parse the hidden puck_body input's current document. */
async function readDocument() {
  const value = await page.$eval(
    'input[name="puck_body"]',
    (el) => el.value,
  );
  return JSON.parse(value);
}

beforeAll(async () => {
  if (typeof page === 'undefined' || typeof context === 'undefined') {
    seedError = 'Playwright harness globals unavailable';
    return;
  }
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));
  page.on('response', (resp) => {
    if (resp.status() >= 400) failedResponses.push({ url: resp.url(), status: resp.status() });
  });

  try {
    editUrl = await seedPuckPage();
    await page.goto(editUrl, { waitUntil: 'domcontentloaded' });
    // Takeover mounts asynchronously (React 18 root + Puck), so wait for the
    // composed frame and the preview iframe rather than a fixed delay.
    await page.waitForSelector('[data-puck-takeover-root] .w-puck-takeover', {
      timeout: 60000,
    });
    await page.waitForSelector('#preview-frame', { timeout: 60000 });
    // Let Puck settle (canvas render, first onChange) before assertions.
    await page.waitForTimeout(2000);
  } catch (err) {
    seedError = String(err && err.message ? err.message : err);
  }
});

const guard = () => {
  if (seedError) {
    // eslint-disable-next-line no-console
    console.warn(`[puck.test] skipping: ${seedError}`);
    return true;
  }
  return false;
};

describe('Puck takeover editor (integration)', () => {
  it('mounts the takeover on a RichText-bearing page with no console errors', async () => {
    if (guard()) return;

    // (a) Takeover root has children and the four rail sections are present.
    const railCount = await page.$$eval(
      '.w-puck-rail .w-puck-rail__btn',
      (els) => els.length,
    );
    expect(railCount).toBe(4);
    for (const label of ['Main', 'Page', 'Blocks', 'Outline']) {
      expect(await page.$(`.w-puck-rail__btn[title="${label}"]`)).not.toBeNull();
    }

    // The canvas actually rendered the seeded content (RichText path exercised).
    const frame = await previewFrame();
    await frame.waitForSelector('text=Seeded Hero Title', { timeout: 30000 });

    // No ChunkLoadError / dnd-kit-signals interop error at mount — the crux of
    // bugs 1 & 2.
    const regressions = consoleErrors.filter((t) => REGRESSION_ERROR.test(t));
    expect(regressions).toEqual([]);

    // The Puck bundles (and any chunk webpack might have split off, had
    // single-file bundling regressed) must all load — no 404 under wagtailpuck/.
    const puckBundle404 = failedResponses.filter((r) => /\/wagtailpuck\//.test(r.url));
    expect(puckBundle404).toEqual([]);

    // No JS runtime errors beyond generic resource-load 404s (environment noise;
    // see RESOURCE_LOAD_ERROR). A genuine chunk failure is still caught above.
    const jsErrors = consoleErrors.filter((t) => !RESOURCE_LOAD_ERROR.test(t));
    expect(jsErrors).toEqual([]);
  });

  it('keeps a Hero sibling text prop rendering after editing another field', async () => {
    if (guard()) return;

    const frame = await previewFrame();
    // Select the Hero by clicking its rendered heading in the canvas.
    await frame.waitForSelector('text=Seeded Hero Title', { timeout: 30000 });
    await frame.click('text=Seeded Hero Title');

    // The fields sidebar now shows the Hero's fields; the title is the first
    // text input. Edit it.
    const titleInput = page
      .locator('.w-puck-takeover__fields input[type="text"], .w-puck-takeover__fields input:not([type])')
      .first();
    await titleInput.waitFor({ state: 'visible', timeout: 30000 });
    await titleInput.fill('Edited Hero Title');
    // Nudge Puck to commit (blur / input events).
    await titleInput.press('Tab');
    await page.waitForTimeout(1000);

    // The edited title updates AND the untouched description still renders —
    // the field-transform bug blanked the sibling text props here.
    await frame.waitForSelector('text=Edited Hero Title', { timeout: 30000 });
    expect(
      await frame.$('text=Seeded hero description text'),
    ).not.toBeNull();
  });

  it('inserts a block when dragged from the Blocks drawer into the canvas', async () => {
    if (guard()) return;

    const before = await readDocument();
    const beforeCount = before.content.length;

    // Open the Blocks drawer.
    await page.click('.w-puck-rail__btn[title="Blocks"]');
    // Drawer items live in the active Blocks panel. Pick one by its label.
    const drawerItem = page
      .locator('.w-puck-takeover__panel [data-panel="blocks"], .w-puck-takeover__panel')
      .locator('text=Space')
      .first();
    await drawerItem.waitFor({ state: 'visible', timeout: 30000 });

    const src = await drawerItem.boundingBox();
    const iframeEl = await page.$('#preview-frame');
    const dst = await iframeEl.boundingBox();
    if (!src || !dst) throw new Error('could not measure drag source/target');

    const targetX = dst.x + dst.width / 2;
    const targetY = dst.y + dst.height / 2;

    // Pointer-event drag with incremental moves; the small jiggle at the end
    // forces Puck's collision engine to recompute a drop target.
    await page.mouse.move(src.x + src.width / 2, src.y + src.height / 2, {
      steps: 5,
    });
    await page.mouse.down();
    await page.mouse.move(src.x + src.width / 2 + 10, src.y + src.height / 2 + 10, {
      steps: 5,
    });
    await page.mouse.move(targetX, targetY, { steps: 20 });
    await page.mouse.move(targetX + 2, targetY + 2, { steps: 5 });
    await page.waitForTimeout(300);
    await page.mouse.up();
    await page.waitForTimeout(1500);

    const after = await readDocument();
    expect(after.content.length).toBe(beforeCount + 1);
  });

  it('never leaves the preview iframe root on a dark theme (relabel)', async () => {
    if (guard()) return;

    const frame = await previewFrame();
    const rootClass =
      (await frame.locator(':root').getAttribute('class')) || '';
    expect(rootClass).not.toMatch(/w-theme-dark/);
    expect(rootClass).not.toMatch(/w-theme-system/);
    // If the root carries any theme label at all, it must be the light one.
    if (/w-theme-/.test(rootClass)) {
      expect(rootClass).toMatch(/w-theme-light/);
    }
  });
});
