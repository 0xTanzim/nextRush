/**
 * @nextrush/errors - Base Error Classes
 *
 * Foundational error classes for NextRush framework.
 *
 * @packageDocumentation
 */

import { codeForStatus } from './codes';

/** Options accepted by {@link NextRushError.hydrate} when reconstructing errors. */
interface HydrateOptions {
  status?: number;
  code?: string;
  details?: Record<string, unknown>;
  requestId?: string;
  traceId?: string;
  timestamp?: string;
}

const V8Error = Error as ErrorConstructor & {
  captureStackTrace?: (targetObject: object, constructorOpt?: Function) => void;
};

/** Maximum depth walked when serializing a `cause` chain (audit E-2). */
const MAX_CAUSE_DEPTH = 5;

/**
 * Serialize an error `cause` chain into a plain, JSON-safe object.
 *
 * @remarks
 * Walks nested `cause` links up to {@link MAX_CAUSE_DEPTH}, guards against
 * cyclic chains via a visited set, and only surfaces `name`/`message`/`code`
 * so no unexpected enumerable properties (or secrets on ad-hoc error objects)
 * leak. Returns `undefined` when there is nothing meaningful to serialize.
 */
function serializeCause(cause: unknown, seen: Set<unknown>, depth: number): unknown {
  if (cause === undefined || cause === null || depth >= MAX_CAUSE_DEPTH) return undefined;
  if (typeof cause !== 'object') return { message: String(cause) };
  if (seen.has(cause)) return undefined; // cycle guard
  seen.add(cause);

  const err = cause as { name?: unknown; message?: unknown; code?: unknown; cause?: unknown };
  const out: Record<string, unknown> = {};
  if (typeof err.name === 'string') out.name = err.name;
  if (typeof err.message === 'string') out.message = err.message;
  if (typeof err.code === 'string') out.code = err.code;

  const nested = serializeCause(err.cause, seen, depth + 1);
  if (nested !== undefined) out.cause = nested;

  return out;
}

/**
 * Base error class for all NextRush errors
 */
export class NextRushError extends Error {
  /** HTTP status code */
  readonly status: number;

  /** Error code for programmatic handling */
  readonly code: string;

  /** Whether error message is safe to expose to client */
  readonly expose: boolean;

  /** Additional error details */
  readonly details?: Record<string, unknown>;

  /** Original error that caused this error */
  readonly cause?: unknown;

  /** Correlation/request identifier for tracing across boundaries (audit E-5). */
  readonly requestId?: string;

  /** Distributed-trace identifier (audit E-5). */
  readonly traceId?: string;

  /** ISO-8601 timestamp of when the error was created, when supplied. */
  readonly timestamp?: string;

