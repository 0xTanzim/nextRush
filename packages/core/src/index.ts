/**
 * @nextrush/core - NextRush Core Package
 *
 * The core package provides the fundamental building blocks:
 * - Application class for managing middleware and plugins
 * - Middleware composition
 * - Error handling
 *
 * @packageDocumentation
 * @module @nextrush/core
 */

// Application
export { Application, createApp } from './application';
export type {
  ApplicationOptions,
  ErrorHandler,
  ListenCallback,
  Routable,
} from './application';

// Middleware
export { compose, flattenMiddleware, isMiddleware } from './middleware';
export type { ComposeOptions, ComposedMiddleware } from './middleware';

// Universal Fetch
export { DEFAULT_UNIVERSAL_TIMEOUT_MS } from '@nextrush/runtime';
export type {
  UniversalFetchOptions,
  UniversalWebContext,
} from '@nextrush/runtime';

// Errors
export {
  BadRequestError,
  ForbiddenError,
  HttpError,
  InternalServerError,
  NextRushError,
  NotFoundError,
  UnauthorizedError,
} from './errors';

// Re-export types for convenience
export type {
  Context,
  ContextState,
  Extension,
  ExtensionContext,
  ExtensionHost,
  HttpMethod,
  HttpStatusCode,
  Logger,
  Middleware,
  Next,
  QueryParams,
  RouteEntry,
  RouteHandler,
  RouteParams,
  Router,
  UniversalFetchHandler,
} from '@nextrush/types';

// Re-export constants
export { ContentType, HttpStatus } from '@nextrush/types';
