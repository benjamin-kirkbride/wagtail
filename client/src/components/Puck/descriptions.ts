/**
 * One-line editor-facing descriptions for every block, shown in the right
 * sidebar above the selected block's properties. Keyed by component type
 * (must cover every component in `buildConfig()` — enforced by
 * descriptions.test.ts).
 */
export const BLOCK_DESCRIPTIONS: Record<string, string> = {
  Button: 'A call-to-action link styled as a button. Link to a page on this site or an external URL.',
  Card: 'An icon with a title and a short description. Works well in a grid of features.',
  Flex: 'A flexible container that lays out the blocks inside it in a row or column.',
  Grid: 'A column grid container. Blocks placed inside are arranged into equal columns.',
  Heading: 'A section heading. Pick a level (Heading 1–6), just like headings in a RichText block.',
  Hero: "The page's lead banner: a large title with intro text, optional buttons and an image.",
  Logos: 'A row of logos, each an image with alt text.',
  RichText: 'Formatted text with bold, italics, links and lists. Edit it directly in the canvas.',
  Space: 'Invisible spacing between blocks. Use it to add breathing room to a layout.',
  Stats: 'A row of statistics — each a value with a label underneath.',
  Text: 'A plain paragraph of body text.',
};

/** Shown when nothing is selected (the page root). */
export const PAGE_DESCRIPTION =
  'Page-level properties. Select a block in the canvas to edit its settings.';
