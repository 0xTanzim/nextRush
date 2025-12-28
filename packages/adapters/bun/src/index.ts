/**
 * @nextrush/adapter-bun - Bun HTTP Adapter
 *
 * This package provides the Bun HTTP adapter for NextRush.
 * It connects the Application to Bun.serve() for blazing fast performance.
 *
 * @packageDocumentation
 * @module @nextrush/adapter-bun
 */

// Adapter
export { createHandler, listen, serve } from './adapter';
export type { ServeOptions, ServerInstance } from './adapter';

// Context
export { BunContext, HttpError, createBunContext } from './context';

// Body Source
export {
    BodyConsumedError,
    BodyTooLargeError,
    BunBodySource, EmptyBodySource, createBunBodySource,
    createEmptyBodySource
} from './body-source';

// Utilities
export { getContentLength, getContentType, parseQueryString } from './utils';

// Re-export types
export type { Application } from '@nextrush/core';
export type { BodySource, Context, HttpMethod, Middleware, Runtime } from '@nextrush/types';
