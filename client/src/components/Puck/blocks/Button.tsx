import type { ComponentConfig } from '@puckeditor/core';

export type ButtonProps = {
  label: string;
  href: string;
  variant: 'primary' | 'secondary';
};

/**
 * Emits the site's call-to-action markup — a `.block-cta` wrapper around a
 * `.button` link — matching the old StreamField `cta` block, so the site's
 * `.block-cta` / `.button` rules style it. `inline` + `puck.dragRef` on the root
 * keep `.block-cta` a direct child of the content column in the editor canvas
 * (as on the published page). Neutral fallback styling lives in
 * `puck-render.css`. The `variant` field is carried as a `button--secondary`
 * modifier class so a site can distinguish the two without inline styles.
 */
export const Button: ComponentConfig<ButtonProps> = {
  label: 'Button',
  inline: true,
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
    const cls = variant === 'secondary' ? 'button button--secondary' : 'button';
    return (
      <div className="block-cta" ref={puck.dragRef}>
        <p>
          <a
            className={cls}
            href={puck.isEditing ? '#' : href}
            tabIndex={puck.isEditing ? -1 : undefined}
          >
            {label}
          </a>
        </p>
      </div>
    );
  },
};

export default Button;
