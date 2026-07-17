import type { ComponentConfig } from '@puckeditor/core';

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
 * Presentational font sizes, the fixed section max-width and the demo grid are
 * dropped so they don't fight the site CSS; the `align` field is left to the
 * site's hero styling. Fallback defaults for classless environments (the fork
 * testapp) live in `puck-render.css`.
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
      min: 1,
      max: 4,
      getItemSummary: (item) => item.label || 'Button',
      arrayFields: {
        label: { type: 'text' },
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
  inline: true,
  defaultProps: {
    title: 'Hero',
    align: 'left',
    description: 'Description',
    buttons: [],
    padding: '64px',
  },
  render: ({ title, description, buttons, image, puck }) => {
    return (
      <section className="block-hero hero" ref={puck.dragRef}>
        {title ? <h1 className="hero__heading">{title}</h1> : null}
        {description ? <p className="hero__intro">{description}</p> : null}
        {image?.url ? (
          <img className="hero__image" src={image.url} alt="" />
        ) : null}
        {buttons && buttons.length ? (
          <p className="hero__actions">
            {buttons.map((button, i) => (
              <a
                key={i}
                className="button"
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
