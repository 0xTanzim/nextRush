/**
 * @nextrush/request-id - Constants
 *
 * Default values and constants for request ID middleware.
 *
 * @packageDocumentation
 */

// NOTE: intentionally uses the global `crypto.randomUUID()` rather than
// `node:crypto`'s `randomUUID` — this is the only Web-standard-vs-Node-module
// choice in the package, and choosing the module would make an otherwise
// edge-safe middleware Node-only for no behavioral difference. The global is
// available on Node ≥19, Bun, Deno, Cloudflare Workers, Vercel Edge, and
// Netlify Edge. `requestId()` in middleware.ts already assumes this and
// throws a clear capability error when the global is absent and the caller
// hasn't supplied a custom generator — this makes that check correspond to
// what it actually guards.

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
 * Default ID generator using the global crypto.randomUUID().
 * Produces RFC 4122 version 4 UUIDs.
 *
 * @remarks
 * `requestId()` in middleware.ts performs a one-time capability check
 * (`typeof globalThis.crypto?.randomUUID !== 'function'`) before relying on
 * this generator, and throws a clear, actionable error naming the missing
 * capability if the global is absent — never an unguarded `ReferenceError`.
 *
 * @returns A new random UUID string
 */
export const defaultGenerator = (): string => crypto.randomUUID();
