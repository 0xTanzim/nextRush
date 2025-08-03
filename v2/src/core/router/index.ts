/**
 * Radix Tree Router for NextRush v2
 *
 * High-performance router with O(k) lookup performance
 * where k is path length, not route count.
 *
 * @packageDocumentation
 */

import type {
  Middleware,
  RouteConfig,
  RouteHandler,
  Router as RouterInterface,
} from '@/types/context';

/**
 * Radix tree node
 */
interface RadixNode {
  path: string;
  handlers: Map<string, RouteHandler>;
  children: Map<string, RadixNode>;
  isParam: boolean;
  paramName?: string;
}

/**
 * Route match result
 */
interface RouteMatch {
  handler: RouteHandler;
  params: Record<string, string>;
  path: string;
}

/**
 * Router class for modular routing with Radix Tree
 *
 * @example
 * ```typescript
 * import { createApp } from 'nextrush-v2';
 *
 * const app = createApp();
 * const userRouter = app.router();
 *
 * userRouter.get('/profile', async (ctx) => {
 *   ctx.res.json({ user: 'profile' });
 * });
 *
 * userRouter.post('/login', async (ctx) => {
 *   const { email, password } = ctx.body;
 *   ctx.res.json({ message: 'Logged in' });
 * });
 *
 * app.use('/users', userRouter);
 * ```
 */
export class Router implements RouterInterface {
  private root: RadixNode;
  private middleware: Middleware[] = [];
  private prefix: string = '';

  constructor(prefix: string = '') {
    this.prefix = prefix;
    this.root = {
      path: '',
      handlers: new Map(),
      children: new Map(),
      isParam: false,
    };
  }

  /**
   * Register a GET route
   */
  public get(path: string, handler: RouteHandler | RouteConfig): Router {
    this.registerRoute('GET', path, handler);
    return this;
  }

  /**
   * Register a POST route
   */
  public post(path: string, handler: RouteHandler | RouteConfig): Router {
    this.registerRoute('POST', path, handler);
    return this;
  }

  /**
   * Register a PUT route
   */
  public put(path: string, handler: RouteHandler | RouteConfig): Router {
    this.registerRoute('PUT', path, handler);
    return this;
  }

  /**
   * Register a DELETE route
   */
  public delete(path: string, handler: RouteHandler | RouteConfig): Router {
    this.registerRoute('DELETE', path, handler);
    return this;
  }

  /**
   * Register a PATCH route
   */
  public patch(path: string, handler: RouteHandler | RouteConfig): Router {
    this.registerRoute('PATCH', path, handler);
    return this;
  }

  /**
   * Register middleware
   */
  public use(middleware: Middleware): Router;
  /**
   * Register sub-router
   */
  public use(prefix: string, router: Router): Router;
  public use(middlewareOrPrefix: Middleware | string, router?: Router): Router {
    if (typeof middlewareOrPrefix === 'function') {
      // Register middleware
      this.middleware.push(middlewareOrPrefix);
    } else if (router) {
      // Register sub-router
      const subRouter = router as any;
      const subRoutes = subRouter.getRoutes();
      const subMiddleware = subRouter.getMiddleware();

      // Add sub-router middleware
      this.middleware.push(...subMiddleware);

      // Add sub-router routes with prefix
      for (const [routeKey, handler] of subRoutes) {
        const [method, path] = routeKey.split(':');
        const fullPath = `${middlewareOrPrefix}${path}`;
        this.registerRoute(method, fullPath, handler);
      }
    }

    return this;
  }

  /**
   * Get router middleware
   */
  public getMiddleware(): Middleware[] {
    return [...this.middleware];
  }

  /**
   * Get router routes (for compatibility)
   */
  public getRoutes(): Map<string, RouteHandler> {
    const allRoutes = new Map<string, RouteHandler>();
    this.collectRoutes(this.root, '', allRoutes);
    return allRoutes;
  }

