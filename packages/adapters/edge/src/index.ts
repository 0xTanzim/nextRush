/**
 * @nextrush/adapter-edge - Edge Runtime Adapter for NextRush
 *
 * Provides universal Edge runtime support for:
 * - Cloudflare Workers
 * - Vercel Edge Functions
 * - Netlify Edge Functions
 * - Any runtime supporting the Fetch API
 *
 * @packageDocumentation
 * @module @nextrush/adapter-edge
 */

// Main adapter functions
export {
  createCloudflareHandler,
  createFetchHandler,
  createHandler,
  createNetlifyHandler,
  createVercelHandler,
  type CloudflareFetchHandler, // Alias
  type FetchHandler,
  type FetchHandlerOptions,
} from './adapter';

// Context exports
export { EdgeContext, createEdgeContext, type EdgeExecutionContext } from './context';

// HttpError re-export (uniform across all adapters — audit F-10)
export { HttpError } from '@nextrush/errors';

// Body source exports (F-10: previously only `EdgeBodySource` was exported;
// the rest were dead. Now the full shared surface is wired up.)
export {
  createEmptyBodySource,
  createWebBodySource,
  EmptyBodySource,
  WebBodySource,
} from './body-source';

// Deprecated back-compat aliases (renamed to `WebBodySource` / `createWebBodySource`
// in @nextrush/runtime). Re-exported for one major cycle so existing imports keep
// working; the `@deprecated` JSDoc still signals the rename to consumers' IDEs.
/* eslint-disable @typescript-eslint/no-deprecated -- intentional back-compat re-export */
export { createEdgeBodySource, EdgeBodySource } from './body-source';
/* eslint-enable @typescript-eslint/no-deprecated */

// Shared error classes (parity with node/bun/deno — audit F-10)
export { BodyConsumedError, BodyTooLargeError } from '@nextrush/runtime';

// Utility exports
export {
  detectEdgeRuntime,
  getContentLength,
  getContentType,
  parseQueryString,
  type EdgeRuntimeInfo,
} from './utils';

// Re-export types for convenience (parity with node/bun/deno — audit F-10)
export type {
  BodySource,
  Context,
  HttpMethod,
  Middleware,
  Runtime,
  RuntimeCapabilities,
} from '@nextrush/types';
