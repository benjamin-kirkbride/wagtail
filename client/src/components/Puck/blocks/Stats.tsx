import type { ComponentConfig } from '@puckeditor/core';
import { Section } from '../components/Section';

export type StatsProps = {
  items: {
    title: string;
    description: string;
  }[];
};

export const Stats: ComponentConfig<StatsProps> = {
  // `inline` + `puck.dragRef` on the root (forwarded to Section's outer div) so
  // the editor canvas gets no extra Puck wrapper and matches the published DOM,
  // like every other converted block (see CLAUDE.md).
  inline: true,
  fields: {
    items: {
      type: 'array',
      getItemSummary: (item, i) =>
        item.title && item.description ? (
          <>
            {item.title} ({item.description})
          </>
        ) : (
          `Feature #${i}`
        ),
      defaultItemProps: {
        title: 'Stat',
        description: '1,000',
      },
      arrayFields: {
        title: {
          type: 'text',
        },
        description: {
          type: 'text',
        },
      },
    },
  },
  defaultProps: {
    items: [
      {
        title: 'Stat',
        description: '1,000',
      },
    ],
  },
  render: ({ items, puck }) => {
    return (
      <Section maxWidth="916px" ref={puck.dragRef}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 24,
          }}
        >
          {items.map((item, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: 8,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--puck-color-grey-05, #6b7280)',
                }}
              >
                {item.title}
              </div>
              <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 1 }}>
                {item.description}
              </div>
            </div>
          ))}
        </div>
      </Section>
    );
  },
};

export default Stats;
