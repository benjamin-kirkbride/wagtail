import { render } from '@testing-library/react';
import { buildConfig } from './config';

const config = buildConfig();

const stubPuck = {
  isEditing: false,
  dragRef: null,
  renderDropZone: () => null,
  metadata: {},
};

// Slot props must be a component when rendered outside the Puck runtime.
// Strip Puck-only props (`as`, `disallow`) so React doesn't warn about them.
const StubSlot = ({ as: _as, disallow: _disallow, style }: any) => (
  <div data-testid="slot" style={style} />
);

const slotOverrides: Record<string, Record<string, unknown>> = {
  Flex: { items: StubSlot },
  Grid: { items: StubSlot },
};

function propsFor(name: string) {
  const component = (config.components as Record<string, any>)[name];
  return {
    ...component.defaultProps,
    ...(slotOverrides[name] || {}),
    puck: stubPuck,
  };
}

describe('block render() smoke tests', () => {
  Object.keys(config.components).forEach((name) => {
    it(`${name} renders without throwing`, () => {
      const component = (config.components as Record<string, any>)[name];
      expect(() => {
        const { unmount } = render(component.render(propsFor(name)));
        unmount();
      }).not.toThrow();
    });
  });
});

describe('block spot checks', () => {
  it('Button renders the site CTA markup (.block-cta > .button anchor)', () => {
    const component = (config.components as Record<string, any>).Button;
    const { container, getByText } = render(
      component.render(propsFor('Button')),
    );
    const el = getByText('Button');
    const anchor = el.closest('a');
    expect(anchor).not.toBeNull();
    expect(anchor).toHaveClass('button');
    expect(container.querySelector('.block-cta a.button')).not.toBeNull();
  });

  it('Heading renders its text in a .block-heading root as an h2 by default', () => {
    const component = (config.components as Record<string, any>).Heading;
    const { container, getByText } = render(
      component.render(propsFor('Heading')),
    );
    expect(getByText('Heading')).toBeInTheDocument();
    expect(container.querySelector('.block-heading h2')?.textContent).toBe(
      'Heading',
    );
  });

  it('Hero renders the site hero markup (.block-hero.hero > .hero__heading)', () => {
    const component = (config.components as Record<string, any>).Hero;
    const { container } = render(component.render(propsFor('Hero')));
    const hero = container.querySelector('section.block-hero.hero');
    expect(hero).not.toBeNull();
    expect(hero?.querySelector('.hero__heading')?.textContent).toBe('Hero');
  });

  it('RichText renders inside a .block-paragraph root', () => {
    const component = (config.components as Record<string, any>).RichText;
    const { container } = render(component.render(propsFor('RichText')));
    expect(container.querySelector('.block-paragraph')).not.toBeNull();
  });

  it('Stats renders its items', () => {
    const component = (config.components as Record<string, any>).Stats;
    const { getByText } = render(component.render(propsFor('Stats')));
    expect(getByText('Stat')).toBeInTheDocument();
    expect(getByText('1,000')).toBeInTheDocument();
  });

  it('Logos renders one image per logo', () => {
    const component = (config.components as Record<string, any>).Logos;
    const { container } = render(component.render(propsFor('Logos')));
    expect(container.querySelectorAll('img')).toHaveLength(5);
  });
});

/**
 * Rewiring guards. Each formerly-dead/unstyled field now follows the design
 * contract: at its site-default/sentinel value it emits NO override (so the
 * site CSS owns the look and converted documents stay byte-identical); at an
 * explicit value it emits a winning style/class.
 */
const comp = (name: string) =>
  (config.components as Record<string, any>)[name];

function renderHero(props: Record<string, unknown>) {
  const base = comp('Hero').defaultProps;
  return render(
    comp('Hero').render({ ...base, ...props, puck: stubPuck }),
  );
}

