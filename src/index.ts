/**
 * NextRush v2 - Main Entry Point
 *
 * @packageDocumentation
 */

// Core exports
export { createApp } from '@/core/app/application';
export { createContext } from '@/core/app/context';

// Type exports
export type {
  Application,
  Context,
  DotfilesPolicy,
  Middleware,
  RouteConfig,
  RouteHandler,
  Router,
  StaticFilesOptions,
  StatsLike,
  TemplateHelper,
  TemplatePluginOptions,
  TemplateRenderOptions,
  WebSocketPluginOptions,
  WSConnection,
  WSHandler,
  WSMiddleware,
} from '@/types/context';

export type { NextRushRequest, NextRushResponse } from '@/types/http';

// Error exports
export {
  AuthenticationError,
  AuthenticationExceptionFilter,
  AuthorizationError,
  AuthorizationExceptionFilter,
  BadRequestError,
  ConflictError,
  DatabaseError,
  ErrorFactory,
  ForbiddenError,
  GlobalExceptionFilter,
  InternalServerError,
  MethodNotAllowedError,
  NetworkError,
  NextRushError,
  NotFoundError,
  NotFoundExceptionFilter,
  RateLimitError,
  RateLimitExceptionFilter,
  ServiceUnavailableError,
  TimeoutError,
  TooManyRequestsError,
  UnauthorizedError,
  UnprocessableEntityError,
  ValidationError,
  ValidationExceptionFilter,
  type ExceptionFilter,
} from '@/errors/custom-errors';

// Logger Plugin exports
export {
  ConsoleTransport,
  createDevLogger,
  createMinimalLogger,
  createProdLogger,
  FileTransport,
  HttpTransport,
  LoggerPlugin,
  LogLevel,
  StreamTransport,
  type LogEntry,
  type LoggerConfig,
  type Transport,
} from '@/plugins/logger';

// Static Files Plugin
export { StaticFilesPlugin } from '@/plugins/static-files/static-files.plugin';

// Template Plugin
export { TemplatePlugin } from '@/plugins/template/template.plugin';

// WebSocket Plugin
export {
  WebSocketPlugin,
  type WSContext,
} from '@/plugins/websocket/websocket.plugin';

// Middleware exports
export { smartBodyParser as bodyParser } from '@/core/middleware/body-parser';
export { compression } from '@/core/middleware/compression';
export { cors } from '@/core/middleware/cors';
export { helmet } from '@/core/middleware/helmet';
export { logger } from '@/core/middleware/logger';
export { rateLimit } from '@/core/middleware/rate-limiter';
export { requestId } from '@/core/middleware/request-id';
export { timer } from '@/core/middleware/timer';

// Utility exports
export { RequestEnhancer } from '@/core/enhancers/request-enhancer';
export { ResponseEnhancer } from '@/core/enhancers/response-enhancer';
export { createRouter } from '@/core/router';

// Version info
export const VERSION = '2.0.0-alpha.1';
export const NODE_VERSION = '>=18.0.0';

// Import createApp for default export
import { createApp } from '@/core/app/application';

// Default export for convenience
export default {
  createApp,
  VERSION,
  NODE_VERSION,
} as const;
