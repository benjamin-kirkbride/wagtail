/**
 * Heal Puck's stuck-modifier hotkey state before it misfires.
 *
 * Puck implements its undo/redo hotkeys (Ctrl/Cmd+Z, +Shift+Z, +Y) with its
 * own held-modifier tracker (`monitorHotkeys(document)`): a keydown/keyup
 * listener pair on the admin document maintains a `held` map, reset only on
 * `window` blur / tab-hide. A modifier's keyup can be consumed without any of
 * those firing — a native context menu opened while the key was down, an
 * OS/IME shortcut, a keyup delivered to the canvas iframe's document — after
 * which the tracker believes Ctrl/Cmd is held FOREVER. Every later bare
 * keystroke is then evaluated against that phantom chord, so typing a plain
 * "z" in a sidebar field fires a real Puck undo: content reverts, the block
 * deselects, and focus is yanked out of the field mid-word. (Reproduced
 * exactly that way in a live browser; a stale tracker turns ordinary typing
 * into hotkeys.)
 *
 * The browser's live event flags are ground truth: a keydown that arrives with
 * NO modifier flags set proves no modifier is physically down, so any held
 * state is stale. This listener runs in the CAPTURE phase on the same document
 * (Puck's listeners are bubble-phase, so ours is guaranteed to run first) and,
 * when a bare keystroke follows a modifier-flagged one, forces Puck's reset
 * before its keydown handler can evaluate the phantom chord. The reset signal
 * is a synthetic `keyup` with `code: 'MetaLeft'`: Puck's own keyup handler
 * maps a meta release to a full `reset()` of the held map — the same code
 * path as its window-blur handler. The armed flag limits the synthetic
 * dispatch to the first bare key after modifier use, so plain typing does not
 * dispatch an extra event per keystroke. Real chords are unaffected: a
 * genuine Ctrl/Cmd+Z keydown carries its live flag and is left alone.
 *
 * (Do not "fix" this by listening for the canvas iframe element's focus/blur
 * instead: Chrome does not fire those events on iframe elements at all —
 * verified — and focus entering the canvas already resets the tracker via
 * the parent window's blur.)
 *
 * Returns a disposer that removes the listener.
 */
export function installStaleHotkeyHealer(doc: Document): () => void {
  let armed = false;
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      armed = true;
      return;
    }
    if (!armed) return;
    armed = false;
    doc.dispatchEvent(
      new KeyboardEvent('keyup', { code: 'MetaLeft', bubbles: true }),
    );
  };
  doc.addEventListener('keydown', onKeyDown, { capture: true });
  return () =>
    doc.removeEventListener('keydown', onKeyDown, { capture: true });
}

export default installStaleHotkeyHealer;
