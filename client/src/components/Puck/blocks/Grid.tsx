import type { ComponentConfig, Slot } from '@puckeditor/core';
import { Section } from '../components/Section';
import { withLayout } from '../components/Layout';

export type GridProps = {
  numColumns: number;
  gap: number;
  items: Slot;
};

const CustomSlot = (props: any) => {
  return <span {...props} />;
};

export const GridInternal: ComponentConfig<GridProps> = {
  fields: {
    numColumns: {
      type: 'number',
      label: 'Number of columns',
      min: 1,
      max: 12,
    },
    gap: {
      label: 'Gap',
      type: 'number',
      min: 0,
    },
    items: {
      type: 'slot',
    },
  },
  defaultProps: {
    numColumns: 4,
    gap: 24,
    items: [],
  },
  render: ({ gap, numColumns, items: Items }) => {
    return (
      <Section>
        <Items
          as={CustomSlot}
          disallow={['Hero', 'Stats']}
          style={{
            display: 'grid',
            gap,
            gridTemplateColumns: `repeat(${numColumns}, 1fr)`,
          }}
        />
      </Section>
    );
  },
};

export const Grid = withLayout(GridInternal);

export default Grid;
