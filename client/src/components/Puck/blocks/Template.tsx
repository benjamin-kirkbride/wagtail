import type { ComponentConfig, Slot } from '@puckeditor/core';
import { Section } from '../components/Section';
import { WithLayout, withLayout } from '../components/Layout';

/**
 * Simplified static port of the demo Template block. The demo generated
 * children from saved localStorage templates via `resolveData` /
 * `createComponent`; for v1 this is just a static slot container (see plan).
 */
export type TemplateProps = WithLayout<{
  children: Slot;
}>;

const TemplateInternal: ComponentConfig<TemplateProps> = {
  fields: {
    children: {
      type: 'slot',
    },
  },
  defaultProps: {
    children: [],
  },
  render: ({ children: Children }) => {
    return (
      <Section>
        <Children />
      </Section>
    );
  },
};

export const Template = withLayout(TemplateInternal);

export default Template;
