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
export { DenoContext, HttpError, createDenoContext } from './context';

// Body Source
export {
    BodyConsumedError,
    BodyTooLargeError, DenoBodySource,
    EmptyBodySource, createDenoBodySource,
    createEmptyBodySource
} from './body-source';

// Utilities
export { getContentLength, getContentType, parseQueryString } from './utils';

// Re-export types
export type { Application } from '@nextrush/core';
export type { BodySource, Context, HttpMethod, Middleware, Runtime } from '@nextrush/types';
