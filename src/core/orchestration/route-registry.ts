/**
 * Route Registry for NextRush v2
 * Handles route registration, matching, and management
 *
 * @packageDocumentation
 */

import { Router as RouterClass } from '@/core/router';
import type { RouteConfig, RouteHandler, Router } from '@/types/context';

/**
 * Route match result type
 */
export interface RouteMatch {
  handler: RouteHandler;
  params: Record<string, string>;
}

/**
 * Route Registry responsible for managing application routes
 * Following Single Responsibility Principle
 */
export class RouteRegistry {
  private internalRouter: RouterClass;

  constructor() {
    this.internalRouter = new RouterClass();
  }

  /**
   * Register a route with the internal router
   */
  public registerRoute(
    method: string,
    path: string,
    handler: RouteHandler | RouteConfig
  ): void {
    // Use the router's HTTP method methods
    switch (method) {
      case 'GET':
        this.internalRouter.get(path, handler);
        break;
      case 'POST':
        this.internalRouter.post(path, handler);
        break;
      case 'PUT':
        this.internalRouter.put(path, handler);
        break;
      case 'DELETE':
        this.internalRouter.delete(path, handler);
        break;
      case 'PATCH':
        this.internalRouter.patch(path, handler);
        break;
      case 'HEAD':
        // HEAD method not implemented in current router, fallback to GET
        this.internalRouter.get(path, handler);
        break;
      case 'OPTIONS':
        // OPTIONS method not implemented in current router, register as GET for now
        this.internalRouter.get(path, handler);
        break;
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }
  }

  /**
   * Find a route match for the given method and path
   */
  public findRoute(method: string, path: string): RouteMatch | null {
    return this.internalRouter.find(method, path) as RouteMatch | null;
  }

  /**
   * Create a new router instance
   */
  public createRouter(): Router {
    return new RouterClass();
  }

  /**
   * Register routes from a router with optional prefix
   */
  public registerRouter(
    prefixOrRouter: string | Router,
    router?: Router
  ): void {
    const actualRouter = router || (prefixOrRouter as Router);
    const prefix = router ? (prefixOrRouter as string) : '';

    if (
      actualRouter &&
      typeof actualRouter === 'object' &&
      'routes' in actualRouter
    ) {
      const routes = actualRouter.routes as Record<string, RouteHandler>;
      for (const [routeKey, handler] of Object.entries(routes)) {
        const colonIndex = routeKey.indexOf(':');
        if (colonIndex !== -1) {
          const method = routeKey.substring(0, colonIndex);
          const path = routeKey.substring(colonIndex + 1);
          if (method && path) {
            const fullPath = prefix + path;
            this.registerRoute(method, fullPath, handler);
          }
        }
      }
    }
  }

  /**
   * Get route statistics
   */
  public getRouteStats(): {
    totalRoutes: number;
    routesByMethod: Record<string, number>;
  } {
    // This would require extending the Router class to provide stats
    // For now, return basic info
    return {
      totalRoutes: 0, // Router doesn't expose this currently
      routesByMethod: {},
    };
  }
}
