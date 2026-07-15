import type { ComponentConfig } from '@puckeditor/core';
import { Section } from '../components/Section';
import { ButtonEl } from '../components/ButtonEl';

/**
 * Simplified port of the demo Hero. The demo's `external` quote picker,
 * `resolveData`/`resolveFields` machinery and Puck-native richtext description
 * are dropped for v1 (see plan): description is a plain textarea and the image
 * is a URL text field with inline / background modes. Wagtail image-chooser
 * wiring is future work.
 */
export type HeroProps = {
  title: string;
  description: string;
  align?: 'left' | 'center';
  padding: string;
  image?: {
    mode?: 'inline' | 'background';
    url?: string;
  };
  buttons: {
    label: string;
    href: string;
    variant?: 'primary' | 'secondary';
  }[];
};

export const Hero: ComponentConfig<HeroProps> = {
  fields: {
    title: { type: 'text', contentEditable: true },
    description: { type: 'textarea', contentEditable: true },
    buttons: {
      type: 'array',
      min: 1,
      max: 4,
      getItemSummary: (item) => item.label || 'Button',
      arrayFields: {
        label: { type: 'text', contentEditable: true },
        href: { type: 'text' },
        variant: {
          type: 'select',
          options: [
            { label: 'primary', value: 'primary' },
            { label: 'secondary', value: 'secondary' },
          ],
        },
      },
      defaultItemProps: {
        label: 'Button',
        href: '#',
      },
    },
    align: {
      type: 'radio',
      options: [
        { label: 'left', value: 'left' },
        { label: 'center', value: 'center' },
      ],
    },
    image: {
      type: 'object',
      objectFields: {
        url: { type: 'text' },
        mode: {
          type: 'radio',
          options: [
            { label: 'inline', value: 'inline' },
            { label: 'bg', value: 'background' },
          ],
        },
      },
    },
    padding: { type: 'text' },
  },
  defaultProps: {
    title: 'Hero',
    align: 'left',
    description: 'Description',
    buttons: [{ label: 'Learn more', href: '#' }],
    padding: '64px',
  },
  render: ({ align, title, description, buttons, padding, image, puck }) => {
    const isBackground = image?.mode === 'background' && image?.url;
    const isCentered = align === 'center';

    return (
      <Section
        style={{
          position: 'relative',
          paddingTop: padding,
          paddingBottom: padding,
          color: isBackground ? '#ffffff' : undefined,
        }}
      >
        {isBackground && (
          <>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `url("${image?.url}")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.5)',
              }}
            />
          </>
        )}

        <div
          style={{
            position: 'relative',
            display: 'grid',
            gridTemplateColumns:
              !isCentered && image?.mode === 'inline' && image?.url
                ? '1fr 1fr'
                : '1fr',
            gap: 32,
            alignItems: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              alignItems: isCentered ? 'center' : 'flex-start',
              textAlign: isCentered ? 'center' : 'left',
            }}
          >
            <h1 style={{ margin: 0, fontSize: 48, fontWeight: 700 }}>{title}</h1>
            <div style={{ fontSize: 20, fontWeight: 300 }}>{description}</div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {buttons.map((button, i) => (
                <ButtonEl
                  key={i}
                  href={button.href}
                  variant={button.variant}
                  tabIndex={puck.isEditing ? -1 : undefined}
                >
                  {button.label}
                </ButtonEl>
              ))}
            </div>
          </div>

          {!isCentered && image?.mode === 'inline' && image?.url && (
            <div
              style={{
                backgroundImage: `url('${image?.url}')`,
                backgroundSize: 'cover',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
                borderRadius: 24,
                height: 356,
                marginLeft: 'auto',
                width: '100%',
              }}
            />
          )}
        </div>
      </Section>
    );
  },
};

export default Hero;
