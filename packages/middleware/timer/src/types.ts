/**
 * @nextrush/timer - Type definitions
 *
 * Type definitions for response timing middleware.
 *
 * @packageDocumentation
 */

// ============================================================================
// Middleware Types (standalone, no external deps for runtime compatibility)
// ============================================================================

/**
 * Middleware function type for compatibility with NextRush.
 */
export type Middleware<TContext = unknown> = (
  ctx: TContext,
  next?: () => Promise<void>
) => Promise<void>;

// ============================================================================
// Timer Context
// ============================================================================

/**
 * Minimal context interface for Timer middleware.
 */
export interface TimerContext {
  /** Context state storage */
  state: Record<string, unknown>;
  /** Set response header */
  set: (name: string, value: string) => void;
  /** Call next middleware */
  next: () => Promise<void>;
}

// ============================================================================
// Options Types
// ============================================================================

/**
 * Time getter function type.
 * Allows custom time sources for testing or alternative timing.
 */
export type TimeGetter = () => number;

/**
 * Timer middleware options.
 */
export interface TimerOptions {
  /**
   * Header name for response time.
   * @default 'X-Response-Time'
   */
  header?: string;

  /**
   * Time unit suffix (e.g., 'ms', 's', '').
   * @default 'ms'
   */
  suffix?: string;

  /**
   * Number of decimal places for milliseconds.
   * Maximum: 6 (microsecond precision)
   * @default 2
   */
  precision?: number;

  /**
   * Key to store timing info in ctx.state.
   * @default 'responseTime'
   */
  stateKey?: string;

  /**
   * Whether to expose header in response.
   * @default true
   */
  exposeHeader?: boolean;

  /**
   * Custom time getter (for testing or alternative timing).
   * @default performance.now
   */
  now?: TimeGetter;
}

/**
 * Server-Timing middleware options.
 */
export interface ServerTimingOptions extends Omit<TimerOptions, 'header' | 'suffix'> {
  /**
   * Metric name for Server-Timing header.
   * @default 'total'
   */
  metric?: string;

  /**
   * Optional description for the metric.
   */
  description?: string;
}

/**
 * Timing result stored in context state.
 */
export interface TimingResult {
  /** Duration in milliseconds */
  duration: number;
  /** Formatted string */
  formatted: string;
  /** Start timestamp */
  start: number;
  /** End timestamp */
  end: number;
}

/**
 * Extended timer options with detailed result.
 */
export interface DetailedTimerOptions extends TimerOptions {
  /**
   * Store detailed timing information.
   * @default false
   */
  detailed?: boolean;
}
