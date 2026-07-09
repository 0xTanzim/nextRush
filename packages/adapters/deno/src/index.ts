/**
 * @nextrush/adapter-deno - Deno HTTP Adapter
 *
 * This package provides the Deno HTTP adapter for NextRush.
 * It connects the Application to Deno.serve() for secure, modern runtime.
 *
 * @packageDocumentation
 * @module @nextrush/adapter-deno
 */

// Adapter
export { createHandler, listen, serve } from './adapter';
export type { ServeOptions, ServerInstance } from './adapter';

// Context
export { HttpError } from '@nextrush/errors';
export { DenoContext, createDenoContext } from './context';

// Body Source
export { EmptyBodySource, createEmptyBodySource } from './body-source';

// Deprecated back-compat aliases (renamed to `WebBodySource` / `createWebBodySource`
// in @nextrush/runtime). Re-exported for one major cycle; the `@deprecated` JSDoc
// still signals the rename to consumers' IDEs.
/* eslint-disable @typescript-eslint/no-deprecated -- intentional back-compat re-export */
export { DenoBodySource, createDenoBodySource } from './body-source';
/* eslint-enable @typescript-eslint/no-deprecated */

// Re-export shared error classes from @nextrush/runtime
export { BodyConsumedError, BodyTooLargeError } from '@nextrush/runtime';

// Utilities
export { getContentLength, getContentType, parseQueryString } from './utils';

// Re-export types
export type { Application } from '@nextrush/core';
export type { BodySource, Context, HttpMethod, Middleware, Runtime } from '@nextrush/types';
