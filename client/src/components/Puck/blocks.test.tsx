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
  it('Button renders an anchor with the label', () => {
    const component = (config.components as Record<string, any>).Button;
    const { getByText } = render(component.render(propsFor('Button')));
    const el = getByText('Button');
    expect(el.closest('a')).not.toBeNull();
  });

  it('Heading renders its text', () => {
    const component = (config.components as Record<string, any>).Heading;
    const { getByText } = render(component.render(propsFor('Heading')));
    expect(getByText('Heading')).toBeInTheDocument();
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
