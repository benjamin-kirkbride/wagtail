/**
 * Tripwire for the dead-drag-and-drop bug (commit 2ea07ed9f7).
 *
 * This is NOT a behavior test — the actual regression is CSS geometry that jsdom
 * cannot compute (real drop targeting is exercised by the Playwright integration
 * test). It guards an untestable-in-jsdom invariant by asserting the load-bearing
 * rule still exists in the source stylesheet, so a well-meaning CSS edit that
 * drops it trips here instead of silently re-breaking drag-and-drop in a browser.
 *
 * Why it matters: the takeover overlay is position:absolute, which collapses
 * Puck's own root `.Puck` div to height 0. Puck's collision engine
 * (NestedDroppablePlugin) gates every collision update on the drag pointer being
 * over that `.Puck` element (elementsFromPoint(...).some(el => el.id ===
 * instanceId)). A zero-height box is never under the pointer, so drops silently
 * do nothing. The fix pins `html[data-puck-takeover] .Puck` to position:absolute
 * inset:0 so it geometrically covers the canvas.
 */
import fs from 'fs';
import path from 'path';

describe('admin-overrides.css — drag-and-drop hit-test tripwire', () => {
  const css = fs.readFileSync(
    path.resolve(__dirname, 'admin-overrides.css'),
    'utf8',
  );

  it('pins Puck\'s root (.Puck) to cover the overlay in takeover mode', () => {
    const marker = 'html[data-puck-takeover] .Puck';
    const start = css.indexOf(marker);
    expect(start).toBeGreaterThanOrEqual(0);

    // Extract just this rule's declaration block.
    const open = css.indexOf('{', start);
    const close = css.indexOf('}', open);
    expect(open).toBeGreaterThan(start);
    expect(close).toBeGreaterThan(open);
    const block = css.slice(open + 1, close);

    // The load-bearing declarations. Without BOTH, `.Puck` collapses and Puck's
    // collision gate never sees the pointer over it — drag-and-drop dies.
    expect(block).toMatch(/position:\s*absolute/);
    expect(block).toMatch(/inset:\s*0/);
  });
});
