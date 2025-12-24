/**
 * Type definitions for NextRush v2 Application
 *
 * @packageDocumentation
 */

import type { NextRushEventSystem, SimpleEventsAPI } from '@/core/events';
import type { ExceptionFilter } from '@/errors/custom-errors';
import type { LoggerPlugin } from '@/plugins/logger';
import type {
    Application,
    Middleware,
    RouteConfig,
    RouteHandler,
    Router,
} from '@/types/context';
import type { Server } from 'node:http';

/**
 * Logger level types
 */
export type LogLevel =
  | 'error'
  | 'warn'
  | 'info'
  | 'http'
  | 'verbose'
  | 'debug'
  | 'silly';

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  level?: LogLevel;
  transports?: unknown[];
  format?: 'json' | 'text' | 'combined';
  colorize?: boolean;
  timestamp?: boolean;
  context?: string;
  requestLogging?: boolean;
  performance?: boolean;
  structured?: boolean;
}

/**
 * NextRush Application interface extension
 */
export interface NextRushApp extends Application {
  // Event system
  readonly events: SimpleEventsAPI;
  readonly eventSystem: NextRushEventSystem;

  // Server access
  getServer(): Server;

  // Lifecycle
  shutdown(): Promise<void>;
  listen(port?: number, callback?: () => void): Server;
  listen(port?: number, host?: string, callback?: () => void): Server;

  // Route registration
  get(path: string, handler: RouteHandler | RouteConfig): NextRushApp;
  post(path: string, handler: RouteHandler | RouteConfig): NextRushApp;
  put(path: string, handler: RouteHandler | RouteConfig): NextRushApp;
  delete(path: string, handler: RouteHandler | RouteConfig): NextRushApp;
  patch(path: string, handler: RouteHandler | RouteConfig): NextRushApp;

  // Middleware
  use(middleware: Middleware): NextRushApp;
  use(prefix: string, router: Router): NextRushApp;

  // Router factory
  router(): Router;

  // Exception filter
  exceptionFilter(filters?: ExceptionFilter[]): Middleware;

  // Logger factory
  createLogger(config?: LoggerConfig): LoggerPlugin;
  createDevLogger(): LoggerPlugin;
  createProdLogger(): LoggerPlugin;
}

/**
 * Map log level string to numeric value
 */
export function convertLogLevel(level: LogLevel): number {
  const levelMap: Record<LogLevel, number> = {
    error: 0,
    warn: 1,
    info: 2,
    http: 2, // Same as info
    verbose: 3, // Same as debug
    debug: 3,
    silly: 4, // Same as trace
  };
  return levelMap[level] ?? 2; // Default to info
}
