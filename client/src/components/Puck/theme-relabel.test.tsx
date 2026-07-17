/**
 * Regression guard for the white-on-white canvas bug (commit 5b327fab8c).
 *
 * The preview iframe clones the admin <html> attributes, so a dark-profile admin
 * paints the canvas with dark text tokens on the pinned-white page background.
 * The canvas represents the PUBLISHED page, so TakeoverFrame relabels the iframe
 * root to `w-theme-light`. The bug: the relabel only stripped `w-theme-dark`
 * (profile-dark) and left `w-theme-system` — which applies dark tokens via a
 * `prefers-color-scheme: dark` media query — so system-theme users on a dark OS
 * still got light-grey-on-white. The fix strips BOTH classes and re-asserts the
 * light label through a MutationObserver when AutoFrame re-syncs the attributes.
 *
 * jsdom CAN exercise this: its iframes have a real contentDocument and it
 * supports MutationObserver. We mock the Puck runtime (dnd-kit/signals ship
 * untransformed ESM jest skips) exactly as the existing PuckEditor.test.tsx
 * does, then feed the frame a canvas iframe and drive the theme classes.
 */
import { render, waitFor } from '@testing-library/react';

jest.mock('@puckeditor/core', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const React = require('react');
  const Puck = (props: Record<string, unknown>) =>
    React.createElement(
      'div',
      { 'data-testid': 'puck-root' },
      props.children as React.ReactNode,
    );
  Puck.Components = () => React.createElement('div');
  Puck.Fields = () => React.createElement('div');
  Puck.Preview = () =>
    React.createElement('div', { 'data-testid': 'puck-preview' });
  Puck.Outline = () => React.createElement('div');
  return {
    Puck,
    usePuck: () => ({
      history: {
        back: jest.fn(),
        forward: jest.fn(),
        hasPast: false,
        hasFuture: false,
      },
    }),
  };
});

// eslint-disable-next-line import/first
import { PuckEditor } from './PuckEditor';
// eslint-disable-next-line import/first
import { defaultData } from './config';

/**
 * Minimal takeover DOM: the frame only needs its mount host (a child of the
 * form, carrying [data-puck-takeover-root]) and the parking node. The reparent
 * effects no-op cleanly when their Wagtail source nodes are absent.
 */
function setupHost(): HTMLElement {
  document.body.innerHTML = `
    <form id="page-edit-form">
      <div data-puck-parking hidden></div>
      <div data-puck-takeover-root></div>
    </form>
  `;
  return document.querySelector('[data-puck-takeover-root]') as HTMLElement;
}

/**
 * Simulate the preview iframe Puck's AutoFrame would create in the canvas, with
 * its cloned <html> carrying the given theme class, and let the frame's tree
 * observer adopt it.
 */
function addCanvasIframe(initialThemeClass: string): HTMLIFrameElement {
  const canvas = document.querySelector(
    '.w-puck-takeover__canvas',
  ) as HTMLElement;
  const iframe = document.createElement('iframe');
  canvas.appendChild(iframe);
  // contentDocument exists once attached; set the cloned theme class before the
  // MutationObserver microtask that adopts the iframe runs.
  iframe.contentDocument!.documentElement.className = initialThemeClass;
  return iframe;
}

function htmlClasses(iframe: HTMLIFrameElement): DOMTokenList {
  return iframe.contentDocument!.documentElement.classList;
}

describe('TakeoverFrame canvas theme relabel', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('data-puck-takeover');
  });

  it.each(['w-theme-system', 'w-theme-dark'])(
    'relabels a %s canvas iframe to w-theme-light',
    async (themeClass) => {
      const host = setupHost();
      render(<PuckEditor initialData={defaultData} onChange={jest.fn()} />, {
        container: host,
      });

      const iframe = addCanvasIframe(themeClass);

      await waitFor(() => {
        expect(htmlClasses(iframe).contains('w-theme-light')).toBe(true);
      });
      expect(htmlClasses(iframe).contains('w-theme-dark')).toBe(false);
      expect(htmlClasses(iframe).contains('w-theme-system')).toBe(false);
    },
  );

  it('re-asserts w-theme-light when AutoFrame re-syncs a dark class (observer)', async () => {
    const host = setupHost();
    render(<PuckEditor initialData={defaultData} onChange={jest.fn()} />, {
      container: host,
    });

    const iframe = addCanvasIframe('w-theme-system');
    await waitFor(() => {
      expect(htmlClasses(iframe).contains('w-theme-light')).toBe(true);
    });

    // AutoFrame re-syncs the parent's attributes onto the iframe root, restoring
    // a dark-capable class. The MutationObserver must strip it again.
    htmlClasses(iframe).remove('w-theme-light');
    htmlClasses(iframe).add('w-theme-system');

    await waitFor(() => {
      expect(htmlClasses(iframe).contains('w-theme-light')).toBe(true);
    });
    expect(htmlClasses(iframe).contains('w-theme-system')).toBe(false);
    expect(htmlClasses(iframe).contains('w-theme-dark')).toBe(false);
  });
});
