import type { ComponentConfig } from '@puckeditor/core';

export type BlankProps = Record<string, never>;

/**
 * Minimal placeholder / spacer block. The demo's index omits Blank; we
 * register a simple version so the block name resolves.
 */
export const Blank: ComponentConfig<BlankProps> = {
  label: 'Blank',
  fields: {},
  defaultProps: {},
  render: () => {
    return <div style={{ minHeight: 24 }} />;
  },
};

export default Blank;
