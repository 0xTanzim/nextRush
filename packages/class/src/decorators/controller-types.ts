/**
 * @nextrush/class - Controller Type Definitions
 *
 * Metadata and options shapes for the @Controller decorator, plus the shared
 * middleware reference type used by both controller- and route-level metadata.
 */

/**
 * Reference to middleware - can be a class token or function
 */
export type MiddlewareRef = symbol | string | ((...args: unknown[]) => unknown);

/**
 * Controller metadata stored by @Controller decorator
 */
export interface ControllerMetadata {
  /** Base path prefix for all routes in this controller */
  readonly path: string;

  /** Optional controller version for API versioning */
  readonly version?: string;

  /** Middleware to apply to all routes in this controller */
  readonly middleware?: MiddlewareRef[];

  /** Controller-level tags for documentation/grouping */
  readonly tags?: string[];
}

/**
 * Options for @Controller decorator
 */
export interface ControllerOptions {
  /** Base path prefix for all routes */
  path?: string;

  /** API version prefix (e.g., 'v1' → '/v1/users') */
  version?: string;

  /** Middleware to apply to all routes */
  middleware?: MiddlewareRef[];

  /** Tags for documentation grouping */
  tags?: string[];
}
