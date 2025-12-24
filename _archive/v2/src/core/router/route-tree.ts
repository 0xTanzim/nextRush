/**
 * Route Tree for NextRush v2 Router
 *
 * Radix tree implementation for O(k) route matching where k is path length.
 * Handles static segments, parameters, and wildcards.
 *
 * @packageDocumentation
 */

import type { Middleware, RouteConfig, RouteHandler } from '@/types/context';
import { PathSplitter } from './path-splitter';
import type { OptimizedRadixNode, OptimizedRouteMatch, RouteData } from './types';

/**
 * Route tree for radix tree-based routing
 *
 * Provides efficient O(k) route registration and matching.
 *
 * @example
 * ```typescript
 * const tree = new RouteTree();
 *
 * tree.register('GET', '/users/:id', handler, []);
 * const match = tree.find('GET', '/users/123', () => ({}));
 * ```
 */
export class RouteTree {
  private root: OptimizedRadixNode;

  constructor() {
    this.root = {
      path: '',
      handlers: new Map(),
      children: new Map(),
      isParam: false,
    };
  }

  /**
   * Get the root node
   */
  getRoot(): OptimizedRadixNode {
    return this.root;
  }

  /**
   * Register a route in the tree
   *
   * @param method - HTTP method
   * @param path - Route path
   * @param handler - Route handler
   * @param middleware - Route middleware
   * @returns Created route data
   */
  register(
    method: string,
    path: string,
    handler: RouteHandler | RouteConfig,
    middleware: Middleware[]
  ): RouteData {
    const pathParts = PathSplitter.split(path);
    let currentNode = this.root;

    // Extract handler and middleware
    let actualHandler: RouteHandler;
    let routeMiddleware: Middleware[] = [...middleware];

    if (typeof handler === 'function') {
      actualHandler = handler;
    } else {
      actualHandler = handler.handler;
      if (handler.middleware) {
        const handlerMiddleware = Array.isArray(handler.middleware)
          ? handler.middleware
          : [handler.middleware];
        routeMiddleware = [...routeMiddleware, ...handlerMiddleware];
      }
    }

    const routeData: RouteData = {
      handler: actualHandler,
      middleware: routeMiddleware,
    };

    // Handle root path case
    if (pathParts.length === 0) {
      currentNode.handlers.set(method, routeData);
      return routeData;
    }

    // Build tree with optimized node creation
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      if (!part) continue;

      if (PathSplitter.isParameterized(part)) {
        // Parameter node
        const paramName = PathSplitter.extractParamName(part);

        if (!currentNode.paramChild && paramName) {
          currentNode.paramChild = {
            path: part,
            handlers: new Map(),
            children: new Map(),
            isParam: true,
            paramName,
            paramIndex: i,
          };
        }
        if (currentNode.paramChild) {
          currentNode = currentNode.paramChild;
        }
      } else if (part === '*') {
        // Wildcard node
        if (!currentNode.wildcardChild) {
          currentNode.wildcardChild = {
            path: part,
            handlers: new Map(),
            children: new Map(),
            isParam: false,
          };
        }
        currentNode = currentNode.wildcardChild;
      } else {
        // Static node
        let childNode = currentNode.children.get(part);
        if (!childNode) {
          childNode = {
            path: part,
            handlers: new Map(),
            children: new Map(),
            isParam: false,
          };
          currentNode.children.set(part, childNode);
        }
        currentNode = childNode;
      }
    }

