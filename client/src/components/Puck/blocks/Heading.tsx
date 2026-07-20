import type { ComponentConfig } from '@puckeditor/core';
import { WithLayout, withLayout } from '../components/Layout';

type HeadingSize = 'xxxl' | 'xxl' | 'xl' | 'l' | 'm' | 's' | 'xs';

export type HeadingProps = WithLayout<{
  align: 'left' | 'center' | 'right';
  text?: string;
  level?: '1' | '2' | '3' | '4' | '5' | '6';
  size: HeadingSize;
}>;

/**
 * `l` is the neutral size: it emits NO class, so the heading renders at the
 * site's own scale (the marketing site's `.block-heading h2` = 1.3rem, or the
 * fork testapp's `puck-render.css` per-level fallback). This is also the
 * data-compatibility sentinel — the marketing conversion stored `size: "l"` on
 * headings as its default, and those must stay byte-identical (no class). Any
 * other value emits `block-heading--<size>`, whose real-specificity rule in
 * `puck-render.css` (`.block-heading .block-heading--<size>`, 0,2,0) beats the
 * site's `.block-heading h2` (0,1,1) to become a genuine override.
 *
 * `size` no longer has a field (the sidebar offers only the RichText-style
 * level picker), but stored overrides keep rendering — see fields.
 */
const SIZE_SENTINEL = 'l';

/**
 * The same heading choices Puck's RichText toolbar offers, with the same
 * labels ("Heading 1" … "Heading 6" — see RichTextMenu's HeadingSelect
 * use-options.ts), so picking a level here feels identical to picking one in
 * a RichText block. Values stay '1'..'6' for stored-data compatibility.
 */
const levelOptions = [
  { label: 'Heading 1', value: '1' },
  { label: 'Heading 2', value: '2' },
  { label: 'Heading 3', value: '3' },
  { label: 'Heading 4', value: '4' },
  { label: 'Heading 5', value: '5' },
  { label: 'Heading 6', value: '6' },
];

const HeadingInternal: ComponentConfig<HeadingProps> = {
  fields: {
    text: {
      // No contentEditable — overlay portals break in the takeover frame, see
      // Hero.tsx. (Demo uses textarea; text is fine for a heading.)
      type: 'text',
    },
    level: {
      type: 'select',
      options: levelOptions,
    },
    // No `size` field: the sidebar exposes only the RichText-style level
    // picker. Stored `size` overrides (the XXXL–XS system) are still honored
    // by render() for data compatibility, but new overrides can't be authored
    // — the level IS the size, exactly as in a RichText block.
    align: {
      type: 'radio',
      options: [
        { label: 'Left', value: 'left' },
        { label: 'Center', value: 'center' },
        { label: 'Right', value: 'right' },
      ],
    },
  },
  defaultProps: {
    align: 'left',
    text: 'Heading',
    // The site's content heading — same default the render falls back to for
    // stored data with no level.
    level: '2',
    // Neutral size so a fresh heading inherits the site's per-level scale
    // (site default unless explicitly overridden; see render()).
    size: SIZE_SENTINEL,
    layout: {
      padding: '8px',
    },
  },
  render: ({ align, text, level, size }) => {
    // Default to h2 (the site's content heading) rather than a bare span so the
    // markup is semantic and the site's `.block-heading h2` typography applies.
    const Tag = (level ? `h${level}` : 'h2') as any;
    // `l` (neutral) → no class → site scale; anything else → override class.
    const sizeClass =
      size && size !== SIZE_SENTINEL ? `block-heading--${size}` : undefined;
    return (
      <Tag
        className={sizeClass}
        style={align && align !== 'left' ? { textAlign: align } : undefined}
      >
        {text}
      </Tag>
    );
  },
};

/**
 * Renders a clean semantic heading inside a `.block-heading` root (the demo's
 * inline font sizes and Section max-width are dropped) so the site's
 * `.block-heading h2` typography styles it. The level picker mirrors the
 * RichText toolbar's heading dropdown ("Heading 1" … "Heading 6") and is the
 * only size control — each level renders at the site's scale for that level
 * (per-level fallbacks in `puck-render.css`). Stored `size` overrides from the
 * retired XXXL–XS system still render for data compatibility; `align` is a
 * field-driven override that yields to the site's default.
 */
export const Heading = withLayout(HeadingInternal, 'block-heading');

export default Heading;
