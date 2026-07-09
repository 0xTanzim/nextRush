/**
 * @nextrush/runtime - Server Startup Errors
 *
 * A single typed error for server bind/startup failures so every server
 * adapter (node/bun/deno) surfaces the same shape and message for the same
 * failure — most importantly `EADDRINUSE` (audit F-15). Previously Node
 * rejected the raw error, Bun rewrote the message, and Deno did neither.
 *
 * @packageDocumentation
 */

/** Known, normalized startup failure codes. */
export type ServerStartErrorCode = 'EADDRINUSE' | 'EACCES' | 'EADDRNOTAVAIL' | 'UNKNOWN';

/**
 * Error thrown when a server adapter fails to bind/start.
 *
 * @remarks
 * Carries a machine-readable {@link ServerStartErrorCode} and preserves the
 * original error via `cause`, so callers can branch on `code` regardless of
 * runtime.
 */
export class ServerStartError extends Error {
  /** Normalized startup failure code. */
  readonly code: ServerStartErrorCode;
  /** The port the adapter tried to bind (when known). */
  readonly port?: number;
  /** The host the adapter tried to bind (when known). */
  readonly host?: string;

  constructor(
    message: string,
    options: { code: ServerStartErrorCode; port?: number; host?: string; cause?: unknown }
  ) {
    super(message, { cause: options.cause });
    this.name = 'ServerStartError';
    this.code = options.code;
    this.port = options.port;
    this.host = options.host;
  }
}

/**
 * Classify a raw startup error's code from its message / `code` property.
 *
 * @param error - The raw error thrown by the runtime's server.
 * @returns The normalized {@link ServerStartErrorCode}.
 */
function classifyStartupError(error: unknown): ServerStartErrorCode {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';
  const message = error instanceof Error ? error.message : String(error);
  const haystack = `${code} ${message}`;

  if (haystack.includes('EADDRINUSE') || haystack.includes('address already in use')) {
    return 'EADDRINUSE';
  }
  if (haystack.includes('EACCES') || haystack.includes('permission denied')) {
    return 'EACCES';
  }
  if (haystack.includes('EADDRNOTAVAIL') || haystack.includes('cannot assign requested address')) {
    return 'EADDRNOTAVAIL';
  }
  return 'UNKNOWN';
}

/**
 * Normalize a raw runtime startup error into a {@link ServerStartError} with a
 * consistent, actionable message across adapters (audit F-15).
 *
 * @param error - The raw error thrown by the runtime's server.
 * @param context - The port/host the adapter attempted to bind.
 * @returns A typed {@link ServerStartError}.
 */
export function normalizeStartupError(
  error: unknown,
  context: { port: number; host: string }
): ServerStartError {
  const { port, host } = context;
  const errorCode = classifyStartupError(error);

  let message: string;
  switch (errorCode) {
    case 'EADDRINUSE':
      message =
        `Port ${String(port)} is already in use. ` +
        `Kill the process using that port or choose a different one.`;
      break;
    case 'EACCES':
      message =
        `Permission denied binding to ${host}:${String(port)}. ` +
        `Ports below 1024 typically require elevated privileges.`;
      break;
    case 'EADDRNOTAVAIL':
      message = `Cannot bind to ${host}:${String(port)} — address not available on this host.`;
      break;
    default:
      message = `Failed to start server on ${host}:${String(port)}: ${
        error instanceof Error ? error.message : String(error)
      }`;
  }

  return new ServerStartError(message, { code: errorCode, port, host, cause: error });
}
