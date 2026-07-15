import type { ComponentConfig } from '@puckeditor/core';
import { spacingOptions } from '../components/options';

export type SpaceProps = {
  direction?: '' | 'vertical' | 'horizontal';
  size: string;
};

export const Space: ComponentConfig<SpaceProps> = {
  label: 'Space',
  fields: {
    size: {
      type: 'select',
      options: spacingOptions,
    },
    direction: {
      type: 'radio',
      options: [
        { value: 'vertical', label: 'Vertical' },
        { value: 'horizontal', label: 'Horizontal' },
        { value: '', label: 'Both' },
      ],
    },
  },
  defaultProps: {
    direction: '',
    size: '24px',
  },
  inline: true,
  render: ({ direction, size, puck }) => {
    const style: Record<string, string> = {};
    if (direction === 'vertical' || direction === '') {
      style.height = size;
    }
    if (direction === 'horizontal' || direction === '') {
      style.width = size;
    }
    return <div ref={puck.dragRef} style={style} />;
  },
};

export default Space;
