import type { Config, Data, RootConfig } from '@puckeditor/core';
import {
  Button,
  Card,
  Flex,
  Grid,
  Heading,
  Hero,
  Logos,
  RichText,
  Space,
  Stats,
  Text,
} from './blocks';

/**
 * Page-level root config. Renders the main content drop zone. Header / footer
 * chrome from the demo is intentionally omitted — in Wagtail the surrounding
 * page shell is provided by the site template, not by Puck.
 *
 * The drop zone is the element that directly contains the top-level blocks, so
 * it is the natural home for the site's content-column class (e.g. `stream`):
 * with the blocks rendered `inline` (each attaching `puck.dragRef` to its own
 * `block-*` root, so Puck adds no extra wrapper) they are direct children of
 * this element on both the published page and the editor canvas, and the site's
 * `.<class> > *` measure rules apply identically in both. The class name is not
 * hardcoded — it rides in on `puck.metadata.renderClass`, fed from the
 * `WAGTAILPUCK_RENDER_CLASS` setting (SSR) / editor option (canvas). No wrapping
 * `<div>` is added here: an extra level would sit between the class and the
 * blocks and break the direct-child measure.
 */
export const root: RootConfig = {
  // No root fields: Puck's default root exposes a `title` field, but here it is
  // inert — it duplicates Wagtail's own page title and is never rendered (the
  // page shell is the site template, not Puck). Declaring `fields: {}` removes
  // that default field; dropping `defaultProps.title` stops seeding it. Existing
  // documents that stored `root.props.title` (e.g. the marketing homepage's
  // empty string) still load fine — the extra prop is simply ignored.
  fields: {},
  render: ({ puck }) => {
    const DropZone = puck.renderDropZone as any;
    const renderClass = (puck as any)?.metadata?.renderClass as
      | string
      | undefined;
    return (
      <DropZone
        zone="default-zone"
        className={renderClass || undefined}
      />
    );
  },
};

export const categories = {
  layout: {
    components: ['Grid', 'Flex', 'Space'],
  },
  typography: {
    components: ['Heading', 'Text', 'RichText'],
  },
  interactive: {
    title: 'Actions',
    components: ['Button'],
  },
  other: {
    title: 'Other',
    components: ['Card', 'Hero', 'Logos', 'Stats'],
  },
} as const;

/**
 * The single source of truth for the Puck configuration, shared by the admin
 * editor bundle and the SSR renderer bundle.
 */
export function buildConfig(): Config {
  return {
    root,
    categories: categories as any,
    components: {
      Button,
      Card,
      Flex,
      Grid,
      Heading,
      Hero,
      Logos,
      RichText,
      Space,
      Stats,
      Text,
    },
  } as Config;
}

/** A fresh empty Puck document. */
export const defaultData: Data = { content: [], root: { props: {} } };

/**
 * Coerce arbitrary parsed input into a valid Puck `Data` document. Puck throws
 * on malformed data, so empty / `{}` / `null` / partial objects are normalized
 * to a well-formed doc with an array `content` and a `root`.
 */
export function normalizeData(input: unknown): Data {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { content: [], root: { props: {} } };
  }

  const obj = input as Record<string, any>;
  const content = Array.isArray(obj.content) ? obj.content : [];
  const rootObj =
    obj.root && typeof obj.root === 'object' && !Array.isArray(obj.root)
      ? obj.root
      : { props: {} };

  const normalized: Data = { content, root: rootObj };
  if (obj.zones && typeof obj.zones === 'object') {
    (normalized as any).zones = obj.zones;
  }
  return normalized;
}