  /**
   * Find route with O(k) lookup
   */
  public find(method: string, path: string): RouteMatch | null {
    const pathParts = this.splitPath(path);
    const params: Record<string, string> = {};
    let currentNode = this.root;

    // Handle root path case
    if (pathParts.length === 1 && pathParts[0] === '') {
      // Check if we have a handler for this method at root
      const handler = currentNode.handlers.get(method);
      if (!handler) {
        return null;
      }

      return {
        handler,
        params,
        path,
      };
    }

    for (const part of pathParts) {
      if (!part) continue; // Skip empty parts

      // Try exact match first
      if (currentNode.children.has(part)) {
        currentNode = currentNode.children.get(part)!;
        continue;
      }

      // Try parameter match
      let foundParam = false;
      for (const childNode of currentNode.children.values()) {
        if (childNode.isParam) {
          params[childNode.paramName!] = part;
          currentNode = childNode;
          foundParam = true;
          break;
        }
      }

      if (!foundParam) {
        return null; // No match found
      }
    }

    // Check if we have a handler for this method
    const handler = currentNode.handlers.get(method);
    if (!handler) {
      return null;
    }

    return {
      handler,
      params,
      path,
    };
  }

  /**
   * Register a route with O(k) insertion
   */
  private registerRoute(
    method: string,
    path: string,
    handler: RouteHandler | RouteConfig
  ): void {
    const fullPath = this.prefix ? `${this.prefix}${path}` : path;
    const pathParts = this.splitPath(fullPath);
    let currentNode = this.root;

    // Extract the actual handler
    let actualHandler: RouteHandler;
    if (typeof handler === 'object') {
      actualHandler = handler.handler;
      // Add route-specific middleware
      if (handler.middleware) {
        this.middleware.push(...handler.middleware);
      }
    } else {
      actualHandler = handler;
    }

    // Handle root path case
    if (pathParts.length === 1 && pathParts[0] === '') {
      currentNode.handlers.set(method, actualHandler);
      return;
    }

    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      if (!part) continue; // Skip empty parts

      const isLastPart = i === pathParts.length - 1;
      const isParam = part.startsWith(':');

      if (isParam) {
        // Parameter node
        const paramName = part.slice(1);
        const paramKey = `:${paramName}`;

        if (!currentNode.children.has(paramKey)) {
          currentNode.children.set(paramKey, {
            path: part,
            handlers: new Map(),
            children: new Map(),
            isParam: true,
            paramName,
          });
        }

        currentNode = currentNode.children.get(paramKey)!;
      } else {
        // Static node
        if (!currentNode.children.has(part)) {
          currentNode.children.set(part, {
            path: part,
            handlers: new Map(),
            children: new Map(),
            isParam: false,
          });
        }

        currentNode = currentNode.children.get(part)!;
      }

      // Register handler at the final node
      if (isLastPart) {
        currentNode.handlers.set(method, actualHandler);
      }
    }
  }

  /**
   * Split path into parts with zero allocations
   */
  private splitPath(path: string): string[] {
    if (path === '/') {
      return [''];
    }

    // Remove leading slash and split
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return cleanPath.split('/').filter(Boolean);
  }

  /**
   * Recursively collect all routes from the tree
   */
  private collectRoutes(
    node: RadixNode,
    currentPath: string,
    routes: Map<string, RouteHandler>
  ): void {
    // Add handlers at current node
    for (const [method, handler] of node.handlers) {
      const routeKey = `${method}:${currentPath || '/'}`;
      routes.set(routeKey, handler);
    }

    // Recursively collect from children
    for (const childNode of node.children.values()) {
      const childPath = `${currentPath}/${childNode.path}`;
      this.collectRoutes(childNode, childPath, routes);
    }
  }
}

/**
 * Create a new router instance
 *
 * @param prefix - Optional route prefix
 * @returns Router instance
 *
 * @example
 * ```typescript
 * import { createRouter } from 'nextrush-v2';
 *
 * const userRouter = createRouter('/users');
 *
 * userRouter.get('/profile', async (ctx) => {
 *   ctx.res.json({ user: 'profile' });
 * });
 *
 * app.use(userRouter);
 * ```
 */
export function createRouter(prefix: string = ''): Router {
  return new Router(prefix);
}
