import type { ComponentConfig } from '@puckeditor/core';

export type BlankProps = Record<string, never>;

/**
 * Minimal placeholder / spacer block. The demo's index omits Blank; we
 * register a simple version so the block name resolves.
 *
 * `inline` + `puck.dragRef` on the root (matching every converted block): an
 * inline block whose classed/positioned root IS the drag element gets no Puck
 * wrapper `<div>` in the editor canvas, so the canvas DOM matches the published
 * DOM (see the "site-compatible block markup" note in CLAUDE.md).
 */
export const Blank: ComponentConfig<BlankProps> = {
  label: 'Blank',
  inline: true,
  fields: {},
  defaultProps: {},
  render: ({ puck }) => {
    return <div style={{ minHeight: 24 }} ref={puck.dragRef} />;
  },
};

export default Blank;
