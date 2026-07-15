import type { Data } from '@puckeditor/core';

/**
 * The stored Puck document shape.
 *
 * This is the opaque JSON blob persisted in the Wagtail model's JSONField and
 * round-tripped through the hidden-input widget. It is a plain Puck `Data`
 * document (`{ content, root, zones? }`).
 */
export type PuckDoc = Data;
