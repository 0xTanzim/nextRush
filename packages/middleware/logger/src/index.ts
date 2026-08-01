/**
 * @nextrush/logger - Request logging middleware for NextRush
 *
 * This package wraps @nextrush/log and provides:
 * - Re-exports of all @nextrush/log functionality
 * - Request logging middleware for NextRush applications
 * - Automatic correlation ID handling
 * - Context-attached logger for request handlers
 *
 * @example
 * ```typescript
 * import { createApp } from '@nextrush/core';
 * import { logger, createLogger } from '@nextrush/logger';
 *
 * const app = createApp();
 *
 * // Request logging middleware
 * app.use(logger());
 *
 * // Direct logging for application code
 * const log = createLogger('MyService');
 * log.info('Server starting');
 *
 * // Access logger in handlers via context
 * app.use(async (ctx) => {
 *   ctx.log.info('Processing request');
 *   ctx.json({ ok: true });
 * });
 * ```
 *
 * @packageDocumentation
 */

// ============================================================================
// Re-export everything from @nextrush/log
// ============================================================================

export {
    addGlobalTransport,
    clearGlobalTransports, compareLevels,
    // Configuration
    configure,
    configureFromEnv, containsSensitivePattern, createBatchTransport,
    // Transports
    createConsoleTransport, createContextMiddleware, createFilteredTransport,
    // Core
    createLogger, createNamespaceRateLimitedTransport, createPredicateTransport,
    createRateLimitedTransport, DEFAULT_SENSITIVE_KEYS, logger as defaultLogger,
    // Runtime
    detectRuntime, disableLogging, disableNamespaces, enableLogging, enableNamespaces,
    // Formatters
    formatJSON,
    formatPrettyJSON,
    formatPrettyTerminal, formatPrettyTimestamp,
    // Utilities
    formatTimestamp, getAsyncContext,
    getContextCorrelationId,
    getContextMetadata, getEnvVar, getGlobalConfig, getProcessId, getRuntime, getTime, isAsyncContextAvailable, isError, isNamespaceEnabled, isProductionBuild, isValidLogLevel, log, LOG_LEVEL_PRIORITY,
    // Levels
    LOG_LEVELS, Logger, mergeSensitiveKeys, onConfigChange, parseLogLevel, redactSensitiveValues, resetGlobalConfig,
    // Context (AsyncLocalStorage)
    runWithContext,
    // Serializers
    safeSerialize, sanitizeContext, scopedLogger, serializeError, setGlobalLevel, shouldLog, shouldRedact, type AsyncLogContext,
    // Types
    type BatchTransport,
    type BatchTransportOptions, type GlobalLoggerConfig, type ILogger,
    type LogContext,
    type LogEntry,
    type LoggerOptions,
    type LogLevel,
    type LogTransport, type NamespaceRateLimits, type PerformanceMetrics, type RateLimitOptions,
    type RateLimitStats, type RuntimeEnvironment,
    type RuntimeInfo,
    type SerializedError,
    type Timer
} from '@nextrush/log';

// ============================================================================
// NextRush-specific Types
// ============================================================================

import { createLogger, isProductionBuild, type ILogger, type LoggerOptions, type LogLevel } from '@nextrush/log';
import type { Context, Middleware } from '@nextrush/types';

/**
 * Extended context with logger attached
 *
 * Use this type when you need typed access to ctx.log
 *
 * @example
 * ```typescript
 * import type { LoggerContext } from '@nextrush/logger';
 *
 * app.get('/users', async (ctx) => {
 *   (ctx as LoggerContext).log.info('Processing request');
 * });
 *
 * // Or use the hasLogger type guard
 * if (hasLogger(ctx)) {
 *   ctx.log.info('Now typed correctly');
 * }
 * ```
 */
export interface LoggerContext extends Context {
  /** Request-scoped logger with correlation ID */
  log: ILogger;
}

/**
 * Options for the logger middleware
 */
