import type { ComponentConfig } from '@puckeditor/core';
import { linkField } from '../links/LinkField';
import { WithLayout, withLayout } from '../components/Layout';

export type ButtonProps = WithLayout<{
  label: string;
  href: string;
  variant: 'primary' | 'secondary';
}>;

/**
 * Emits the site's call-to-action markup — a `.block-cta` wrapper around a
 * `.button` link — matching the old StreamField `cta` block, so the site's
 * `.block-cta` / `.button` rules style it. `withLayout` supplies the
 * `.block-cta` root, `puck.dragRef`, and the Top Padding field, like every
 * other block — CTA spacing used to be a fixed `margin-top` baked into
 * `.block-cta` in site.css, which no field could touch; that's gone, so this
 * block's own top space is field-driven like everything else. Neutral
 * fallback styling lives in `puck-render.css`. The `variant` field is carried
 * as a `button--secondary` modifier class so a site can distinguish the two
 * without inline styles.
 */
const ButtonInternal: ComponentConfig<ButtonProps> = {
  label: 'Button',
  fields: {
    label: {
      type: 'text',
      placeholder: 'Lorem ipsum...',
    },
    href: linkField('Link'),
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
    layout: {
      padding: '2rem',
    },
  },
  render: ({ href, variant, label, puck }) => {
    const cls = variant === 'secondary' ? 'button button--secondary' : 'button';
    return (
      <p>
        <a
          className={cls}
          href={puck.isEditing ? '#' : href}
          tabIndex={puck.isEditing ? -1 : undefined}
        >
          {label}
        </a>
      </p>
    );
  },
};

export const Button = withLayout(ButtonInternal, 'block-cta');

export default Button;
