/**
 * 🛣️ Router Plugin - NextRush Framework
 *
 * Unified plugin architecture following copilot instructions.
 * Provides all HTTP methods (GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS, ALL).
 */

import { Application } from '../../core/app/application';
import { ExpressHandler, ExpressMiddleware } from '../../types/express';
import {
  HttpMethod,
  MiddlewareHandler,
  Path,
  RequestContext,
  RouteHandler,
} from '../../types/routing';
import { BasePlugin, PluginRegistry } from '../core/base-plugin';

/**
 * Route definition for the router
 */
interface RouteDefinition {
  method: HttpMethod;
  path: Path;
  handler: RouteHandler | ExpressHandler;
  middleware: (MiddlewareHandler | ExpressMiddleware)[];
}

/**
 * Router Plugin - Handles all HTTP routing functionality
 */
export class RouterPlugin extends BasePlugin {
  name = 'Router';

  private routes: RouteDefinition[] = [];

  constructor(registry: PluginRegistry) {
    super(registry);
  }

  /**
   * Install router capabilities into the application
   */
  install(app: Application): void {
    // Router capabilities are already built into Application class
    // This plugin now just provides additional utilities and events
    console.log(
      '🛣️  Router plugin installed - using Application built-in routing'
    );

    this.emit('router:installed');
  }

  /**
   * Start the router plugin
   */
  start(): void {
    console.log('🛣️  Router plugin started - Application routing ready');
    this.emit('router:started');
  }

  /**
   * Stop the router plugin
   */
  stop(): void {
    this.emit('router:stopped');
  }

  /**
   * Install all HTTP methods on the application
   */
  private installHttpMethods(app: Application): void {
    const methods: HttpMethod[] = [
      'GET',
      'POST',
      'PUT',
      'DELETE',
      'PATCH',
      'HEAD',
      'OPTIONS',
    ];

    methods.forEach((method) => {
      (app as any)[method.toLowerCase()] = (
        path: Path,
        ...args: (
          | RouteHandler
          | ExpressHandler
          | MiddlewareHandler
          | ExpressMiddleware
        )[]
      ) => {
        this.registerRoute(method, path, args);
        return app;
      };
    });

    // Special handling for ALL method
    (app as any).all = (
      path: Path,
      ...args: (
        | RouteHandler
        | ExpressHandler
        | MiddlewareHandler
        | ExpressMiddleware
      )[]
    ) => {
      this.registerRoute('ALL', path, args);
      return app;
    };
  }

  /**
   * Install middleware capability
   */
  private installMiddleware(app: Application): void {
    (app as any).use = (
      pathOrHandler: Path | MiddlewareHandler | ExpressMiddleware,
      handler?: MiddlewareHandler | ExpressMiddleware
    ) => {
      if (
        typeof pathOrHandler === 'string' ||
        pathOrHandler instanceof RegExp
      ) {
        // Path-specific middleware
        this.registerMiddleware(pathOrHandler, handler!);
      } else {
        // Global middleware - treat function as middleware
        this.registerMiddleware(
          '*',
          pathOrHandler as MiddlewareHandler | ExpressMiddleware
        );
      }
      return app;
    };
  }

  /**
   * Install route creation methods
   */
  private installRouteCreation(app: Application): void {
    (app as any).createRoute = (definition: {
      method: HttpMethod;
      path: Path;
      handler: RouteHandler | ExpressHandler;
      middleware?: (MiddlewareHandler | ExpressMiddleware)[];
      name?: string;
      description?: string;
    }) => {
      return {
        ...definition,
        id: this.generateRouteId(
          definition.method,
          definition.path,
          definition.name
        ),
      };
    };

    (app as any).addCreatedRoute = (route: any) => {
      this.registerRoute(route.method, route.path, [
        ...(route.middleware || []),
        route.handler,
      ]);
      return app;
    };

    (app as any).route = (definition: any) => {
      (app as any).addCreatedRoute((app as any).createRoute(definition));
      return app;
    };
  }

