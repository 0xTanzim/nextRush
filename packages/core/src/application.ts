/**
 * @nextrush/core - Application Class
 *
 * The Application class is the main entry point for NextRush.
 * It manages middleware registration and plugin installation.
 *
 * @packageDocumentation
 */

import type { Context, Middleware, Plugin, PluginWithHooks } from '@nextrush/types';
import { compose } from './middleware';

/** @internal Symbol keys for route() state — avoids polluting user's ctx.state namespace */
const ORIGINAL_PATH = Symbol.for('nextrush.originalPath');
const ROUTE_PREFIX = Symbol.for('nextrush.routePrefix');

/**
 * Error handler function type
 */
export type ErrorHandler = (error: Error, ctx: Context) => void | Promise<void>;

/**
 * Logger interface for pluggable logging
 */
export interface Logger {
  error(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  info(...args: unknown[]): void;
  debug(...args: unknown[]): void;
}

/** No-op logger — default when no logger is configured */
const NOOP_LOGGER: Logger = {
  error() {},
  warn() {},
  info() {},
  debug() {},
};

/**
 * Application options
 */
export interface ApplicationOptions {
  /**
   * Environment mode
   * @default 'development'
   */
  env?: 'development' | 'production' | 'test';

  /**
   * Whether to use proxy headers (X-Forwarded-For, etc.)
   * @default false
   */
  proxy?: boolean;

  /**
   * Custom logger. Defaults to no-op (silent).
   *
   * @remarks
   * Pass `console` for quick development logging:
   * ```ts
   * const app = createApp({ logger: console });
   * ```
   *
   * For production, provide a structured logger (e.g. pino, winston)
   * that implements the {@link Logger} interface.
   *
   * Adapters and internal hooks use `app.logger` — configuring it here
   * ensures consistent logging across the framework.
   */
  logger?: Logger;
}

/**
 * Listener callback type
 */
export type ListenCallback = () => void;

/**
 * Routable interface - any object with routes() method
 * This allows mounting Router instances without circular dependency
 */
export interface Routable {
  routes(): Middleware;
}

/**
 * The Application class
 *
 * @example
 * ```typescript
 * const app = createApp();
 *
 * app.use(async (ctx) => {
 *   ctx.json({ message: 'Hello World' });
 * });
 *
 * // Mount with an adapter
 * listen(app, { port: 3000 });
 * ```
 */
export class Application {
  /**
   * Middleware stack
   */
  private readonly middlewareStack: Middleware[] = [];

  /**
   * Installed plugins
   */
  private readonly plugins: Map<string, Plugin> = new Map();

  /**
   * Custom error handler
   */
  private _errorHandler: ErrorHandler | null = null;

  /**
   * Pluggable logger
   */
  readonly logger: Logger;

  /**
   * Application options
   */
  readonly options: ApplicationOptions;

  /**
   * Whether the app is running
   */
  private _isRunning = false;

  constructor(options: ApplicationOptions = {}) {
    this.options = {
      env: options.env ?? 'development',
      proxy: options.proxy ?? false,
    };
    this.logger = options.logger ?? NOOP_LOGGER;
  }

  /**
   * Check if running in production
   */
  get isProduction(): boolean {
    return this.options.env === 'production';
  }

  /**
   * Check if app is running
   */
  get isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * Get middleware count
   */
  get middlewareCount(): number {
    return this.middlewareStack.length;
  }

  /**
   * Throws if the app is already running.
   * Prevents configuration mutations after start().
   */
  private assertNotRunning(method: string): void {
    if (this._isRunning) {
      throw new Error(`Cannot call ${method}() after the application has started`);
    }
  }

  // ===========================================================================
  // Middleware Registration
  // ===========================================================================

  /**
   * Register middleware function(s)
   *
   * @param middleware - Middleware function or array of middleware
   * @returns this for chaining
   *
   * @example
   * ```typescript
   * // Single middleware
   * app.use(async (ctx) => {
   *   console.log(ctx.method, ctx.path);
   *   await ctx.next();
   * });
   *
   * // Multiple middleware
   * app.use(cors(), helmet(), json());
   * ```
   */
  use(...middleware: Middleware[]): this {
    this.assertNotRunning('use');
    for (const mw of middleware) {
      if (typeof mw !== 'function') {
        throw new TypeError('Middleware must be a function');
      }
      this.middlewareStack.push(mw);
    }
    return this;
  }

