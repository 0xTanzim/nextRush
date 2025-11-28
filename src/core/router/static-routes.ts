/**
 * Static Route Map for NextRush v2 Router
 *
 * O(1) lookup for routes without parameters.
 * Provides fast-path for common static routes like /, /health, /api.
 *
 * @packageDocumentation
 */

import type { OptimizedRouteMatch } from './types';

/**
 * Static route map for O(1) lookups
 *
 * Stores pre-computed route matches for static paths (no params or wildcards).
 * This bypasses tree traversal entirely for the most common route patterns.
 *
 * @example
 * ```typescript
 * const staticRoutes = new StaticRouteMap();
 *
 * staticRoutes.set('GET', '/', { handler, middleware: [], params: {}, path: '/' });
 * staticRoutes.set('GET', '/health', { handler, middleware: [], params: {}, path: '/health' });
 *
 * const match = staticRoutes.get('GET', '/health');
 * ```
 */
export class StaticRouteMap {
  private routes = new Map<string, OptimizedRouteMatch>();

  /**
   * Create cache key from method and path
   */
  private makeKey(method: string, path: string): string {
    return `${method}:${path}`;
  }

  /**
   * Check if a path is static (no params or wildcards)
   *
   * @param path - Path to check
   * @returns true if path has no params or wildcards
   */
  static isStaticPath(path: string): boolean {
    return !path.includes(':') && !path.includes('*');
  }

  /**
   * Add a static route
   *
   * @param method - HTTP method
   * @param path - Route path
   * @param match - Pre-computed route match
   */
  set(method: string, path: string, match: OptimizedRouteMatch): void {
    const key = this.makeKey(method, path);
    this.routes.set(key, match);
  }

  /**
   * Get a static route
   *
   * @param method - HTTP method
   * @param path - Route path
   * @returns Route match or undefined
   */
  get(method: string, path: string): OptimizedRouteMatch | undefined {
    const key = this.makeKey(method, path);
    return this.routes.get(key);
  }

  /**
   * Check if a static route exists
   *
   * @param method - HTTP method
   * @param path - Route path
   * @returns true if route exists
   */
  has(method: string, path: string): boolean {
    const key = this.makeKey(method, path);
    return this.routes.has(key);
  }

  /**
   * Delete a static route
   *
   * @param method - HTTP method
   * @param path - Route path
   * @returns true if route was deleted
   */
  delete(method: string, path: string): boolean {
    const key = this.makeKey(method, path);
    return this.routes.delete(key);
  }

  /**
   * Clear all static routes
   */
  clear(): void {
    this.routes.clear();
  }

  /**
   * Get the number of static routes
   */
  get size(): number {
    return this.routes.size;
  }

  /**
   * Get all static route keys
   */
  keys(): IterableIterator<string> {
    return this.routes.keys();
  }
}
