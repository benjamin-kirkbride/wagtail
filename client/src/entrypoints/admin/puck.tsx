import '@puckeditor/core/puck.css';
import '../../components/Puck/admin-overrides.css';

import { createRoot } from 'react-dom/client';
import type { Data } from '@puckeditor/core';
import { PuckEditor } from '../../components/Puck/PuckEditor';
import { normalizeData } from '../../components/Puck/config';

/**
 * Admin entrypoint for the Puck visual editor.
 *
 * The Python `PuckWidget` renders a hidden input wired to the core `w-init`
 * Stimulus controller, which fires a `w-puck:init` event on the input once
 * connected. We listen for that event and mount an isolated React 18 root.
 *
 * On a page create/edit view the editor "takes over" the whole viewport: we
 * mount into a host element appended to `<form id=page-edit-form>` (so the
 * editor's DOM — and any Wagtail nodes the frame reparents into it — stay inside
 * the form and keep submitting), and flag `<html data-puck-takeover>` so scoped
 * CSS can hide the now-redundant Wagtail chrome. The Django EditView /
 * CreateView, the edit-handler form, and POST semantics are untouched: this is a
 * purely client-side re-composition of the existing edit page.
 *
 * If the widget is used outside a page edit form (no `#page-edit-form`), we fall
 * back to mounting into the widget's own root node, so nothing else breaks.
 *
 * On every Puck change we write the serialized doc back into the hidden input
 * and dispatch a bubbling `change` event so Wagtail's unsaved-changes tracking
 * and form submit/preview pick up the value.
 *
 * The bundle may be evaluated more than once (e.g. AJAX responses that include
 * the widget), so guard against registering the listener twice.
 */

const WIN = window as unknown as { __wagtailPuckInit?: boolean };

function inlineMountNode(input: HTMLElement): HTMLElement | null {
  const container = input.closest('[data-puck-editor]');
  const withinContainer = container
    ? container.querySelector('[data-puck-editor-root]')
    : null;
  if (withinContainer) {
    return withinContainer as HTMLElement;
  }
  return document.querySelector(
    `[data-puck-editor-root][data-puck-input-id="${input.id}"]`,
  );
}

if (!WIN.__wagtailPuckInit) {
  WIN.__wagtailPuckInit = true;

  document.addEventListener('w-puck:init', (event) => {
    const input = event.target as HTMLInputElement | null;

    if (!input || !input.id) {
      // eslint-disable-next-line no-console
      console.error('`w-puck:init` event must have a target with an id.');
      return;
    }

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(input.value);
    } catch {
      parsed = null;
    }
    const data: Data = normalizeData(parsed);

    const onChange = (next: Data) => {
      input.value = JSON.stringify(next);
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };

    // Server-side options ride along on the w-init event `detail` (see
    // PuckWidget). `previewCss` lists the stylesheets to inject into the preview
    // iframe so the canvas renders under the site's CSS, not the admin's.
    const detail = (event as CustomEvent<{ previewCss?: string[] } | undefined>)
      .detail;
    const previewCss = Array.isArray(detail?.previewCss)
      ? detail.previewCss
      : [];

    // Page edit/create view -> full-viewport takeover.
    const form = input.closest<HTMLFormElement>('form#page-edit-form');
    if (form) {
      // A dedicated host, a direct child of the form, so it (and every Wagtail
      // node the frame reparents into it) stays inside the form and submits.
      let host = form.querySelector<HTMLElement>(
        ':scope > [data-puck-takeover-root]',
      );
      if (!host) {
        host = document.createElement('div');
        host.setAttribute('data-puck-takeover-root', '');
        form.appendChild(host);
      }
      // A stable, hidden "parking" element inside the form. The frame reparents
      // Wagtail's live DOM into its panels, but Puck remounts our frame once
      // (its DragDropContext changes shape when it leaves the LOADING status),
      // which would otherwise destroy those moved nodes along with the discarded
      // host divs. The frame's reparent effects therefore rescue nodes here on
      // unmount; parking inside the form keeps form-bound fields submitting even
      // mid-remount.
      if (!form.querySelector(':scope > [data-puck-parking]')) {
        const parking = document.createElement('div');
        parking.setAttribute('data-puck-parking', '');
        parking.hidden = true;
        form.appendChild(parking);
      }
      document.documentElement.setAttribute('data-puck-takeover', '');

      const root = createRoot(host);
      root.render(
        <PuckEditor
          initialData={data}
          onChange={onChange}
          previewCss={previewCss}
        />,
      );
      return;
    }

    // Fallback: mount inline into the widget's own root node.
    const mountNode = inlineMountNode(input);
    if (!mountNode) {
      // eslint-disable-next-line no-console
      console.error('Could not find a Puck editor mount node for', input.id);
      return;
    }
    const root = createRoot(mountNode);
    root.render(
      <PuckEditor
        initialData={data}
        onChange={onChange}
        previewCss={previewCss}
      />,
    );
  });
}
