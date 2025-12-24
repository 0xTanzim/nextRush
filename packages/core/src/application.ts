/**
 * @nextrush/core - Application Class
 *
 * The Application class is the main entry point for NextRush.
 * It manages middleware registration and plugin installation.
 *
 * @packageDocumentation
 */

import type { Context, Middleware, Plugin } from '@nextrush/types';
import { compose } from './middleware';

/**
 * Application options
 */
export interface ApplicationOptions {
  /**
   * Whether to run in production mode
   * @default process.env.NODE_ENV === 'production'
   */
  env?: 'development' | 'production' | 'test';

  /**
   * Whether to use proxy headers (X-Forwarded-For, etc.)
   * @default false
   */
  proxy?: boolean;
}

/**
 * Listener callback type
 */
export type ListenCallback = () => void;

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
   * Application options
   */
  readonly options: ApplicationOptions;

  /**
   * Whether the app is running
   */
  private _isRunning = false;

  constructor(options: ApplicationOptions = {}) {
    this.options = {
      env: options.env ?? (process.env['NODE_ENV'] as ApplicationOptions['env']) ?? 'development',
      proxy: options.proxy ?? false,
    };
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
    for (const mw of middleware) {
      if (typeof mw !== 'function') {
        throw new TypeError('Middleware must be a function');
      }
      this.middlewareStack.push(mw);
    }
    return this;
  }

  // ===========================================================================
  // Plugin System
  // ===========================================================================

  /**
   * Install a plugin
   *
   * @param plugin - Plugin to install
   * @returns this for chaining
   *
   * @example
   * ```typescript
   * app.plugin(new LoggerPlugin({ level: 'info' }));
   * ```
   */
  plugin(plugin: Plugin): this {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" is already installed`);
    }

    // Install the plugin
    const result = plugin.install(this);

    // Handle async installation
    if (result instanceof Promise) {
      // For async plugins, we need to handle this differently
      // In v3, we might want to make app.start() async
      throw new Error('Async plugin installation is not yet supported. Use synchronous install().');
    }

    this.plugins.set(plugin.name, plugin);
    return this;
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
   * @returns Request handler function
   */
  callback(): (ctx: Context) => Promise<void> {
    const fn = compose(this.middlewareStack);

    return async (ctx: Context): Promise<void> => {
      try {
        await fn(ctx);
      } catch (error) {
        // Default error handling
        // Plugins/middleware can add more sophisticated error handling
        this.handleError(error, ctx);
      }
    };
  }

  /**
   * Default error handler
   */
  private handleError(error: unknown, ctx: Context): void {
    // Log in development
    if (!this.isProduction) {
      console.error('Request error:', error);
    }

    // Set error response
    if (error instanceof Error && 'status' in error) {
      ctx.status = (error as Error & { status: number }).status;
    } else {
      ctx.status = 500;
    }

    // Only expose error message in development
    const message =
      error instanceof Error && !this.isProduction ? error.message : 'Internal Server Error';

    ctx.json({ error: message });
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Mark app as running
   * Called by adapters when server starts
   */
  start(): void {
    this._isRunning = true;
  }

  /**
   * Graceful shutdown
   * Destroys all plugins that have a destroy method
   */
  async close(): Promise<void> {
    this._isRunning = false;

    // Destroy plugins in reverse order
    const pluginArray = Array.from(this.plugins.values()).reverse();

    for (const plugin of pluginArray) {
      if (plugin.destroy) {
        await plugin.destroy();
      }
    }

    this.plugins.clear();
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
