/**
 * Request ID Middleware for NextRush v2
 *
 * Provides request ID generation and tracking functionality
 *
 * @packageDocumentation
 */

import type { Context } from '@/types/context';
import { randomBytes } from 'node:crypto';
import type { Middleware, RequestIdOptions } from './types';

/**
 * Simple logger interface to avoid console dependencies
 */
interface Logger {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
}

/**
 * No-op logger for production environments
 */
const noopLogger: Logger = {
  log: () => {},
  error: () => {},
  warn: () => {},
  info: () => {},
};

/**
 * Console logger for development
 */
const consoleLogger: Logger = {
  log: (...args: unknown[]) => {
    // eslint-disable-next-line no-console
    console.log(...args);
  },
  error: (...args: unknown[]) => {
    // eslint-disable-next-line no-console
    console.error(...args);
  },
  warn: (...args: unknown[]) => {
    // eslint-disable-next-line no-console
    console.warn(...args);
  },
  info: (...args: unknown[]) => {
    // eslint-disable-next-line no-console
    console.info(...args);
  },
};

/**
 * Default logger implementation
 */
const defaultLogger: Logger =
  process.env['NODE_ENV'] === 'production' ? noopLogger : consoleLogger;

/**
 * Default request ID options
 */
const DEFAULT_REQUEST_ID_OPTIONS: Required<RequestIdOptions> = {
  headerName: 'X-Request-ID',
  generator: generateUUID,
  addResponseHeader: true,
  echoHeader: false,
  setInContext: true,
  includeInLogs: true,
};

/**
 * Generate a UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate a timestamp-based ID
 */
function generateTimestampId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a crypto-based ID
 */
function generateCryptoId(): string {
  return randomBytes(8).toString('hex');
}

/**
 * Create request ID middleware
 *
 * @param options - Request ID configuration options
 * @returns Request ID middleware function
 *
 * @example
 * ```typescript
 * import { requestId } from '@/core/middleware/request-id';
 *
 * const app = createApp();
 *
 * // Basic request ID
 * app.use(requestId());
 *
 * // Advanced request ID
 * app.use(requestId({
 *   headerName: 'X-Correlation-ID',
 *   generator: () => generateUUID(),
 *   addResponseHeader: true,
 *   echoHeader: true,
 * }));
 * ```
 */
export function requestId(options: RequestIdOptions = {}): Middleware {
  const config = { ...DEFAULT_REQUEST_ID_OPTIONS, ...options };

  return async (ctx: Context, next: () => Promise<void>): Promise<void> => {
    let requestId: string;

    try {
      // Check if request ID is already in headers
      requestId = ctx.req?.headers?.[config.headerName.toLowerCase()] as string;

      // Handle whitespace-only or empty request IDs
      if (requestId && requestId.trim() === '') {
        requestId = '';
      }

      // Generate new request ID if not found (and not in echo mode)
      if (!requestId && !config.echoHeader) {
        try {
          requestId = config.generator();
        } catch {
          // Fallback to UUID if generator fails
          requestId = generateUUID();
        }
      }

      // Set request ID in request headers (only if we have an ID)
      if (requestId && ctx.req?.headers) {
        ctx.req.headers[config.headerName.toLowerCase()] = requestId;
      }

      // Set request ID in context
      if (config.setInContext && requestId) {
        ctx.id = requestId;
      }

      // Add request ID to response headers
      if (config.addResponseHeader && requestId && ctx.res?.setHeader) {
        ctx.res.setHeader(config.headerName, requestId);
      }

      // Add request ID to logs if configured
      if (config.includeInLogs && requestId) {
        // Store request ID in context for logging
        ctx.requestId = requestId;

        // Create request-specific logger that can be used by other middleware
        const requestLogger: Logger = {
          log: (...args: unknown[]) =>
            defaultLogger.log(`[${requestId}]`, ...args),
          error: (...args: unknown[]) =>
            defaultLogger.error(`[${requestId}]`, ...args),
          warn: (...args: unknown[]) =>
            defaultLogger.warn(`[${requestId}]`, ...args),
          info: (...args: unknown[]) =>
            defaultLogger.info(`[${requestId}]`, ...args),
        };

        // Store logger in context for other middleware to use
        ctx.logger = requestLogger;
      }
    } catch (error) {
      // Silently handle any errors to prevent middleware from crashing
      defaultLogger.warn('Request ID middleware error:', error);
    }

    await next();
  };
}

/**
 * Create request ID middleware with UUID generator
 *
 * @param options - Request ID configuration options
 * @returns Request ID middleware function
 */
export function requestIdWithUUID(options: RequestIdOptions = {}): Middleware {
  return requestId({
    ...options,
    generator: generateUUID,
  });
}

/**
 * Create request ID middleware with timestamp generator
 *
 * @param options - Request ID configuration options
 * @returns Request ID middleware function
 */
export function requestIdWithTimestamp(
  options: RequestIdOptions = {}
): Middleware {
  return requestId({
    ...options,
    generator: generateTimestampId,
  });
}

/**
 * Create request ID middleware with crypto generator
 *
 * @param options - Request ID configuration options
 * @returns Request ID middleware function
 */
export function requestIdWithCrypto(
  options: RequestIdOptions = {}
): Middleware {
  return requestId({
    ...options,
    generator: generateCryptoId,
  });
}

/**
 * Create request ID middleware that echoes existing headers
 *
 * @param options - Request ID configuration options
 * @returns Request ID middleware function
 */
export function requestIdEcho(options: RequestIdOptions = {}): Middleware {
  return requestId({
    ...options,
    echoHeader: true,
  });
}

/**
 * Create request ID middleware with metrics
 *
 * @param options - Request ID configuration options
 * @returns Request ID middleware function with performance monitoring
 */
export function requestIdWithMetrics(
  options: RequestIdOptions = {}
): Middleware {
  const requestIdMiddleware = requestId(options);

  return async (ctx: Context, next: () => Promise<void>): Promise<void> => {
    const start = process.hrtime
      ? process.hrtime.bigint?.() || BigInt(0)
      : BigInt(0);

    await requestIdMiddleware(ctx, async () => {
      const end = process.hrtime
        ? process.hrtime.bigint?.() || BigInt(0)
        : BigInt(0);
      const duration = Number(end - start) / 1000000; // Convert to milliseconds

      if (duration > 1) {
        defaultLogger.warn(
          `Slow request ID generation: ${duration.toFixed(3)}ms`
        );
      }

      await next();
    });
  };
}

/**
 * Request ID utilities for testing and advanced usage
 */
export const requestIdUtils = {
  /**
   * Generate UUID v4
   */
  generateUUID,

  /**
   * Generate timestamp-based ID
   */
  generateTimestampId,

  /**
   * Generate crypto-based ID
   */
  generateCryptoId,

  /**
   * Default request ID options
   */
  DEFAULT_OPTIONS: DEFAULT_REQUEST_ID_OPTIONS,
};
