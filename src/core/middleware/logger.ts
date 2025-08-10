/**
 * Logger Middleware for NextRush v2
 *
 * Provides request logging functionality
 *
 * @packageDocumentation
 */

import type { Context } from '@/types/context';
import type { LoggerOptions, Middleware } from './types';

/**
 * Default logger options
 */
const DEFAULT_LOGGER_OPTIONS: LoggerOptions = {
  format: 'combined',
  level: 'info',
  colorize: true,
  timestamp: true,
  showHeaders: false,
  showBody: false,
  showQuery: false,
  showResponseTime: true,
  showUserAgent: true,
  showReferer: true,
  showIP: true,
  showMethod: true,
  showURL: true,
  showStatus: true,
  showResponseSize: true,

  filter: () => true,
};

/**
 * Log levels and their numeric values
 */
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6,
} as const;

// type LogLevel = keyof typeof LOG_LEVELS;

/**
 * ANSI color codes for terminal output
 */
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
} as const;

/**
 * Get color for status code
 */
function getStatusColor(status: number): string {
  if (status >= 500) return COLORS.red;
  if (status >= 400) return COLORS.yellow;
  if (status >= 300) return COLORS.cyan;
  if (status >= 200) return COLORS.green;
  return COLORS.white;
}

/**
 * Get color for method
 */
function getMethodColor(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
      return COLORS.green;
    case 'POST':
      return COLORS.blue;
    case 'PUT':
      return COLORS.yellow;
    case 'DELETE':
      return COLORS.red;
    case 'PATCH':
      return COLORS.magenta;
    default:
      return COLORS.white;
  }
}

/**
 * Format timestamp
 */
function formatTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Format request log entry
 */
function formatRequestLog(
  ctx: Context,
  duration: number,
  options: Required<LoggerOptions>
): string {
  const {
    colorize,
    timestamp,
    showHeaders,
    showBody,
    showQuery,
    showResponseTime,
    showUserAgent,
    showReferer,
    showIP,
    showMethod,
    showURL,
    showStatus,
    showResponseSize,
    customFormat,
  } = options;

  // Use custom format if provided
  if (customFormat) {
    return customFormat(ctx, duration);
  }

  // Build log parts
  const parts: string[] = [];

  if (timestamp) {
    parts.push(formatTimestamp());
  }

  if (showIP) {
    parts.push(ctx.ip || 'unknown');
  }

  if (showMethod) {
    const method = ctx.method.toUpperCase();
    const methodStr = colorize
      ? `${getMethodColor(method)}${method}${COLORS.reset}`
      : method;
    parts.push(methodStr);
  }

  if (showURL) {
    parts.push(ctx.path || ctx.url || '/');
  }

  if (showStatus) {
    const status = ctx.res?.statusCode || ctx.status || 200;
    const statusStr = colorize
      ? `${getStatusColor(status)}${status}${COLORS.reset}`
      : status.toString();
    parts.push(statusStr);
  }

  if (showResponseTime) {
    parts.push(`${duration}ms`);
  }

  if (showResponseSize) {
    const size = ctx.res?.getHeader?.('content-length') || 0;
    parts.push(`${size}b`);
  }

  if (showUserAgent) {
    const userAgent = ctx.req?.headers?.['user-agent'] || '-';
    parts.push(`"${userAgent}"`);
  }

  if (showReferer) {
    const referer = ctx.req?.headers?.referer || '-';
    parts.push(`"${referer}"`);
  }

  if (showQuery && ctx.query && Object.keys(ctx.query).length > 0) {
    const queryStr = new URLSearchParams(
      ctx.query as Record<string, string>
    ).toString();
    parts.push(`query: ${queryStr}`);
  }

  if (
    showHeaders &&
    ctx.req?.headers &&
    Object.keys(ctx.req.headers).length > 0
  ) {
    const headersStr = JSON.stringify(ctx.req.headers);
    parts.push(`headers: ${headersStr}`);
  }

  if (showBody && ctx.body) {
    const bodyStr =
      typeof ctx.body === 'string' ? ctx.body : JSON.stringify(ctx.body);
    parts.push(`body: ${bodyStr}`);
  }

  return parts.join(' ');
}

