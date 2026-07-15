import { render } from '@testing-library/react';

/**
 * `@puckeditor/core`'s `<Puck>` pulls in `@dnd-kit` / `@preact/signals-core`,
 * which ship as untransformed ESM under `node_modules`. Jest's default
 * `transformIgnorePatterns` skips `node_modules`, so importing the real editor
 * runtime throws a SyntaxError before any assertion can run. We mock the Puck
 * runtime so this suite can verify that `PuckEditor` renders and wires the
 * config/data through, per the plan's fallback ("at least assert the component
 * renders"). The real editor is exercised by the webpack build + browser.
 *
 * NOTE (integration): to mount the *real* Puck in jest instead, add a
 * `transformIgnorePatterns` to the `puck` jest project allowing
 * `@puckeditor/core`, `@dnd-kit`, and `@preact/signals-core` to be transformed.
 */
const mockPuckSpy = jest.fn();

jest.mock('@puckeditor/core', () => ({
  Puck: (props: Record<string, unknown>) => {
    mockPuckSpy(props);
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'puck-root' });
  },
}));

// Imported after the mock is registered.
// eslint-disable-next-line import/first
import { PuckEditor } from './PuckEditor';
// eslint-disable-next-line import/first
import { defaultData } from './config';

describe('PuckEditor', () => {
  beforeEach(() => mockPuckSpy.mockClear());

  it('mounts without throwing and renders the Puck root', () => {
    const onChange = jest.fn();
    const { getByTestId, unmount } = render(
      <PuckEditor initialData={defaultData} onChange={onChange} />,
    );
    expect(getByTestId('puck-root')).toBeInTheDocument();
    unmount();
  });

  it('passes the built config, data and onChange through to Puck', () => {
    const onChange = jest.fn();
    render(<PuckEditor initialData={defaultData} onChange={onChange} />);

    expect(mockPuckSpy).toHaveBeenCalledTimes(1);
    const props = mockPuckSpy.mock.calls[0][0];
    expect(Object.keys(props.config.components)).toHaveLength(13);
    expect(props.data).toBe(defaultData);
    // onChange is wrapped (the latest doc is kept for fullscreen remounts) but
    // must still forward every change to the widget's handler.
    const changed = { ...defaultData, root: { props: { title: 'x' } } };
    props.onChange(changed);
    expect(onChange).toHaveBeenCalledWith(changed);
    // Puck's own header actions (its Publish button) are replaced with the
    // fullscreen toggle — persistence belongs to Wagtail's form submit.
    expect(props.overrides).toBeDefined();
    expect(typeof props.overrides.headerActions).toBe('function');
    const actions = props.overrides.headerActions();
    expect(actions.type).toBe('button');
    expect(actions.props.title).toMatch(/fullscreen/i);
  });
});
