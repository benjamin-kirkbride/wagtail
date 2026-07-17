import { buildConfig } from './config';
import { BLOCK_DESCRIPTIONS, PAGE_DESCRIPTION } from './descriptions';

describe('block descriptions', () => {
  it('covers every component in the config, with no stale extras', () => {
    const types = Object.keys(buildConfig().components).sort();
    expect(Object.keys(BLOCK_DESCRIPTIONS).sort()).toEqual(types);
  });

  it('every description is a non-empty sentence', () => {
    Object.entries(BLOCK_DESCRIPTIONS).forEach(([type, desc]) => {
      expect(desc.length).toBeGreaterThan(10);
      expect(desc.endsWith('.')).toBe(true);
    });
    expect(PAGE_DESCRIPTION.length).toBeGreaterThan(10);
  });
});
