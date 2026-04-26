/**
 * @nextrush/errors - Base Error Classes
 *
 * Foundational error classes for NextRush framework.
 *
 * @packageDocumentation
 */

const V8Error = Error as ErrorConstructor & {
  captureStackTrace?: (targetObject: object, constructorOpt?: Function) => void;
};

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

  constructor(
    message: string,
    options: {
      status?: number;
      code?: string;
      expose?: boolean;
      details?: Record<string, unknown>;
      cause?: unknown;
    } = {}
  ) {
    super(message);
    this.name = this.constructor.name;
    this.status = options.status ?? 500;
    this.code = options.code ?? 'INTERNAL_ERROR';
    this.expose = options.expose ?? this.status < 500;
    this.details = options.details;
    this.cause = options.cause;

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

    return json;
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
    } = {}
  ) {
    super(message ?? getHttpStatusMessage(status), {
      status,
      code: options.code ?? `HTTP_${status}`,
      expose: options.expose ?? status < 500,
      details: options.details,
      cause: options.cause,
    });
  }
}
