import type { ComponentConfig } from '@puckeditor/core';
import { ButtonEl } from '../components/ButtonEl';

export type ButtonProps = {
  label: string;
  href: string;
  variant: 'primary' | 'secondary';
};

export const Button: ComponentConfig<ButtonProps> = {
  label: 'Button',
  fields: {
    label: {
      type: 'text',
      placeholder: 'Lorem ipsum...',
    },
    href: { type: 'text' },
    variant: {
      type: 'radio',
      options: [
        { label: 'primary', value: 'primary' },
        { label: 'secondary', value: 'secondary' },
      ],
    },
  },
  defaultProps: {
    label: 'Button',
    href: '#',
    variant: 'primary',
  },
  render: ({ href, variant, label, puck }) => {
    return (
      <div>
        <ButtonEl
          href={puck.isEditing ? '#' : href}
          variant={variant}
          tabIndex={puck.isEditing ? -1 : undefined}
        >
          {label}
        </ButtonEl>
      </div>
    );
  },
};

export default Button;
