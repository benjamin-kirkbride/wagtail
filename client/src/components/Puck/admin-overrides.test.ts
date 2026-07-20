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

/**
 * Tripwire for the rich-text-menu occlusion bug.
 *
 * Also a geometry/stacking invariant jsdom cannot compute (the real regression
 * is pointer hit-testing in a browser; the Playwright integration test drives an
 * actual heading/list/alignment selection). Puck's rich-text field renders its
 * heading / list / alignment menus as Radix poppers portaled to <body> with
 * `z-index: auto`. The takeover root is a `z-index: 150` stacking context and so
 * paints over any `z-index: auto` body sibling — the menu draws BEHIND the
 * takeover and its options become visible-but-unclickable (keyboard selection
 * still works; a mouse click lands on the occluding editor content and no-ops).
 * The fix lifts the portal above the takeover. Guard that it stays above 150.
 */
describe('admin-overrides.css — rich-text menu z-index tripwire', () => {
  const css = fs.readFileSync(
    path.resolve(__dirname, 'admin-overrides.css'),
    'utf8',
  );

  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Find the rule whose selector is exactly `marker` (immediately followed by
  // its `{…}` block) and read its z-index. Matching `marker\s*{` skips prose
  // mentions of the selector in comments, which have no block after them.
  const blockOf = (marker: string): string => {
    const rule = css.match(new RegExp(`${escapeRe(marker)}\\s*\\{([^}]*)\\}`));
    expect(rule).not.toBeNull();
    return (rule as RegExpMatchArray)[1];
  };

  const zIndexOf = (marker: string): number => {
    const m = blockOf(marker).match(/z-index:\s*(\d+)/);
    expect(m).not.toBeNull();
    return parseInt((m as RegExpMatchArray)[1], 10);
  };

  it('lifts Puck\'s Radix rich-text popper above the takeover root', () => {
    const popperSel =
      'html[data-puck-takeover] [data-radix-popper-content-wrapper]';
    const popperZ = zIndexOf(popperSel);
    const takeoverZ = zIndexOf('[data-puck-takeover-root]');
    // Strictly above, or the menu options are occluded and un-clickable.
    expect(popperZ).toBeGreaterThan(takeoverZ);
    // Radix writes `z-index: auto` inline on the wrapper, which beats any
    // stylesheet rule without `!important`; drop it and the fix silently dies.
    expect(blockOf(popperSel)).toMatch(/z-index:\s*\d+\s*!important/);
  });
});
