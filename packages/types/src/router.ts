/**
 * @nextrush/types - Router Type Definitions
 *
 * Types for the NextRush router system.
 * The router uses a radix tree for efficient route matching.
 *
 * @packageDocumentation
 */

import type { Context, Middleware, RouteHandler } from './context';
import type { HttpMethod } from './http';
import type { RouteDefinition, RouteEntry } from './route-metadata';

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
  /** Router-level middleware stack (route-specific middleware is in the executor) */
  middleware: Middleware[];
  /** Pre-compiled executor for fast dispatch (internal) */
  executor?: (ctx: Context) => Promise<void>;
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
  get(path: string, ...entries: RouteEntry[]): this;

  /**
   * Register a POST route
   */
  post(path: string, ...entries: RouteEntry[]): this;

  /**
   * Register a PUT route
   */
  put(path: string, ...entries: RouteEntry[]): this;

  /**
   * Register a DELETE route
   */
  delete(path: string, ...entries: RouteEntry[]): this;

  /**
   * Register a PATCH route
   */
  patch(path: string, ...entries: RouteEntry[]): this;

  /**
   * Register a HEAD route
   */
  head(path: string, ...entries: RouteEntry[]): this;

  /**
   * Register an OPTIONS route
   */
  options(path: string, ...entries: RouteEntry[]): this;

  /**
   * Register a route for any HTTP method
   */
  all(path: string, ...entries: RouteEntry[]): this;

  /**
   * Register a route for specific method
   */
  route(method: HttpMethod, path: string, ...entries: RouteEntry[]): this;

  /**
   * Mount router middleware
   */
  /**
   * Mount middleware.
   *
   * @remarks
   * Sub-router mounting (`router.use(path, subRouter)`) is a concrete
   * `@nextrush/router` `Router` capability, not part of this structural
   * interface — mounting needs internal tree access
   * (`Router.mount()`/the concrete class's own `use()` overload provide it).
   * Cross-package router composition goes through `Application.route()`
   * (`Routable`, `routes()`-only) instead.
   */
  use(middleware: Middleware): this;

  /**
   * Register a redirect from one path to another
   *
   * @param from - Source path to redirect from
   * @param to - Target path or URL to redirect to
   * @param status - HTTP status code (default: 301)
   */
  redirect(from: string, to: string, status?: 301 | 302 | 303 | 307 | 308): this;

  /**
   * Get routes middleware function
   * Mount this on the application
   */
  routes(): Middleware;

  /**
   * Return every registered route as a read-only list of RouteDefinitions.
   * Consumed by renderers (`@nextrush/openapi`, SDK/Postman generators).
   * Doc-generation-time projection — never called on the request hot path.
   */
  getRoutes(): readonly RouteDefinition[];

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

  /**
   * Whether to percent-decode extracted param and wildcard values
   * (via `decodeURIComponent`). Malformed encoding falls back to the raw value
   * and never throws. Set to `false` to receive raw, undecoded values.
   * @default true
   */
  decode?: boolean;
}

// ============================================================================
// Route Pattern Types
// ============================================================================

/**
 * Supported route pattern types
 */
export type RoutePattern =
  | `/${string}` // Static: '/users'
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
