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
  render: ({ align, color, text, maxWidth }) => {
    return (
      <p
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
 * size / flex span wrapper are dropped). `align`, `maxWidth` and a muted
 * `color` remain field-driven overrides that yield to the site's defaults.
 * Neutral fallback in `puck-render.css`.
 */
export const Text = withLayout(TextInner, 'block-paragraph');

export default Text;