  // ===========================================================================
  // Router Mounting (Hono-style)
  // ===========================================================================

  /**
   * Mount a router at a path prefix
   *
   * This is the Hono-style API for mounting routers directly on the app.
   * The router's routes will only match requests that start with the given prefix.
   *
   * @param path - Path prefix for the router (e.g., '/api/users')
   * @param router - Router instance to mount
   * @returns this for chaining
   *
   * @example
   * ```typescript
   * // Create modular routers
   * const users = createRouter();
   * users.get('/', listUsers);
   * users.get('/:id', getUser);
   * users.post('/', createUser);
   *
   * const posts = createRouter();
   * posts.get('/', listPosts);
   * posts.get('/:id', getPost);
   *
   * // Mount directly on app - clean like Hono!
   * const app = createApp();
   * app.route('/api/users', users);
   * app.route('/api/posts', posts);
   *
   * listen(app, 3000);
   * ```
   */
  route(path: string, router: Routable): this {
    this.assertNotRunning('route');
    // Root mount optimization: skip all prefix processing
    if (path === '/' || path === '') {
      this.middlewareStack.push(router.routes());
      return this;
    }

    const routerMiddleware = router.routes();
    // Normalize prefix: ensure leading '/', strip trailing '/'
    let normalizedPrefix = path.endsWith('/') ? path.slice(0, -1) : path;
    if (normalizedPrefix && !normalizedPrefix.startsWith('/')) {
      normalizedPrefix = '/' + normalizedPrefix;
    }
    const prefixLen = normalizedPrefix.length;

    // NOTE (DX-3): We cast `ctx` to `{ path: string }` inside this middleware
    // to temporarily strip the `readonly` modifier on `path`. This is intentional:
    // route mounting must adjust ctx.path for the sub-router and restore it
    // afterwards. The Context interface keeps `path` readonly to prevent
    // accidental mutation by user code, but internal mounting is the exception.
    const mountedMiddleware: Middleware = async (ctx, next) => {
      const currentPath = ctx.path;

      // Fast prefix check
      if (!currentPath.startsWith(normalizedPrefix)) {
        return next ? next() : undefined;
      }

      // Check prefix boundary (avoid /api/usersxxx matching /api/users)
      const charAfterPrefix = currentPath.charCodeAt(prefixLen);
      if (charAfterPrefix && charAfterPrefix !== 47) {
        // 47 = '/'
        return next ? next() : undefined;
      }

      // Direct path manipulation (no Proxy - fast!)
      const adjustedPath = currentPath.slice(prefixLen) || '/';
      (ctx as { path: string }).path = adjustedPath;

      // Store original for recovery (Symbol keys avoid ctx.state pollution)
      (ctx.state as Record<symbol, unknown>)[ORIGINAL_PATH] = currentPath;
      (ctx.state as Record<symbol, unknown>)[ROUTE_PREFIX] = normalizedPrefix;

      try {
        await routerMiddleware(ctx, async () => {
          // Restore original path before calling downstream middleware
          // so downstream sees the full unmounted path
          (ctx as { path: string }).path = currentPath;
          if (next) await next();
          // Re-apply stripped path for router's return path
          (ctx as { path: string }).path = adjustedPath;
        });
      } finally {
        // Restore original path and clean up Symbol state
        (ctx as { path: string }).path = currentPath;
        (ctx.state as Record<symbol, unknown>)[ORIGINAL_PATH] = undefined;
        (ctx.state as Record<symbol, unknown>)[ROUTE_PREFIX] = undefined;
      }
    };

    this.middlewareStack.push(mountedMiddleware);
    return this;
  }

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  /**
   * Set the application error handler.
   *
   * Replaces any previously set handler. Only one error handler is active
   * at a time. For additive error handling, compose logic within a single
   * handler or use the `errorHandler()` middleware from `@nextrush/errors`.
   *
   * @param handler - Error handler function
   * @returns this for chaining
   *
   * @example
   * ```typescript
   * app.setErrorHandler((error, ctx) => {
   *   console.error('Request failed:', error);
   *
   *   if (error instanceof ValidationError) {
   *     ctx.status = 400;
   *     ctx.json({ error: error.message, details: error.details });
   *     return;
   *   }
   *
   *   ctx.status = 500;
   *   ctx.json({ error: 'Internal Server Error' });
   * });
   * ```
   */
  setErrorHandler(handler: ErrorHandler): this {
    this._errorHandler = handler;
    return this;
  }

