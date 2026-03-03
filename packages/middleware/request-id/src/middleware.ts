/**
 * @nextrush/request-id - Middleware
 *
 * Request ID middleware implementations.
 *
 * @packageDocumentation
 */

import {
  CORRELATION_HEADER,
  CORRELATION_STATE_KEY,
  DEFAULT_HEADER,
  DEFAULT_MAX_LENGTH,
  DEFAULT_STATE_KEY,
  TRACE_HEADER,
  TRACE_STATE_KEY,
  defaultGenerator,
} from './constants';
import type {
  CorrelationIdOptions,
  Middleware,
  RequestIdContext,
  RequestIdOptions,
  TraceIdOptions,
} from './types';
import { defaultValidator, validateId } from './validation';

// ============================================================================
// Request ID Middleware
// ============================================================================

/**
 * Creates request ID middleware for request tracking and correlation.
 *
 * Generates unique identifiers for each request using crypto.randomUUID().
 * Supports trusting incoming IDs from upstream services with validation.
 *
 * @param options - Configuration options
 * @returns Middleware function
 *
 * @example Basic usage
 * ```ts
 * import { requestId } from '@nextrush/request-id';
 *
 * app.use(requestId());
 * // Request: (no header)
 * // Response: X-Request-Id: 550e8400-e29b-41d4-a716-446655440000
 * ```
 *
 * @example Trusting upstream IDs
 * ```ts
 * app.use(requestId({ trustIncoming: true }));
 * // Request: X-Request-Id: upstream-id-123
 * // Response: X-Request-Id: upstream-id-123 (validated and passed through)
 * ```
 *
 * @example Custom generator
 * ```ts
 * app.use(requestId({
 *   generator: () => `req-${Date.now()}-${Math.random().toString(36).slice(2)}`
 * }));
 * ```
 *
 * @example Access in handlers
 * ```ts
 * app.use(requestId());
 *
 * app.get('/api/data', (ctx) => {
 *   const id = ctx.state.requestId;
 *   console.log(`Processing request ${id}`);
 *   ctx.json({ requestId: id });
 * });
 * ```
 */
export function requestId<TContext extends RequestIdContext = RequestIdContext>(
  options: RequestIdOptions = {}
): Middleware<TContext> {
  const {
    header = DEFAULT_HEADER,
    generator = defaultGenerator,
    /**
     * When `true` (default), the middleware accepts valid incoming request
     * IDs from the client header. Set to `false` for public-facing services
     * where clients should not be able to inject their own tracking IDs.
     */
    trustIncoming = true,
    validator = defaultValidator,
    maxLength = DEFAULT_MAX_LENGTH,
    stateKey = DEFAULT_STATE_KEY,
    exposeHeader = true,
  } = options;

  const headerLower = header.toLowerCase();

  return async (ctx: TContext) => {
    let id: string | undefined;

    // Trust incoming ID if enabled and valid
    if (trustIncoming) {
      const incoming = ctx.get(headerLower);
      if (incoming !== undefined && incoming !== '') {
        // Validate incoming ID for security
        const isValid = validateId(incoming, maxLength) && validator(incoming);
        if (isValid) {
          id = incoming;
        }
        // If invalid, fall through to generate new ID
      }
    }

    // Generate new ID if not trusting incoming or incoming was invalid
    if (!id) {
      id = generator();
    }

    // Store in context state
    ctx.state[stateKey] = id;

    // Set response header
    if (exposeHeader) {
      ctx.set(header, id);
    }

    await ctx.next();
  };
}

// ============================================================================
// Correlation ID Middleware
// ============================================================================

/**
 * Correlation ID middleware for distributed tracing.
 *
 * Uses `X-Correlation-Id` header and stores in `ctx.state.correlationId`.
 * Useful for correlating requests across microservices.
 *
 * @param options - Configuration options
 * @returns Middleware function
 *
 * @example
 * ```ts
 * import { correlationId } from '@nextrush/request-id';
 *
 * app.use(correlationId());
 *
 * app.get('/api/data', (ctx) => {
 *   // Forward to downstream services
 *   const correlation = ctx.state.correlationId;
 *   await fetch(downstreamUrl, {
 *     headers: { 'X-Correlation-Id': correlation }
 *   });
 * });
 * ```
 */
export function correlationId<TContext extends RequestIdContext = RequestIdContext>(
  options: CorrelationIdOptions = {}
): Middleware<TContext> {
  return requestId<TContext>({
    ...options,
    header: CORRELATION_HEADER,
    stateKey: CORRELATION_STATE_KEY,
  });
}

// ============================================================================
// Trace ID Middleware
// ============================================================================

/**
 * Trace ID middleware for distributed tracing.
 *
 * Uses `X-Trace-Id` header and stores in `ctx.state.traceId`.
 * Compatible with OpenTelemetry and other tracing systems.
 *
 * @param options - Configuration options
 * @returns Middleware function
 *
 * @example
 * ```ts
 * import { traceId } from '@nextrush/request-id';
 *
 * app.use(traceId());
 *
 * app.get('/api/data', (ctx) => {
 *   // Use trace ID for logging
 *   logger.info('Processing request', { traceId: ctx.state.traceId });
 * });
 * ```
 */
export function traceId<TContext extends RequestIdContext = RequestIdContext>(
  options: TraceIdOptions = {}
): Middleware<TContext> {
  return requestId<TContext>({
    ...options,
    header: TRACE_HEADER,
    stateKey: TRACE_STATE_KEY,
  });
}
