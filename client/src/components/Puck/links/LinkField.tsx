import type { CustomField } from '@puckeditor/core';
import { useEffect, useState } from 'react';
import { LinkEditor } from './LinkEditor';
import { fetchPageById } from './PagePicker';
import { parseLink } from './linkValue';

/**
 * Human-readable summary of a stored href, shown on the collapsed field. An
 * internal page resolves its title lazily from the API (falling back to the id);
 * an external link shows the URL; empty shows a hint.
 */
function LinkSummary({ href }: { href: string }) {
  const parsed = parseLink(href);
  const [pageTitle, setPageTitle] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setPageTitle(null);
    if (parsed.kind === 'page' && parsed.pageId != null) {
      fetchPageById(parsed.pageId).then((p) => {
        if (live && p) setPageTitle(p.title);
      });
    }
    return () => {
      live = false;
    };
  }, [parsed.kind, parsed.pageId]);

  if (parsed.kind === 'empty') {
    return <span className="w-puck-link__summary-empty">No link set</span>;
  }
  if (parsed.kind === 'page') {
    return (
      <span className="w-puck-link__summary-value">
        <span className="w-puck-link__badge">Page</span>
        {pageTitle || `#${parsed.pageId}`}
      </span>
    );
  }
  return (
    <span className="w-puck-link__summary-value">
      <span className="w-puck-link__badge">URL</span>
      {parsed.url}
    </span>
  );
}

function LinkFieldControl({
  value,
  onChange,
}: {
  value?: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const href = value || '';

  return (
    <div className="w-puck-link">
      {!open ? (
        <div className="w-puck-link__row">
          <LinkSummary href={href} />
          <button
            type="button"
            className="w-puck-link__btn"
            onClick={() => setOpen(true)}
          >
            Edit link
          </button>
        </div>
      ) : (
        <LinkEditor
          initialHref={href}
          onApply={(next) => {
            onChange(next);
            setOpen(false);
          }}
          onClear={
            parseLink(href).kind !== 'empty'
              ? () => {
                  onChange('#');
                  setOpen(false);
                }
              : undefined
          }
          onCancel={() => setOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * A Puck `custom` field for an href value following the `page:<id>` / URL
 * contract. Drop it in anywhere a plain `href` text field was used (the Button
 * block, the Hero buttons) to get external-URL + internal-page-picker editing.
 *
 * The editor expands INLINE in the fields sidebar (no portal / popper), so it is
 * immune to the takeover stacking-context occlusion that a body-portal dropdown
 * hits — no z-index handling needed here.
 */
export function linkField(label = 'Link'): CustomField<string> {
  return {
    type: 'custom',
    label,
    render: ({ value, onChange }) => (
      <LinkFieldControl value={value} onChange={onChange} />
    ),
  };
}

export default linkField;
