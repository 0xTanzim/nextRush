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

// Body source exports
export { EdgeBodySource } from './body-source';

// Utility exports
export {
  detectEdgeRuntime,
  getContentLength,
  parseQueryString,
  type EdgeRuntimeInfo,
} from './utils';

// Re-export types for convenience
export type { BodySource, Runtime, RuntimeCapabilities } from '@nextrush/types';
