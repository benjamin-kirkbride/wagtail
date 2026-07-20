import {
  isPageToken,
  pageIdFromToken,
  pageToken,
  parseLink,
} from './linkValue';

describe('link value contract (page:<id> tokens)', () => {
  it('formats a page token from a number or string id', () => {
    expect(pageToken(3)).toBe('page:3');
    expect(pageToken('42')).toBe('page:42');
  });

  it('recognises page tokens and rejects everything else', () => {
    expect(isPageToken('page:3')).toBe(true);
    expect(isPageToken('  page:12  ')).toBe(true);
    expect(isPageToken('page:')).toBe(false);
    expect(isPageToken('page:abc')).toBe(false);
    expect(isPageToken('/page:3/')).toBe(false);
    expect(isPageToken('https://example.com')).toBe(false);
    expect(isPageToken(undefined)).toBe(false);
    expect(isPageToken(123 as unknown)).toBe(false);
  });

  it('extracts the id from a token, else null', () => {
    expect(pageIdFromToken('page:7')).toBe(7);
    expect(pageIdFromToken('https://x')).toBeNull();
    expect(pageIdFromToken('#')).toBeNull();
  });

  it('parseLink classifies empty / page / external', () => {
    expect(parseLink('').kind).toBe('empty');
    expect(parseLink('   ').kind).toBe('empty');
    expect(parseLink('#').kind).toBe('empty');

    const page = parseLink('page:5');
    expect(page.kind).toBe('page');
    expect(page.pageId).toBe(5);
    expect(page.href).toBe('page:5');

    const ext = parseLink('https://example.com/a');
    expect(ext.kind).toBe('external');
    expect(ext.url).toBe('https://example.com/a');
    expect(ext.href).toBe('https://example.com/a');
  });

  it('parseLink treats a relative path as external (not a page token)', () => {
    const rel = parseLink('/whats-included/');
    expect(rel.kind).toBe('external');
    expect(rel.url).toBe('/whats-included/');
  });
});
