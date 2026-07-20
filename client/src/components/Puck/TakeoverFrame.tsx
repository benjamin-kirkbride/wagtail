import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { ReactNode, RefObject } from 'react';
import { Puck, usePuck } from '@puckeditor/core';
import { buildConfig } from './config';
import { BLOCK_DESCRIPTIONS, PAGE_DESCRIPTION } from './descriptions';
import { installStaleHotkeyHealer } from './staleHotkeys';

/**
 * The Puck "takeover" frame.
 *
 * Rendered as `children` of `<Puck>`, so it lives inside all of Puck's context
 * providers (app store, dnd) — which is why `usePuck()` and the compositional
 * `Puck.Components` / `Puck.Fields` / `Puck.Preview` / `Puck.Outline` pieces all
 * work here. We deliberately do NOT use Puck's default `<Layout>` UI; we compose
 * our own so we can slot in Wagtail's real DOM.
 *
 * Wagtail form chrome (the nav sidebar, the title/promote fields, the
 * save/publish action menu, messages, side panels) is NOT re-implemented in
 * React. Instead we `appendChild` Wagtail's live, server-rendered DOM nodes into
 * plain host `<div>`s. A moved node that started inside `<form id=page-edit-form>`
 * stays inside it (our whole takeover host is a descendant of that form), so it
 * keeps submitting; its Stimulus controllers reconnect automatically on move.
 * React must treat these host divs as opaque — we never render children into
 * them, only `appendChild` in an effect.
 */

type PanelKey = 'main' | 'page' | 'blocks' | 'outline';

