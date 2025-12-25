/**
 * @nextrush/controllers - Controllers Plugin
 *
 * NextRush plugin for automatic controller discovery and route registration.
 * Scans directories for @Controller decorated classes and auto-wires them.
 */

import type { Application } from '@nextrush/core';
import { container as globalContainer, type ContainerInterface } from '@nextrush/di';
import type { Router } from '@nextrush/router';
import type { Plugin } from '@nextrush/types';
import 'reflect-metadata';
import {
  discoverControllers,
  getControllersFromResults,
  getErrorsFromResults,
} from './discovery.js';
import { RouteRegistrationError } from './errors.js';
import { ControllerRegistry } from './registry.js';
import type {
  ControllersPluginOptions,
  ControllersPluginState,
  RegisteredController,
  ResolvedOptions,
} from './types.js';

const DEFAULT_INCLUDE = ['**/*.ts', '**/*.js'];
const DEFAULT_EXCLUDE = [
  '**/*.test.ts',
  '**/*.spec.ts',
  '**/*.test.js',
  '**/*.spec.js',
  '**/node_modules/**',
  '**/dist/**',
  '**/__tests__/**',
];

/**
 * Controllers plugin for NextRush
 *
 * Supports two modes:
 * 1. **Auto-discovery (recommended)**: Scans directories for @Controller classes
 * 2. **Manual**: Explicitly provide controller classes
 *
 * @example Auto-discovery (recommended)
 * ```typescript
 * import { createApp } from '@nextrush/core';
 * import { createRouter } from '@nextrush/router';
 * import { controllersPlugin } from '@nextrush/controllers';
 *
 * const app = createApp();
 * const router = createRouter();
 *
 * // Auto-discover all controllers in ./src
 * app.plugin(controllersPlugin({
 *   router,
 *   root: './src',
 *   prefix: '/api/v1',
 *   debug: true,
 * }));
 *
 * app.use(router.routes());
 * ```
 *
 * @example Manual registration (for testing or explicit control)
 * ```typescript
 * app.plugin(controllersPlugin({
 *   router,
 *   controllers: [UserController, PostController],
 * }));
 * ```
 */
export class ControllersPlugin implements Plugin {
  readonly name = 'controllers';

  private readonly options: ResolvedOptions;
  private readonly router: Router;
  private registry: ControllerRegistry | null = null;
  private _initialized = false;

  constructor(options: ControllersPluginOptions & { router: Router }) {
    this.router = options.router;
    this.options = this.resolveOptions(options);
  }

  /**
   * Install the plugin on the application
   */
  async install(_app: Application): Promise<void> {
    this.registry = new ControllerRegistry(
      this.options.container,
      this.options.prefix,
      this.options.middleware,
      this.options.debug
    );

    let controllers: Function[] = [];

    // Auto-discovery mode
    if (this.options.root) {
      if (this.options.debug) {
        console.log(`[Controllers] Starting auto-discovery in: ${this.options.root}`);
      }

      const results = await discoverControllers({
        root: this.options.root,
        include: this.options.include,
        exclude: this.options.exclude,
        debug: this.options.debug,
      });

      controllers = getControllersFromResults(results);
      const errors = getErrorsFromResults(results);

      // Handle discovery errors
      if (errors.length > 0) {
        for (const error of errors) {
          if (this.options.strict) {
            throw error;
          }
          console.warn(`[Controllers] Warning: ${error.message}`);
        }
      }

      if (this.options.debug) {
        console.log(`[Controllers] Discovered ${controllers.length} controller(s)`);
      }
    }

    // Add manually provided controllers
    if (this.options.controllers.length > 0) {
      controllers = [...controllers, ...this.options.controllers];
    }

    if (controllers.length === 0) {
      console.warn('[Controllers] No controllers found. Check your root path or patterns.');
      this._initialized = true;
      return;
    }

    // Register all controllers
    const registered = this.registry.registerAll(controllers);
    this.registerRoutes(registered);

    this._initialized = true;

    if (this.options.debug) {
      console.log(`[Controllers] Initialized with ${this.registry.routeCount} routes`);
    }
  }

