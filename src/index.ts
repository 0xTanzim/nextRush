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

// Middleware exports
export * from './middleware/built-in';
export * from './middleware/compose';
export * from './middleware/presets';

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

// Helper utilities
export * from './helpers';

// 🚀 WebSocket support (zero dependencies)
export {
  enhanceApplicationWithWebSocket,
  WebSocketIntegration,
  WebSocketServer,
} from './websocket';

// WebSocket type exports
export type {
  ConnectionEvents,
  NextRushWebSocket,
  RoomEmitter,
  RoomInfo,
  TypedWebSocketEvents,
  WebSocketCloseCode,
  WebSocketHandler,
  WebSocketMessage,
  WebSocketMiddleware,
  WebSocketOpcode,
  WebSocketOptions,
  WebSocketReadyState,
  WebSocketStats,
} from './types/websocket';

// Auto-initialize WebSocket support
import { enhanceApplicationWithWebSocket } from './websocket';

// Enhance Application with WebSocket capabilities
enhanceApplicationWithWebSocket();

/**
 * Create a new NextRush application instance
 * Now with built-in WebSocket support!
 *
 * @param options - Application and WebSocket options
 * @returns NextRush application instance with WebSocket capabilities
 */
export function createApp(
  options: ApplicationOptions & {
    websocket?: boolean | import('./types/websocket').WebSocketOptions;
  } = {}
): Application {
  const { websocket, ...appOptions } = options;
  const app = new Application(appOptions);

  // Auto-enable WebSocket if requested
  if (websocket) {
    const wsOptions = typeof websocket === 'boolean' ? {} : websocket;
    (app as any).enableWebSocket(wsOptions);
  }

  return app;
}

/**
 * Create a new router instance
 */
export function createRouter(options?: RouterOptions): Router {
  return new Router(options);
}

// Default export - Application class for compatibility
export default Application;
