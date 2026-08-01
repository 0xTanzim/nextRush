/**
 * @nextrush/adapter-edge - Body Source
 *
 * The bespoke `EdgeBodySource`/`EmptyBodySource`/`concatUint8Arrays` have been
 * collapsed onto the shared cross-runtime {@link WebBodySource} in
 * `@nextrush/runtime` (audit F-04a). Body-reading behavior is now identical
 * across the Web adapters (Bun/Deno/Edge) and fixed in one place.
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