/**
 * Create logger middleware
 *
 * @param options - Logger configuration options
 * @returns Logger middleware function
 *
 * @example
 * ```typescript
 * import { logger } from '@/core/middleware/logger';
 *
 * const app = createApp();
 *
 * // Basic logging
 * app.use(logger());
 *
 * // Advanced logging
 * app.use(logger({
 *   format: 'combined',
 *   level: 'info',
 *   colorize: true,
 *   showResponseTime: true,
 *   showUserAgent: true,
 * }));
 * ```
 */
export function logger(options: LoggerOptions = {}): Middleware {
  const config = { ...DEFAULT_LOGGER_OPTIONS, ...options };

  return async (ctx: Context, next: () => Promise<void>): Promise<void> => {
    try {
      // Skip logging if filter returns false
      let shouldLog = true;
      try {
        shouldLog = config.filter?.(ctx) ?? true;
      } catch (filterError) {
        // eslint-disable-next-line no-console
        console.error('Logger middleware error:', filterError);
        // Continue with logging even if filter fails
        shouldLog = true;
      }

      if (!shouldLog) {
        await next();
        return;
      }

      const start = Date.now();

      // Log request start (only in debug/verbose mode)
      const requestLog = formatRequestLog(
        ctx,
        0,
        config as Required<LoggerOptions>
      );
      if (config.level === 'debug' || config.level === 'verbose') {
        if (config.stream) {
          config.stream.write(`→ ${requestLog}\n`);
        } else {
          // eslint-disable-next-line no-console
          console.log(`→ ${requestLog}`);
        }
      }

      // Call next middleware
      try {
        await next();
      } catch (nextError) {
        // Log the error but continue with response logging
        // eslint-disable-next-line no-console
        console.error('Logger middleware error:', nextError);
      }

      // Calculate duration
      const duration = Date.now() - start;

      // Log response (always log responses)
      const responseLog = formatRequestLog(
        ctx,
        duration,
        config as Required<LoggerOptions>
      );
      if (config.stream) {
        config.stream.write(`← ${responseLog}\n`);
      } else {
        // eslint-disable-next-line no-console
        console.log(`← ${responseLog}`);
      }
    } catch (error) {
      // Handle errors gracefully
      // eslint-disable-next-line no-console
      console.error('Logger middleware error:', error);
      await next();
    }
  };
}

/**
 * Create logger middleware with custom format
 *
 * @param format - Custom format function
 * @param options - Logger configuration options
 * @returns Logger middleware function
 */
export function loggerWithFormat(
  format: (ctx: Context, duration: number) => string,
  options: LoggerOptions = {}
): Middleware {
  return logger({
    ...options,
    customFormat: format,
  });
}

/**
 * Create development logger with colors
 *
 * @param options - Logger configuration options
 * @returns Logger middleware function
 */
export function devLogger(options: LoggerOptions = {}): Middleware {
  return logger({
    colorize: true,
    timestamp: true,
    showResponseTime: true,
    showUserAgent: true,
    showIP: true,
    level: 'debug',
    ...options,
  });
}

/**
 * Create production logger without colors
 *
 * @param options - Logger configuration options
 * @returns Logger middleware function
 */
export function prodLogger(options: LoggerOptions = {}): Middleware {
  return logger({
    colorize: false,
    timestamp: true,
    showResponseTime: true,
    showUserAgent: false,
    showIP: true,
    level: 'info',
    ...options,
  });
}

/**
 * Create minimal logger
 *
 * @param options - Logger configuration options
 * @returns Logger middleware function
 */
export function minimalLogger(options: LoggerOptions = {}): Middleware {
  return logger({
    timestamp: false,
    showResponseTime: true,
    showUserAgent: false,
    showIP: false,
    showReferer: false,
    showQuery: false,
    showHeaders: false,
    showBody: false,
    showResponseSize: false,
    ...options,
  });
}

/**
 * Logger utilities for testing and advanced usage
 */
export const loggerUtils = {
  /**
   * Get color for status code
   */
  getStatusColor,

  /**
   * Get color for method
   */
  getMethodColor,

  /**
   * Format timestamp
   */
  formatTimestamp,

  /**
   * Format request log
   */
  formatRequestLog,

  /**
   * Default logger options
   */
  DEFAULT_OPTIONS: DEFAULT_LOGGER_OPTIONS,

  /**
   * Log levels
   */
  LOG_LEVELS,

  /**
   * Colors
   */
  COLORS,
};