  /**
   * Register a route with the router
   */
  private registerRoute(
    method: HttpMethod,
    path: Path,
    args: (
      | RouteHandler
      | ExpressHandler
      | MiddlewareHandler
      | ExpressMiddleware
    )[]
  ): void {
    const handler = args[args.length - 1] as RouteHandler | ExpressHandler;
    const middleware = args.slice(0, -1) as (
      | MiddlewareHandler
      | ExpressMiddleware
    )[];

    const route: RouteDefinition = {
      method,
      path,
      handler: this.convertHandler(handler),
      middleware: middleware.map((m) => this.convertMiddleware(m)),
    };

    this.routes.push(route);
    this.emit('router:routeRegistered', method, path);
  }

  /**
   * Register middleware
   */
  private registerMiddleware(
    path: string | Path,
    handler: MiddlewareHandler | ExpressMiddleware
  ): void {
    const pathString = typeof path === 'string' ? path : path.toString();

    const route: RouteDefinition = {
      method: 'ALL',
      path: pathString,
      handler: this.convertMiddlewareToHandler(handler),
      middleware: [],
    };

    this.routes.unshift(route); // Middleware should be checked first
    this.emit('router:middlewareRegistered', pathString);
  }

  /**
   * Convert Express-style handler to context-style handler
   */
  private convertHandler(handler: RouteHandler | ExpressHandler): RouteHandler {
    // Check if it's already a context-style handler (takes 1 parameter)
    if (handler.length === 1) {
      return handler as RouteHandler;
    }

    // Convert Express-style to context-style (takes 3 parameters)
    return (context: RequestContext) => {
      return new Promise<void>((resolve, reject) => {
        try {
          const expressHandler = handler as ExpressHandler;
          // Type assertion to work around type mismatch - Express handlers don't return promises
          (expressHandler as any)(
            context.request as any,
            context.response as any
          );
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    };
  }

  /**
   * Convert Express-style middleware to context-style middleware
   */
  private convertMiddleware(
    middleware: MiddlewareHandler | ExpressMiddleware
  ): MiddlewareHandler {
    // Check if it's already a context-style middleware (takes 2 parameters)
    if (middleware.length === 2) {
      return middleware as MiddlewareHandler;
    }

    // Convert Express-style to context-style (takes 3 parameters)
    return (context: RequestContext, next: () => Promise<void>) => {
      return new Promise<void>((resolve, reject) => {
        try {
          const expressMiddleware = middleware as ExpressMiddleware;
          const nextFn = () => {
            next().then(resolve).catch(reject);
          };
          // Type assertion to work around type mismatch
          expressMiddleware(
            context.request as any,
            context.response as any,
            nextFn
          );
        } catch (error) {
          reject(error);
        }
      });
    };
  }

  /**
   * Convert middleware to handler for middleware registration
   */
  private convertMiddlewareToHandler(
    middleware: MiddlewareHandler | ExpressMiddleware
  ): RouteHandler {
    return (context: RequestContext) => {
      return new Promise<void>((resolve, reject) => {
        try {
          if (middleware.length === 2) {
            // Context-style middleware
            const contextMiddleware = middleware as MiddlewareHandler;
            contextMiddleware(context, async () => resolve());
          } else {
            // Express-style middleware (takes 3 parameters)
            const expressMiddleware = middleware as ExpressMiddleware;
            const next = () => resolve();
            // Type assertion to work around type mismatch
            expressMiddleware(
              context.request as any,
              context.response as any,
              next
            );
          }
        } catch (error) {
          reject(error);
        }
      });
    };
  }

  /**
   * Generate unique route ID
   */
  private generateRouteId(
    method: HttpMethod,
    path: Path,
    name?: string
  ): string {
    const timestamp = Date.now().toString(36);
    const pathKey =
      typeof path === 'string' ? path.replace(/[^a-zA-Z0-9]/g, '_') : 'regex';
    return name || `${method}_${pathKey}_${timestamp}`;
  }

  /**
   * Get all registered routes (for debugging)
   */
  public getRoutes(): RouteDefinition[] {
    return [...this.routes];
  }

  /**
   * Clear all routes (for testing)
   */
  public clearRoutes(): void {
    this.routes = [];
    this.emit('router:routesCleared');
  }
}
