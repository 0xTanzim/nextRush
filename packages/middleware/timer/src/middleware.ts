/**
 * @nextrush/timer - Middleware
 *
 * Response timing middleware implementations.
 *
 * @packageDocumentation
 */

import {
  DEFAULT_HEADER,
  DEFAULT_METRIC,
  DEFAULT_PRECISION,
  DEFAULT_STATE_KEY,
  DEFAULT_SUFFIX,
  MAX_PRECISION,
  SERVER_TIMING_HEADER,
  defaultTimeGetter,
} from './constants';
import type {
  DetailedTimerOptions,
  Middleware,
  ServerTimingOptions,
  TimerContext,
  TimerOptions,
  TimingResult,
} from './types';

// ============================================================================
// Internal Utilities
// ============================================================================

/**
 * Clamps precision to valid range [0, MAX_PRECISION].
 */
function clampPrecision(value: number): number {
  return Math.min(Math.max(0, Math.floor(value)), MAX_PRECISION);
}

/**
 * Sanitizes Server-Timing description to prevent header injection.
 * Escapes quotes and removes control characters.
 */
function sanitizeDescription(desc: string): string {
  return desc
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/"/g, '\\"'); // Escape quotes
}

/**
 * Sanitizes metric name for Server-Timing header.
 * Only allows token characters per RFC 7230.
 */
