import type { ComponentConfig } from '@puckeditor/core';
import { WithLayout, withLayout } from '../components/Layout';

type HeadingSize = 'xxxxl' | 'xxxl' | 'xxl' | 'xl' | 'l' | 'm' | 's' | 'xs';

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
    size: 'm',
    layout: {
      padding: '8px',
    },
  },
  render: ({ align, text, level }) => {
    // Default to h2 (the site's content heading) rather than a bare span so the
    // markup is semantic and the site's `.block-heading h2` typography applies.
    const Tag = (level ? `h${level}` : 'h2') as any;
    return (
      <Tag
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
 * `.block-heading h2` typography styles it. `size` no longer drives an inline
 * font-size — the site owns heading scale; `align` is kept as a field-driven
 * override that yields to the site's default. Neutral fallback in
 * `puck-render.css`.
 */
export const Heading = withLayout(HeadingInternal, 'block-heading');

export default Heading;
