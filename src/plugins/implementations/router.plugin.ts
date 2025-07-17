/**
 * 🚀 Router Plugin - Enterprise Routing Implementation
 * High-performance, type-safe routing plugin with pattern matching
 */

import {
  ExpressHandler as Handler,
  NextRushRequest,
  NextRushResponse,
} from '../../types/express';
import { PluginContext, PluginMetadata } from '../core/plugin.interface';
import {
  BaseRouterPlugin,
  RouteDefinition,
  RouteMatch,
} from '../types/specialized-plugins';

/**
 * Route pattern compiler interface
 */
interface CompiledRoute {
  pattern: RegExp;
  paramNames: string[];
  definition: RouteDefinition;
}

/**
 * Enterprise Router Plugin
 * Provides high-performance routing with Express.js compatibility
 */
export class RouterPlugin extends BaseRouterPlugin {
  public readonly metadata: PluginMetadata = {
    name: 'NextRush-Router',
    version: '1.0.0',
    description:
      'Enterprise routing plugin with pattern matching and middleware support',
    author: 'NextRush Framework',
    category: 'core',
    priority: 100, // High priority - core routing
    dependencies: [],
  };

  private compiledRoutes = new Map<string, CompiledRoute>();
  private globalMiddleware: Handler[] = [];

  protected async onInstall(context: PluginContext): Promise<void> {
    const app = context.app;

    // Bind HTTP methods to the application
    const httpMethods = [
      'get',
      'post',
      'put',
      'delete',
      'patch',
      'head',
      'options',
      'all',
    ];

    httpMethods.forEach((method) => {
      (app as any)[method] = (path: string, ...handlers: Handler[]) => {
        this.addRoute({
          method: method.toUpperCase(),
          path,
          handlers,
          middleware: [],
          options: {},
        });
        return app;
      };
    });

    // Bind middleware method
    (app as any).use = (pathOrHandler: string | Handler, handler?: Handler) => {
      if (typeof pathOrHandler === 'function') {
        // Global middleware: app.use(handler)
        this.globalMiddleware.push(pathOrHandler);
      } else if (typeof pathOrHandler === 'string' && handler) {
        // Path-specific middleware: app.use('/path', handler)
        this.addRoute({
          method: 'USE',
          path: pathOrHandler,
          handlers: [handler],
          middleware: [],
          options: {},
        });
      }
      return app;
    };

    context.logger.info('Router plugin methods bound to application');
  }

  protected async onStart(context: PluginContext): Promise<void> {
    // Compile all routes for performance
    this.compileRoutes();
    context.logger.info(`Router started with ${this.routes.size} routes`);
  }

  protected async onStop(context: PluginContext): Promise<void> {
    // Clear compiled routes
    this.compiledRoutes.clear();
    context.logger.info('Router stopped');
  }

  protected async onUninstall(context: PluginContext): Promise<void> {
    // Clean up all routes
    this.routes.clear();
    this.compiledRoutes.clear();
    this.globalMiddleware = [];
    context.logger.info('Router plugin uninstalled');
  }

  public override addRoute(definition: RouteDefinition): void {
    super.addRoute(definition);

    // Compile the route immediately for performance
    const key = `${definition.method}:${definition.path}`;
    const compiled = this.compileRoute(definition);
    this.compiledRoutes.set(key, compiled);
  }

  public override removeRoute(method: string, path: string): boolean {
    const removed = super.removeRoute(method, path);
    if (removed) {
      const key = `${method.toUpperCase()}:${path}`;
      this.compiledRoutes.delete(key);
    }
    return removed;
  }

  public findRoute(method: string, path: string): RouteMatch | null {
    // First try exact match for performance
    const exactKey = `${method.toUpperCase()}:${path}`;
    const exactRoute = this.compiledRoutes.get(exactKey);
    if (exactRoute) {
      return {
        route: exactRoute.definition,
        params: {},
      };
    }

    // Try pattern matching
    for (const [, compiled] of this.compiledRoutes) {
      if (
        compiled.definition.method !== method.toUpperCase() &&
        compiled.definition.method !== 'ALL'
      ) {
        continue;
      }

      const match = compiled.pattern.exec(path);
      if (match) {
        const params: Record<string, string> = {};

        // Extract parameters
        compiled.paramNames.forEach((name, index) => {
          params[name] = match[index + 1] || '';
        });

        return {
          route: compiled.definition,
          params,
        };
      }
    }

    return null;
  }

