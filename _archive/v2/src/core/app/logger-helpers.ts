/**
 * Logger Helpers for NextRush v2 Application
 *
 * Provides logger creation methods for the Application class.
 * Extracted from application.ts to maintain single responsibility.
 *
 * @packageDocumentation
 */

import {
  createDevLogger as createDevLoggerPlugin,
  createProdLogger as createProdLoggerPlugin,
  LoggerPlugin,
} from '@/plugins/logger';
import type { LoggerConfig } from './types';
import { convertLogLevel } from './types';

/**
 * Logger helper interface
 */
export interface LoggerHelpers {
  createLogger(config?: LoggerConfig): LoggerPlugin;
  createDevLogger(): LoggerPlugin;
  createProdLogger(): LoggerPlugin;
}

/**
 * Create a logger plugin with the given configuration
 *
 * Provides comprehensive logging capabilities similar to Winston/Pino
 * with multiple transports, structured logging, and performance optimization.
 *
 * @param config - Logger configuration options
 * @returns LoggerPlugin instance
 *
 * @example
 * ```typescript
 * const logger = createLoggerWithConfig({
 *   level: 'debug',
 *   requestLogging: true,
 *   performance: true
 * });
 * logger.install(app);
 * ```
 */
export function createLoggerWithConfig(config: LoggerConfig = {}): LoggerPlugin {
  const loggerConfig = {
    ...config,
    level: config.level ? convertLogLevel(config.level) : undefined,
  };
  return new LoggerPlugin(loggerConfig as unknown as ConstructorParameters<typeof LoggerPlugin>[0]);
}

/**
 * Create development logger
 *
 * Optimized for development with debug level, colors, and detailed logging.
 *
 * @returns Development logger plugin
 */
export function createDevLogger(): LoggerPlugin {
  return createDevLoggerPlugin();
}

/**
 * Create production logger
 *
 * Optimized for production with info level, JSON format, and file logging.
 *
 * @returns Production logger plugin
 */
export function createProdLogger(): LoggerPlugin {
  return createProdLoggerPlugin();
}

/**
 * Create logger helper methods
 *
 * @returns Object with logger creation methods
 */
export function createLoggerHelpers(): LoggerHelpers {
  return {
    createLogger: createLoggerWithConfig,
    createDevLogger,
    createProdLogger,
  };
}

/**
 * Bind logger helper methods to an object
 *
 * @param target - Object to bind methods to
 */
export function bindLoggerHelpers(target: Record<string, unknown>): void {
  target.createLogger = createLoggerWithConfig;
  target.createDevLogger = createDevLogger;
  target.createProdLogger = createProdLogger;
}
