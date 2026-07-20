import type { Editor } from '@tiptap/react';
import {
  useEffect,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { LinkEditor } from './LinkEditor';

/**
 * The RichText toolbar link control, appended to Puck's default rich-text menu
 * via the field's `renderMenu`. Adds a Link button (and Unlink button) that open
 * the shared LinkEditor and drive TipTap's link mark.
 *
 * The editor stores whatever href the LinkEditor returns — an external URL or a
 * `page:<id>` token (see linkValue.ts); the token is resolved to a real URL at
 * render time in Python, exactly like the Button/Hero hrefs.
 *
 * The LinkEditor expands INLINE inside the toolbar (no portal / popper), so it
 * is not subject to the takeover stacking-context occlusion that broke the
 * heading/list/align dropdowns.
 */
function RichTextLinkControl({ editor }: { editor: Editor | null }) {
  const [open, setOpen] = useState(false);
  // The text range to link, captured when the editor opens. Interacting with
  // the link panel (typing in the page search, clicking a result) blurs the
  // contenteditable; restoring this range before applying guarantees the mark
  // lands on the originally-selected text rather than a lost/collapsed cursor.
  const savedRange = useRef<{ from: number; to: number } | null>(null);
  // Re-render on every editor transaction so the button's enabled/active state
  // and the current-link href track the live selection.
  const [, bump] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (!editor) return undefined;
    editor.on('transaction', bump);
    editor.on('selectionUpdate', bump);
    return () => {
      editor.off('transaction', bump);
      editor.off('selectionUpdate', bump);
    };
  }, [editor]);

  if (!editor) return null;

  const inLink = editor.isActive('link');
  const currentHref = (editor.getAttributes('link').href as string) || '';
  // A link can be created only with a text selection; editing an existing link
  // works from a collapsed cursor inside it (extendMarkRange covers the mark).
  const canLink = inLink || !editor.state.selection.empty;

  const openEditor = () => {
    const { from, to } = editor.state.selection;
    savedRange.current = { from, to };
    setOpen((v) => !v);
  };

  const withSavedRange = () => {
    const chain = editor.chain().focus();
    return savedRange.current
      ? chain.setTextSelection(savedRange.current)
      : chain;
  };

  const apply = (href: string) => {
    withSavedRange().extendMarkRange('link').setLink({ href }).run();
    setOpen(false);
  };

  const clear = () => {
    withSavedRange().extendMarkRange('link').unsetLink().run();
    setOpen(false);
  };

  return (
    <div className="w-puck-link__rte" data-puck-rte-link>
      <div className="w-puck-link__rte-buttons">
        <button
          type="button"
          className="w-puck-link__rte-btn"
          data-active={inLink}
          disabled={!canLink}
          title={
            canLink ? 'Add or edit link' : 'Select text to add a link'
          }
          onClick={openEditor}
        >
          Link
        </button>
        {inLink ? (
          <button
            type="button"
            className="w-puck-link__rte-btn"
            title="Remove link"
            onClick={clear}
          >
            Unlink
          </button>
        ) : null}
      </div>
      {open && canLink ? (
        <LinkEditor
          initialHref={currentHref}
          onApply={apply}
          onClear={inLink ? clear : undefined}
          onCancel={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}

/**
 * The `renderMenu` value for the RichText field: render Puck's default toolbar
 * (`children`) and append the link control.
 */
export function renderRichTextMenu({
  children,
  editor,
}: {
  children: ReactNode;
  editor: Editor | null;
}): ReactNode {
  return (
    <div className="w-puck-link__rte-menu">
      {children}
      <RichTextLinkControl editor={editor} />
    </div>
  );
}

export default renderRichTextMenu;
