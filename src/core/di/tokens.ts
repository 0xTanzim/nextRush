/**
 * Service Tokens for NextRush v2 DI System
 *
 * Pre-defined tokens for built-in framework services.
 * Use these tokens when registering or resolving core services.
 *
 * @packageDocumentation
 */

/**
 * Service tokens for built-in framework services
 *
 * @example
 * ```typescript
 * import { SERVICE_TOKENS } from '@nextrush/core/di';
 *
 * // Register a custom logger
 * container.singleton(SERVICE_TOKENS.LOGGER, () => new MyLogger());
 *
 * // Resolve the logger
 * const logger = container.resolve(SERVICE_TOKENS.LOGGER);
 * ```
 */
export const SERVICE_TOKENS = {
  // Core services
  /** Logger service token */
  LOGGER: Symbol('LOGGER'),
  /** Router service token */
  ROUTER: Symbol('ROUTER'),
  /** Context factory service token */
  CONTEXT_FACTORY: Symbol('CONTEXT_FACTORY'),

  // Middleware services
  /** CORS middleware token */
  CORS_MIDDLEWARE: Symbol('CORS_MIDDLEWARE'),
  /** Helmet middleware token */
  HELMET_MIDDLEWARE: Symbol('HELMET_MIDDLEWARE'),
  /** Body parser middleware token */
  BODY_PARSER_MIDDLEWARE: Symbol('BODY_PARSER_MIDDLEWARE'),
  /** Compression middleware token */
  COMPRESSION_MIDDLEWARE: Symbol('COMPRESSION_MIDDLEWARE'),
  /** Rate limiter middleware token */
  RATE_LIMITER_MIDDLEWARE: Symbol('RATE_LIMITER_MIDDLEWARE'),

  // Configuration
  /** Application configuration token */
  APPLICATION_CONFIG: Symbol('APPLICATION_CONFIG'),
  /** Middleware configuration token */
  MIDDLEWARE_CONFIG: Symbol('MIDDLEWARE_CONFIG'),
} as const;

/**
 * Type for service token values
 */
export type ServiceToken = (typeof SERVICE_TOKENS)[keyof typeof SERVICE_TOKENS];

/**
 * Custom token creation helper
 *
 * @param name - Token name for debugging
 * @returns A unique symbol token
 *
 * @example
 * ```typescript
 * const MY_SERVICE = createToken('MY_SERVICE');
 * container.singleton(MY_SERVICE, () => new MyService());
 * ```
 */
export function createToken(name: string): symbol {
  return Symbol(name);
}