  /**
   * Get middleware chain for a request
   */
  public getMiddlewareChain(method: string, path: string): Handler[] {
    const middleware: Handler[] = [...this.globalMiddleware];

    // Add path-specific middleware
    for (const [, compiled] of this.compiledRoutes) {
      if (compiled.definition.method === 'USE') {
        const match = compiled.pattern.exec(path);
        if (match) {
          middleware.push(...compiled.definition.handlers);
        }
      }
    }

    return middleware;
  }

  /**
   * Handle incoming request
   */
  public async handleRequest(
    req: NextRushRequest,
    res: NextRushResponse
  ): Promise<boolean> {
    const method = req.method || 'GET';
    const path = req.url || '/';

    // Find matching route
    const match = this.findRoute(method, path);
    if (!match) {
      return false; // No route found
    }

    // Add params to request
    (req as any).params = match.params;

    // Get middleware chain
    const middlewareChain = this.getMiddlewareChain(method, path);
    const handlers = [...middlewareChain, ...match.route.handlers];

    // Execute middleware and handlers
    let currentIndex = 0;

    const next = async (): Promise<void> => {
      if (currentIndex >= handlers.length) {
        return;
      }

      const handler = handlers[currentIndex++];

      try {
        // Convert Express-style to context-style if needed
        if (this.isExpressStyleHandler(handler)) {
          await this.executeExpressHandler(handler, req, res, next);
        } else {
          await this.executeContextHandler(handler, req, res, next);
        }
      } catch (error) {
        this.getContext().logger.error('Handler execution error:', error);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal Server Error' }));
        }
      }
    };

    await next();
    return true;
  }

  // Private methods
  private compileRoutes(): void {
    this.compiledRoutes.clear();

    for (const [key, route] of this.routes) {
      const compiled = this.compileRoute(route);
      this.compiledRoutes.set(key, compiled);
    }
  }

  private compileRoute(definition: RouteDefinition): CompiledRoute {
    const paramNames: string[] = [];
    let pattern = definition.path;

    // Replace parameter patterns (:param) with regex groups
    pattern = pattern.replace(/:([^/]+)/g, (match, paramName) => {
      paramNames.push(paramName);
      return '([^/]+)';
    });

    // Replace wildcard patterns (*) with regex groups
    pattern = pattern.replace(/\*/g, '(.*)');

    // Escape special regex characters
    pattern = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

    // Create regex with anchors
    const regex = new RegExp(`^${pattern}$`);

    return {
      pattern: regex,
      paramNames,
      definition,
    };
  }

  private isExpressStyleHandler(handler: Handler): boolean {
    // Check if handler expects 3 parameters (req, res, next)
    return handler.length === 3;
  }

  private async executeExpressHandler(
    handler: Handler,
    req: NextRushRequest,
    res: NextRushResponse,
    next: () => Promise<void>
  ): Promise<void> {
    const expressHandler = handler as (
      req: NextRushRequest,
      res: NextRushResponse,
      next: () => void
    ) => void | Promise<void>;

    let nextCalled = false;
    const nextWrapper = () => {
      nextCalled = true;
      next().catch((error) => {
        this.getContext().logger.error('Next middleware error:', error);
      });
    };

    const result = expressHandler(req, res, nextWrapper);

    if (result instanceof Promise) {
      await result;
    }

    // If next wasn't called and response isn't sent, assume handler is complete
    if (!nextCalled && !res.headersSent) {
      // Handler completed without calling next
    }
  }

  private async executeContextHandler(
    handler: Handler,
    req: NextRushRequest,
    res: NextRushResponse,
    next: () => Promise<void>
  ): Promise<void> {
    const contextHandler = handler as unknown as (
      context: any,
      next: () => void
    ) => void | Promise<void>;

    const context = {
      request: req,
      response: res,
      params: (req as any).params || {},
      query: (req as any).query || {},
      body: (req as any).body,
      headers: req.headers,
      cookies: (req as any).cookies || {},
      session: (req as any).session,
      user: (req as any).user,
    };

    let nextCalled = false;
    const nextWrapper = () => {
      nextCalled = true;
      next().catch((error) => {
        this.getContext().logger.error('Next middleware error:', error);
      });
    };

    const result = contextHandler(context, nextWrapper);

    if (result instanceof Promise) {
      await result;
    }

    if (!nextCalled && !res.headersSent) {
      // Handler completed without calling next
    }
  }
}
