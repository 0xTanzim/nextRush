/**
 * @nextrush/request-id - Type definitions
 *
 * Type definitions for request ID middleware.
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
// Request ID Context
// ============================================================================

/**
 * Minimal context interface for Request ID middleware.
 */
export interface RequestIdContext {
  /** Context state storage */
  state: Record<string, unknown>;
  /** Get request header */
  get: (name: string) => string | undefined;
  /** Set response header */
  set: (name: string, value: string) => void;
  /** Call next middleware */
  next: () => Promise<void>;
}

// ============================================================================
// Options Types
// ============================================================================

/**
 * ID generator function type.
 */
export type IdGenerator = () => string;

/**
 * ID validator function type.
 * Returns true if the ID is valid.
 */
export type IdValidator = (id: string) => boolean;

/**
 * Request ID middleware options.
 */
export interface RequestIdOptions {
  /**
   * Header name to read/write request ID.
   * @default 'X-Request-Id'
   */
  header?: string;

  /**
   * Custom ID generator function.
   * @default crypto.randomUUID()
   */
  generator?: IdGenerator;

  /**
   * Whether to trust and use incoming request ID if present.
   * When true, validates incoming IDs before use.
   * @default false
   */
  trustIncoming?: boolean;

  /**
   * Custom validator for incoming IDs.
   * Only used when trustIncoming is true.
   * @default UUID format validator
   */
  validator?: IdValidator;

  /**
   * Maximum length for incoming IDs.
   * IDs exceeding this length are rejected to prevent header overflow.
   * @default 128
   */
  maxLength?: number;

  /**
   * Key to store request ID in ctx.state.
   * @default 'requestId'
   */
  stateKey?: string;

  /**
   * Whether to expose request ID in response header.
   * @default true
   */
  exposeHeader?: boolean;
}

/**
 * Correlation ID middleware options.
 * Extends RequestIdOptions but with fixed header and stateKey.
 */
export type CorrelationIdOptions = Omit<RequestIdOptions, 'header' | 'stateKey'>;

/**
 * Trace ID middleware options.
 * Extends RequestIdOptions but with fixed header and stateKey.
 */
export type TraceIdOptions = Omit<RequestIdOptions, 'header' | 'stateKey'>;
