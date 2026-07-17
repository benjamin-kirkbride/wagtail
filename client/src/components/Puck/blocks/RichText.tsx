import type { ComponentConfig } from '@puckeditor/core';
import { WithLayout, withLayout } from '../components/Layout';

export type RichTextProps = WithLayout<{
  richtext?: string;
}>;

const RichTextInner: ComponentConfig<RichTextProps> = {
  fields: {
    richtext: {
      type: 'richtext',
    },
  },
  render: ({ richtext }) => {
    return <>{richtext}</>;
  },
  defaultProps: {
    richtext: '<h2>Heading</h2><p>Body</p>',
  },
};

/**
 * Body prose. Rendered inside a `.block-paragraph` root (mapping to the old
 * StreamField `paragraph` block) so the site's `.block-paragraph p` /
 * `.block-paragraph strong` typography styles the Puck rich-text HTML (which
 * Puck emits inside its own `.rich-text` wrapper). The demo Section max-width is
 * dropped — the content column measure comes from the site. Neutral fallback in
 * `puck-render.css`.
 */
export const RichText = withLayout(RichTextInner, 'block-paragraph');

export default RichText;
