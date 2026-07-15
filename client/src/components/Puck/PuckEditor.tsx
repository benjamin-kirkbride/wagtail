import { Puck } from '@puckeditor/core';
import type { Data } from '@puckeditor/core';
import { buildConfig } from './config';
import { TakeoverFrame } from './TakeoverFrame';

export type PuckEditorProps = {
  initialData: Data;
  onChange: (data: Data) => void;
};

/**
 * The Puck editor as a full-viewport "takeover" of the Wagtail page edit view.
 *
 * `<Puck>` renders `props.children` (our `<TakeoverFrame>`) in place of its own
 * default UI, but still inside every Puck context provider — so the frame can
 * use `usePuck()` and the compositional `Puck.Components` / `Puck.Fields` /
 * `Puck.Preview` / `Puck.Outline` pieces. Persistence is NOT Puck's publish
 * flow: the parent widget mirrors `onChange` into the hidden form input, and
 * Wagtail's own save/publish machinery (reparented into the frame's header)
 * submits the form.
 */
export function PuckEditor({ initialData, onChange }: PuckEditorProps) {
  return (
    <Puck config={buildConfig()} data={initialData} onChange={onChange}>
      <TakeoverFrame />
    </Puck>
  );
}

export default PuckEditor;
