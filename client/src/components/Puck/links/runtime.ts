/**
 * Editor-only runtime config for the link UI, set once when the Puck editor
 * mounts and read by the page picker.
 *
 * The internal-page picker fetches from Wagtail's admin pages API, whose URL is
 * not knowable at build time (the admin can be mounted under any path, and the
 * API URL is reversed server-side). `puck.tsx` reads it from the widget's
 * `w-init` options and stores it here so the picker — rendered deep inside the
 * Puck field tree, where neither `puck.metadata` nor React context reach a
 * `custom` field's render — can pick it up from a plain module singleton. One
 * editor mounts per page, so a singleton is sufficient.
 *
 * The default is the conventional endpoint, so the picker still works if the
 * option is ever absent (e.g. the fork testapp).
 */
export interface LinkRuntime {
  /** Absolute path to the admin pages API listing endpoint. */
  pagesApiUrl: string;
}

let RUNTIME: LinkRuntime = {
  pagesApiUrl: '/admin/api/main/pages/',
};

export function setLinkRuntime(cfg: Partial<LinkRuntime> | null | undefined): void {
  if (!cfg) return;
  RUNTIME = {
    ...RUNTIME,
    ...(cfg.pagesApiUrl ? { pagesApiUrl: cfg.pagesApiUrl } : {}),
  };
}

export function getLinkRuntime(): LinkRuntime {
  return RUNTIME;
}
