import { Puck } from '@puckeditor/core';
import type { Data } from '@puckeditor/core';
import { buildConfig } from './config';

export type PuckEditorProps = {
  initialData: Data;
  onChange: (data: Data) => void;
};

/**
 * Wraps Puck's editor for use inside the Wagtail admin.
 *
 * Persistence goes through Wagtail's own form submit (the parent widget mirrors
 * `onChange` into a hidden input), NOT through Puck's publish flow — so Puck's
 * header actions are suppressed via the `headerActions` override.
 */
export function PuckEditor({ initialData, onChange }: PuckEditorProps) {
  return (
    <div style={{ height: '80vh', minHeight: 640 }}>
      <Puck
        config={buildConfig()}
        data={initialData}
        onChange={onChange}
        overrides={{ headerActions: () => null }}
      />
    </div>
  );
}

export default PuckEditor;