  /**
   * Get plugin state
   */
  get state(): ControllersPluginState {
    return {
      controllers: this.registry?.getAll() ?? [],
      routeCount: this.registry?.routeCount ?? 0,
      initialized: this._initialized,
    };
  }

  /**
   * Get the DI container
   */
  get container(): ContainerInterface {
    return this.options.container;
  }

  /**
   * Destroy the plugin
   */
  destroy(): void {
    this.registry?.clear();
    this._initialized = false;
  }

  /**
   * Resolve options with defaults
   */
  private resolveOptions(options: ControllersPluginOptions): ResolvedOptions {
    return {
      root: options.root ?? null,
      include: options.include ?? DEFAULT_INCLUDE,
      exclude: options.exclude ?? DEFAULT_EXCLUDE,
      controllers: options.controllers ?? [],
      container: options.container ?? globalContainer,
      middleware: options.middleware ?? [],
      debug: options.debug ?? false,
      prefix: options.prefix ?? '',
      strict: options.strict ?? false,
    };
  }

  /**
   * Register routes on the router
   */
  private registerRoutes(registered: RegisteredController[]): void {
    for (const controller of registered) {
      for (const route of controller.routes) {
        try {
          const method = route.method.toLowerCase() as keyof Router;

          if (typeof this.router[method] === 'function') {
            if (route.middleware.length > 0) {
              (this.router[method] as Function)(
                route.path,
                ...route.middleware,
                route.handler
              );
            } else {
              (this.router[method] as Function)(route.path, route.handler);
            }
          }
        } catch (error) {
          throw new RouteRegistrationError(
            controller.target.name,
            route.method,
            route.path,
            error instanceof Error ? error.message : String(error),
            error instanceof Error ? error : undefined
          );
        }
      }
    }
  }
}

/**
 * Create a controllers plugin with auto-discovery
 *
 * @param options - Plugin options
 * @returns Controllers plugin instance
 *
 * @example Auto-discovery (recommended for production)
 * ```typescript
 * app.plugin(controllersPlugin({
 *   router,
 *   root: './src',           // Scan this directory
 *   prefix: '/api/v1',       // Add prefix to all routes
 *   debug: true,             // Log discovered controllers
 * }));
 * ```
 *
 * @example With custom patterns
 * ```typescript
 * app.plugin(controllersPlugin({
 *   router,
 *   root: './src',
 *   include: ['controllers/**\/*.ts', 'modules/**\/*.controller.ts'],
 *   exclude: ['**\/*.test.ts'],
 * }));
 * ```
 *
 * @example Manual registration (for testing)
 * ```typescript
 * app.plugin(controllersPlugin({
 *   router,
 *   controllers: [UserController, PostController],
 * }));
 * ```
 */
export function controllersPlugin(
  options: ControllersPluginOptions & { router: Router }
): ControllersPlugin {
  return new ControllersPlugin(options);
}

/**
 * Helper to register a single controller on a router
 *
 * @param router - Router instance
 * @param controller - Controller class
 * @param container - Optional DI container
 *
 * @example
 * ```typescript
 * registerController(router, UserController);
 * ```
 */
export function registerController(
  router: Router,
  controller: Function,
  container?: ContainerInterface
): void {
  const registry = new ControllerRegistry(container ?? globalContainer, '', [], false);

  const registered = registry.register(controller);

  for (const route of registered.routes) {
    const method = route.method.toLowerCase() as keyof Router;

    if (typeof router[method] === 'function') {
      if (route.middleware.length > 0) {
        (router[method] as Function)(route.path, ...route.middleware, route.handler);
      } else {
        (router[method] as Function)(route.path, route.handler);
      }
    }
  }
}
