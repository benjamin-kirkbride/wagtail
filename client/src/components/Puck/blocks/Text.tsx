import { ALargeSmall, AlignLeft } from 'lucide-react';
import type { ComponentConfig } from '@puckeditor/core';
import { WithLayout, withLayout } from '../components/Layout';

export type TextProps = WithLayout<{
  align: 'left' | 'center' | 'right';
  text?: string;
  padding?: string;
  size?: 's' | 'm';
  color: 'default' | 'muted';
  maxWidth?: string;
}>;

const TextInner: ComponentConfig<TextProps> = {
  fields: {
    text: {
      // No contentEditable — overlay portals break in the takeover frame, see
      // Hero.tsx.
      type: 'textarea',
    },
    size: {
      type: 'select',
      labelIcon: <ALargeSmall size={16} />,
      options: [
        { label: 'S', value: 's' },
        { label: 'M', value: 'm' },
      ],
    },
    align: {
      type: 'radio',
      labelIcon: <AlignLeft size={16} />,
      options: [
        { label: 'Left', value: 'left' },
        { label: 'Center', value: 'center' },
        { label: 'Right', value: 'right' },
      ],
    },
    color: {
      type: 'radio',
      options: [
        { label: 'Default', value: 'default' },
        { label: 'Muted', value: 'muted' },
      ],
    },
    maxWidth: { type: 'text' },
  },
  defaultProps: {
    align: 'left',
    text: 'Text',
    size: 'm',
    color: 'default',
  },
  render: ({ align, color, text, maxWidth, size }) => {
    // `m` (default) is neutral → no class → site body scale; `s` emits
    // `block-paragraph--s`, whose real-specificity rule in `puck-render.css`
    // (`.block-paragraph .block-paragraph--s`, 0,2,0) beats the site's
    // `.block-paragraph p` (0,1,1).
    const sizeClass = size && size !== 'm' ? `block-paragraph--${size}` : undefined;
    return (
      <p
        className={sizeClass}
        style={{
          margin: 0,
          textAlign: align && align !== 'left' ? align : undefined,
          maxWidth: maxWidth || undefined,
          color: color === 'muted' ? 'var(--muted, #5b6068)' : undefined,
        }}
      >
        {text}
      </p>
    );
  },
};

/**
 * Plain body text. Rendered as a semantic `<p>` inside a `.block-paragraph`
 * root so it inherits the site's body typography (the demo's inline font
 * size / flex span wrapper are dropped). `size` drives a `block-paragraph--*`
 * modifier class (neutral at `m`, overriding via a real-specificity rule in
 * `puck-render.css` otherwise); `align`, `maxWidth` and a muted `color` remain
 * field-driven overrides that yield to the site's defaults. Neutral fallback in
 * `puck-render.css`.
 */
export const Text = withLayout(TextInner, 'block-paragraph');

export default Text;