const ICONS: Record<PanelKey, ReactNode> = {
  main: (
    // hamburger / main nav
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 6h18M3 12h18M3 18h18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  page: (
    // document
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 2h8l4 4v16H6z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M14 2v4h4M9 13h6M9 17h6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  blocks: (
    // grid of blocks
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="2" />
      <rect x="14" y="3" width="7" height="7" stroke="currentColor" strokeWidth="2" />
      <rect x="3" y="14" width="7" height="7" stroke="currentColor" strokeWidth="2" />
      <rect x="14" y="14" width="7" height="7" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  outline: (
    // list / tree
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
};

const LABELS: Record<PanelKey, string> = {
  main: 'Main',
  page: 'Page',
  blocks: 'Blocks',
  outline: 'Outline',
};

const RAIL_ORDER: PanelKey[] = ['main', 'page', 'blocks', 'outline'];

/**
 * Reparent a live Wagtail DOM node (found by `selector`) into `ref`'s element.
 *
 * Puck remounts our frame once, when its DragDropContext changes shape on
 * leaving the LOADING status. A naive one-shot appendChild would move the node
 * into the first-mount host div, which React then discards on remount — taking
 * the node out of the document for good. So on unmount we rescue the node into
 * the stable `[data-puck-parking]` element (a hidden child of the form). On the
 * next mount the same selector finds it (in parking) and moves it into the new
 * host. The node is never destroyed, and — because parking lives inside the
 * form — any form-bound fields keep submitting throughout.
 *
 * The container and node are captured at setup time (not read from refs during
 * cleanup, which React may already have nulled).
 */
function useReparent(
  selector: string,
  ref: RefObject<HTMLElement | null>,
  after?: (node: HTMLElement) => void,
) {
  useEffect(() => {
    const container = ref.current;
    const node = document.querySelector<HTMLElement>(selector);
    if (!container || !node) return undefined;
    if (!container.contains(node)) {
      container.appendChild(node);
      if (after) after(node);
    }
    return () => {
      const parking = document.querySelector<HTMLElement>('[data-puck-parking]');
      if (parking && node.parentElement !== parking) {
        parking.appendChild(node);
      }
    };
    // Selector is a stable literal per call site; run once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// Component type -> editor label, resolved once (labels are static config).
const CONFIG_LABELS: Record<string, string> = (() => {
  const cfg = buildConfig();
  return Object.fromEntries(
    Object.entries(cfg.components).map(([type, def]) => [
      type,
      (def as { label?: string }).label ?? type,
    ]),
  );
})();

/**
 * Header for the right-hand fields sidebar: the selected block's name and a
 * one-line description of what it is/does (from descriptions.ts), above its
 * properties. Falls back to "Page" when nothing is selected.
 */
function FieldsHeader() {
  const { selectedItem } = usePuck() as {
    selectedItem?: { type?: string } | null;
  };
  const type = selectedItem?.type;
  const name = type ? (CONFIG_LABELS[type] ?? type) : 'Page';
  const description = type ? BLOCK_DESCRIPTIONS[type] : PAGE_DESCRIPTION;
  return (
    <div className="w-puck-takeover__fields-header">
      <div className="w-puck-takeover__fields-title">{name}</div>
      {description ? (
        <p className="w-puck-takeover__fields-desc">{description}</p>
      ) : null}
    </div>
  );
}

function UndoRedo() {
  const { history } = usePuck();
  return (
    <div className="w-puck-undo-redo">
      <button
        type="button"
        title="Undo"
        aria-label="Undo"
        className="w-puck-undo-redo__btn"
        onClick={() => history.back?.()}
        disabled={!history.hasPast}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M9 14L4 9l5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 9h11a5 5 0 0 1 0 10h-1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        type="button"
        title="Redo"
        aria-label="Redo"
        className="w-puck-undo-redo__btn"
        onClick={() => history.forward?.()}
        disabled={!history.hasFuture}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M15 14l5-5-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M20 9H9a5 5 0 0 0 0 10h1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

const VIEWPORTS: { key: string; label: string; width: number | null }[] = [
  { key: 'mobile', label: 'Mobile', width: 375 },
  { key: 'tablet', label: 'Tablet', width: 768 },
  { key: 'full', label: 'Full width', width: null },
];

export type TakeoverFrameProps = {
  /**
   * Stylesheets to inject into the preview iframe so the canvas renders under
   * the site's CSS. Puck's AutoFrame host-style cloning is disabled (see
   * PuckEditor), so without these the canvas content is unstyled (UA defaults).
   */
  previewCss?: string[];
};

export function TakeoverFrame({ previewCss }: TakeoverFrameProps = {}) {
  const [active, setActive] = useState<PanelKey>('page');
  const [viewport, setViewport] = useState<string>('full');

  // Kept in a ref so the (mount-once) iframe-adopt effect always injects the
  // current list without needing the effect to re-run.
  const previewCssRef = useRef<string[]>(previewCss ?? []);
  previewCssRef.current = previewCss ?? [];

  // Wagtail page edit/history live at /admin/pages/<id>/edit|add/... — derive the
  // history URL from the edit URL. Only pages (not create views) have history.
  const historyHref = (() => {
    const m = window.location.pathname.match(/\/admin\/pages\/(\d+)\/edit\//);
    return m ? `/admin/pages/${m[1]}/history/` : null;
  })();

  const mainRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const promoteRef = useRef<HTMLDivElement>(null);
  const pageToolbarRef = useRef<HTMLDivElement>(null);
  const pagePanelsRef = useRef<HTMLDivElement>(null);
  const headerActionsRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  // Reparent Wagtail's live DOM into our host divs. Order/grouping mirrors the
  // rail sections. See useReparent for the remount-survival mechanism.

  // Left rail "Main": the whole Wagtail nav sidebar (its own React 16 app).
  useReparent('aside#wagtail-sidebar', mainRef);

  // Header (top-left): Wagtail's real Save-draft split button + dropdown. The
  // footer action menu lives inside the form, so moving it keeps submit intact.
  // Location-independent selector: once parked (see useReparent), this node no
  // longer lives under footer.footer, so match it by its own classes instead.
  useReparent('nav.actions--primary', headerActionsRef);

  // The tab bar is hidden in takeover, and we move the promote panel out of the
  // tabs below. Remove the now-orphaned promote tab trigger first, so the
  // `w-tabs` controller doesn't error validating a trigger whose panel is gone.
  useEffect(() => {
    document
      .querySelector('[data-w-tabs-target="trigger"][aria-controls="tab-promote"]')
      ?.remove();
  }, []);

  // Left rail "Page": title field goes under a "Title" heading; the promote-tab
  // fields go under a "Promote" heading in their own host, so the SEO fields are
  // clearly separated from the page title (headings are frame-rendered around
  // the reparented hosts — we never inject DOM into the Wagtail nodes).
  useReparent('#panel-child-content-title-section', pageRef);
  useReparent('#tab-promote', promoteRef, (node) => {
    // It was a hidden (inactive) tab panel; now it's always shown.
    node.removeAttribute('hidden');
  });

  // Side-panel toggles (status / checks / comments / preview). sidePanel.js
  // binds these document-globally, so they keep working after the move.
  useReparent('[data-side-panel-toggle="status"]', pageToolbarRef);
  useReparent('[data-side-panel-toggle="checks"]', pageToolbarRef);
  useReparent('[data-side-panel-toggle="comments"]', pageToolbarRef);
  // The panels themselves (status includes the history summary + link).
  useReparent('[data-form-side]', pagePanelsRef);

  // Messages / banners (save success, validation errors).
  useReparent('.messages', messagesRef);

  // Keep the page canvas rendering as the published (light) page even when the
  // admin is in dark mode. Puck renders the preview in an <iframe> that clones
  // the admin document's <html> attributes — including `w-theme-dark` — so the
  // injected admin CSS otherwise paints the page with dark-theme text colours.
  // The canvas represents the live page, so we relabel just that iframe's root
  // to the light theme (Wagtail's own light tokens then apply). This touches
  // only Puck's isolated preview document, never a reparented Wagtail node.
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-puck-takeover-root]');
    if (!root) return undefined;

    const cleanups: Array<() => void> = [];
    const observedRoots = new WeakSet<HTMLElement>();
    const watchedIframes = new WeakSet<HTMLIFrameElement>();

    // Strip BOTH dark-capable classes: `w-theme-dark` applies dark tokens
    // directly, and `w-theme-system` applies them through a
    // `prefers-color-scheme: dark` media query — leaving it in place made the
    // canvas render light-grey-on-white for system-theme users on a dark OS.
    const relabel = (html: HTMLElement) => {
      if (
        html.classList.contains('w-theme-dark') ||
        html.classList.contains('w-theme-system')
      ) {
        html.classList.remove('w-theme-dark', 'w-theme-system');
        html.classList.add('w-theme-light');
      }
    };

    // Inject the site's stylesheet(s) into the preview iframe. AutoFrame's
    // host-style cloning is disabled (PuckEditor sets iframe.syncHostStyles
    // false), so the admin CSS no longer leaks in; these <link>s put the site's
    // CSS in its place, making the canvas match the published page. Puck's own
    // interaction styles (drag/drop/selection) are injected by Puck itself and
    // are untouched. Idempotent: each URL is added at most once per document.
    const injectSiteStyles = (doc: Document) => {
      const head = doc.head;
      if (!head) return;
      previewCssRef.current.forEach((href) => {
        if (
          head.querySelector(`link[data-puck-site-css][href="${href}"]`)
        ) {
          return;
        }
        const link = doc.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.setAttribute('data-puck-site-css', '');
        head.appendChild(link);
      });
    };

    const adoptDocument = (iframe: HTMLIFrameElement) => {
      const doc = iframe.contentDocument;
      const html = doc?.documentElement;
      if (!doc || !html) return;
      // Styles must be (re)injected even if we've already observed this root,
      // because AutoFrame can wipe non-Puck head nodes when it re-syncs.
      injectSiteStyles(doc);
      if (observedRoots.has(html)) return;
      observedRoots.add(html);
      relabel(html);
      // AutoFrame re-syncs the cloned <html> attributes from the parent, which
      // can restore the theme class after we strip it — keep re-asserting.
      const mo = new MutationObserver(() => relabel(html));
      mo.observe(html, { attributes: true, attributeFilter: ['class'] });
      cleanups.push(() => mo.disconnect());
    };

    const watchIframe = (iframe: HTMLIFrameElement) => {
      if (watchedIframes.has(iframe)) return;
      watchedIframes.add(iframe);
      adoptDocument(iframe);
      const onLoad = () => adoptDocument(iframe);
      iframe.addEventListener('load', onLoad);
      cleanups.push(() => iframe.removeEventListener('load', onLoad));
    };

    const scan = () => {
      root
        .querySelectorAll<HTMLIFrameElement>('.w-puck-takeover__canvas iframe')
        .forEach(watchIframe);
    };
    scan();
    // Puck can recreate the preview iframe (remounts, viewport changes); watch
    // the frame subtree so replacements are adopted too.
    const treeObserver = new MutationObserver(scan);
    treeObserver.observe(root, { childList: true, subtree: true });
    cleanups.push(() => treeObserver.disconnect());

    return () => cleanups.forEach((fn) => fn());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Heal Puck's stuck-modifier hotkey state before it misfires (a stale held
  // Ctrl/Cmd turns a plain "z" typed in a sidebar field into a real undo).
  // See staleHotkeys.ts for the full mechanism.
  useEffect(() => installStaleHotkeyHealer(document), []);

  const railButton = useCallback(
    (key: PanelKey) => {
      const isActive = active === key;
      return (
        <button
          key={key}
          type="button"
          title={LABELS[key]}
          aria-pressed={isActive}
          onClick={() => setActive(key)}
          className="w-puck-rail__btn"
          data-active={isActive ? 'true' : undefined}
        >
          <span className="w-puck-rail__icon">{ICONS[key]}</span>
          <span className="w-puck-rail__label">{LABELS[key]}</span>
        </button>
      );
    },
    [active],
  );

  const activeWidth = VIEWPORTS.find((v) => v.key === viewport)?.width ?? null;

  return (
    <div className="w-puck-takeover">
      {/* Header */}
      <div className="w-puck-takeover__header">
        <div className="w-puck-takeover__header-left">
          <div ref={headerActionsRef} className="w-puck-takeover__actions" />
        </div>
        <div className="w-puck-takeover__header-right">
          <UndoRedo />
          <div className="w-puck-takeover__viewports">
            {VIEWPORTS.map((v) => (
              <button
                key={v.key}
                type="button"
                title={v.label}
                aria-pressed={viewport === v.key}
                data-active={viewport === v.key ? 'true' : undefined}
                onClick={() => setViewport(v.key)}
                className="w-puck-takeover__viewport-btn"
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Body: rail | panel | canvas | fields */}
      <div className="w-puck-takeover__body">
        <nav className="w-puck-rail" aria-label="Editor sections">
          {RAIL_ORDER.map(railButton)}
        </nav>

        <div className="w-puck-takeover__panel" data-panel={active}>
          {/* Main — reparented Wagtail nav sidebar */}
          <div
            className="w-puck-takeover__panel-section"
            hidden={active !== 'main'}
          >
            <div ref={mainRef} className="w-puck-takeover__main" />
          </div>

          {/* Page — reparented title + promote + side panels */}
          <div
            className="w-puck-takeover__panel-section w-puck-takeover__page"
            hidden={active !== 'page'}
          >
            <div className="w-puck-takeover__page-toolbar">
              <div ref={pageToolbarRef} className="w-puck-takeover__page-toggles" />
              {historyHref && (
                <a
                  className="button button-small button-secondary"
                  href={historyHref}
                >
                  History
                </a>
              )}
            </div>
            {/* Side-panel content (status / checks) appears right under the
                toggles when opened; the editable fields follow below. */}
            <div ref={pagePanelsRef} className="w-puck-takeover__page-panels" />
            <h3 className="w-puck-section-heading">Title</h3>
            <div ref={pageRef} className="w-puck-takeover__page-fields" />
            <h3 className="w-puck-section-heading">Promote</h3>
            <div ref={promoteRef} className="w-puck-takeover__page-fields" />
          </div>

          {/* Blocks — Puck's component drawer */}
          <div
            className="w-puck-takeover__panel-section"
            hidden={active !== 'blocks'}
          >
            <Puck.Components />
          </div>

          {/* Outline — Puck's layer tree */}
          <div
            className="w-puck-takeover__panel-section"
            hidden={active !== 'outline'}
          >
            <Puck.Outline />
          </div>
        </div>

        <div className="w-puck-takeover__canvas">
          <div ref={messagesRef} className="w-puck-takeover__messages" />
          <div
            className="w-puck-takeover__canvas-inner"
            style={
              activeWidth
                ? { maxWidth: activeWidth, margin: '0 auto', width: '100%' }
                : undefined
            }
          >
            <Puck.Preview />
          </div>
        </div>

        <div className="w-puck-takeover__fields">
          <FieldsHeader />
          <Puck.Fields />
        </div>
      </div>
    </div>
  );
}

export default TakeoverFrame;
