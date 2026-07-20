/**
 * The link-value contract, shared by every href in the Puck config (the Button
 * block, the Hero buttons, and the RichText link mark).
 *
 * A link is stored as a single href STRING so it drops into a plain `<a href>`,
 * a Puck `text`-style field, or a TipTap link mark without a bespoke data shape:
 *
 *   - Internal page  -> `page:<id>`   (a stable reference, e.g. "page:3")
 *   - External / other -> the URL itself (e.g. "https://…", "/foo/", "#", mailto:)
 *
 * The `page:<id>` token is resolved to the page's live URL at RENDER time in
 * Python (`wagtail/contrib/puck/rendering.py::_resolve_page_links`), not at edit
 * time — so an internal link survives the target page being moved or its slug
 * changing, and the static bake always emits the correct path. The token never
 * reaches a browser: published HTML and the SSR/preview output carry the
 * resolved URL. In the editor canvas the token is inert (Button/Hero blank their
 * hrefs while editing; a RichText anchor is unclickable in edit mode).
 *
 * This module is pure and SSR-safe — no browser globals at import time — because
 * it is pulled into both the editor bundle and the Node SSR bundle via the block
 * config.
 */

/** The sentinel prefix marking an internal-page reference. */
const PAGE_PREFIX = 'page:';

export type LinkKind = 'page' | 'external' | 'empty';

export interface ParsedLink {
  kind: LinkKind;
  /** The raw href string as stored. */
  href: string;
  /** Set only when kind === 'page'. */
  pageId?: number;
  /** The external URL, when kind === 'external' (else ''). */
  url: string;
}

/** The href string for an internal page reference. */
export function pageToken(id: number | string): string {
  return `${PAGE_PREFIX}${id}`;
}

/** True when `href` is an internal-page token (`page:<digits>`). */
export function isPageToken(href: unknown): href is string {
  return typeof href === 'string' && /^page:\d+$/.test(href.trim());
}

/** The page id in a `page:<id>` token, or null if `href` is not one. */
export function pageIdFromToken(href: unknown): number | null {
  if (!isPageToken(href)) return null;
  return parseInt((href as string).trim().slice(PAGE_PREFIX.length), 10);
}

/**
 * Classify a stored href into the shape the LinkEditor edits against. An empty
 * / whitespace / bare-`#` value is treated as "no link" so the editor opens on a
 * clean slate rather than pre-filling a placeholder.
 */
export function parseLink(href: unknown): ParsedLink {
  const raw = typeof href === 'string' ? href.trim() : '';
  if (!raw || raw === '#') {
    return { kind: 'empty', href: raw, url: '' };
  }
  const pageId = pageIdFromToken(raw);
  if (pageId !== null) {
    return { kind: 'page', href: raw, pageId, url: '' };
  }
  return { kind: 'external', href: raw, url: raw };
}
