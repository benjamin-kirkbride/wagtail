import type { ComponentConfig } from '@puckeditor/core';
import { WithLayout, withLayout } from '../components/Layout';

type HeadingSize = 'xxxl' | 'xxl' | 'xl' | 'l' | 'm' | 's' | 'xs';

export type HeadingProps = WithLayout<{
  align: 'left' | 'center' | 'right';
  text?: string;
  level?: '1' | '2' | '3' | '4' | '5' | '6';
  size: HeadingSize;
}>;

const sizeOptions = [
  { value: 'xxxl', label: 'XXXL' },
  { value: 'xxl', label: 'XXL' },
  { value: 'xl', label: 'XL' },
  { value: 'l', label: 'L' },
  { value: 'm', label: 'M' },
  { value: 's', label: 'S' },
  { value: 'xs', label: 'XS' },
];

/**
 * `l` is the neutral size: it emits NO class, so the heading renders at the
 * site's own scale (the marketing site's `.block-heading h2` = 1.3rem, or the
 * fork testapp's `puck-render.css` per-level fallback). This is also the
 * data-compatibility sentinel — the marketing conversion stored `size: "l"` on
 * headings as its default, and those must stay byte-identical (no class). Any
 * other value emits `block-heading--<size>`, whose real-specificity rule in
 * `puck-render.css` (`.block-heading .block-heading--<size>`, 0,2,0) beats the
 * site's `.block-heading h2` (0,1,1) to become a genuine override.
 */
const SIZE_SENTINEL = 'l';

const levelOptions = [
  { label: '', value: '' },
  { label: '1', value: '1' },
  { label: '2', value: '2' },
  { label: '3', value: '3' },
  { label: '4', value: '4' },
  { label: '5', value: '5' },
  { label: '6', value: '6' },
];

const HeadingInternal: ComponentConfig<HeadingProps> = {
  fields: {
    text: {
      // No contentEditable — overlay portals break in the takeover frame, see
      // Hero.tsx. (Demo uses textarea; text is fine for a heading.)
      type: 'text',
    },
    size: {
      type: 'select',
      options: sizeOptions,
    },
    level: {
      type: 'select',
      options: levelOptions,
    },
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
    // Default to the neutral size so a fresh heading inherits the site's scale
    // (site default unless explicitly overridden).
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
 * `.block-heading h2` typography styles it. `size` drives a `block-heading--*`
 * modifier class (not an inline font-size) that yields to the site scale at the
 * neutral `l` value and overrides it otherwise via a real-specificity rule in
 * `puck-render.css`; `align` is a field-driven override that yields to the
 * site's default. Neutral / per-level fallbacks live in `puck-render.css`.
 */
export const Heading = withLayout(HeadingInternal, 'block-heading');

export default Heading;
