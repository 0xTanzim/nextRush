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
export type { GracefulShutdownOptions, ServeOptions, ServerInstance } from './adapter';

// Context
export { HttpError } from '@nextrush/errors';
export { DenoContext, createDenoContext } from './context';

// Body Source
export { EmptyBodySource, createEmptyBodySource } from './body-source';

// Re-export shared error classes from @nextrush/runtime
export { BodyConsumedError, BodyTooLargeError } from '@nextrush/runtime';

// Utilities
// eslint-disable-next-line @typescript-eslint/no-deprecated -- F-09: intentional compat re-export, not a usage site
export { getContentLength, getContentType, parseQueryString } from './utils';

// Re-export types
export type { Application } from '@nextrush/core';
export type { BodySource, Context, HttpMethod, Middleware, Runtime } from '@nextrush/types';
