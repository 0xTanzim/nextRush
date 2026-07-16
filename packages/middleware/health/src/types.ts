/**
 * @nextrush/health - Type definitions
 *
 * Type definitions for the health check middleware and its check registry.
 *
 * @packageDocumentation
 */

import type { Middleware } from '@nextrush/types';

// ============================================================================
// Check Function
// ============================================================================

/**
 * A readiness check function.
 *
 * May be synchronous (returning a `boolean` directly) or asynchronous
 * (returning a `Promise<boolean>`) — both are supported so a trivially
 * synchronous check (e.g. "is this env var set") doesn't need a manual
 * `Promise.resolve()` wrapper (design.md's Open Question, resolved: support
 * both).
 *
 * A check that returns `false` or throws is treated as failing. A check
 * that never settles is bounded by `checkTimeoutMs` and treated as failing
 * once that bound is exceeded (design.md Risks: hung-check mitigation).
 *
 * @returns `true` if the dependency is healthy, `false` otherwise.
 */
export type CheckFn = () => boolean | Promise<boolean>;

// ============================================================================
// Options
// ============================================================================

/**
 * Configuration options for the health middleware.
 */
export interface HealthOptions {
  /**
   * Path for the liveness endpoint.
   * @default '/livez'
   */
  livezPath?: string;

  /**
   * Path for the readiness endpoint.
   * @default '/readyz'
   */
  readyzPath?: string;

  /**
   * Maximum time, in milliseconds, a single registered check is allowed to
   * take before it is treated as a failure.
   * @default 5000
   */
  checkTimeoutMs?: number;
}

// ============================================================================
// Response Shape
// ============================================================================

/**
 * JSON body returned by both `/livez` and `/readyz`.
 */
export interface HealthResponseBody {
  /** `'ok'` when healthy/ready, `'error'` otherwise. */
  status: 'ok' | 'error';
  /**
   * Per-check pass/fail breakdown. Only populated on `/readyz` responses —
   * `/livez` never evaluates registered checks (design.md D5).
   */
  checks?: Record<string, boolean>;
}

// ============================================================================
// Health Instance
// ============================================================================

/**
 * The object returned by {@link health}.
 */
export interface HealthInstance {
  /**
   * Middleware handling `/livez` and `/readyz`; mount with `app.use()`.
   * Any other path is passed through via `next()` untouched.
   */
  middleware: Middleware;

  /**
   * Registers a readiness check under a name.
   *
   * Only affects `/readyz` — `/livez` never depends on registered checks
   * (design.md D5). Registering a check with a name that's already in use
   * replaces the previous check under that name.
   *
   * @param name - A short identifier for the check (e.g. `'database'`),
   *   surfaced in the `/readyz` response body's `checks` breakdown.
   * @param check - The check function; see {@link CheckFn}.
   */
  registerCheck: (name: string, check: CheckFn) => void;
}
