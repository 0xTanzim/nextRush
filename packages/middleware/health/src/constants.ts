/**
 * @nextrush/health - Constants
 *
 * Default values and constants for the health check middleware.
 *
 * @packageDocumentation
 */

// ============================================================================
// Route Paths
// ============================================================================

/**
 * Default path for the liveness endpoint.
 * Reflects only whether the process can respond at all — never depends on
 * registered checks (design.md D5).
 */
export const DEFAULT_LIVEZ_PATH = '/livez';

/**
 * Default path for the readiness endpoint.
 * Reflects whether registered checks currently pass.
 */
export const DEFAULT_READYZ_PATH = '/readyz';

// ============================================================================
// Response Status Bodies
// ============================================================================

/**
 * Response status literal for a passing health/readiness result.
 */
export const STATUS_OK = 'ok' as const;

/**
 * Response status literal for a failing readiness result.
 */
export const STATUS_ERROR = 'error' as const;

// ============================================================================
// HTTP Status Codes
// ============================================================================

/**
 * Status code returned when the process/checks are healthy.
 */
export const HTTP_OK = 200;

/**
 * Status code returned when a registered readiness check fails, throws,
 * or times out.
 */
export const HTTP_SERVICE_UNAVAILABLE = 503;

// ============================================================================
// Timeout Defaults
// ============================================================================

/**
 * Default bound (in milliseconds) on a single check invocation.
 *
 * A registered check that never resolves (a hung DB ping) must not hang
 * /readyz indefinitely — a timed-out check is treated as a failure
 * (design.md Risks: "hung check" mitigation).
 */
export const DEFAULT_CHECK_TIMEOUT_MS = 5000;