  constructor(
    message: string,
    options: {
      status?: number;
      code?: string;
      expose?: boolean;
      details?: Record<string, unknown>;
      cause?: unknown;
      requestId?: string;
      traceId?: string;
      timestamp?: string;
    } = {}
  ) {
    // Pass cause to the native Error constructor so `util.inspect` / logging
    // tooling walks the chain natively, in addition to our own `cause` field.
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = this.constructor.name;
    this.status = options.status ?? 500;
    this.code = options.code ?? 'INTERNAL_ERROR';
    this.expose = options.expose ?? this.status < 500;
    // Freeze a shallow snapshot so the error owns immutable details and the
    // caller's object cannot be mutated through the error (audit E-6).
    this.details = options.details ? Object.freeze({ ...options.details }) : undefined;
    this.cause = options.cause;
    this.requestId = options.requestId;
    this.traceId = options.traceId;
    this.timestamp = options.timestamp;

    // Maintain proper stack trace for V8
    // Skip for common client errors (4xx with expose=true) to reduce overhead.
    // These are expected control-flow errors, not bugs — stack traces add cost
    // without diagnostic value in production.
    if (V8Error.captureStackTrace && !(this.expose && this.status < 500)) {
      V8Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON representation
   */
  toJSON(): Record<string, unknown> {
    const json: Record<string, unknown> = {
      error: this.name,
      message: this.expose ? this.message : 'Internal Server Error',
      code: this.code,
      status: this.status,
    };

    if (this.expose && this.details) {
      json.details = this.details;
    }

    // Surface the cause chain for diagnosability, but only on exposed errors —
    // a non-exposed 5xx cause may contain internal detail (audit E-2). Server
    // -side logging should read `error.cause` directly, which is never gated.
    if (this.expose && this.cause !== undefined) {
      const serialized = serializeCause(this.cause, new Set(), 0);
      if (serialized !== undefined) {
        json.cause = serialized;
      }
    }

    // Correlation identifiers are safe to surface and are the primary handle
    // for cross-service debugging (audit E-5). Only emitted when set, so the
    // default serialized shape is unchanged.
    if (this.requestId !== undefined) json.requestId = this.requestId;
    if (this.traceId !== undefined) json.traceId = this.traceId;
    if (this.timestamp !== undefined) json.timestamp = this.timestamp;

    return json;
  }

  /**
   * Reconstruct a {@link NextRushError} from a serialized {@link toJSON} payload
   * (audit E-7).
   *
   * @remarks
   * Enables cross-service transport: a downstream service can rebuild a typed
   * error (with a working `instanceof NextRushError`) from the JSON it received,
   * rather than being left with an opaque plain object. `message` falls back to
   * a generic string when the source error was not exposed.
   *
   * @param json - A payload previously produced by {@link toJSON}.
   * @returns A reconstructed {@link NextRushError}.
   */
  static fromJSON(json: Record<string, unknown>): NextRushError {
    return NextRushError.hydrate(json, (message, options) => new NextRushError(message, options));
  }

  /**
   * Shared hydration logic for {@link fromJSON} across the hierarchy.
   * @internal
   */
  protected static hydrate<T extends NextRushError>(
    json: Record<string, unknown>,
    build: (message: string, options: HydrateOptions) => T
  ): T {
    const status = typeof json.status === 'number' ? json.status : 500;
    const message = typeof json.message === 'string' ? json.message : getHttpStatusMessage(status);
    return build(message, {
      status,
      code: typeof json.code === 'string' ? json.code : undefined,
      details:
        json.details !== null && typeof json.details === 'object'
          ? (json.details as Record<string, unknown>)
          : undefined,
      requestId: typeof json.requestId === 'string' ? json.requestId : undefined,
      traceId: typeof json.traceId === 'string' ? json.traceId : undefined,
      timestamp: typeof json.timestamp === 'string' ? json.timestamp : undefined,
    });
  }

  /**
   * Create a response-safe version of the error
   */
  toResponse(): { status: number; body: Record<string, unknown> } {
    return {
      status: this.status,
      body: this.toJSON(),
    };
  }
}

/**
 * Default HTTP status messages
 */
const HTTP_STATUS_MESSAGES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  406: 'Not Acceptable',
  407: 'Proxy Authentication Required',
  408: 'Request Timeout',
  409: 'Conflict',
  410: 'Gone',
  411: 'Length Required',
  412: 'Precondition Failed',
  413: 'Payload Too Large',
  414: 'URI Too Long',
  415: 'Unsupported Media Type',
  416: 'Range Not Satisfiable',
  417: 'Expectation Failed',
  418: "I'm a Teapot",
  422: 'Unprocessable Entity',
  423: 'Locked',
  424: 'Failed Dependency',
  425: 'Too Early',
  426: 'Upgrade Required',
  428: 'Precondition Required',
  429: 'Too Many Requests',
  431: 'Request Header Fields Too Large',
  451: 'Unavailable For Legal Reasons',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
  505: 'HTTP Version Not Supported',
  506: 'Variant Also Negotiates',
  507: 'Insufficient Storage',
  508: 'Loop Detected',
  510: 'Not Extended',
  511: 'Network Authentication Required',
};

/**
 * Get default message for an HTTP status code
 */
export function getHttpStatusMessage(status: number): string {
  return HTTP_STATUS_MESSAGES[status] ?? `HTTP Error ${status}`;
}

/**
 * Base class for HTTP errors
 */
export class HttpError extends NextRushError {
  constructor(
    status: number,
    message?: string,
    options: {
      code?: string;
      expose?: boolean;
      details?: Record<string, unknown>;
      cause?: unknown;
      requestId?: string;
      traceId?: string;
      timestamp?: string;
    } = {}
  ) {
    super(message ?? getHttpStatusMessage(status), {
      status,
      code: options.code ?? codeForStatus(status),
      expose: options.expose ?? status < 500,
      details: options.details,
      cause: options.cause,
      requestId: options.requestId,
      traceId: options.traceId,
      timestamp: options.timestamp,
    });
  }

  /**
   * Reconstruct an {@link HttpError} from a serialized {@link NextRushError.toJSON}
   * payload (audit E-7).
   *
   * @param json - A payload previously produced by `toJSON()`.
   * @returns A reconstructed {@link HttpError}.
   */
  static override fromJSON(json: Record<string, unknown>): HttpError {
    return NextRushError.hydrate(
      json,
      (message, options) =>
        new HttpError(options.status ?? 500, message, {
          code: options.code,
          details: options.details,
          requestId: options.requestId,
          traceId: options.traceId,
          timestamp: options.timestamp,
        })
    );
  }
}
