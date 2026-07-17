/**
 * Config invariants for the Puck integration.
 *
 * The load-bearing one guards the contentEditable overlay-portal bug
 * (commit 382f6af3fe, second part): Puck renders inline-editable props through
 * overlay-portal spans backed by its internal <Canvas> layer, which is NOT part
 * of the compositional API the takeover frame is built from — so any field with
 * `contentEditable: true` renders empty after a prop change (text "disappears"
 * from the canvas while the stored data stays intact). The rule is absolute:
 * NO field, anywhere in the config — top level, arrayFields, or objectFields —
 * may set contentEditable. All text is edited through the fields sidebar.
 *
 * We walk every component's fields recursively and assert that invariant, plus a
 * cheap belt that the 13 blocks and the root config are all present.
 */
import { buildConfig } from './config';

type Field = Record<string, any>;

/**
 * Collect [path, field] for every field in the config, descending through
 * `arrayFields` and `objectFields` so nested fields are covered too.
 */
function walkFields(
  fields: Record<string, Field> | undefined,
  prefix: string,
  out: Array<[string, Field]>,
) {
  if (!fields) return;
  for (const [name, field] of Object.entries(fields)) {
    const path = `${prefix}.${name}`;
    out.push([path, field]);
    if (field && typeof field === 'object') {
      if (field.arrayFields) {
        walkFields(field.arrayFields, `${path}[]`, out);
      }
      if (field.objectFields) {
        walkFields(field.objectFields, path, out);
      }
    }
  }
}

describe('Puck config invariants', () => {
  const config = buildConfig();

  it('registers all 13 blocks and the root config', () => {
    const EXPECTED = [
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
    expect(Object.keys(config.components).sort()).toEqual([...EXPECTED].sort());
    expect(Object.keys(config.components)).toHaveLength(13);
    expect(config.root).toBeDefined();
  });

  it('never sets contentEditable on any field (overlay-portal bug guard)', () => {
    const offenders: string[] = [];
    for (const [name, component] of Object.entries<any>(config.components)) {
      const collected: Array<[string, Field]> = [];
      walkFields(component.fields, name, collected);
      for (const [path, field] of collected) {
        if (field && field.contentEditable) {
          offenders.push(path);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('walks nested array/object fields (guard has real coverage, not a no-op)', () => {
    // Sanity check the walker actually descends: Hero has an array field
    // (buttons -> label/href) and an object field (image -> url/mode), so the
    // recursion must surface those nested field paths.
    const collected: Array<[string, Field]> = [];
    walkFields((config.components as any).Hero.fields, 'Hero', collected);
    const paths = collected.map(([p]) => p);
    expect(paths).toContain('Hero.buttons[].label');
    expect(paths).toContain('Hero.image.url');
  });
});
