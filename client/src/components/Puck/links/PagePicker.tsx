import { useCallback, useEffect, useRef, useState } from 'react';
import { getLinkRuntime } from './runtime';

/** A page as surfaced to the picker UI. */
export interface PickedPage {
  id: number;
  title: string;
  url: string;
}

interface ApiPage {
  id: number;
  title: string;
  admin_display_title?: string;
  meta?: { html_url?: string | null };
}

/** Build a listing URL with query params against the configured pages API. */
function listingUrl(params: Record<string, string>): string {
  const base = getLinkRuntime().pagesApiUrl;
  const qs = new URLSearchParams({
    fields: 'admin_display_title',
    limit: '20',
    ...params,
  }).toString();
  return `${base}${base.includes('?') ? '&' : '?'}${qs}`;
}

function toPicked(item: ApiPage): PickedPage {
  return {
    id: item.id,
    title: item.admin_display_title || item.title || `Page ${item.id}`,
    url: (item.meta && item.meta.html_url) || '',
  };
}

/**
 * Fetch a single page's display info by id — used to label an existing internal
 * link (`page:<id>`) when the editor reopens it. Returns null on any failure so
 * callers can fall back to a generic label.
 */
export async function fetchPageById(id: number): Promise<PickedPage | null> {
  try {
    const base = getLinkRuntime().pagesApiUrl;
    const url = `${base}${id}/?fields=admin_display_title`;
    const resp = await fetch(url, { credentials: 'same-origin' });
    if (!resp.ok) return null;
    const data: ApiPage = await resp.json();
    return toPicked(data);
  } catch {
    return null;
  }
}

/**
 * A search box + results list backed by Wagtail's admin pages API. The API is
 * same-origin and authorized by the admin session cookie, so the fetch just
 * needs `credentials: 'same-origin'` (it is a read-only GET — no CSRF). Selecting
 * a result hands the caller a `{ id, title, url }`.
 */
export function PagePicker({
  onSelect,
}: {
  onSelect: (page: PickedPage) => void;
}) {
  const [query, setQuery] = useState('');
  const [pages, setPages] = useState<PickedPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guards against a slow earlier request overwriting a newer one's results.
  const reqSeq = useRef(0);

  const search = useCallback(async (q: string) => {
    const seq = ++reqSeq.current;
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = q.trim()
        ? { search: q.trim() }
        : { order: 'title' };
      const resp = await fetch(listingUrl(params), {
        credentials: 'same-origin',
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (seq !== reqSeq.current) return; // superseded
      const items: ApiPage[] = Array.isArray(data.items) ? data.items : [];
      setPages(items.map(toPicked));
    } catch (e) {
      if (seq !== reqSeq.current) return;
      setError('Could not load pages.');
      setPages([]);
    } finally {
      if (seq === reqSeq.current) setLoading(false);
    }
  }, []);

  // Initial listing + debounced search on subsequent keystrokes.
  useEffect(() => {
    const t = setTimeout(() => search(query), query ? 250 : 0);
    return () => clearTimeout(t);
  }, [query, search]);

  return (
    <div className="w-puck-link__picker">
      <input
        type="text"
        className="w-puck-link__search"
        placeholder="Search pages…"
        value={query}
        autoFocus
        onChange={(e) => setQuery(e.target.value)}
      />
      {error ? <p className="w-puck-link__error">{error}</p> : null}
      {loading && !pages.length ? (
        <p className="w-puck-link__muted">Loading…</p>
      ) : null}
      {!loading && !error && !pages.length ? (
        <p className="w-puck-link__muted">No pages found.</p>
      ) : null}
      <ul className="w-puck-link__results">
        {pages.map((page) => (
          <li key={page.id}>
            <button
              type="button"
              className="w-puck-link__result"
              onClick={() => onSelect(page)}
            >
              <span className="w-puck-link__result-title">{page.title}</span>
              {page.url ? (
                <span className="w-puck-link__result-url">{page.url}</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default PagePicker;
