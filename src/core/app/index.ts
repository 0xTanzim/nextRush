/**
 * Application Module Exports for NextRush v2
 *
 * Organized into logical submodules:
 * - context/ - Context creation, pooling, and methods
 * - server/ - Server lifecycle and request handling
 * - helpers/ - Factory and utility helpers
 *
 * @packageDocumentation
 */

// ==================== MAIN APPLICATION ====================
export { createApp, NextRushApplication } from './application';
export type { Application, ApplicationOptions } from './application';

// ==================== TYPES ====================
export { convertLogLevel } from './types';
export type { LoggerConfig, LogLevel, NextRushApp } from './types';

// ==================== CONTEXT MODULE ====================
// Context creation and management
export { clearContextPool, createContext, releaseContext } from './context';

// Context pool
export {
  acquireContext,
  clearPool,
  getPoolSize,
  getPoolStats,
  releaseToPool
} from './context-pool';

// Context methods
export {
  bindContextMethods,
  bindConvenienceMethods,
  ctxAssert,
  ctxCacheable,
  ctxFresh,
  ctxIdempotent,
  ctxSet,
  ctxStale,
  ctxThrow
} from './context-methods';

// Re-export from context subfolder for clean imports
export * from './context/index';

// ==================== SERVER MODULE ====================
// Request handling
export {
  createRequestHandler,
  executeMiddleware,
  executeRoute,
  type RequestHandlerConfig
} from './request-handler';

// Server lifecycle
export {
  createHttpServer,
  createServerLifecycle,
  shutdownServer,
  startServer,
  type ServerConfig,
  type ServerLifecycle
} from './server-lifecycle';

// Listen helpers
export {
  createListenHandler,
  parseListenParams,
  startServerWithCompilation,
  type ListenConfig,
  type ListenParams
} from './listen-helpers';

// Re-export from server subfolder for clean imports
export * from './server/index';

// ==================== HELPERS MODULE ====================
// Route registration
export {
  addMiddleware,
  createRouteHelpers,
  mountSubRouter,
  registerRoute,
  type HttpMethod,
  type RouteRegistrationConfig
} from './route-registry';

// Exception filter management
export {
  createExceptionFilterManager,
  EXCEPTION_FILTER_MARK,
  type ExceptionFilterManager
} from './exception-filter-manager';

// Logger helpers
export {
  createDevLogger,
  createLoggerHelpers,
  createLoggerWithConfig,
  createProdLogger,
  type LoggerHelpers
} from './logger-helpers';

// Middleware helpers
export {
  bindMiddlewareFactoryMethods,
  createMiddlewareHelpers,
  type MiddlewareHelpers
} from './middleware-helpers';

// Re-export from helpers subfolder for clean imports
export * from './helpers/index';