function sanitizeMetricName(name: string): string {
  return name.replace(/[^\w!#$%&'*+.^`|~-]/g, '');
}

// ============================================================================
// Timer Middleware
// ============================================================================

/**
 * Creates response time middleware.
 *
 * Measures the duration of request processing and optionally sets
 * a response header with the timing information.
 *
 * @param options - Timer configuration options
 * @returns Middleware function
 *
 * @example Basic usage
 * ```ts
 * import { timer } from '@nextrush/timer';
 *
 * app.use(timer());
 * // Sets: X-Response-Time: 12.34ms
 * ```
 *
 * @example Custom header and precision
 * ```ts
 * app.use(timer({
 *   header: 'X-Duration',
 *   precision: 0,
 *   suffix: ' milliseconds'
 * }));
 * // Sets: X-Duration: 12 milliseconds
 * ```
 *
 * @example Accessing timing in downstream middleware
 * ```ts
 * app.use(async (ctx) => {
 *   await ctx.next();
 *   console.log(`Request took ${ctx.state.responseTime}ms`);
 * });
 * ```
 */
export function timer<TContext extends TimerContext = TimerContext>(
  options: TimerOptions = {}
): Middleware<TContext> {
  const {
    header = DEFAULT_HEADER,
    suffix = DEFAULT_SUFFIX,
    precision = DEFAULT_PRECISION,
    stateKey = DEFAULT_STATE_KEY,
    exposeHeader = true,
    now = defaultTimeGetter,
  } = options;

  const safePrecision = clampPrecision(precision);

  return async (ctx: TContext) => {
    const start = now();

    await ctx.next();

    const end = now();
    const duration = end - start;
    const formatted = duration.toFixed(safePrecision);

    ctx.state[stateKey] = parseFloat(formatted);

    if (exposeHeader) {
      ctx.set(header, `${formatted}${suffix}`);
    }
  };
}

/**
 * Creates detailed timer middleware with extended timing information.
 *
 * Stores complete timing data including start/end timestamps,
 * raw duration, and formatted output in context state.
 *
 * @param options - Detailed timer configuration options
 * @returns Middleware function
 *
 * @example
 * ```ts
 * import { detailedTimer } from '@nextrush/timer';
 *
 * app.use(detailedTimer({ detailed: true }));
 *
 * app.use(async (ctx) => {
 *   await ctx.next();
 *   const timing = ctx.state.responseTime as TimingResult;
 *   console.log(`Duration: ${timing.duration}ms`);
 *   console.log(`Started: ${timing.start}`);
 *   console.log(`Ended: ${timing.end}`);
 * });
 * ```
 */
export function detailedTimer<TContext extends TimerContext = TimerContext>(
  options: DetailedTimerOptions = {}
): Middleware<TContext> {
  const {
    header = DEFAULT_HEADER,
    suffix = DEFAULT_SUFFIX,
    precision = DEFAULT_PRECISION,
    stateKey = DEFAULT_STATE_KEY,
    exposeHeader = true,
    now = defaultTimeGetter,
    detailed = false,
  } = options;

  const safePrecision = clampPrecision(precision);

  return async (ctx: TContext) => {
    const start = now();

    await ctx.next();

    const end = now();
    const duration = end - start;
    const formatted = `${duration.toFixed(safePrecision)}${suffix}`;

    if (detailed) {
      const result: TimingResult = {
        duration,
        formatted,
        start,
        end,
      };
      ctx.state[stateKey] = result;
    } else {
      ctx.state[stateKey] = parseFloat(duration.toFixed(safePrecision));
    }

    if (exposeHeader) {
      ctx.set(header, formatted);
    }
  };
}

/**
 * Response time middleware - alias for timer.
 *
 * Provides a more descriptive name for common use cases.
 *
 * @param options - Timer configuration options
 * @returns Middleware function
 *
 * @example
 * ```ts
 * import { responseTime } from '@nextrush/timer';
 *
 * app.use(responseTime());
 * ```
 */
export function responseTime<TContext extends TimerContext = TimerContext>(
  options: TimerOptions = {}
): Middleware<TContext> {
  return timer<TContext>(options);
}

// ============================================================================
// Server-Timing Middleware
// ============================================================================

/**
 * Creates Server-Timing middleware.
 *
 * Uses the standard Server-Timing header format compatible with
 * browser DevTools performance analysis.
 *
 * @param options - Server-Timing configuration options
 * @returns Middleware function
 *
 * @example Basic usage
 * ```ts
 * import { serverTiming } from '@nextrush/timer';
 *
 * app.use(serverTiming());
 * // Sets: Server-Timing: total;dur=123.45
 * ```
 *
 * @example With description
 * ```ts
 * app.use(serverTiming({
 *   metric: 'api',
 *   description: 'API Response Time'
 * }));
 * // Sets: Server-Timing: api;dur=123.45;desc="API Response Time"
 * ```
 *
 * @example Multiple metrics (compose multiple middleware)
 * ```ts
 * // Database timing
 * app.use(async (ctx) => {
 *   const dbStart = performance.now();
 *   await db.query();
 *   const dbTime = performance.now() - dbStart;
 *   ctx.set('Server-Timing', `db;dur=${dbTime.toFixed(2)};desc="Database"`);
 *   await ctx.next();
 * });
 *
 * // Total timing
 * app.use(serverTiming({ metric: 'total' }));
 * ```
 */
export function serverTiming<TContext extends TimerContext = TimerContext>(
  options: ServerTimingOptions = {}
): Middleware<TContext> {
  const {
    metric = DEFAULT_METRIC,
    description,
    precision = DEFAULT_PRECISION,
    stateKey = DEFAULT_STATE_KEY,
    exposeHeader = true,
    now = defaultTimeGetter,
  } = options;

  const safePrecision = clampPrecision(precision);
  const safeMetric = sanitizeMetricName(metric);
  const safeDescription = description ? sanitizeDescription(description) : undefined;

  return async (ctx: TContext) => {
    const start = now();

    await ctx.next();

    const end = now();
    const duration = end - start;
    const formatted = duration.toFixed(safePrecision);

    ctx.state[stateKey] = parseFloat(formatted);

    if (exposeHeader) {
      const descPart = safeDescription ? `;desc="${safeDescription}"` : '';
      ctx.set(SERVER_TIMING_HEADER, `${safeMetric};dur=${formatted}${descPart}`);
    }
  };
}
