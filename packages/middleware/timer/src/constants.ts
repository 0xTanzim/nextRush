/**
 * @nextrush/timer - Constants
 *
 * Default values and constants for response timing middleware.
 *
 * @packageDocumentation
 */

import type { TimeGetter } from './types';

// ============================================================================
// Header Names
// ============================================================================

/**
 * Default header name for response time.
 */
export const DEFAULT_HEADER = 'X-Response-Time';

/**
 * Server-Timing header name (standard HTTP header).
 */
export const SERVER_TIMING_HEADER = 'Server-Timing';

// ============================================================================
// Default Values
// ============================================================================

/**
 * Default time unit suffix.
 */
export const DEFAULT_SUFFIX = 'ms';

/**
 * Default number of decimal places for timing output.
 */
export const DEFAULT_PRECISION = 2;

/**
 * Maximum precision allowed (microsecond level).
 */
export const MAX_PRECISION = 6;

/**
 * Default state key for storing timing information.
 */
export const DEFAULT_STATE_KEY = 'responseTime';

/**
 * Default metric name for Server-Timing header.
 */
export const DEFAULT_METRIC = 'total';

// ============================================================================
// Time Getters
// ============================================================================

/**
 * Default high-resolution time getter.
 * Uses `performance.now()` when available, falls back to `Date.now()`.
 *
 * @returns Current time in milliseconds
 */
const perf = typeof globalThis.performance !== 'undefined' ? globalThis.performance : undefined;

export const defaultTimeGetter: TimeGetter = perf?.now ? () => perf.now() : () => Date.now();
