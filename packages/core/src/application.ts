/**
 * @nextrush/core - Application Class
 *
 * The Application class is the main entry point for NextRush.
 * It manages middleware registration and the extension lifecycle.
 *
 * See docs/RFC/RFC-NEXTRUSH-PLUGIN-SYSTEM.md for the extension model.
 *
 * @packageDocumentation
 */

import type {
  Container,
  Context,
  Extension,
  ExtensionContext,
  Logger,
  Middleware,
  RouteEntry,
  Router,
} from '@nextrush/types';
import { getErrorStatus, getHttpStatusMessage, NextRushError } from '@nextrush/errors';
import { compose } from './middleware';

/** @internal Symbol keys for route() state — avoids polluting user's ctx.state namespace */
const ORIGINAL_PATH = Symbol.for('nextrush.originalPath');
const ROUTE_PREFIX = Symbol.for('nextrush.routePrefix');

/**
 * Error handler function type
 */
export type ErrorHandler = (error: Error, ctx: Context) => void | Promise<void>;

/** No-op logger — default when no logger is configured */
const NOOP_LOGGER: Logger = {
  error(..._args) {
    void _args;
  },
  warn(..._args) {
    void _args;
  },
  info(..._args) {
    void _args;
  },
  debug(..._args) {
    void _args;
  },
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
   * Pass `console` for quick development logging. For production, provide a
   * structured logger (pino, winston, `@nextrush/logger`) implementing {@link Logger}.
   */
  logger?: Logger;

  /**
   * A router the app owns. Route methods (`app.get`, `app.post`, …) delegate to
   * it, and it is mounted last at `ready()`. The `nextrush` meta-package's
   * `createApp` injects one automatically; pass it explicitly when using
   * `@nextrush/core` directly.
   */
  router?: Router;

  /**
   * A per-app DI container. Exposed to extensions via `ExtensionContext.container`
   * and used by class-based registrars (e.g. `registerControllers`). Injected by
   * `nextrush/class`; omitted for functional, DI-free apps.
   */
  container?: Container;
}

/**
 * Listener callback type
 */
export type ListenCallback = () => void;

/**
 * Routable interface - any object with routes() method.
 * Allows mounting Router instances without a circular dependency.
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
 * // Extensions (rare — long-lived services) are booted at ready(), which
 * // adapters call automatically before start().
 * app.extend(events());
 *
 * listen(app, { port: 8080 });
 * ```
 */
export class Application {
  /** Middleware stack */
  private readonly middlewareStack: Middleware[] = [];

  /** Registered extensions, in registration order (setup runs at ready()) */
  private readonly extensions: Extension<unknown>[] = [];

  /** Registered extension names — enforces uniqueness */
  private readonly extensionNames = new Set<string>();

  /** Names decorated onto the app — enforces collision detection */
  private readonly decorations = new Set<string>();

  /** Custom error handler */
  private _errorHandler: ErrorHandler | null = null;

  /** Pluggable logger */
  readonly logger: Logger;

  /** Application options */
  readonly options: ApplicationOptions;

  /** Whether the app is running (server listening) */
  private _isRunning = false;

  /** Whether the app has been booted (extensions set up, config frozen) */
  private _isReady = false;

  /** Whether ready() mounted the app-owned router (so close() can undo it) */
  private _routerMounted = false;

  /** The app-owned router (optional). Route methods delegate to it. */
  readonly router?: Router;

  /** The app-owned DI container (optional). Exposed to extensions and registrars. */
  readonly container?: Container;

  constructor(options: ApplicationOptions = {}) {
    this.options = {
      env: options.env ?? 'development',
      proxy: options.proxy ?? false,
    };
    this.logger = options.logger ?? NOOP_LOGGER;
    this.router = options.router;
    this.container = options.container;
  }

  /** Check if running in production */
  get isProduction(): boolean {
    return this.options.env === 'production';
  }

  /** Check if app is running */
  get isRunning(): boolean {
    return this._isRunning;
  }

  /** Check if app has been booted via ready() */
  get isReady(): boolean {
    return this._isReady;
  }

  /** Get middleware count */
  get middlewareCount(): number {
    return this.middlewareStack.length;
  }

  /** Get registered extension count */
  get extensionCount(): number {
    return this.extensions.length;
  }

  /**
   * Throws if the app configuration is frozen (after ready() or start()).
   * Prevents unsafe mutations once the app has booted or is serving traffic.
   */
  private assertConfigurable(method: string): void {
    if (this._isReady || this._isRunning) {
      throw new Error(`Cannot call ${method}() after app.ready() — configuration is frozen`);
    }
  }

  // ===========================================================================
  // Middleware Registration
  // ===========================================================================

