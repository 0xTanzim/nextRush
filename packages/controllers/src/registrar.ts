/**
 * @nextrush/controllers - Controller registration
 *
 * `registerControllers(app, options)` is a **registrar**: it scans for
 * `@Controller` classes (or takes them explicitly), builds their routes, and
 * registers them on the app's router. It reads `app.router` and `app.container`
 * — no plugin lifecycle, no ignored app. Call it (awaited) before `serve()`.
 *
 * @example
 * ```typescript
 * const app = createApp();
 * await registerControllers(app, { root: './src', prefix: '/api' });
 * await serve(app, { port: 8080 });
 * ```
 */

import type { Application } from '@nextrush/core';
import { getAllGuards, isGuardClass } from '@nextrush/decorators';
import { container as globalContainer, createContainer, DIError, type Container } from '@nextrush/di';
import { ROUTE_METADATA, type Router } from '@nextrush/types';
import {
  DEFAULT_EXCLUDE,
  DEFAULT_INCLUDE,
  discoverControllers,
  getControllersFromResults,
  getErrorsFromResults,
} from './discovery.js';
import { ControllerResolutionError, RouteRegistrationError } from './errors.js';
import { registerLifecycleExtension } from './lifecycle.js';
import { ControllerRegistry } from './registry.js';
import { bindRequestScopes } from './scope.js';
import type {
  ControllersOptions,
  BuiltRoute,
  RegisteredController,
  ResolvedOptions,
} from './types.js';

/** Debug logger that writes to stderr (never to stdout). */
function debugLog(debug: boolean, message: string): void {
  if (debug) {
    process.stderr.write(`[Controllers] ${message}\n`);
  }
}

function warnLog(message: string): void {
  process.stderr.write(`[Controllers] WARNING: ${message}\n`);
}

/**
 * Assemble the entries passed to a router method: middleware first, then the
 * metadata marker (only when the route carries decorator docs), then the
 * handler — using the ROUTE_METADATA contribution protocol from `@nextrush/types`.
 */
function buildRouteEntries(route: BuiltRoute): unknown[] {
  const entries: unknown[] = [...route.middleware];
  if (route.metadata) {
    entries.push({ [ROUTE_METADATA]: route.metadata });
  }
  entries.push(route.handler);
  return entries;
}

function resolveOptions(
  options: ControllersOptions,
  container: Container
): ResolvedOptions {
  return {
    root: options.root ?? null,
    include: options.include ?? DEFAULT_INCLUDE,
    exclude: options.exclude ?? DEFAULT_EXCLUDE,
    controllers: options.controllers ?? [],
    container,
    middleware: options.middleware ?? [],
    debug: options.debug ?? false,
    prefix: options.prefix ?? '',
    strict: options.strict ?? false,
    validate: options.validate ?? true,
    isolate: options.isolate ?? false,
  };
}

