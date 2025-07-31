/**
 * Router class for NextRush v2
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
 * Router class for modular routing
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
  private routes: Map<string, RouteHandler> = new Map();
  private middleware: Middleware[] = [];
  private prefix: string = '';

  constructor(prefix: string = '') {
    this.prefix = prefix;
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
        this.routes.set(`${method}:${fullPath}`, handler);
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
   * Get router routes
   */
  public getRoutes(): Map<string, RouteHandler> {
    return new Map(this.routes);
  }

  /**
   * Register a route with the router
   */
  private registerRoute(
    method: string,
    path: string,
    handler: RouteHandler | RouteConfig
  ): void {
    const fullPath = this.prefix ? `${this.prefix}${path}` : path;
    const routeKey = `${method}:${fullPath}`;

    if (typeof handler === 'object') {
      // Fastify-style route config
      this.routes.set(routeKey, handler.handler);

      // Add route-specific middleware
      if (handler.middleware) {
        this.middleware.push(...handler.middleware);
      }
    } else {
      // Simple handler function
      this.routes.set(routeKey, handler);
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
