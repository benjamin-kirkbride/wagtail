import '@puckeditor/core/puck.css';

import { createRoot } from 'react-dom/client';
import type { Data } from '@puckeditor/core';
import { PuckEditor } from '../../components/Puck/PuckEditor';
import { normalizeData } from '../../components/Puck/config';

/**
 * Admin entrypoint for the Puck visual editor.
 *
 * Mirrors the Draftail event-bridge (`client/src/entrypoints/admin/draftail.js`)
 * but mounts an isolated React 18 root. The Python `PuckWidget` renders a hidden
 * input wired to the core `w-init` Stimulus controller, which fires a
 * `w-puck:init` event on the input once connected. We listen for that event,
 * resolve the mount node, and render the editor. On every Puck change we write
 * the serialized doc back into the hidden input and dispatch a bubbling
 * `change` event so Wagtail's unsaved-changes tracking and form submit/preview
 * pick up the value.
 *
 * The bundle may be evaluated more than once (e.g. AJAX responses that include
 * the widget), so guard against registering the listener twice.
 */

const WIN = window as unknown as { __wagtailPuckInit?: boolean };

function resolveMountNode(input: HTMLElement): HTMLElement | null {
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

    const mountNode = resolveMountNode(input);
    if (!mountNode) {
      // eslint-disable-next-line no-console
      console.error('Could not find a Puck editor mount node for', input.id);
      return;
    }

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(input.value);
    } catch {
      parsed = null;
    }
    const data: Data = normalizeData(parsed);

    const root = createRoot(mountNode);
    root.render(
      <PuckEditor
        initialData={data}
        onChange={(next) => {
          input.value = JSON.stringify(next);
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }}
      />,
    );
  });
}
