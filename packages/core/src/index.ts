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
  Logger,
  Routable,
} from './application';

// Middleware
export { compose, flattenMiddleware, isMiddleware } from './middleware';
export type { ComposeOptions, ComposedMiddleware } from './middleware';

// Errors
export {
  BadRequestError,
  ForbiddenError,
  HttpError,
  InternalServerError,
  NextRushError,
  NotFoundError,
  UnauthorizedError,
  createHttpError,
} from './errors';

// Re-export types for convenience
export type {
  Context,
  ContextState,
  HttpMethod,
  HttpStatusCode,
  Middleware,
  Next,
  Plugin,
  PluginWithHooks,
  QueryParams,
  RouteHandler,
  RouteParams,
} from '@nextrush/types';

// Re-export constants
export { ContentType, HttpStatus } from '@nextrush/types';
