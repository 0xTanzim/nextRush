/**
 * @nextrush/types - Logger contract
 *
 * The structured logging interface shared by the application, adapters, and
 * extensions. Lives here (the lowest package) so any layer can depend on the
 * contract without depending on `@nextrush/core`.
 *
 * @packageDocumentation
 */

/**
 * Pluggable logger interface.
 *
 * Pass `console` for quick development logging, or a structured logger
 * (pino, winston, `@nextrush/logger`) in production.
 */
export interface Logger {
  error(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  info(...args: unknown[]): void;
  debug(...args: unknown[]): void;
}
