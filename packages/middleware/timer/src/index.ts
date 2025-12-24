/**
 * @nextrush/timer
 *
 * Response time middleware for measuring request duration.
 * Uses high-resolution time (performance.now()) for accurate measurements.
 */
import type { Context, Middleware } from '@nextrush/types';

export interface TimerOptions {
  /**
   * Header name for response time
   * @default 'X-Response-Time'
   */
  header?: string;

  /**
   * Time unit suffix (e.g., 'ms', 's', '')
   * @default 'ms'
   */
  suffix?: string;

  /**
   * Number of decimal places for milliseconds
   * @default 2
   */
  precision?: number;

  /**
   * Key to store timing info in ctx.state
   * @default 'responseTime'
   */
  stateKey?: string;

  /**
   * Whether to expose header in response
   * @default true
   */
  exposeHeader?: boolean;

  /**
   * Custom time getter (for testing or alternative timing)
   * @default performance.now
   */
  now?: () => number;
}

const DEFAULT_HEADER = 'X-Response-Time';
const DEFAULT_SUFFIX = 'ms';
const DEFAULT_PRECISION = 2;
const DEFAULT_STATE_KEY = 'responseTime';

/**
 * Creates response time middleware
 *
 * @example
 * ```ts
 * import { timer } from '@nextrush/timer';
 *
 * // Basic usage
 * app.use(timer());
 *
 * // Custom options
 * app.use(timer({
 *   header: 'X-Duration',
 *   precision: 0,
 *   suffix: 'ms'
 * }));
 *
 * // Access timing in handlers
 * app.use(async (ctx) => {
 *   await ctx.next();
 *   console.log(`Request took ${ctx.state.responseTime}ms`);
 * });
 * ```
 */
export function timer(options: TimerOptions = {}): Middleware {
  const {
    header = DEFAULT_HEADER,
    suffix = DEFAULT_SUFFIX,
    precision = DEFAULT_PRECISION,
    stateKey = DEFAULT_STATE_KEY,
    exposeHeader = true,
    now = () => performance.now(),
  } = options;

  return async (ctx: Context) => {
    const start = now();

    await ctx.next();

    const duration = now() - start;
    const formatted = duration.toFixed(precision);

    ctx.state[stateKey] = parseFloat(formatted);

    if (exposeHeader) {
      ctx.set(header, `${formatted}${suffix}`);
    }
  };
}

/**
 * Response time middleware - alias for timer with common naming
 *
 * @example
 * ```ts
 * import { responseTime } from '@nextrush/timer';
 *
 * app.use(responseTime());
 * ```
 */
export function responseTime(options: TimerOptions = {}): Middleware {
  return timer(options);
}

/**
 * Server timing middleware - uses Server-Timing header format
 * Compatible with browser DevTools performance analysis
 *
 * @example
 * ```ts
 * import { serverTiming } from '@nextrush/timer';
 *
 * app.use(serverTiming());
 * // Sets: Server-Timing: total;dur=123.45
 * ```
 */
export function serverTiming(
  options: Omit<TimerOptions, 'header' | 'suffix'> & {
    /**
     * Metric name for Server-Timing header
     * @default 'total'
     */
    metric?: string;
    /**
     * Optional description for the metric
     */
    description?: string;
  } = {}
): Middleware {
  const {
    metric = 'total',
    description,
    precision = DEFAULT_PRECISION,
    stateKey = DEFAULT_STATE_KEY,
    exposeHeader = true,
    now = () => performance.now(),
  } = options;

  return async (ctx: Context) => {
    const start = now();

    await ctx.next();

    const duration = now() - start;
    const formatted = duration.toFixed(precision);

    ctx.state[stateKey] = parseFloat(formatted);

    if (exposeHeader) {
      const descPart = description ? `;desc="${description}"` : '';
      ctx.set('Server-Timing', `${metric};dur=${formatted}${descPart}`);
    }
  };
}

export type { Context, Middleware };
