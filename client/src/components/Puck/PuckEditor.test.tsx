import { render } from '@testing-library/react';

/**
 * `@puckeditor/core`'s real `<Puck>` pulls in `@dnd-kit` / `@preact/signals-core`
 * (untransformed ESM that jest skips), so we mock the Puck runtime. The mock's
 * `<Puck>` renders its children, and exposes the compositional pieces
 * (`Puck.Components` / `Puck.Fields` / `Puck.Preview` / `Puck.Outline`) plus
 * `usePuck`, so `TakeoverFrame` can render and be asserted against. The real
 * editor is exercised by the webpack build + browser.
 */
const mockPuckSpy = jest.fn();

jest.mock('@puckeditor/core', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const React = require('react');
  const Puck = (props: Record<string, unknown>) => {
    mockPuckSpy(props);
    return React.createElement(
      'div',
      { 'data-testid': 'puck-root' },
      props.children as React.ReactNode,
    );
  };
  Puck.Components = () =>
    React.createElement('div', { 'data-testid': 'puck-components' });
  Puck.Fields = () =>
    React.createElement('div', { 'data-testid': 'puck-fields' });
  Puck.Preview = () =>
    React.createElement('div', { 'data-testid': 'puck-preview', id: 'puck-preview' });
  Puck.Outline = () =>
    React.createElement('div', { 'data-testid': 'puck-outline' });
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

// Imported after the mock is registered.
// eslint-disable-next-line import/first
import { PuckEditor } from './PuckEditor';
// eslint-disable-next-line import/first
import { defaultData } from './config';

/**
 * Build a minimal facsimile of the Wagtail page edit DOM that the takeover
 * frame reparents from: a form with the nav sidebar, the footer action menu,
 * the title + promote panels, the side-panel toggles + panels, and messages.
 * Returns the mount host (a child of the form, as `puck.tsx` sets up).
 */
function setupWagtailDom(): HTMLElement {
  document.body.innerHTML = `
    <aside id="wagtail-sidebar"><div class="sidebar">nav</div></aside>
    <main>
      <div class="messages">a message</div>
      <form id="page-edit-form">
        <div class="w-tabs">
          <div role="tablist">
            <a data-w-tabs-target="trigger" aria-controls="tab-content">Content</a>
            <a data-w-tabs-target="trigger" aria-controls="tab-promote">Promote</a>
          </div>
          <section id="tab-content">
            <section id="panel-child-content-title-section">
              <input id="id_title" name="title" />
            </section>
          </section>
          <section id="tab-promote" hidden>
            <input id="id_slug" name="slug" />
          </section>
        </div>
        <header>
          <button data-side-panel-toggle="status">status</button>
          <button data-side-panel-toggle="checks">checks</button>
          <button data-side-panel-toggle="comments">comments</button>
        </header>
        <aside data-form-side><div data-side-panel="status">status panel</div></aside>
        <footer class="footer">
          <nav class="actions actions--primary">
            <button class="button action-save" type="submit">Save draft</button>
          </nav>
        </footer>
        <div data-puck-parking hidden></div>
        <div data-puck-takeover-root></div>
      </form>
    </main>
  `;
  return document.querySelector('[data-puck-takeover-root]') as HTMLElement;
}

describe('PuckEditor takeover frame', () => {
  beforeEach(() => mockPuckSpy.mockClear());
  afterEach(() => {
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('data-puck-takeover');
  });

  it('passes the built config, data and onChange through to Puck', () => {
    const host = setupWagtailDom();
    const onChange = jest.fn();
    render(<PuckEditor initialData={defaultData} onChange={onChange} />, {
      container: host,
    });

    expect(mockPuckSpy).toHaveBeenCalledTimes(1);
    const props = mockPuckSpy.mock.calls[0][0];
    expect(Object.keys(props.config.components)).toHaveLength(13);
    expect(props.data).toBe(defaultData);
    expect(props.onChange).toBe(onChange);
  });

  it('renders the four rail sections (Main, Page, Blocks, Outline)', () => {
    const host = setupWagtailDom();
    const { getByTitle } = render(
      <PuckEditor initialData={defaultData} onChange={jest.fn()} />,
      { container: host },
    );
    ['Main', 'Page', 'Blocks', 'Outline'].forEach((label) => {
      expect(getByTitle(label)).toBeInTheDocument();
    });
  });

  it('renders the compositional Puck pieces (drawer, outline, preview, fields)', () => {
    const host = setupWagtailDom();
    const { getByTestId } = render(
      <PuckEditor initialData={defaultData} onChange={jest.fn()} />,
      { container: host },
    );
    expect(getByTestId('puck-components')).toBeInTheDocument();
    expect(getByTestId('puck-outline')).toBeInTheDocument();
    expect(getByTestId('puck-preview')).toBeInTheDocument();
    expect(getByTestId('puck-fields')).toBeInTheDocument();
  });

  it('relocates the Wagtail save/publish action menu into the frame header', () => {
    const host = setupWagtailDom();
    render(<PuckEditor initialData={defaultData} onChange={jest.fn()} />, {
      container: host,
    });
    const actions = document.querySelector('.w-puck-takeover__actions');
    expect(actions?.querySelector('button.action-save')).toBeInTheDocument();
    // It stays inside the form, so it keeps submitting.
    expect(
      document.querySelector('#page-edit-form button.action-save'),
    ).toBeInTheDocument();
  });

  it('reparents the nav sidebar, title, promote fields and messages into the frame', () => {
    const host = setupWagtailDom();
    render(<PuckEditor initialData={defaultData} onChange={jest.fn()} />, {
      container: host,
    });
    expect(
      document.querySelector('.w-puck-takeover__main #wagtail-sidebar'),
    ).toBeInTheDocument();
    expect(
      document.querySelector('.w-puck-takeover__page #id_title'),
    ).toBeInTheDocument();
    expect(
      document.querySelector('.w-puck-takeover__page #id_slug'),
    ).toBeInTheDocument();
    expect(
      document.querySelector('.w-puck-takeover__messages .messages'),
    ).toBeInTheDocument();
    // Title / slug remain inside the form (still submit).
    expect(document.querySelector('#page-edit-form #id_title')).toBeInTheDocument();
    expect(document.querySelector('#page-edit-form #id_slug')).toBeInTheDocument();
  });

  it('removes the orphaned promote tab trigger so w-tabs will not error', () => {
    const host = setupWagtailDom();
    render(<PuckEditor initialData={defaultData} onChange={jest.fn()} />, {
      container: host,
    });
    expect(
      document.querySelector('[aria-controls="tab-promote"]'),
    ).not.toBeInTheDocument();
  });

  it('relocates the status/checks side-panel toggles into the Page section', () => {
    const host = setupWagtailDom();
    render(<PuckEditor initialData={defaultData} onChange={jest.fn()} />, {
      container: host,
    });
    const toggles = document.querySelectorAll(
      '.w-puck-takeover__page-toggles [data-side-panel-toggle]',
    );
    expect(toggles).toHaveLength(3);
  });
});
