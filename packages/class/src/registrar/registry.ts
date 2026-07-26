/**
 * @nextrush/class - Controller Registry
 *
 * Manages registration and tracking of controllers.
 */

import { getControllerDefinition, isController } from '../metadata/metadata.js';
import type { Container } from '@nextrush/di';
import type { Middleware } from '@nextrush/types';
import { buildRoutes } from './builder.js';
import { NoRoutesError, NotAControllerError } from '../errors.js';
import type { BuiltRoute, RegisteredController } from './registrar-types.js';

/**
 * Registry for tracking and building controller routes
 */
export class ControllerRegistry {
  private readonly controllers: Map<Function, RegisteredController> = new Map();
  private readonly container: Container;
  private readonly globalPrefix: string;
  private readonly globalMiddleware: Middleware[];
  private readonly debug: boolean;

  /**
   * Classes whose effective DI scope is `'request'` (self or dependency graph
   * declares `scope: 'request'`). A request-scoped controller is registered with
   * the request lifecycle and resolved from a per-request child on every request
   * instead of being memoized. Empty by default (pure singleton/transient graph).
   */
  private readonly requestScopedClasses: ReadonlySet<Function>;

  /**
   * Shared controller-instance cache, keyed by controller class.
   *
   * Owned by the registry so a single resolved singleton is reused across the
   * boot-time eager validation (`validateControllers`) and the per-request
   * handlers built by {@link buildRoutes}. Without a shared cache, `validate: true`
   * resolves each controller twice: once at boot and again on the first request.
   *
   * A failed resolve is never stored, so resolution retries on each request until
   * it succeeds (see `createRouteHandler` in `builder.ts`).
   */
  private readonly instanceCache: Map<Function, unknown> = new Map();

  constructor(
    container: Container,
    globalPrefix: string,
    globalMiddleware: Middleware[],
    debug: boolean,
    requestScopedClasses: ReadonlySet<Function> = new Set()
  ) {
    this.container = container;
    this.globalPrefix = globalPrefix;
    this.globalMiddleware = globalMiddleware;
    this.debug = debug;
    this.requestScopedClasses = requestScopedClasses;
  }

  /**
   * Register a controller class
   */
  register(controllerClass: Function): RegisteredController {
    if (this.controllers.has(controllerClass)) {
      return this.controllers.get(controllerClass)!;
    }

    if (!isController(controllerClass)) {
      throw new NotAControllerError(controllerClass.name);
    }

    const definition = getControllerDefinition(controllerClass);

    if (!definition) {
      throw new NotAControllerError(controllerClass.name);
    }

    if (definition.routes.length === 0) {
      throw new NoRoutesError(controllerClass.name);
    }

    this.registerInContainer(controllerClass);

    const routes = buildRoutes(
      definition,
      this.container,
      this.globalPrefix,
      this.globalMiddleware,
      this.instanceCache,
      this.requestScopedClasses.has(controllerClass)
    );

    const registered: RegisteredController = {
      target: controllerClass,
      definition,
      routes,
    };

    this.controllers.set(controllerClass, registered);

    if (this.debug) {
      this.logRegistration(registered);
    }

    return registered;
  }

  /**
   * The shared controller-instance cache.
   *
   * Exposed so `registerControllers` can pre-seed it during eager validation
   * (`validate: true`), making the boot-time resolve and the per-request handler
   * share one singleton instead of resolving the same controller twice.
   */
  get instances(): Map<Function, unknown> {
    return this.instanceCache;
  }

  /**
   * Register multiple controllers
   */
  registerAll(controllers: Function[]): RegisteredController[] {
    return controllers.map((c) => this.register(c));
  }

  /**
   * Get all registered controllers
   */
  getAll(): RegisteredController[] {
    return Array.from(this.controllers.values());
  }

  /**
   * Get all built routes from all controllers
   */
  getAllRoutes(): BuiltRoute[] {
    const routes: BuiltRoute[] = [];

    for (const controller of this.controllers.values()) {
      routes.push(...controller.routes);
    }

    return routes;
  }

  /**
   * Get total route count
   */
  get routeCount(): number {
    let count = 0;

    for (const controller of this.controllers.values()) {
      count += controller.routes.length;
    }

    return count;
  }

  /**
   * Check if a controller is registered
   */
  has(controllerClass: Function): boolean {
    return this.controllers.has(controllerClass);
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.controllers.clear();
  }

  /**
   * Register the controller in the DI container with its effective scope: a
   * request-effective controller (self or dependency graph declares
   * `scope: 'request'`) uses the request (ContainerScoped) lifecycle so a fresh
   * instance is built per request; every other controller stays a singleton.
   */
  private registerInContainer(controllerClass: Function): void {
    const token = controllerClass as new (...args: unknown[]) => unknown;

    if (!this.container.isRegistered(token)) {
      const scope = this.requestScopedClasses.has(controllerClass) ? 'request' : 'singleton';
      this.container.register(token, { useClass: token }, { scope });
    }
  }

  /**
   * Log controller registration details
   */
  private logRegistration(registered: RegisteredController): void {
    const { target, routes } = registered;

    process.stderr.write(`[Controllers] Registered: ${target.name}\n`);

    for (const route of routes) {
      process.stderr.write(`  ${route.method.padEnd(7)} ${route.path}\n`);
    }
  }
}