  /**
   * Set custom error handler.
   *
   * @param handler - Error handler function
   * @returns this for chaining
   *
   * @deprecated Use `setErrorHandler()` instead — `onError()` implies
   * event subscription (additive), but this is a setter (replaces).
   */
  onError(handler: ErrorHandler): this {
    return this.setErrorHandler(handler);
  }

  // ===========================================================================
  // Plugin System
  // ===========================================================================

  /**
   * Install a plugin.
   *
   * Handles both sync and async `install()` methods automatically.
   * Returns `this` for sync plugins and `Promise<this>` for async ones.
   *
   * @param plugin - Plugin to install
   * @returns this (sync) or Promise<this> (async)
   *
   * @example
   * ```typescript
   * // Sync plugin
   * app.plugin(loggerPlugin({ level: 'info' }));
   *
   * // Async plugin — just await it
   * await app.plugin(databasePlugin({ uri: '...' }));
   * ```
   */
  plugin(plugin: Plugin): this | Promise<this> {
    this.assertNotRunning('plugin');
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" is already installed`);
    }

    const result = plugin.install(this);

    // If install() returned a thenable, handle it asynchronously
    if (result != null && typeof (result as { then?: unknown }).then === 'function') {
      return (result as Promise<void>).then(() => {
        this.plugins.set(plugin.name, plugin);
        return this;
      });
    }

    this.plugins.set(plugin.name, plugin);
    return this;
  }

  /**
   * Install a plugin asynchronously.
   *
   * @param plugin - Plugin to install
   * @returns Promise that resolves when plugin is installed
   *
   * @deprecated Use `plugin()` instead — it handles both sync and async
   * plugins automatically.
   *
   * @example
   * ```typescript
   * await app.plugin(new DatabasePlugin({ connectionString: '...' }));
   * ```
   */
  async pluginAsync(plugin: Plugin): Promise<this> {
    const result = this.plugin(plugin);
    return result instanceof Promise ? result : Promise.resolve(result);
  }

  /**
   * Get an installed plugin by name
   *
   * @param name - Plugin name
   * @returns Plugin instance or undefined
   */
  getPlugin<T extends Plugin>(name: string): T | undefined {
    return this.plugins.get(name) as T | undefined;
  }

  /**
   * Check if a plugin is installed
   */
  hasPlugin(name: string): boolean {
    return this.plugins.has(name);
  }

  // ===========================================================================
  // Request Handler
  // ===========================================================================

  /**
   * Create the request handler callback
   *
   * This is the function that adapters call to handle each request.
   * It composes all middleware and returns a function that processes context.
   *
   * **Important:** The middleware stack is snapshot at call time.
   * Middleware or plugins added after `callback()` will NOT take effect
   * on the returned handler. Call `callback()` again to get a
   * handler that includes subsequent registrations.
   *
   * @returns Request handler function
   */
  callback(): (ctx: Context) => Promise<void> {
    const fn = compose(this.middlewareStack);

    // Collect plugins that implement lifecycle hooks (once at build time)
    // Validate that hook properties are actually callable functions
    const hookPlugins = Array.from(this.plugins.values()).filter((p): p is PluginWithHooks => {
      const hasHook =
        'onRequest' in p || 'onResponse' in p || 'onError' in p || 'extendContext' in p;
      if (!hasHook) return false;

      // Runtime validation: ensure hook properties are functions
      if ('onRequest' in p && typeof p.onRequest !== 'function') {
        throw new TypeError(
          `Plugin "${p.name}": onRequest must be a function, got ${typeof p.onRequest}`
        );
      }
      if ('onResponse' in p && typeof p.onResponse !== 'function') {
        throw new TypeError(
          `Plugin "${p.name}": onResponse must be a function, got ${typeof p.onResponse}`
        );
      }
      if ('onError' in p && typeof p.onError !== 'function') {
        throw new TypeError(
          `Plugin "${p.name}": onError must be a function, got ${typeof p.onError}`
        );
      }
      if ('extendContext' in p && typeof p.extendContext !== 'function') {
        throw new TypeError(
          `Plugin "${p.name}": extendContext must be a function, got ${typeof p.extendContext}`
        );
      }
      return true;
    });

    return async (ctx: Context): Promise<void> => {
      try {
        // Extend context and run onRequest hooks
        for (const p of hookPlugins) {
          if (p.extendContext) p.extendContext(ctx);
          if (p.onRequest) await p.onRequest(ctx);
        }

        await fn(ctx);

        // Run onResponse hooks — isolate errors so all hooks run
        for (const p of hookPlugins) {
          if (p.onResponse) {
            try {
              await p.onResponse(ctx);
            } catch (hookError) {
              this.logger.warn('Plugin onResponse hook threw:', {
                plugin: p.name,
                error: hookError,
              });
            }
          }
        }
      } catch (error) {
        // Run onError hooks
        const err = error instanceof Error ? error : new Error(String(error));
        for (const p of hookPlugins) {
          if (p.onError) {
            try {
              await p.onError(err, ctx);
            } catch (hookError) {
              this.logger.warn('Plugin onError hook threw:', {
                plugin: p.name,
                error: hookError,
              });
            }
          }
        }
        await this.handleError(error, ctx);
      }
    };
  }

