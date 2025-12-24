/**
 * @nextrush/types - Router Type Definitions
 *
 * Types for the NextRush router system.
 * The router uses a radix tree for efficient route matching.
 *
 * @packageDocumentation
 */

import type { Middleware, RouteHandler } from './context';
import type { HttpMethod } from './http';

// ============================================================================
// Route Definition Types
// ============================================================================

/**
 * Route definition
 */
export interface Route {
  /** HTTP method */
  method: HttpMethod;
  /** Route path pattern */
  path: string;
  /** Route handler */
  handler: RouteHandler;
  /** Optional route-level middleware */
  middleware?: Middleware[];
}

/**
 * Matched route result
 */
export interface RouteMatch {
  /** Matched handler */
  handler: RouteHandler;
  /** Extracted route parameters */
  params: Record<string, string>;
  /** Combined middleware stack */
  middleware: Middleware[];
}

// ============================================================================
// Router Interface
// ============================================================================

/**
 * Router interface for route registration
 *
 * @example
 * ```typescript
 * const router = createRouter();
 *
 * router.get('/users', listUsers);
 * router.get('/users/:id', getUser);
 * router.post('/users', createUser);
 *
 * app.use(router.routes());
 * ```
 */
export interface Router {
  /**
   * Register a GET route
   */
  get(path: string, ...handlers: RouteHandler[]): this;

  /**
   * Register a POST route
   */
  post(path: string, ...handlers: RouteHandler[]): this;

  /**
   * Register a PUT route
   */
  put(path: string, ...handlers: RouteHandler[]): this;

  /**
   * Register a DELETE route
   */
  delete(path: string, ...handlers: RouteHandler[]): this;

  /**
   * Register a PATCH route
   */
  patch(path: string, ...handlers: RouteHandler[]): this;

  /**
   * Register a HEAD route
   */
  head(path: string, ...handlers: RouteHandler[]): this;

  /**
   * Register an OPTIONS route
   */
  options(path: string, ...handlers: RouteHandler[]): this;

  /**
   * Register a route for any HTTP method
   */
  all(path: string, ...handlers: RouteHandler[]): this;

  /**
   * Register a route for specific method
   */
  route(method: HttpMethod, path: string, ...handlers: RouteHandler[]): this;

  /**
   * Mount router middleware
   */
  use(path: string, router: Router): this;
  use(middleware: Middleware): this;

  /**
   * Get routes middleware function
   * Mount this on the application
   */
  routes(): Middleware;

  /**
   * Match a route
   */
  match(method: HttpMethod, path: string): RouteMatch | null;
}

// ============================================================================
// Router Options
// ============================================================================

/**
 * Router configuration options
 */
export interface RouterOptions {
  /**
   * Prefix for all routes
   * @example '/api/v1'
   */
  prefix?: string;

  /**
   * Whether to enable case-sensitive routing
   * @default false
   */
  caseSensitive?: boolean;

  /**
   * Whether to enable strict routing (trailing slashes matter)
   * @default false
   */
  strict?: boolean;
}

// ============================================================================
// Route Pattern Types
// ============================================================================

/**
 * Supported route pattern types
 */
export type RoutePattern =
  | string // Static: '/users'
  | `${string}/:${string}` // Param: '/users/:id'
  | `${string}/*` // Wildcard: '/files/*'
  | `${string}/:${string}/*`; // Combined: '/api/:version/*'

/**
 * Route parameter definition
 */
export interface RouteParam {
  /** Parameter name (without colon) */
  name: string;
  /** Whether the parameter is optional */
  optional?: boolean;
  /** Regex pattern for validation */
  pattern?: RegExp;
}