export interface LoggerMiddlewareOptions extends LoggerOptions {
  /**
   * Skip logging for certain requests
   * @example
   * ```typescript
   * logger({ skip: (ctx) => ctx.path === '/health' })
   * ```
   */
  skip?: (ctx: Context) => boolean;

  /**
   * Custom message formatter
   * @default `${method} ${path}`
   */
  formatMessage?: (ctx: Context, duration: number) => string;

  /**
   * Log level for successful requests (2xx, 3xx)
   * @default 'info'
   */
  successLevel?: LogLevel;

  /**
   * Log level for client errors (4xx)
   * @default 'warn'
   */
  clientErrorLevel?: LogLevel;

  /**
   * Log level for server errors (5xx)
   * @default 'error'
   */
  serverErrorLevel?: LogLevel;

  /**
   * Whether to log request start
   * @default true in development, false in production
   */
  logRequestStart?: boolean;

  /**
   * Header name for correlation ID
   * @default 'x-request-id'
   */
  correlationIdHeader?: string;

  /**
   * Generate correlation ID if not present in headers
   * @default true
   */
  generateCorrelationId?: boolean;

  /**
   * Logger context/name prefix
   * @default 'nextrush'
   */
  context?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique correlation ID using crypto when available
 * Falls back to timestamp + random for environments without crypto
 */
function generateCorrelationId(): string {
  // Use crypto.randomUUID() when available (Node.js 19+, modern browsers, Deno, Bun)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Fallback: timestamp + random (sufficient for most use cases)
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

/**
 * Get correlation ID from request headers
 * Handles string and array header values safely
 */
function getCorrelationIdFromHeaders(
  ctx: Context,
  headerName: string,
): string | undefined {
  // Safety check for undefined headers
  if (!ctx.headers || typeof ctx.headers !== 'object') {
    return undefined;
  }

  const value = ctx.headers[headerName.toLowerCase()];
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
    return value[0];
  }
  return undefined;
}

/**
 * Determine log level based on status code
 */
function getLogLevelForStatus(
  status: number,
  options: {
    successLevel: LogLevel;
    clientErrorLevel: LogLevel;
    serverErrorLevel: LogLevel;
  },
): LogLevel {
  if (status >= 500) {
    return options.serverErrorLevel;
  }
  if (status >= 400) {
    return options.clientErrorLevel;
  }
  return options.successLevel;
}

// ============================================================================
// Logger Middleware
// ============================================================================

/**
 * Request logging middleware for NextRush
 *
 * Features:
 * - Automatic request/response logging
 * - Correlation ID extraction/generation
 * - Attaches logger to context as `ctx.log`
 * - Duration tracking
 * - Configurable log levels per status code
 *
 * @example
 * ```typescript
 * import { createApp } from '@nextrush/core';
 * import { logger } from '@nextrush/logger';
 *
 * const app = createApp();
 *
 * // Basic usage
 * app.use(logger());
 *
 * // With options
 * app.use(logger({
 *   minLevel: 'info',
 *   skip: (ctx) => ctx.path === '/health',
 *   logRequestStart: true,
 * }));
 *
 * // Access logger in handlers
 * app.use(async (ctx) => {
 *   ctx.log.info('Processing', { userId: ctx.params.id });
 *   ctx.json({ ok: true });
 * });
 * ```
 */
export function logger(options: LoggerMiddlewareOptions = {}): Middleware {
  const {
    skip,
    formatMessage,
    successLevel = 'info',
    clientErrorLevel = 'warn',
    serverErrorLevel = 'error',
    logRequestStart = !isProductionBuild(),
    correlationIdHeader = 'x-request-id',
    generateCorrelationId: shouldGenerateId = true,
    context: loggerContext = 'nextrush',
    ...loggerOptions
  } = options;

  const baseLogger = createLogger(loggerContext, loggerOptions);

  return async (ctx: Context, next: () => Promise<void>): Promise<void> => {
    // Skip logging for certain paths
    if (skip?.(ctx)) {
      return next();
    }

    const start = Date.now();

    // Get or generate correlation ID
    let correlationId = getCorrelationIdFromHeaders(ctx, correlationIdHeader);
    if (!correlationId && shouldGenerateId) {
      correlationId = generateCorrelationId();
    }

    // Create request-scoped logger with correlation ID
    const requestLogger = correlationId
      ? baseLogger.withCorrelationId(correlationId)
      : baseLogger;

    // Attach logger to context
    (ctx as LoggerContext).log = requestLogger;

    // Set correlation ID in response header
    if (correlationId) {
      ctx.set(correlationIdHeader, correlationId);
    }

    // Log request start (development only by default)
    if (logRequestStart) {
      requestLogger.debug('Request started', {
        method: ctx.method,
        path: ctx.path,
        query: Object.keys(ctx.query).length > 0 ? ctx.query : undefined,
        ip: ctx.ip,
      });
    }

    let error: Error | undefined;

    try {
      await next();
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
      throw err;
    } finally {
      const duration = Date.now() - start;
      const status = ctx.status || 200;

      // Format log message
      const message = formatMessage?.(ctx, duration) ?? `${ctx.method} ${ctx.path}`;

      // Determine log level based on status
      const level = getLogLevelForStatus(status, {
        successLevel,
        clientErrorLevel,
        serverErrorLevel,
      });

      // Build log data
      const logData: Record<string, unknown> = {
        method: ctx.method,
        path: ctx.path,
        status,
        duration,
      };

      // Add query params if present
      if (Object.keys(ctx.query).length > 0) {
        logData['query'] = ctx.query;
      }

      // Add error if present
      if (error) {
        requestLogger.error(message, error, logData);
      } else {
        // Use the appropriate log method based on level
        switch (level) {
          case 'trace':
            requestLogger.trace(message, logData);
            break;
          case 'debug':
            requestLogger.debug(message, logData);
            break;
          case 'info':
            requestLogger.info(message, logData);
            break;
          case 'warn':
            requestLogger.warn(message, logData);
            break;
          case 'error':
            requestLogger.error(message, logData);
            break;
          case 'fatal':
            requestLogger.fatal(message, logData);
            break;
        }
      }
    }
  };
}

// ============================================================================
// Utility Middleware
// ============================================================================

/**
 * Create a middleware that attaches a logger to context without request logging
 *
 * Use this when you want `ctx.log` available but don't need request logging
 *
 * @example
 * ```typescript
 * app.use(attachLogger({ context: 'api' }));
 *
 * app.use(async (ctx) => {
 *   ctx.log.info('Handler called');
 * });
 * ```
 */
export function attachLogger(options: LoggerMiddlewareOptions = {}): Middleware {
  const {
    correlationIdHeader = 'x-request-id',
    generateCorrelationId: shouldGenerateId = true,
    context: loggerContext = 'nextrush',
    ...loggerOptions
  } = options;

  const baseLogger = createLogger(loggerContext, loggerOptions);

  return async (ctx: Context, next: () => Promise<void>): Promise<void> => {
    // Get or generate correlation ID
    let correlationId = getCorrelationIdFromHeaders(ctx, correlationIdHeader);
    if (!correlationId && shouldGenerateId) {
      correlationId = generateCorrelationId();
    }

    // Create request-scoped logger
    const requestLogger = correlationId
      ? baseLogger.withCorrelationId(correlationId)
      : baseLogger;

    // Attach to context
    (ctx as LoggerContext).log = requestLogger;

    // Set correlation ID in response header
    if (correlationId) {
      ctx.set(correlationIdHeader, correlationId);
    }

    await next();
  };
}

/**
 * Type guard to check if context has logger attached
 */
export function hasLogger(ctx: Context): ctx is LoggerContext {
  return 'log' in ctx && typeof (ctx as LoggerContext).log?.info === 'function';
}

/**
 * Get logger from context, or create a fallback
 */
export function getLogger(ctx: Context, fallbackContext = 'nextrush'): ILogger {
  if (hasLogger(ctx)) {
    return ctx.log;
  }
  return createLogger(fallbackContext);
}
