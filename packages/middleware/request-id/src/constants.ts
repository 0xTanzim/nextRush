/**
 * @nextrush/request-id - Constants
 *
 * Default values and constants for request ID middleware.
 *
 * @packageDocumentation
 */

// ============================================================================
// Header Names
// ============================================================================

/**
 * Default header name for request ID.
 */
export const DEFAULT_HEADER = 'X-Request-Id';

/**
 * Header name for correlation ID.
 */
export const CORRELATION_HEADER = 'X-Correlation-Id';

/**
 * Header name for trace ID.
 */
export const TRACE_HEADER = 'X-Trace-Id';

// ============================================================================
// Default Values
// ============================================================================

/**
 * Default state key for storing request ID.
 */
export const DEFAULT_STATE_KEY = 'requestId';

/**
 * State key for correlation ID.
 */
export const CORRELATION_STATE_KEY = 'correlationId';

/**
 * State key for trace ID.
 */
export const TRACE_STATE_KEY = 'traceId';

/**
 * Maximum allowed length for incoming request IDs.
 * Prevents header overflow attacks.
 */
export const DEFAULT_MAX_LENGTH = 128;

/**
 * Minimum reasonable ID length.
 */
export const MIN_ID_LENGTH = 1;

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Default ID generator using crypto.randomUUID().
 * Produces RFC 4122 version 4 UUIDs.
 *
 * @returns A new random UUID string
 */
export const defaultGenerator = (): string => crypto.randomUUID();