  /**
   * Register middleware function(s)
   *
   * @param middleware - Middleware function(s)
   * @returns this for chaining
   */
  use(...middleware: Middleware[]): this {
    this.assertConfigurable('use');
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
   * Mount a router at a path prefix.
   *
   * @param path - Path prefix (e.g. '/api/users')
   * @param router - Router instance to mount
   * @returns this for chaining
   */
  route(path: string, router: Routable): this {
    this.assertConfigurable('route');
    // Root mount optimization: skip all prefix processing
    if (path === '/' || path === '') {
      this.middlewareStack.push(router.routes());
      return this;
    }

    const routerMiddleware = router.routes();
    // Normalize prefix: ensure leading '/', strip trailing '/'
    let normalizedPrefix = path.endsWith('/') ? path.slice(0, -1) : path;
    if (!normalizedPrefix.startsWith('/')) {
      normalizedPrefix = '/' + normalizedPrefix;
    }
    const prefixLen = normalizedPrefix.length;

    const mountedMiddleware: Middleware = async (ctx, next) => {
      const currentPath = ctx.path;

      // Fast prefix check
      if (!currentPath.startsWith(normalizedPrefix)) {
        return next();
      }

      // Check prefix boundary (avoid /api/usersxxx matching /api/users)
      const hasCharAfterPrefix = prefixLen < currentPath.length;
      if (hasCharAfterPrefix && currentPath.charCodeAt(prefixLen) !== 47) {
        // 47 = '/'
        return next();
      }

      // Direct path manipulation (no Proxy - fast!)
      const adjustedPath = currentPath.slice(prefixLen) || '/';
      (ctx as { path: string }).path = adjustedPath;

      // Store original for recovery (Symbol keys avoid ctx.state pollution)
      (ctx.state as Record<symbol, unknown>)[ORIGINAL_PATH] = currentPath;
      (ctx.state as Record<symbol, unknown>)[ROUTE_PREFIX] = normalizedPrefix;

      try {
        await routerMiddleware(ctx, async () => {
          (ctx as { path: string }).path = currentPath;
          await next();
          (ctx as { path: string }).path = adjustedPath;
        });
      } finally {
        (ctx as { path: string }).path = currentPath;
        (ctx.state as Record<symbol, unknown>)[ORIGINAL_PATH] = undefined;
        (ctx.state as Record<symbol, unknown>)[ROUTE_PREFIX] = undefined;
      }
    };

    this.middlewareStack.push(mountedMiddleware);
    return this;
  }

  // ===========================================================================
  // Routing (delegates to the app-owned router)
  // ===========================================================================

  private requireRouter(): Router {
    if (!this.router) {
      throw new Error(
        'No router configured. Create your app with `createApp()` from `nextrush` ' +
          '(batteries-included), or pass one: `createApp({ router: createRouter() })`.'
      );
    }
    return this.router;
  }

  /** Register a GET route on the app-owned router. */
  get(path: string, ...entries: RouteEntry[]): this {
    this.assertConfigurable('get');
    this.requireRouter().get(path, ...entries);
    return this;
  }

  /** Register a POST route on the app-owned router. */
  post(path: string, ...entries: RouteEntry[]): this {
    this.assertConfigurable('post');
    this.requireRouter().post(path, ...entries);
    return this;
  }

  /** Register a PUT route on the app-owned router. */
  put(path: string, ...entries: RouteEntry[]): this {
    this.assertConfigurable('put');
    this.requireRouter().put(path, ...entries);
    return this;
  }

  /** Register a PATCH route on the app-owned router. */
  patch(path: string, ...entries: RouteEntry[]): this {
    this.assertConfigurable('patch');
    this.requireRouter().patch(path, ...entries);
    return this;
  }

  /** Register a DELETE route on the app-owned router. */
  delete(path: string, ...entries: RouteEntry[]): this {
    this.assertConfigurable('delete');
    this.requireRouter().delete(path, ...entries);
    return this;
  }

  /** Register a HEAD route on the app-owned router. */
  head(path: string, ...entries: RouteEntry[]): this {
    this.assertConfigurable('head');
    this.requireRouter().head(path, ...entries);
    return this;
  }

  /**
   * Register a route for all HTTP methods on the app-owned router.
   *
   * @remarks
   * There is intentionally no `app.options()` verb method — it would collide
   * with the `app.options` configuration property. Register OPTIONS routes via
   * `app.all()`, the router directly, or let CORS middleware handle preflight.
   */
  all(path: string, ...entries: RouteEntry[]): this {
    this.assertConfigurable('all');
    this.requireRouter().all(path, ...entries);
    return this;
  }

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  /**
   * Set the application error handler. Replaces any previously set handler.
   *
   * @param handler - Error handler function
   * @returns this for chaining
   */
  setErrorHandler(handler: ErrorHandler): this {
    this.assertConfigurable('setErrorHandler');
    this._errorHandler = handler;
    return this;
  }

  // ===========================================================================
  // Extension System (see RFC-NEXTRUSH-PLUGIN-SYSTEM)
  // ===========================================================================

  /**
   * Register an extension. Queues it — `setup()` runs later, at `ready()`,
   * in registration order. Synchronous and chainable.
   *
   * @param extension - Extension to register. If it declares a decorated
   * shape via `Extension<TDecorated>`, the return type carries that shape —
   * `app.extend(events<MyEvents>()).events` is statically known, no
   * `declare module` augmentation required.
   * @returns this, intersected with the extension's declared decorated shape
   *
   * @example
   * ```typescript
   * const extended = app.extend(events<MyEvents>());
   * extended.events.emit('user:created', { id: '1' }); // inferred
   * await app.ready(); // adapters call this automatically
   * ```
   */
  extend<TDecorated = Record<string, never>>(
    extension: Extension<TDecorated>
  ): this & TDecorated {
    this.assertConfigurable('extend');
    // Runtime guard for externally-supplied input: the type says non-null with a
    // required setup(), but user/plugin code can still violate that at runtime.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive validation of external input
    if (!extension || typeof extension.setup !== 'function') {
      throw new TypeError('Extension must have a setup() method');
    }
    if (this.extensionNames.has(extension.name)) {
      throw new Error(
        `Extension "${extension.name}" is already registered. Use a different extension ` +
          `name, or check for a duplicate app.extend() call.`
      );
    }
    this.extensionNames.add(extension.name);
    this.extensions.push(extension);
    return this as this & TDecorated;
  }

  /**
   * Boot the application: run every registered extension's `setup()` once, in
   * registration order, awaiting async setups. Idempotent — safe to call twice.
   * Adapters call this automatically before `start()`.
   *
   * After `ready()` resolves, the configuration is frozen (`use`/`route`/`extend`
   * throw).
   *
   * @returns this
   * @throws if an extension declares a `needs` dependency not yet registered
   */
  async ready(): Promise<this> {
    if (this._isReady) {
      return this;
    }

    // Pre-flight: every `needs` entry must name a genuinely registered
    // extension SOMEWHERE (regardless of order) — catches a typo'd or
    // never-registered dependency name with a distinct message from the
    // order-sensitive check below, before running any setup().
    const allNames = new Set(this.extensions.map((e) => e.name));
    for (const extension of this.extensions) {
      if (extension.needs) {
        for (const dep of extension.needs) {
          if (!allNames.has(dep)) {
            throw new Error(
              `Extension "${extension.name}" needs "${dep}", but no extension named ` +
                `"${dep}" was ever registered.`
            );
          }
        }
      }
    }

    const setupDone = new Set<string>();

    for (const extension of this.extensions) {
      // Declare-and-assert dependency check (no auto-sort; registration order is the order)
      if (extension.needs) {
        for (const dep of extension.needs) {
          if (!setupDone.has(dep)) {
            throw new Error(
              `Extension "${extension.name}" needs "${dep}", but "${dep}" was not ` +
                `registered before it. Register the "${dep}" extension before "${extension.name}".`
            );
          }
        }
      }

      const ctx: ExtensionContext = {
        app: this,
        logger: this.logger,
        container: this.container,
        env: this.options.env ?? 'development',
        name: extension.name,
        decorate: (name: string, value: unknown): void => {
          this.decorate(name, value);
        },
      };

      await extension.setup(ctx);
      setupDone.add(extension.name);
    }

    // Mount the app-owned router LAST, so routes run after all middleware
    // (both user- and extension-registered).
    if (this.router) {
      this.middlewareStack.push(this.router.routes());
      this._routerMounted = true;
    }

    this._isReady = true;
    return this;
  }

  /**
   * Attach a value to the app under `name`. Extension-author primitive, invoked
   * through {@link ExtensionContext.decorate} — there is intentionally no public
   * `app.decorate()` (RFC §6.1). Throws on collision.
   *
   * @internal
   */
  private decorate(name: string, value: unknown): void {
    if (this.decorations.has(name)) {
      throw new Error(
        `Decoration "${name}" already exists on the application. Choose a different ` +
          `name, or check for a duplicate ctx.decorate() call across your extensions.`
      );
    }
    if (name in this) {
      throw new Error(
        `Decoration "${name}" collides with an existing Application member — choose another name`
      );
    }
    Object.defineProperty(this, name, {
      value,
      enumerable: true,
      writable: false,
      configurable: true, // allow close() to clean up
    });
    this.decorations.add(name);
  }

  /**
   * Whether a decoration already occupies `name`.
   */
  hasDecorator(name: string): boolean {
    return this.decorations.has(name);
  }

  // ===========================================================================
  // Request Handler
  // ===========================================================================

  /**
   * Create the request handler callback.
   *
   * The middleware stack is snapshot at call time — call `ready()` before
   * `callback()` so extension-registered middleware is included. Adapters do
   * this automatically.
   *
   * @returns Request handler function
   */
  callback(): (ctx: Context) => Promise<void> {
    if (!this._isReady && this.extensions.length > 0) {
      this.logger.warn(
        `callback() was called before ready(), but ${String(this.extensions.length)} extension(s) ` +
          `were registered via extend() — their setup() will NOT run, and anything they ` +
          `would decorate (e.g. app.events) will be missing. Call \`await app.ready()\` ` +
          `before \`callback()\`. Adapters (listen/serve) do this automatically.`
      );
    }

    const fn = compose(this.middlewareStack, {
      warnDoubleResponse: !this.isProduction,
    });

    return async (ctx: Context): Promise<void> => {
      try {
        await fn(ctx);
      } catch (error) {
        await this.handleError(error, ctx);
      }
    };
  }

  /**
   * Handle errors - uses custom handler if set, otherwise default
   */
  private async handleError(error: unknown, ctx: Context): Promise<void> {
    const err = error instanceof Error ? error : new Error(String(error));

    if (this._errorHandler) {
      try {
        await this._errorHandler(err, ctx);
        return;
      } catch (handlerError) {
        this.logger.error('Error handler threw:', handlerError);
      }
    }

    this.defaultErrorHandler(err, ctx);
  }

  /**
   * Default error handler.
   *
   * Produces the same JSON shape as `@nextrush/errors`' `errorHandler()` so the
   * framework has ONE error contract (audit C-1): a `NextRushError` serializes
   * via its own `toJSON()` (carrying `code`/`status`/`details`/`issues`), and a
   * plain error becomes a safe coded 500. 5xx are always logged (C-7); 4xx only
   * outside production.
   */
  private defaultErrorHandler(error: Error, ctx: Context): void {
    const status = getErrorStatus(error);

    if (status >= 500 || !this.isProduction) {
      this.logger.error('Request error:', error);
    }

    ctx.status = status;

    if (error instanceof NextRushError) {
      ctx.json(error.toJSON());
      return;
    }

    const expose = status < 500;
    ctx.json({
      error: expose ? error.name : getHttpStatusMessage(status),
      message: expose ? error.message : 'Internal Server Error',
      code: 'INTERNAL_ERROR',
      status,
    });
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Mark app as running and freeze configuration.
   *
   * Called by adapters when the server starts listening (after `ready()`).
   */
  start(): void {
    this._isRunning = true;
  }

  /**
   * Graceful shutdown. Destroys extensions in reverse registration order using
   * `Promise.allSettled` so one failing `destroy()` never strands the others.
   *
   * @returns Array of errors from extensions that failed to destroy (empty on success)
   */
  async close(): Promise<Error[]> {
    this._isRunning = false;

    if (!this._isReady && this.extensions.length > 0) {
      this.logger.warn(
        `close() was called before ready(), but ${String(this.extensions.length)} extension(s) ` +
          `were registered via extend() — their setup() never ran, yet destroy() will still ` +
          `be called on them now. If destroy() assumes setup()-established state, this may ` +
          `throw or behave incorrectly. Call \`await app.ready()\` before \`close()\`.`
      );
    }

    const reversed = [...this.extensions].reverse();
    const destroyable = reversed.filter(
      (e): e is Extension & { destroy: () => void | Promise<void> } =>
        typeof e.destroy === 'function'
    );

    const results = await Promise.allSettled(
      destroyable.map((e) =>
        Promise.resolve()
          .then(() => e.destroy())
          .catch((err: unknown) => {
            throw err instanceof Error ? err : new Error(String(err));
          })
      )
    );

    // Clean up decorations so the instance can be re-booted (e.g. in tests)
    for (const name of this.decorations) {
      Reflect.deleteProperty(this, name);
    }
    this.decorations.clear();
    this.extensions.length = 0;
    this.extensionNames.clear();
    this._isReady = false;

    // Undo the router mount that ready() appended, so a subsequent ready()
    // (re-boot in tests / hot reload) does not stack a second router (audit C-2).
    if (this._routerMounted) {
      this.middlewareStack.pop();
      this._routerMounted = false;
    }

    return results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => (r.reason instanceof Error ? r.reason : new Error(String(r.reason))));
  }
}

/**
 * Create a new Application instance
 *
 * @param options - Application options
 * @returns New Application instance
 */
export function createApp(options?: ApplicationOptions): Application {
  return new Application(options);
}