describe('Hero rewired fields', () => {
  it('padding sentinel "64px" emits no inline padding (byte-compat)', () => {
    const { container } = renderHero({ padding: '64px' });
    const hero = container.querySelector('section.block-hero') as HTMLElement;
    expect(hero.getAttribute('style')).toBeNull();
  });

  it('empty padding emits no inline padding', () => {
    const { container } = renderHero({ padding: '' });
    const hero = container.querySelector('section.block-hero') as HTMLElement;
    expect(hero.style.paddingTop).toBe('');
  });

  it('explicit padding emits paddingTop/paddingBottom override', () => {
    const { container } = renderHero({ padding: '96px' });
    const hero = container.querySelector('section.block-hero') as HTMLElement;
    expect(hero.style.paddingTop).toBe('96px');
    expect(hero.style.paddingBottom).toBe('96px');
  });

  it('align "center" (site default) emits no textAlign', () => {
    const { container } = renderHero({ align: 'center' });
    const hero = container.querySelector('section.block-hero') as HTMLElement;
    expect(hero.style.textAlign).toBe('');
  });

  it('align "left" emits a textAlign override', () => {
    const { container } = renderHero({ align: 'left' });
    const hero = container.querySelector('section.block-hero') as HTMLElement;
    expect(hero.style.textAlign).toBe('left');
  });

  it('align "right" emits a textAlign override', () => {
    const { container } = renderHero({ align: 'right' });
    const hero = container.querySelector('section.block-hero') as HTMLElement;
    expect(hero.style.textAlign).toBe('right');
  });

  it('buttons array has no min — a lone button stays deletable', () => {
    const heroFields = comp('Hero').fields as Record<string, any>;
    expect(heroFields.buttons.min).toBeUndefined();
    expect(heroFields.buttons.max).toBe(4);
  });

  it('image inline mode renders <img class="hero__image">, no background', () => {
    const { container } = renderHero({
      image: { mode: 'inline', url: 'http://x/y.png' },
    });
    const hero = container.querySelector('section.block-hero') as HTMLElement;
    expect(container.querySelector('img.hero__image')).not.toBeNull();
    expect(hero.style.backgroundImage).toBe('');
  });

  it('image background mode renders a background image + dark overlay + light text, no <img>', () => {
    const props = {
      ...comp('Hero').defaultProps,
      image: { mode: 'background', url: 'http://x/y.png' },
      description: 'Intro',
      puck: stubPuck,
    };
    // jsdom's CSSOM silently drops the layered `linear-gradient(...), url(...)`
    // value, so inspect the React element's style object directly for the
    // background; mount for everything else.
    const el = comp('Hero').render(props) as any;
    expect(el.props.style.backgroundImage).toContain('url(http://x/y.png)');
    expect(el.props.style.backgroundImage).toContain('linear-gradient'); // dark overlay
    expect(el.props.style.color).toBe('#ffffff'); // readable light text

    const { container } = render(comp('Hero').render(props));
    expect(container.querySelector('img.hero__image')).toBeNull();
    const intro = container.querySelector('.hero__intro') as HTMLElement;
    expect(intro.style.color).toBe('rgb(255, 255, 255)');
  });

  it('button variant "secondary" emits the button--secondary modifier class', () => {
    const { container } = renderHero({
      buttons: [
        { label: 'A', href: '#', variant: 'primary' },
        { label: 'B', href: '#', variant: 'secondary' },
      ],
    });
    const anchors = container.querySelectorAll('.hero__actions a');
    expect(anchors[0].className).toBe('button');
    expect(anchors[1].className).toBe('button button--secondary');
  });

  it('the field help text / placeholder are surfaced (padding label, image url placeholder)', () => {
    const fields = comp('Hero').fields;
    expect(fields.padding.label).toMatch(/Leave as default/i);
    expect(fields.image.objectFields.url.placeholder).toMatch(/image URL/i);
  });
});

describe('Heading size rewired', () => {
  function renderHeading(size: string) {
    const base = comp('Heading').defaultProps;
    return render(
      comp('Heading').render({ ...base, size, puck: stubPuck }),
    );
  }

  it('neutral "l" emits no size class (byte-compat with the site scale)', () => {
    const { container } = renderHeading('l');
    const h = container.querySelector('.block-heading h2') as HTMLElement;
    expect(h.className).toBe('');
  });

  it('"xl" emits block-heading--xl on the heading element', () => {
    const { container } = renderHeading('xl');
    expect(
      container.querySelector('.block-heading .block-heading--xl'),
    ).not.toBeNull();
  });

  it('"xxl" emits block-heading--xxl', () => {
    const { container } = renderHeading('xxl');
    expect(
      container.querySelector('.block-heading .block-heading--xxl'),
    ).not.toBeNull();
  });
});

describe('Text size rewired', () => {
  function renderText(size: string) {
    const base = comp('Text').defaultProps;
    return render(comp('Text').render({ ...base, size, puck: stubPuck }));
  }

  it('neutral "m" emits no size class', () => {
    const { container } = renderText('m');
    const p = container.querySelector('.block-paragraph p') as HTMLElement;
    expect(p.className).toBe('');
  });

  it('"s" emits block-paragraph--s', () => {
    const { container } = renderText('s');
    expect(
      container.querySelector('.block-paragraph .block-paragraph--s'),
    ).not.toBeNull();
  });
});

describe('layout wart: no inert grid-area at default', () => {
  it.each(['Heading', 'Text', 'RichText'])(
    '%s default layout emits no grid-column/grid-row',
    (name) => {
      const { container } = render(
        comp(name).render({ ...comp(name).defaultProps, puck: stubPuck }),
      );
      const root = container.firstElementChild as HTMLElement;
      expect(root.style.gridColumn).toBe('');
      expect(root.style.gridRow).toBe('');
    },
  );

  it('withLayout defaultProps.layout no longer seeds spanCol/spanRow', () => {
    const layout = comp('Heading').defaultProps.layout;
    expect(layout.spanCol).toBeUndefined();
    expect(layout.spanRow).toBeUndefined();
  });

  it('a stored spanCol/spanRow of 1 still renders (byte-compat)', () => {
    const { container } = render(
      comp('Heading').render({
        ...comp('Heading').defaultProps,
        layout: { spanCol: 1, spanRow: 1, padding: '0px' },
        puck: stubPuck,
      }),
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.gridColumn).toBe('span 1');
    expect(root.style.gridRow).toBe('span 1');
  });
});

describe('config warts', () => {
  it('root config exposes no title field (inert duplicate removed)', () => {
    expect(config.root?.fields).toEqual({});
    expect((config.root as any).defaultProps?.title).toBeUndefined();
  });

  it.each(['Logos', 'Stats'])(
    '%s is inline (canvas/published DOM parity)',
    (name) => {
      expect(comp(name).inline).toBe(true);
    },
  );
});
