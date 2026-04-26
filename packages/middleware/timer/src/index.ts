/**
 * @nextrush/timer
 *
 * Response time middleware for measuring request duration.
 * Uses high-resolution time (performance.now()) for accurate measurements.
 *
 * Features:
 * - Sub-millisecond precision timing
 * - X-Response-Time header support
 * - Server-Timing header for DevTools integration
 * - Detailed timing data with start/end timestamps
 * - Multi-runtime: Node.js, Bun, Deno, Cloudflare Workers
 *
 * @packageDocumentation
 */

// ============================================================================
// Types
// ============================================================================

export type {
    DetailedTimerOptions,
    Middleware,
    ServerTimingOptions,
    TimeGetter,
    TimerContext,
    TimerOptions,
    TimingResult
} from './types';

// ============================================================================
// Constants
// ============================================================================

export {
    DEFAULT_HEADER,
    DEFAULT_METRIC,
    DEFAULT_PRECISION,
    DEFAULT_STATE_KEY,
    DEFAULT_SUFFIX,
    MAX_PRECISION,
    SERVER_TIMING_HEADER,
    defaultTimeGetter
} from './constants';

// ============================================================================
// Middleware
// ============================================================================

export {
    detailedTimer,
    responseTime,
    serverTiming,
    timer
} from './middleware';
