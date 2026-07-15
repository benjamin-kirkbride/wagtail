import type { ComponentConfig } from '@puckeditor/core';
import { Section } from '../components/Section';

export type LogosProps = {
  logos: {
    alt: string;
    imageUrl: string;
  }[];
};

const GOOGLE_LOGO =
  'https://logolook.net/wp-content/uploads/2021/06/Google-Logo.png';

export const Logos: ComponentConfig<LogosProps> = {
  fields: {
    logos: {
      type: 'array',
      getItemSummary: (item, i) => item.alt || `Feature #${i}`,
      defaultItemProps: {
        alt: '',
        imageUrl: '',
      },
      arrayFields: {
        alt: { type: 'text' },
        imageUrl: { type: 'text' },
      },
    },
  },
  defaultProps: {
    logos: [
      { alt: 'google', imageUrl: GOOGLE_LOGO },
      { alt: 'google', imageUrl: GOOGLE_LOGO },
      { alt: 'google', imageUrl: GOOGLE_LOGO },
      { alt: 'google', imageUrl: GOOGLE_LOGO },
      { alt: 'google', imageUrl: GOOGLE_LOGO },
    ],
  },
  render: ({ logos }) => {
    return (
      <Section>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 32,
          }}
        >
          {logos.map((item, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                style={{ maxWidth: '100%', objectFit: 'contain' }}
                alt={item.alt}
                src={item.imageUrl}
                height={64}
              />
            </div>
          ))}
        </div>
      </Section>
    );
  },
};

export default Logos;