    // Set handler at final node
    currentNode.handlers.set(method, routeData);
    return routeData;
  }

  /**
   * Find a route in the tree
   *
   * @param method - HTTP method
   * @param path - Request path
   * @param getParams - Function to get parameter object
   * @returns Route match or null
   */
  find(
    method: string,
    path: string,
    getParams: () => Record<string, string>
  ): OptimizedRouteMatch | null {
    // Fast root path check
    if (path === '/' || path === '') {
      const routeData = this.root.handlers.get(method);
      return routeData
        ? {
            handler: routeData.handler,
            middleware: routeData.middleware,
            params: {},
            path,
          }
        : null;
    }

    const pathParts = PathSplitter.split(path);
    if (pathParts.length === 0) {
      const routeData = this.root.handlers.get(method);
      return routeData
        ? {
            handler: routeData.handler,
            middleware: routeData.middleware,
            params: {},
            path,
          }
        : null;
    }

    let currentNode = this.root;
    const params = getParams();

    // Single-pass traversal
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      if (!part) continue;

      // Try exact match first (hot path)
      const exactChild = currentNode.children.get(part);
      if (exactChild) {
        currentNode = exactChild;
        continue;
      }

      // Parameter match (warm path)
      const paramChild = currentNode.paramChild;
      if (paramChild?.paramName) {
        params[paramChild.paramName] = part;
        currentNode = paramChild;
        continue;
      }

      // Wildcard match (cold path)
      const wildcardChild = currentNode.wildcardChild;
      if (wildcardChild) {
        params['*'] = pathParts.slice(i).join('/');
        currentNode = wildcardChild;
        break;
      }

      // No match
      return null;
    }

    const routeData = currentNode.handlers.get(method);
    return routeData
      ? {
          handler: routeData.handler,
          middleware: routeData.middleware,
          params,
          path,
        }
      : null;
  }

  /**
   * Update handler with compiled version
   *
   * @param method - HTTP method
   * @param pattern - Route pattern
   * @param compiledExecute - Compiled handler function
   */
  setCompiledHandler(
    method: string,
    pattern: string,
    compiledExecute: (ctx: unknown) => Promise<void>
  ): void {
    const pathParts = PathSplitter.split(pattern);
    let currentNode = this.root;

    // Navigate to the route node
    for (const part of pathParts) {
      if (!part) continue;

      if (PathSplitter.isParameterized(part)) {
        if (currentNode.paramChild) {
          currentNode = currentNode.paramChild;
        } else {
          return;
        }
      } else if (part === '*') {
        if (currentNode.wildcardChild) {
          currentNode = currentNode.wildcardChild;
        } else {
          return;
        }
      } else {
        const child = currentNode.children.get(part);
        if (child) {
          currentNode = child;
        } else {
          return;
        }
      }
    }

    const routeData = currentNode.handlers.get(method);
    if (routeData) {
      routeData.compiled = compiledExecute;
    }
  }

  /**
   * Collect all routes iteratively
   *
   * @returns Map of route keys to route data
   */
  collectRoutes(): Map<string, RouteData> {
    const routes = new Map<string, RouteData>();
    const stack: Array<{ node: OptimizedRadixNode; path: string }> = [
      { node: this.root, path: '' },
    ];

    while (stack.length > 0) {
      const { node, path } = stack.pop()!;

      // Add handlers at current node
      for (const [method, routeData] of node.handlers) {
        const routeKey = `${method}:${path || '/'}`;
        routes.set(routeKey, routeData);
      }

      // Add children to stack
      for (const childNode of node.children.values()) {
        stack.push({ node: childNode, path: `${path}/${childNode.path}` });
      }

      // Add parameter child
      if (node.paramChild) {
        stack.push({ node: node.paramChild, path: `${path}/${node.paramChild.path}` });
      }

      // Add wildcard child
      if (node.wildcardChild) {
        stack.push({ node: node.wildcardChild, path: `${path}/${node.wildcardChild.path}` });
      }
    }

    return routes;
  }

  /**
   * Count total routes in tree
   */
  countRoutes(): number {
    let count = 0;

    const countNode = (node: OptimizedRadixNode): void => {
      count += node.handlers.size;
      for (const child of node.children.values()) {
        countNode(child);
      }
      if (node.paramChild) countNode(node.paramChild);
      if (node.wildcardChild) countNode(node.wildcardChild);
    };

    countNode(this.root);
    return count;
  }
}
