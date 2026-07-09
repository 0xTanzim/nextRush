/**
 * @nextrush/adapter-deno - Body Source
 *
 * The bespoke `DenoBodySource`/`EmptyBodySource`/`concatUint8Arrays` have been
 * collapsed onto the shared cross-runtime {@link WebBodySource} in
 * `@nextrush/runtime` (audit F-04a). Body-reading behavior is now identical
 * across the Web adapters (Bun/Deno/Edge) and fixed in one place.
 *
 * The old names remain as backward-compatible re-export aliases so the public
 * API surface does not break.
 *
 * @packageDocumentation
 */

import {
  createEmptyBodySource,
  createWebBodySource,
  EmptyBodySource,
  WebBodySource,
} from '@nextrush/runtime';

export { createEmptyBodySource, createWebBodySource, EmptyBodySource, WebBodySource };

/**
 * @deprecated Renamed to {@link WebBodySource} (from `@nextrush/runtime`). This
 * alias is kept for backward compatibility and will be removed in a future
 * major version.
 */
export const DenoBodySource = WebBodySource;
export type DenoBodySource = WebBodySource;

/**
 * @deprecated Use {@link createWebBodySource} from `@nextrush/runtime`.
 */
export const createDenoBodySource = createWebBodySource;
