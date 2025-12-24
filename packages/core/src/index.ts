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
export type { ApplicationOptions, ListenCallback } from './application';

// Middleware
export { compose, isMiddleware, flattenMiddleware } from './middleware';
export type { ComposedMiddleware } from './middleware';

// Errors
export {
  NextRushError,
  HttpError,
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  InternalServerError,
  createHttpError,
} from './errors';

// Re-export types for convenience
export type {
  Context,
  Middleware,
  Next,
  RouteHandler,
  Plugin,
  PluginWithHooks,
  HttpMethod,
  HttpStatusCode,
  RouteParams,
  QueryParams,
  ContextState,
} from '@nextrush/types';

// Re-export constants
export { HttpStatus, ContentType } from '@nextrush/types';
