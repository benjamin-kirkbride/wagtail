import type { ComponentConfig } from '@puckeditor/core';
import type { CSSProperties } from 'react';
import { linkField } from '../links/LinkField';
import { spacingOptions } from '../components/options';

/**
 * Simplified port of the demo Hero. The demo's `external` quote picker,
 * `resolveData`/`resolveFields` machinery and Puck-native richtext description
 * are dropped for v1 (see plan): description is a plain textarea and the image
 * is a URL text field. Wagtail image-chooser wiring is future work.
 *
 * The render emits the site's own hero markup — a `.block-hero.hero` root with
 * `.hero__heading` / `.hero__intro` children and `.button` CTAs — instead of the
 * demo's inline-styled generic layout, so a consuming site's stylesheet (the
 * `.block-hero` / `.hero__*` rules) styles it directly. The block is `inline`
 * and attaches `puck.dragRef` to its root so, in the editor canvas, Puck adds no
 * wrapper and the `.block-hero` element stays a direct child of the content
 * column (matching the published page, where the site's `> *` measure applies).
 * Fallback defaults for classless environments (the fork testapp) live in
 * `puck-render.css`.
 *
 * Design contract for the field-driven overrides ("site default unless
 * explicitly overridden"): at its site-default/empty value, `align` emits NO
 * inline style, so the site CSS owns the look; only an explicit non-default
 * value emits a winning inline override. `padding` is different — it's always
 * emitted, literally, as `paddingTop`, same as every other block's Top
 * Padding field (see `Layout.tsx`): no block gets inherent CSS padding, so
 * `.stream > .block-hero` carries no `padding-top` of its own.
 *
 * `align`: `"center"` is the site default (emit nothing); `"left"` and
 * `"right"` emit real inline overrides. (An earlier revision aliased legacy
 * `"left"` to the default to protect conversion-artifact data, but the only
 * live hero now stores an explicit `"center"`, so `"left"` is honored as
 * editorial intent.)
 */
export type HeroProps = {
  title: string;
  description: string;
  align?: 'left' | 'center' | 'right';
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

/** The default top padding for a fresh Hero — matches the site's old fixed 5rem. */
const PADDING_DEFAULT = '5rem';

export const Hero: ComponentConfig<HeroProps> = {
  fields: {
    // No `contentEditable: true` on ANY field in this config: Puck renders
    // inline-editable props through overlay-portal spans backed by its
    // internal <Canvas> layer, which is not part of the compositional API our
    // takeover frame is built from — so those spans render empty after any
    // prop change (the block's text "disappears" in the canvas while the data
    // stays intact). All text is edited via the fields sidebar instead.
    title: { type: 'text' },
    description: { type: 'textarea' },
    buttons: {
      type: 'array',
      // No `min`: a hero with zero buttons is valid (the live homepage hero
      // has none) — and with min: 1, adding a first button made it undeletable.
      max: 4,
      getItemSummary: (item) => item.label || 'Button',
      arrayFields: {
        label: { type: 'text' },
        href: linkField('Link'),
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
        variant: 'primary',
      },
    },
    align: {
      type: 'radio',
      // Natural reading order (matches Heading/Text); the DEFAULT is still
      // "center" via defaultProps — the site's hero is centered by design.
      options: [
        { label: 'Left', value: 'left' },
        { label: 'Center', value: 'center' },
        { label: 'Right', value: 'right' },
      ],
    },
    image: {
      type: 'object',
      objectFields: {
        // Puck has no dedicated "help text" field prop; the placeholder carries
        // the "Paste an image URL" hint (only meaningful once a URL is set —
        // the URL feeds either the inline `<img>` or the background mode).
        url: { type: 'text', placeholder: 'Paste an image URL' },
        mode: {
          type: 'radio',
          options: [
            { label: 'inline', value: 'inline' },
            { label: 'bg', value: 'background' },
          ],
        },
      },
    },
    // A `select`, matching the dropdown every other block's shared `layout`
    // field uses (see `Layout.tsx`) — this used to be a free-text input,
    // which was inconsistent.
    padding: {
      type: 'select',
      label: 'Top Padding',
      options: [
        { label: '0rem', value: '0rem' },
        ...spacingOptions.map((option) =>
          option.value === PADDING_DEFAULT
            ? { ...option, label: `${option.label} (default)` }
            : option,
        ),
      ],
    },
  },
  inline: true,
  defaultProps: {
    title: 'Hero',
    align: 'center',
    description: 'Description',
    buttons: [],
    padding: PADDING_DEFAULT,
    image: { mode: 'inline' },
  },
  render: ({ title, description, align, padding, buttons, image, puck }) => {
    const isBackground = image?.mode === 'background' && !!image?.url;

    // "center" is the site default (site CSS centers the hero — emit nothing);
    // "left"/"right" are real overrides (see the block doc-comment).
    const alignOverride =
      align === 'right' || align === 'left' ? align : undefined;
    const sectionStyle: CSSProperties = {};
    if (padding) {
      sectionStyle.paddingTop = padding;
    }
    if (alignOverride) {
      sectionStyle.textAlign = alignOverride;
    }
    if (isBackground) {
      // Restore the pre-restyle "background" mode: the image behind a dark
      // overlay (layered gradient) with readable light text.
      sectionStyle.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0.55)), url(${image!.url})`;
      sectionStyle.backgroundSize = 'cover';
      sectionStyle.backgroundPosition = 'center';
      sectionStyle.color = '#ffffff';
    }
    const hasStyle = Object.keys(sectionStyle).length > 0;

    // In background mode the site's muted intro colour must yield to light text.
    const introStyle: CSSProperties | undefined = isBackground
      ? { color: '#ffffff' }
      : undefined;

    return (
      <section
        className="block-hero hero"
        style={hasStyle ? sectionStyle : undefined}
        ref={puck.dragRef}
      >
        {title ? <h1 className="hero__heading">{title}</h1> : null}
        {description ? (
          <p className="hero__intro" style={introStyle}>
            {description}
          </p>
        ) : null}
        {!isBackground && image?.url ? (
          <img className="hero__image" src={image.url} alt="" />
        ) : null}
        {buttons && buttons.length ? (
          <p className="hero__actions">
            {buttons.map((button, i) => (
              <a
                key={i}
                className={
                  button.variant === 'secondary'
                    ? 'button button--secondary'
                    : 'button'
                }
                href={puck.isEditing ? '#' : button.href}
                tabIndex={puck.isEditing ? -1 : undefined}
              >
                {button.label}
              </a>
            ))}
          </p>
        ) : null}
      </section>
    );
  },
};

export default Hero;
