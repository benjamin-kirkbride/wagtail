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
  Template: { children: StubSlot },
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
