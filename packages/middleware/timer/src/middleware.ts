/**
 * @nextrush/timer - Middleware
 *
 * Response timing middleware implementations.
 *
 * @packageDocumentation
 */

import type { Middleware as NextrushMiddleware } from '@nextrush/types';

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
  ServerTimingOptions,
  TimerContext,
  TimerOptions,
  TimingResult,
} from './types';

// ============================================================================
// Validation
// ============================================================================

/**
 * HTTP token characters per RFC 7230 §3.2.6.
 */
const HTTP_TOKEN_RE = /^[!#$%&'*+.^_`|~\w-]+$/;

/**
 * Safe suffix characters (alphanumeric, dot, hyphen, underscore, percent).
 */
const SAFE_SUFFIX_RE = /^[\w.%\- ]*$/;

/**
 * Validates an HTTP header name against RFC 7230 token rules.
 * @throws If header name contains invalid characters.
 */
function validateHeaderName(name: string): void {
  if (!HTTP_TOKEN_RE.test(name)) {
    throw new Error(`Invalid header name "${name}": must contain only HTTP token characters`);
  }
}

/**
 * Validates a suffix string contains only safe characters.
 * @throws If suffix contains unsafe characters.
 */
function validateSuffix(value: string): void {
  if (!SAFE_SUFFIX_RE.test(value)) {
    throw new Error(
      `Invalid suffix "${value}": must contain only alphanumeric, '.', '-', '_', '%' or space characters`
    );
  }
}

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

/**
 * Formats a duration value to a fixed-width decimal string.
 */
function formatFixed(value: number, precision: number, factor: number): string {
  const rounded = Math.round(value * factor) / factor;
  return rounded.toFixed(precision);
}

// ============================================================================
// Timer Middleware
// ============================================================================

/**
 * Creates response time middleware.
 *
 * Measures the duration of request processing, stores it in `ctx.state`, and —
 * only when asked — writes it to a response header.
 *
 * @remarks
 * The header is written after `ctx.next()` resolves, so it measures the work the
 * rest of the chain did. Every shipped adapter records the outgoing response and
 * flushes it once the chain unwinds (RFC-041), so the header lands on all of
 * them. `exposeHeader` still defaults to `false`: the measurement is always
 * available in state, and advertising it is opt-in.
 *
 * @param options - Timer configuration options
 * @returns Middleware function
 *
 * @example Measurement only (the default)
 * ```ts
 * import { timer } from '@nextrush/timer';
 *
 * app.use(timer());
 * // Timing available as: ctx.state.responseTime
 * ```
 *
 * @example Exposing the header
 * ```ts
 * app.use(timer({ exposeHeader: true }));
 * // Sets: X-Response-Time: 12.34ms
 * ```
 *
 * @example Custom header and precision
 * ```ts
 * app.use(timer({
 *   header: 'X-Duration',
 *   precision: 0,
 *   suffix: ' milliseconds',
 *   exposeHeader: true
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
export function timer(options: TimerOptions = {}): NextrushMiddleware {
  const {
    header = DEFAULT_HEADER,
    suffix = DEFAULT_SUFFIX,
    precision = DEFAULT_PRECISION,
    stateKey = DEFAULT_STATE_KEY,
    exposeHeader = false,
    now = defaultTimeGetter,
  } = options;

  validateHeaderName(header);
  validateSuffix(suffix);

  const safePrecision = clampPrecision(precision);
  const factor = 10 ** safePrecision;

  return (async (ctx: TimerContext) => {
    const start = now();

    try {
      await ctx.next();
    } finally {
      const end = now();
      const duration = end - start;
      const formatted = formatFixed(duration, safePrecision, factor);

      ctx.state[stateKey] = Math.round(duration * factor) / factor;

      if (exposeHeader) {
        ctx.set(header, `${formatted}${suffix}`);
      }
    }
  }) as unknown as NextrushMiddleware;
}

/**
 * Creates detailed timer middleware with extended timing information.
 *
 * Stores complete timing data including start/end timestamps,
 * raw duration, and formatted output in context state.
 *
 * @remarks
 * Shares the timing contract of {@link timer}: the duration is always recorded,
 * and `exposeHeader` is opt-in. The header lands on every adapter because the
 * response is flushed after the middleware chain unwinds.
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
export function detailedTimer(options: DetailedTimerOptions = {}): NextrushMiddleware {
  const {
    header = DEFAULT_HEADER,
    suffix = DEFAULT_SUFFIX,
    precision = DEFAULT_PRECISION,
    stateKey = DEFAULT_STATE_KEY,
    exposeHeader = false,
    now = defaultTimeGetter,
    detailed = false,
  } = options;

  validateHeaderName(header);
  validateSuffix(suffix);

  const safePrecision = clampPrecision(precision);
  const factor = 10 ** safePrecision;

  return (async (ctx: TimerContext) => {
    const start = now();

    try {
      await ctx.next();
    } finally {
      const end = now();
      const duration = end - start;
      const formatted = `${formatFixed(duration, safePrecision, factor)}${suffix}`;

      if (detailed) {
        const result: TimingResult = {
          duration,
          formatted,
          start,
          end,
        };
        ctx.state[stateKey] = result;
      } else {
        ctx.state[stateKey] = Math.round(duration * factor) / factor;
      }

      if (exposeHeader) {
        ctx.set(header, formatted);
      }
    }
  }) as unknown as NextrushMiddleware;
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
export function responseTime(options: TimerOptions = {}): NextrushMiddleware {
  return timer(options);
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
 * @remarks
 * Like {@link timer}, this middleware records the duration in `ctx.state` and
 * writes the header only when `exposeHeader` is enabled. The header is written
 * after `ctx.next()` resolves and lands on every adapter, because the response
 * is flushed once the middleware chain unwinds.
 *
 * @param options - Server-Timing configuration options
 * @returns Middleware function
 *
 * @example Measurement only (the default)
 * ```ts
 * import { serverTiming } from '@nextrush/timer';
 *
 * app.use(serverTiming());
 * // Timing available as: ctx.state.responseTime
 * ```
 *
 * @example Exposing the header
 * ```ts
 * import { serverTiming } from '@nextrush/timer';
 *
 * app.use(serverTiming({ exposeHeader: true }));
 * // Sets: Server-Timing: total;dur=123.45
 * ```
 *
 * @example With description
 * ```ts
 * app.use(serverTiming({
 *   metric: 'api',
 *   description: 'API Response Time',
 *   exposeHeader: true
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
 * app.use(serverTiming({ metric: 'total', exposeHeader: true }));
 * ```
 */
export function serverTiming(options: ServerTimingOptions = {}): NextrushMiddleware {
  const {
    metric = DEFAULT_METRIC,
    description,
    precision = DEFAULT_PRECISION,
    stateKey = DEFAULT_STATE_KEY,
    exposeHeader = false,
    now = defaultTimeGetter,
  } = options;

  const safePrecision = clampPrecision(precision);
  const factor = 10 ** safePrecision;
  const safeMetric = sanitizeMetricName(metric);
  const safeDescription = description ? sanitizeDescription(description) : undefined;

  return (async (ctx: TimerContext) => {
    const start = now();

    try {
      await ctx.next();
    } finally {
      const end = now();
      const duration = end - start;
      const formatted = formatFixed(duration, safePrecision, factor);

      ctx.state[stateKey] = Math.round(duration * factor) / factor;

      if (exposeHeader) {
        const descPart = safeDescription ? `;desc="${safeDescription}"` : '';
        const newValue = `${safeMetric};dur=${formatted}${descPart}`;
        const existing = ctx.get(SERVER_TIMING_HEADER);
        ctx.set(SERVER_TIMING_HEADER, existing ? `${existing}, ${newValue}` : newValue);
      }
    }
  }) as unknown as NextrushMiddleware;
}
