import { useEffect, useState } from 'react';
import { PagePicker, fetchPageById, type PickedPage } from './PagePicker';
import { pageToken, parseLink } from './linkValue';

type Tab = 'external' | 'page';

/**
 * The shared link-editing surface: choose between an external URL and an
 * internal page (via the page picker), then apply. Used both by the `custom`
 * link field (Button / Hero buttons) and by the RichText toolbar link control.
 *
 * It edits against the `page:<id>` / URL href contract (see linkValue.ts) and
 * hands the resulting href string back through `onApply`. It renders only the
 * panel body; the caller positions it (a field popover, a menu popover).
 */
export function LinkEditor({
  initialHref,
  onApply,
  onClear,
  onCancel,
}: {
  initialHref: string;
  onApply: (href: string) => void;
  onClear?: () => void;
  onCancel: () => void;
}) {
  const parsed = parseLink(initialHref);
  const [tab, setTab] = useState<Tab>(parsed.kind === 'page' ? 'page' : 'external');
  const [url, setUrl] = useState(parsed.kind === 'external' ? parsed.url : '');
  // Label for the currently-linked internal page, when reopening an internal
  // link — resolved lazily from the API so the user sees what they picked.
  const [currentPage, setCurrentPage] = useState<PickedPage | null>(null);

  useEffect(() => {
    let live = true;
    if (parsed.kind === 'page' && parsed.pageId != null) {
      fetchPageById(parsed.pageId).then((p) => {
        if (live && p) setCurrentPage(p);
      });
    }
    return () => {
      live = false;
    };
    // Resolve once for the initial href; re-picking updates state directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyExternal = () => {
    const trimmed = url.trim();
    if (trimmed) onApply(trimmed);
  };

  const applyPage = (page: PickedPage) => {
    setCurrentPage(page);
    onApply(pageToken(page.id));
  };

  return (
    <div className="w-puck-link__editor" role="dialog" aria-label="Edit link">
      <div className="w-puck-link__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'external'}
          className="w-puck-link__tab"
          data-active={tab === 'external'}
          onClick={() => setTab('external')}
        >
          External URL
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'page'}
          className="w-puck-link__tab"
          data-active={tab === 'page'}
          onClick={() => setTab('page')}
        >
          Internal page
        </button>
      </div>

      {tab === 'external' ? (
        <div className="w-puck-link__external">
          <input
            type="text"
            className="w-puck-link__search"
            placeholder="https://example.com or /path/"
            value={url}
            autoFocus
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyExternal();
              }
            }}
          />
          <div className="w-puck-link__actions">
            <button
              type="button"
              className="w-puck-link__btn w-puck-link__btn--primary"
              onClick={applyExternal}
              disabled={!url.trim()}
            >
              Apply
            </button>
          </div>
        </div>
      ) : (
        <div className="w-puck-link__page">
          {currentPage ? (
            <p className="w-puck-link__current">
              Linked to <strong>{currentPage.title}</strong>
            </p>
          ) : parsed.kind === 'page' ? (
            <p className="w-puck-link__muted">Linked to page #{parsed.pageId}</p>
          ) : null}
          <PagePicker onSelect={applyPage} />
        </div>
      )}

      <div className="w-puck-link__footer">
        {onClear ? (
          <button
            type="button"
            className="w-puck-link__btn w-puck-link__btn--danger"
            onClick={onClear}
          >
            Remove link
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          className="w-puck-link__btn"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default LinkEditor;
