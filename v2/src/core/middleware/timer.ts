/**
 * Timer middleware for NextRush v2
 *
 * @packageDocumentation
 */

import { Context } from '@/types/context';
import process from 'node:process';
import type { Middleware, TimerOptions } from './types';

/**
 * Default timer options
 */
const DEFAULT_TIMER_OPTIONS: TimerOptions = {
  header: 'X-Response-Time',
  digits: 3,
  suffix: 'ms',
  includeStartTime: false,
  includeEndTime: false,
  includeDuration: true,
  format: 'milliseconds',
  threshold: 0,
  logSlow: false,
  logSlowThreshold: 1000,
};

/**
 * Format duration based on format option
 */
function formatDuration(duration: number, options: TimerOptions): string {
  if (options.customFormat) {
    try {
      return options.customFormat(duration);
    } catch (error) {
      // Fallback to default format if custom format fails
      return `${duration.toFixed(options.digits)}${options.suffix}`;
    }
  }

  const digits = options.digits ?? 3;
  const suffix = options.suffix ?? 'ms';

  switch (options.format) {
    case 'milliseconds':
      return `${Math.round(duration)}${suffix}`;

    case 'seconds':
      return `${(duration / 1000).toFixed(digits)}s`;

    case 'microseconds':
      return `${(duration * 1000).toFixed(digits)}μs`;

    case 'nanoseconds':
      return `${(duration * 1000000).toFixed(digits)}ns`;

    default:
      return `${duration.toFixed(digits)}${suffix}`;
  }
}

/**
 * Create timer middleware
 *
 * @param options - Timer configuration options
 * @returns Timer middleware function
 *
 * @example
 * ```typescript
 * import { timer } from '@/core/middleware/timer';
 *
 * const app = createApp();
 *
 * // Basic timer
 * app.use(timer());
 *
 * // Advanced timer
 * app.use(timer({
 *   header: 'X-Response-Time',
 *   digits: 3,
 *   suffix: 'ms',
 *   logSlow: true,
 *   logSlowThreshold: 1000,
 * }));
 * ```
 */
export function timer(options: TimerOptions = {}): Middleware {
  const config = { ...DEFAULT_TIMER_OPTIONS, ...options };

  return async (ctx: Context, next: () => Promise<void>): Promise<void> => {
    const start = process.hrtime
      ? process.hrtime.bigint?.() || BigInt(0)
      : BigInt(0);
    const startTime = Date.now();

    // Add start time header if configured
    if (config.includeStartTime && ctx.res?.setHeader) {
      ctx.res.setHeader('X-Request-Start', startTime.toString());
    }

    // Override the end method to set the response time header before sending
    if (ctx.res?.end) {
      const originalEnd = ctx.res.end;
      ctx.res.end = function (chunk?: any, encoding?: any, cb?: any) {
        // Set response time header before sending
        if (config.header && ctx.res && !ctx.res.headersSent) {
          try {
            const end = process.hrtime
              ? process.hrtime.bigint?.() || BigInt(0)
              : BigInt(0);
            const duration = Number(end - start) / 1000000; // Convert to milliseconds
            const formattedDuration = formatDuration(duration, config);
            ctx.res.setHeader(config.header, formattedDuration);
          } catch (error) {
            // Headers already sent, ignore
          }
        }
        return originalEnd.call(this, chunk, encoding, cb);
      };
    }

    try {
      // Call next middleware
      await next();
    } finally {
      // Calculate duration
      const end = process.hrtime
        ? process.hrtime.bigint?.() || BigInt(0)
        : BigInt(0);
      const endTime = Date.now();
      const duration = Number(end - start) / 1000000; // Convert to milliseconds

      // Set response time header if not already set
      if (config.header && ctx.res?.setHeader && !ctx.res.headersSent) {
        try {
          const formattedDuration = formatDuration(duration, config);
          ctx.res.setHeader(config.header, formattedDuration);
        } catch (error) {
          // Headers already sent, ignore
        }
      }

      // Add end time header if configured
      if (config.includeEndTime && ctx.res?.setHeader && !ctx.res.headersSent) {
        try {
          ctx.res.setHeader('X-Request-End', endTime.toString());
        } catch (error) {
          // Headers already sent, ignore
        }
      }

      // Add duration header if configured
      if (
        config.includeDuration &&
        ctx.res?.setHeader &&
        !ctx.res.headersSent
      ) {
        try {
          const formattedDuration = formatDuration(duration, config);
          ctx.res.setHeader('X-Request-Duration', formattedDuration);
        } catch (error) {
          // Headers already sent, ignore
        }
      }

      // Log slow requests if configured
      if (config.logSlow && duration > (config.logSlowThreshold ?? 1000)) {
        // eslint-disable-next-line no-console
        console.warn(`Slow request: ${duration.toFixed(3)}ms`);
      }
    }
  };
}

/**
 * Create timer middleware with high precision
 *
 * @param options - Timer configuration options
 * @returns Timer middleware function
 */
export function highPrecisionTimer(options: TimerOptions = {}): Middleware {
  return timer({
    ...options,
    digits: 6,
    format: 'milliseconds',
  });
}

/**
 * Create timer middleware with seconds format
 *
 * @param options - Timer configuration options
 * @returns Timer middleware function
 */
export function timerInSeconds(options: TimerOptions = {}): Middleware {
  return timer({
    ...options,
    format: 'seconds',
    suffix: 's',
  });
}

/**
 * Create timer middleware with nanoseconds format
 *
 * @param options - Timer configuration options
 * @returns Timer middleware function
 */
export function timerInNanoseconds(options: TimerOptions = {}): Middleware {
  return timer({
    ...options,
    format: 'nanoseconds',
    digits: 9,
  });
}

/**
 * Create timer middleware that logs slow requests
 *
 * @param threshold - Threshold in milliseconds
 * @param options - Timer configuration options
 * @returns Timer middleware function
 */
export function slowRequestTimer(
  threshold: number,
  options: TimerOptions = {}
): Middleware {
  return timer({
    ...options,
    logSlow: true,
    logSlowThreshold: threshold,
  });
}

/**
 * Create timer middleware with custom format
 *
 * @param format - Custom format function
 * @param options - Timer configuration options
 * @returns Timer middleware function
 */
export function timerWithCustomFormat(
  format: (duration: number) => string,
  options: TimerOptions = {}
): Middleware {
  return timer({
    ...options,
    customFormat: format,
  });
}

/**
 * Create timer middleware with metrics
 *
 * @param options - Timer configuration options
 * @returns Timer middleware function with performance monitoring
 */
export function timerWithMetrics(options: TimerOptions = {}): Middleware {
  const timerMiddleware = timer(options);

  return async (ctx: Context, next: () => Promise<void>): Promise<void> => {
    const start = process.hrtime
      ? process.hrtime.bigint?.() || BigInt(0)
      : BigInt(0);

    await timerMiddleware(ctx, async () => {
      const end = process.hrtime
        ? process.hrtime.bigint?.() || BigInt(0)
        : BigInt(0);
      const duration = Number(end - start) / 1000000; // Convert to milliseconds

      if (duration > 1) {
        // eslint-disable-next-line no-console
        console.warn(`Slow timing operation: ${duration.toFixed(3)}ms`);
      }

      await next();
    });
  };
}

/**
 * Timer utilities for testing and advanced usage
 */
export const timerUtils = {
  /**
   * Format duration
   */
  formatDuration,

  /**
   * Default timer options
   */
  DEFAULT_OPTIONS: DEFAULT_TIMER_OPTIONS,
};