  /**
   * Handle errors - uses custom handler if set, otherwise default
   */
  private async handleError(error: unknown, ctx: Context): Promise<void> {
    const err = error instanceof Error ? error : new Error(String(error));

    // Use custom error handler if set
    if (this._errorHandler) {
      try {
        await this._errorHandler(err, ctx);
        return;
      } catch (handlerError) {
        // If custom handler throws, fall through to default handling
        this.logger.error('Error handler threw:', handlerError);
      }
    }

    // Default error handling
    this.defaultErrorHandler(err, ctx);
  }

  /**
   * Default error handler
   *
   * Uses the `expose` flag on errors (set by HttpError/NextRushError)
   * to decide whether to include the error message in the response.
   * 4xx errors expose messages by default; 5xx errors never do.
   * This prevents leaking internal details (paths, SQL, stack info)
   * regardless of environment.
   */
  private defaultErrorHandler(error: Error, ctx: Context): void {
    // Always log non-production errors for DX
    if (!this.isProduction) {
      this.logger.error('Request error:', error);
    }

    // Determine status — clamp to valid error range (400-599)
    let status = 500;
    if ('status' in error && typeof error.status === 'number') {
      const raw = error.status as number;
      status = raw >= 400 && raw < 600 ? raw : 500;
    }
    ctx.status = status;

    // Use the `expose` flag to decide what message the client sees.
    // HttpError/NextRushError set expose=true for 4xx, false for 5xx.
    // Plain Error never exposes — prevents leaking internal details.
    const expose = 'expose' in error && typeof error.expose === 'boolean' && error.expose;
    const message = expose ? error.message : 'Internal Server Error';

    ctx.json({ error: message });
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Mark app as running and freeze configuration.
   *
   * Called by adapters when the server starts listening. After this call,
   * `use()`, `route()`, `plugin()`, and `pluginAsync()` will throw.
   * This prevents unsafe middleware mutations while requests are in flight.
   *
   * To re-enable registration (e.g. for testing), call `close()` first.
   */
  start(): void {
    this._isRunning = true;
  }

  /**
   * Graceful shutdown
   * Destroys all plugins that have a destroy method.
   * Uses Promise.allSettled to ensure all plugins are destroyed
   * even if some throw errors.
   *
   * @returns Array of errors from plugins that failed to destroy (empty on success)
   */
  async close(): Promise<Error[]> {
    this._isRunning = false;

    // Destroy plugins in reverse order using allSettled for resilience
    const pluginArray = Array.from(this.plugins.values()).reverse();
    const destroyPromises = pluginArray
      .filter((p) => typeof p.destroy === 'function')
      .map((p) =>
        Promise.resolve()
          .then(() => p.destroy!())
          .catch((err: unknown) => {
            throw err instanceof Error ? err : new Error(String(err));
          })
      );

    const results = await Promise.allSettled(destroyPromises);
    this.plugins.clear();

    return results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => r.reason as Error);
  }
}

/**
 * Create a new Application instance
 *
 * @param options - Application options
 * @returns New Application instance
 *
 * @example
 * ```typescript
 * const app = createApp();
 * const app = createApp({ env: 'production' });
 * ```
 */
export function createApp(options?: ApplicationOptions): Application {
  return new Application(options);
}
