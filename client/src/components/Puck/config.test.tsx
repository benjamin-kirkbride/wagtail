import { buildConfig, defaultData, normalizeData } from './config';

const EXPECTED_BLOCKS = [
  'Blank',
  'Button',
  'Card',
  'Flex',
  'Grid',
  'Heading',
  'Hero',
  'Logos',
  'RichText',
  'Space',
  'Stats',
  'Template',
  'Text',
];

describe('buildConfig', () => {
  const config = buildConfig();

  it('registers all 13 expected blocks', () => {
    expect(Object.keys(config.components).sort()).toEqual(
      [...EXPECTED_BLOCKS].sort(),
    );
  });

  it('provides a root config with a render function', () => {
    expect(config.root).toBeDefined();
    expect(typeof config.root?.render).toBe('function');
  });

  it('gives every component fields and a render function', () => {
    EXPECTED_BLOCKS.forEach((name) => {
      const component = (config.components as Record<string, any>)[name];
      expect(component).toBeDefined();
      expect(component.fields).toBeDefined();
      expect(typeof component.render).toBe('function');
    });
  });

  it('exposes categories', () => {
    expect(config.categories).toBeDefined();
    expect(config.categories?.layout).toBeDefined();
  });
});

describe('defaultData', () => {
  it('is a well-formed empty Puck document', () => {
    expect(Array.isArray(defaultData.content)).toBe(true);
    expect(defaultData.content).toHaveLength(0);
    expect(defaultData.root).toEqual({ props: {} });
  });
});

describe('normalizeData', () => {
  it('normalizes null / empty / {} to a valid doc', () => {
    for (const input of [null, undefined, {}, '', 42, []]) {
      const out = normalizeData(input as unknown);
      expect(Array.isArray(out.content)).toBe(true);
      expect(out.root).toBeDefined();
    }
  });

  it('preserves valid content and root', () => {
    const doc = {
      content: [{ type: 'Heading', props: { id: 'x', text: 'Hi' } }],
      root: { props: { title: 'T' } },
    };
    const out = normalizeData(doc);
    expect(out.content).toHaveLength(1);
    expect(out.root).toEqual({ props: { title: 'T' } });
  });

  it('coerces a missing content array to []', () => {
    const out = normalizeData({ root: { props: {} } });
    expect(out.content).toEqual([]);
  });
});
