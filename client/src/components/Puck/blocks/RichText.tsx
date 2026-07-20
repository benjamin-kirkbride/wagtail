import type { ComponentConfig } from '@puckeditor/core';
import { WithLayout, withLayout } from '../components/Layout';
import { renderRichTextMenu } from '../links/richTextLink';

export type RichTextProps = WithLayout<{
  richtext?: string;
}>;

const RichTextInner: ComponentConfig<RichTextProps> = {
  fields: {
    richtext: {
      type: 'richtext',
      // Append a Link/Unlink control (external URL + internal-page picker) to
      // Puck's default rich-text toolbar. See links/richTextLink.tsx.
      renderMenu: renderRichTextMenu,
      // Puck registers TipTap's Link extension, whose URI validation rejects
      // unknown schemes. Register the `page` pseudo-scheme so an internal-page
      // token (`page:<id>`, see linkValue.ts) is a valid href; it is resolved
      // to a real URL at render time in Python. (Puck passes this straight to
      // Link.configure, so the extension's autolink/paste defaults are kept.)
      options: {
        link: { protocols: ['page'] },
      },
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
