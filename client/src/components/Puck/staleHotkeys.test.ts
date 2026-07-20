/**
 * Regression tests for the stuck-modifier hotkey healer (staleHotkeys.ts).
 *
 * The bug: Puck's held-modifier tracker (backing its Ctrl/Cmd+Z undo hotkey)
 * only ever resets on window blur / tab-hide, so a modifier keyup consumed
 * outside the document (native context menu, OS shortcut, canvas iframe)
 * leaves Ctrl "held" forever and a later bare "z" fires a real undo. The
 * healer watches keydowns in the capture phase and, on the first bare
 * keystroke after modifier use, dispatches the reset signal (a `keyup` with
 * `code: 'MetaLeft'`, which Puck's own handler maps to a full reset) before
 * Puck's bubble-phase keydown handler can evaluate the phantom chord.
 *
 * These tests exercise the healer's real contract against a real document —
 * the same sequences that were verified end-to-end in a live browser when the
 * bug was reproduced and fixed.
 */
import { installStaleHotkeyHealer } from './staleHotkeys';

const keydown = (init: KeyboardEventInit) =>
  new KeyboardEvent('keydown', { bubbles: true, ...init });

describe('installStaleHotkeyHealer', () => {
  let dispose: () => void;
  let resets: KeyboardEvent[];
  const onKeyUp = (e: Event) => {
    const ke = e as KeyboardEvent;
    if (ke.code === 'MetaLeft') resets.push(ke);
  };

  beforeEach(() => {
    resets = [];
    document.addEventListener('keyup', onKeyUp);
    dispose = installStaleHotkeyHealer(document);
  });

  afterEach(() => {
    dispose();
    document.removeEventListener('keyup', onKeyUp);
  });

  it('resets on the first bare keystroke after modifier use', () => {
    // A real Ctrl press carries its own live flag…
    document.dispatchEvent(keydown({ code: 'ControlLeft', ctrlKey: true }));
    expect(resets).toHaveLength(0);
    // …its keyup is lost (context menu / iframe / OS shortcut), and the user
    // later types a plain "z". The healer must fire the reset for this very
    // keydown — before Puck's bubble-phase handler sees it.
    document.dispatchEvent(keydown({ code: 'KeyZ', key: 'z' }));
    expect(resets).toHaveLength(1);
  });

  it('dispatches the reset before bubble-phase listeners see the bare keydown', () => {
    const order: string[] = [];
    const bubbleSpy = (e: Event) => {
      if ((e as KeyboardEvent).type === 'keydown') order.push('puck-keydown');
    };
    const resetSpy = (e: Event) => {
      if ((e as KeyboardEvent).code === 'MetaLeft') order.push('reset');
    };
    // Stand-ins for Puck's own bubble-phase listeners on the document.
    document.addEventListener('keydown', bubbleSpy);
    document.addEventListener('keyup', resetSpy);
    try {
      document.dispatchEvent(keydown({ code: 'ControlLeft', ctrlKey: true }));
      order.length = 0;
      document.dispatchEvent(keydown({ code: 'KeyZ', key: 'z' }));
      // If 'puck-keydown' came first, Puck would have already evaluated the
      // phantom Ctrl+Z chord and fired the undo — the whole point is lost.
      expect(order).toEqual(['reset', 'puck-keydown']);
    } finally {
      document.removeEventListener('keydown', bubbleSpy);
      document.removeEventListener('keyup', resetSpy);
    }
  });

  it('resets only once per modifier use, not on every keystroke', () => {
    document.dispatchEvent(keydown({ code: 'ControlLeft', ctrlKey: true }));
    document.dispatchEvent(keydown({ code: 'KeyA', key: 'a' }));
    document.dispatchEvent(keydown({ code: 'KeyB', key: 'b' }));
    document.dispatchEvent(keydown({ code: 'KeyC', key: 'c' }));
    expect(resets).toHaveLength(1);
  });

  it('does nothing during plain typing with no prior modifier use', () => {
    for (const [code, key] of [['KeyH', 'h'], ['KeyI', 'i'], ['KeyZ', 'z']]) {
      document.dispatchEvent(keydown({ code, key }));
    }
    expect(resets).toHaveLength(0);
  });

  it('leaves genuine chords alone (live modifier flag present)', () => {
    document.dispatchEvent(keydown({ code: 'ControlLeft', ctrlKey: true }));
    // A real Ctrl+Z: the "z" keydown itself carries ctrlKey — no reset, so
    // Puck's undo hotkey still works.
    document.dispatchEvent(keydown({ code: 'KeyZ', key: 'z', ctrlKey: true }));
    expect(resets).toHaveLength(0);
  });

  it('re-arms after each modifier use', () => {
    document.dispatchEvent(keydown({ code: 'ControlLeft', ctrlKey: true }));
    document.dispatchEvent(keydown({ code: 'KeyZ', key: 'z' }));
    document.dispatchEvent(keydown({ code: 'MetaLeft', metaKey: true }));
    document.dispatchEvent(keydown({ code: 'KeyY', key: 'y' }));
    expect(resets).toHaveLength(2);
  });

  it('stops listening once disposed', () => {
    dispose();
    document.dispatchEvent(keydown({ code: 'ControlLeft', ctrlKey: true }));
    document.dispatchEvent(keydown({ code: 'KeyZ', key: 'z' }));
    expect(resets).toHaveLength(0);
    // afterEach disposes again; installStaleHotkeyHealer's disposer must be
    // safe to call twice.
    dispose = installStaleHotkeyHealer(document);
  });
});
