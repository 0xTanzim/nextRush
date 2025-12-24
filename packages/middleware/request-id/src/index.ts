/**
 * @nextrush/request-id
 *
 * Request ID middleware for distributed tracing and request correlation.
 * Generates unique identifiers using crypto.randomUUID() for each request.
 */
import type { Context, Middleware } from '@nextrush/types';

export interface RequestIdOptions {
  /**
   * Header name to read/write request ID
   * @default 'X-Request-Id'
   */
  header?: string;

  /**
   * Custom ID generator function
   * @default crypto.randomUUID()
   */
  generator?: () => string;

  /**
   * Whether to use incoming request ID if present
   * @default true
   */
  trustIncoming?: boolean;

  /**
   * Key to store request ID in ctx.state
   * @default 'requestId'
   */
  stateKey?: string;

  /**
   * Whether to expose request ID in response header
   * @default true
   */
  exposeHeader?: boolean;
}

const DEFAULT_HEADER = 'X-Request-Id';
const DEFAULT_STATE_KEY = 'requestId';

function defaultGenerator(): string {
  return crypto.randomUUID();
}

/**
 * Creates request ID middleware
 *
 * @example
 * ```ts
 * import { requestId } from '@nextrush/request-id';
 *
 * // Basic usage
 * app.use(requestId());
 *
 * // Custom options
 * app.use(requestId({
 *   header: 'X-Correlation-Id',
 *   trustIncoming: false,
 *   generator: () => `req-${Date.now()}`
 * }));
 *
 * // Access in handlers
 * app.get('/api/data', (ctx) => {
 *   const id = ctx.state.requestId;
 *   ctx.json({ requestId: id });
 * });
 * ```
 */
export function requestId(options: RequestIdOptions = {}): Middleware {
  const {
    header = DEFAULT_HEADER,
    generator = defaultGenerator,
    trustIncoming = true,
    stateKey = DEFAULT_STATE_KEY,
    exposeHeader = true,
  } = options;

  const headerLower = header.toLowerCase();

  return async (ctx: Context) => {
    let id: string | undefined;

    if (trustIncoming) {
      id = ctx.get(headerLower);
    }

    if (!id) {
      id = generator();
    }

    ctx.state[stateKey] = id;

    if (exposeHeader) {
      ctx.set(header, id);
    }

    await ctx.next();
  };
}

/**
 * Correlation ID middleware - alias for requestId with common correlation header
 *
 * @example
 * ```ts
 * import { correlationId } from '@nextrush/request-id';
 *
 * app.use(correlationId());
 * ```
 */
export function correlationId(
  options: Omit<RequestIdOptions, 'header' | 'stateKey'> = {}
): Middleware {
  return requestId({
    ...options,
    header: 'X-Correlation-Id',
    stateKey: 'correlationId',
  });
}

/**
 * Trace ID middleware - alias for requestId with trace header
 *
 * @example
 * ```ts
 * import { traceId } from '@nextrush/request-id';
 *
 * app.use(traceId());
 * ```
 */
export function traceId(
  options: Omit<RequestIdOptions, 'header' | 'stateKey'> = {}
): Middleware {
  return requestId({
    ...options,
    header: 'X-Trace-Id',
    stateKey: 'traceId',
  });
}

export type { Context, Middleware };
