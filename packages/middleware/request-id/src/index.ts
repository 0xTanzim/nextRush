/**
 * @nextrush/request-id
 *
 * Request ID middleware for distributed tracing and request correlation.
 * Generates unique identifiers using crypto.randomUUID() for each request.
 *
 * Features:
 * - Cryptographically secure UUID generation
 * - Incoming ID validation to prevent header injection
 * - Correlation and Trace ID variants
 * - Multi-runtime: Node.js, Bun, Deno, Cloudflare Workers
 *
 * @packageDocumentation
 */

// ============================================================================
// Types
// ============================================================================

export type {
    CorrelationIdOptions,
    IdGenerator,
    IdValidator,
    Middleware,
    RequestIdContext,
    RequestIdOptions,
    TraceIdOptions
} from './types';

// ============================================================================
// Constants
// ============================================================================

export {
    CORRELATION_HEADER,
    CORRELATION_STATE_KEY,
    DEFAULT_HEADER,
    DEFAULT_MAX_LENGTH,
    DEFAULT_STATE_KEY,
    TRACE_HEADER,
    TRACE_STATE_KEY,
    defaultGenerator
} from './constants';

// ============================================================================
// Validation
// ============================================================================

export {
    createValidator,
    defaultValidator,
    isSafeId,
    isValidLength,
    isValidUuid,
    permissiveValidator,
    validateId
} from './validation';

// ============================================================================
// Middleware
// ============================================================================

export { correlationId, requestId, traceId } from './middleware';
