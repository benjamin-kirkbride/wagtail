import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Puck } from '@puckeditor/core';
import type { Data } from '@puckeditor/core';
import { buildConfig } from './config';

export type PuckEditorProps = {
  initialData: Data;
  onChange: (data: Data) => void;
};

const inlineStyle: CSSProperties = {
  // Fill the viewport below the Wagtail header/breadcrumb area; the admin
  // column width is unlocked separately in admin-overrides.css.
  height: 'calc(100vh - 16rem)',
  minHeight: 640,
};

const fullscreenStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000, // above the Wagtail sidebar, side panels, and footer bar
  height: '100vh',
  background: 'var(--w-color-surface-page, #fff)',
};

/**
 * Wraps Puck's editor for use inside the Wagtail admin.
 *
 * Persistence goes through Wagtail's own form submit (the parent widget mirrors
 * `onChange` into a hidden input), NOT through Puck's publish flow — so the
 * `headerActions` override replaces Puck's Publish button with a fullscreen
 * toggle. Fullscreen is a fixed overlay covering the whole admin; Escape (or
 * the button) returns to the inline layout, where Wagtail's save/publish bar
 * is reachable again.
 */
export function PuckEditor({ initialData, onChange }: PuckEditorProps) {
  const [fullscreen, setFullscreen] = useState(false);

  // The latest document, so the fullscreen toggle can remount Puck without
  // losing edits. Resizing Puck's container in place breaks its canvas
  // (AutoFrame/dnd-kit hold stale geometry: blank preview, ghost drag
  // artifacts), so the toggle changes the `key` instead — a clean remount in
  // the new geometry, re-fed with whatever the user has done so far. Puck's
  // internal undo stack does reset on toggle; content does not.
  const latestData = useRef(initialData);

  const handleChange = useCallback(
    (data: Data) => {
      latestData.current = data;
      onChange(data);
    },
    [onChange],
  );

  const toggleFullscreen = useCallback(() => {
    setFullscreen((current) => !current);
  }, []);

  useEffect(() => {
    if (!fullscreen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') toggleFullscreen();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [fullscreen, toggleFullscreen]);

  return (
    <div style={fullscreen ? fullscreenStyle : inlineStyle}>
      <Puck
        key={fullscreen ? 'fullscreen' : 'inline'}
        config={buildConfig()}
        data={latestData.current}
        onChange={handleChange}
        overrides={{
          headerActions: () => (
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-pressed={fullscreen}
              title={
                fullscreen ? 'Exit fullscreen (Esc)' : 'Edit in fullscreen'
              }
              style={{
                padding: '8px 16px',
                border: '1px solid var(--puck-color-grey-09, #c3c3c3)',
                borderRadius: 4,
                background: 'transparent',
                cursor: 'pointer',
                font: 'inherit',
              }}
            >
              {fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            </button>
          ),
        }}
      />
    </div>
  );
}

export default PuckEditor;