/** Register built routes on the router. */
function registerRoutes(router: Router, registered: RegisteredController[]): void {
  for (const controller of registered) {
    for (const route of controller.routes) {
      try {
        const method = route.method.toLowerCase() as keyof Router;

        if (typeof router[method] !== 'function') {
          throw new RouteRegistrationError(
            controller.target.name,
            route.method,
            route.path,
            `Router does not support HTTP method: ${route.method}`
          );
        }

        (router[method] as (path: string, ...entries: unknown[]) => unknown)(
          route.path,
          ...buildRouteEntries(route)
        );
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

/**
 * Eagerly resolve every registered controller once so unsatisfiable or circular
 * constructor dependencies fail at boot rather than as a 500 on the first
 * request. Mirrors the per-request resolution in `builder.ts`, surfacing the
 * same {@link ControllerResolutionError} for non-DI failures.
 *
 * Each successfully resolved singleton is stored in the shared `instanceCache`,
 * so the per-request handler reuses this instance instead of resolving the same
 * controller a second time on its first hit.
 *
 * When the underlying failure is a `@nextrush/di` error (a {@link DIError}
 * subclass such as `CircularDependencyError` or `DependencyResolutionError`), it
 * is rethrown as-is so its specific, actionable message surfaces at boot rather
 * than being buried in the `.cause` of a generic wrapper.
 */
function validateControllers(
  registered: RegisteredController[],
  container: Container,
  instanceCache: Map<Function, unknown>
): void {
  for (const controller of registered) {
    const token = controller.target as new (...args: unknown[]) => unknown;
    try {
      instanceCache.set(token, container.resolve(token));
    } catch (error) {
      if (error instanceof DIError) {
        throw error;
      }
      throw new ControllerResolutionError(
        controller.target.name,
        error instanceof Error ? error : undefined
      );
    }
  }
}

/**
 * Eagerly resolve every distinct class-based guard used by any registered route
 * once, so a guard with an unsatisfiable or circular dependency fails at boot
 * instead of surfacing as a 500 on the first request to a guarded route.
 *
 * Guards are resolved per-request in `builder.ts` via `container.resolve(guard)`,
 * so a class guard skipped by {@link validateControllers} (which only resolves
 * controller tokens) would otherwise fail late — the exact gap eager validation
 * exists to close. Function guards need no DI resolution and are skipped; each
 * class guard is resolved once (deduped) even when shared across routes.
 *
 * A `@nextrush/di` error (a {@link DIError} subclass such as
 * `CircularDependencyError` or `DependencyResolutionError`) is rethrown as-is so
 * its specific guidance surfaces at boot; any other failure is wrapped with a
 * guard-specific message.
 */
function validateGuards(
  registered: RegisteredController[],
  container: Container
): void {
  const resolved = new Set<Function>();

  for (const controller of registered) {
    for (const route of controller.definition.routes) {
      const guards = getAllGuards(controller.target, route.methodName);
      for (const guard of guards) {
        if (!isGuardClass(guard) || resolved.has(guard)) {
          continue;
        }
        resolved.add(guard);
        try {
          container.resolve(guard);
        } catch (error) {
          if (error instanceof DIError) {
            throw error;
          }
          const guardName = guard.name || 'AnonymousGuard';
          throw new Error(
            `Failed to resolve guard "${guardName}" from the DI container ` +
              `(used by controller "${controller.target.name}").\n\n` +
              `A class-based guard is resolved from DI on every request to a guarded ` +
              `route. Surfacing the failure here means an unresolvable or circular guard ` +
              `dependency fails at boot instead of as a 500 on the first request.\n\n` +
              `Ensure "${guardName}" and all of its constructor dependencies are registered ` +
              `in the DI container.`,
            { cause: error instanceof Error ? error : undefined }
          );
        }
      }
    }
  }
}

/**
 * Discover and register decorator-based controllers on an application.
 *
 * Reads `app.router` (required) and `app.container` (falls back to a custom
 * container in options, then the global container). Supports auto-discovery
 * (`root`) and/or explicit `controllers`.
 *
 * @param app - The application (must have a router — use `createApp()` from `nextrush`)
 * @param options - Discovery/registration options
 */
export async function registerControllers(
  app: Application,
  options: ControllersOptions = {}
): Promise<void> {
  const router = app.router;
  if (!router) {
    throw new Error(
      'registerControllers() requires an app with a router. Create the app with ' +
        '`createApp()` from `nextrush`, or pass `{ router }` to `createApp()`.'
    );
  }

  // Container ownership: an explicit `options.container` always wins (the caller
  // has taken ownership). Otherwise `isolate: true` gives this registration its
  // own fresh container so its service graph is isolated from other apps; the
  // default (non-isolate) path is unchanged — app.container, then the global one.
  const container: Container =
    options.container ??
    (options.isolate ? createContainer() : (app.container ?? globalContainer));
  const opts = resolveOptions(options, container);

  let controllers: Function[] = [];

  if (opts.root) {
    debugLog(opts.debug, `Starting auto-discovery in: ${opts.root}`);
    const results = await discoverControllers({
      root: opts.root,
      include: opts.include,
      exclude: opts.exclude,
      debug: opts.debug,
    });
    controllers = getControllersFromResults(results);
    const errors = getErrorsFromResults(results);
    if (errors.length > 0) {
      for (const error of errors) {
        if (opts.strict) {
          throw error;
        }
        warnLog(error.message);
      }
    }
    debugLog(opts.debug, `Discovered ${controllers.length} controller(s)`);
  }

  if (opts.controllers.length > 0) {
    controllers = [...controllers, ...opts.controllers];
  }

  if (controllers.length === 0) {
    warnLog('No controllers found. Check your root path or patterns.');
    return;
  }

  // Compute effective DI scopes (request-scope bubbling) and bind request-effective
  // classes to the container's request lifecycle. Returns the request-scoped set
  // that drives per-controller registration and per-request child resolution.
  const requestScoped = bindRequestScopes(controllers, opts.container, opts.isolate);

  const registry = new ControllerRegistry(
    opts.container,
    opts.prefix,
    opts.middleware,
    opts.debug,
    requestScoped
  );

  // Bootstrap async factory providers before controller resolution.
  await opts.container.bootstrap();

  const registered = registry.registerAll(controllers);
  registerRoutes(router, registered);

  if (opts.validate) {
    validateControllers(registered, opts.container, registry.instances);
    validateGuards(registered, opts.container);
  }

  // Bridge service lifecycle hooks (OnInit/OnShutdown) into app.ready()/close().
  // No-op unless a resolved controller/service implements a hook.
  registerLifecycleExtension(app, controllers, opts.container, registry.instances);

  debugLog(opts.debug, `Registered ${registry.routeCount} routes`);
}
