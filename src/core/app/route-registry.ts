/**
 * Route Registry for NextRush v2
 *
 * Handles route registration and sub-router mounting.
 * Follows Single Responsibility Principle.
 *
 * @packageDocumentation
 */

import type { Router as RouterClass } from '@/core/router';
import type { Middleware, RouteConfig, RouteHandler, Router } from '@/types/context';

/**
 * Route registration options
 */
export interface RouteRegistrationConfig {
  /** Router instance */
  router: RouterClass;
  /** Middleware array (for cache invalidation) */
  middleware: Middleware[];
  /** Function to invalidate exception filter cache */
  invalidateExceptionFilterCache: () => void;
}

/**
 * HTTP methods supported by the router
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * Register a route with the router
 *
 * @param config - Route registration configuration
 * @param method - HTTP method
 * @param path - Route path
 * @param handler - Route handler or config
 */
export function registerRoute(
  config: RouteRegistrationConfig,
  method: HttpMethod,
  path: string,
  handler: RouteHandler | RouteConfig
): void {
  const { router } = config;

  switch (method) {
    case 'GET':
      router.get(path, handler);
      break;
    case 'POST':
      router.post(path, handler);
      break;
    case 'PUT':
      router.put(path, handler);
      break;
    case 'DELETE':
      router.delete(path, handler);
      break;
    case 'PATCH':
      router.patch(path, handler);
      break;
    default:
      throw new Error(`Unsupported HTTP method: ${method}`);
  }
}

/**
 * Mount a sub-router with prefix
 *
 * @param config - Route registration configuration
 * @param prefix - URL prefix for all routes
 * @param subRouter - Sub-router instance
 */
export function mountSubRouter(
  config: RouteRegistrationConfig,
  prefix: string,
  subRouter: Router
): void {
  const { middleware, invalidateExceptionFilterCache } = config;

  // Cast to access internal methods
  const routerInternal = subRouter as any;
  const subRoutes = routerInternal.getRoutes();
  const subMiddleware = routerInternal.getMiddleware();

  // Add sub-router middleware
  middleware.push(...subMiddleware);
  invalidateExceptionFilterCache();

  // Add sub-router routes with prefix
  for (const [routeKey, routeData] of subRoutes) {
    const colonIndex = routeKey.indexOf(':');
    if (colonIndex !== -1) {
      const method = routeKey.substring(0, colonIndex) as HttpMethod;
      const path = routeKey.substring(colonIndex + 1);
      if (method && path) {
        const fullPath = `${prefix}${path}`;
        const routeConfig: RouteConfig = {
          handler: routeData.handler,
          middleware:
            routeData.middleware.length > 0 ? routeData.middleware : undefined,
        };
        registerRoute(config, method, fullPath, routeConfig);
      }
    }
  }
}

/**
 * Add middleware to the application
 *
 * @param middleware - Application middleware array
 * @param newMiddleware - Middleware to add
 * @param invalidateCache - Function to invalidate exception filter cache
 */
export function addMiddleware(
  middleware: Middleware[],
  newMiddleware: Middleware,
  invalidateCache: () => void
): void {
  middleware.push(newMiddleware);
  invalidateCache();
}

/**
 * Create route registration helpers
 *
 * @param config - Route registration configuration
 * @returns Object with route registration methods
 */
export function createRouteHelpers(config: RouteRegistrationConfig) {
  return {
    get: (path: string, handler: RouteHandler | RouteConfig) =>
      registerRoute(config, 'GET', path, handler),
    post: (path: string, handler: RouteHandler | RouteConfig) =>
      registerRoute(config, 'POST', path, handler),
    put: (path: string, handler: RouteHandler | RouteConfig) =>
      registerRoute(config, 'PUT', path, handler),
    delete: (path: string, handler: RouteHandler | RouteConfig) =>
      registerRoute(config, 'DELETE', path, handler),
    patch: (path: string, handler: RouteHandler | RouteConfig) =>
      registerRoute(config, 'PATCH', path, handler),
  };
}
