import { Puck } from '@puckeditor/core';
import type { Data } from '@puckeditor/core';
import { buildConfig } from './config';
import { TakeoverFrame } from './TakeoverFrame';

export type PuckEditorProps = {
  initialData: Data;
  onChange: (data: Data) => void;
  /**
   * Stylesheets to inject into the preview iframe so the canvas renders under
   * the site's CSS. Supplied by the widget (see PuckWidget.get_preview_css).
   */
  previewCss?: string[];
  /**
   * The site's content-column class, applied to the canvas drop zone (via Puck
   * metadata → the root render) so the content measure matches the published
   * page. Supplied by the widget (see PuckWidget / get_render_class).
   */
  renderClass?: string;
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
 *
 * `iframe.syncHostStyles: false` stops Puck's AutoFrame from cloning the admin
 * document's stylesheets into the preview iframe (which made canvas content look
 * admin-styled instead of site-styled). Puck's own iframe-internal interaction
 * styles — drag previews, drop placeholders, selection outlines — are injected
 * separately (useInjectIframeCss) and are unaffected. The site's CSS is injected
 * in its place by `TakeoverFrame` from `previewCss`.
 */
export function PuckEditor({
  initialData,
  onChange,
  previewCss,
  renderClass,
}: PuckEditorProps) {
  return (
    <Puck
      config={buildConfig()}
      data={initialData}
      onChange={onChange}
      metadata={{ renderClass: renderClass || '' }}
      iframe={{ syncHostStyles: false }}
    >
      <TakeoverFrame previewCss={previewCss} />
    </Puck>
  );
}

export default PuckEditor;
