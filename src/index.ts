import { Application, ApplicationOptions } from './core/application';
import { Router } from './routing/router';
import { RouterOptions } from './types';

/**
 * NextRush Framework - Modern, fast, and testable Express.js alternative
 *
 * This is the main entry point for the NextRush framework.
 * It follows the principles of:
 * - Single Responsibility
 * - Dependency Injection
 * - Interface-based Design
 * - Testability
 * - Clear separation of concerns
 */

// Core exports
export { Application, type ApplicationOptions } from './core/application';

// Type exports
export type {
  AnyFunction,
  AsyncHandler,
  BodyParserOptions,
  Configurable,
  ContentType,
  DeepPartial,
  Dict,
  Disposable,
  // Express-style types (familiar API)
  ExpressHandler,
  ExpressMiddleware,
  // HTTP types
  HttpMethod,
  MiddlewareHandler,
  NextFunction,
  NextRushRequest,
  NextRushResponse,
  Optional,
  ParsedRequest,
  ParsedResponse,
  // Routing types
  Path,
  // Common types
  Primitive,
  RequestContext,
  RequestParsingOptions,
  ResponseOptions,
  Route,
  RouteBuilder,
  RouteHandler,
  RouteMatch,
  RouteMatcher,
  RouterOptions,
  SyncHandler,
} from './types';

// HTTP handling exports
export {
  BodyParser,
  RequestHandler,
  ResponseHandler,
  type ParsedBody,
  type ResponseData,
} from './http';

// Routing exports
export {
  RouteManager,
  RouteMatcher as RouteMatcherClass,
  Router,
  type RouteManagerOptions,
  type RouteMatcherOptions,
} from './routing';

// Error handling exports
export {
  ErrorHandler,
  InternalServerError,
  MethodNotAllowedError,
  NextRushError,
  NotFoundError,
  PayloadTooLargeError,
  RequestTimeoutError,
  UnsupportedMediaTypeError,
  ValidationError,
  type ErrorHandlerConfig,
} from './errors';

// Utility exports
export {
  buildContentType,
  // Content type utilities
  CONTENT_TYPES,
  extractParamNames,
  getExtension,
  getMimeType,
  isContentType,
  isSafePath,
  isValidObject,
  joinPaths,
  matchPath,
  // Path utilities
  normalizePath,
  parseContentType,
  pathToRegExp,
  // Validation utilities
  validate,
  validateObject,
  ValidationRules,
  type ValidationResult,
  type ValidationRule,
} from './utils';

/**
 * Create a new NextRush application instance
 */
export function createApp(options?: ApplicationOptions): Application {
  return new Application(options);
}

/**
 * Create a new router instance
 */
export function createRouter(options?: RouterOptions): Router {
  return new Router(options);
}

// Default export - Application class for compatibility
export default Application;
