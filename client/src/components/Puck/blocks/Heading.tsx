import type { ComponentConfig } from '@puckeditor/core';
import { Section } from '../components/Section';
import { WithLayout, withLayout } from '../components/Layout';

type HeadingSize = 'xxxxl' | 'xxxl' | 'xxl' | 'xl' | 'l' | 'm' | 's' | 'xs';

export type HeadingProps = WithLayout<{
  align: 'left' | 'center' | 'right';
  text?: string;
  level?: '1' | '2' | '3' | '4' | '5' | '6';
  size: HeadingSize;
}>;

const sizeOptions = [
  { value: 'xxxl', label: 'XXXL' },
  { value: 'xxl', label: 'XXL' },
  { value: 'xl', label: 'XL' },
  { value: 'l', label: 'L' },
  { value: 'm', label: 'M' },
  { value: 's', label: 'S' },
  { value: 'xs', label: 'XS' },
];

const levelOptions = [
  { label: '', value: '' },
  { label: '1', value: '1' },
  { label: '2', value: '2' },
  { label: '3', value: '3' },
  { label: '4', value: '4' },
  { label: '5', value: '5' },
  { label: '6', value: '6' },
];

const fontSizes: Record<HeadingSize, string> = {
  xxxxl: '72px',
  xxxl: '56px',
  xxl: '48px',
  xl: '40px',
  l: '32px',
  m: '24px',
  s: '20px',
  xs: '16px',
};

const HeadingInternal: ComponentConfig<HeadingProps> = {
  fields: {
    text: {
      // No contentEditable — overlay portals break in the takeover frame, see
      // Hero.tsx. (Demo uses textarea; text is fine for a heading.)
      type: 'text',
    },
    size: {
      type: 'select',
      options: sizeOptions,
    },
    level: {
      type: 'select',
      options: levelOptions,
    },
    align: {
      type: 'radio',
      options: [
        { label: 'Left', value: 'left' },
        { label: 'Center', value: 'center' },
        { label: 'Right', value: 'right' },
      ],
    },
  },
  defaultProps: {
    align: 'left',
    text: 'Heading',
    size: 'm',
    layout: {
      padding: '8px',
    },
  },
  render: ({ align, text, size, level }) => {
    const Tag = (level ? `h${level}` : 'span') as any;
    return (
      <Section>
        <Tag
          style={{
            margin: 0,
            fontSize: fontSizes[size] || fontSizes.m,
            fontWeight: 700,
            lineHeight: 1.1,
          }}
        >
          <span style={{ display: 'block', textAlign: align, width: '100%' }}>
            {text}
          </span>
        </Tag>
      </Section>
    );
  },
};

export const Heading = withLayout(HeadingInternal);

export default Heading;
