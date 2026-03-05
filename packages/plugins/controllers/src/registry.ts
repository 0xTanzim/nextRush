/**
 * @nextrush/controllers - Controller Registry
 *
 * Manages registration and tracking of controllers.
 */

import { getControllerDefinition, isController } from '@nextrush/decorators';
import type { ContainerInterface } from '@nextrush/di';
import type { Middleware } from '@nextrush/types';
import 'reflect-metadata';
import { buildRoutes } from './builder.js';
import { NoRoutesError, NotAControllerError } from './errors.js';
import type { BuiltRoute, RegisteredController } from './types.js';

/**
 * Registry for tracking and building controller routes
 */
export class ControllerRegistry {
  private readonly controllers: Map<Function, RegisteredController> = new Map();
  private readonly container: ContainerInterface;
  private readonly globalPrefix: string;
  private readonly globalMiddleware: Middleware[];
  private readonly debug: boolean;

  constructor(
    container: ContainerInterface,
    globalPrefix: string,
    globalMiddleware: Middleware[],
    debug: boolean
  ) {
    this.container = container;
    this.globalPrefix = globalPrefix;
    this.globalMiddleware = globalMiddleware;
    this.debug = debug;
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
      this.globalMiddleware
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
   * Register the controller in the DI container as a singleton
   */
  private registerInContainer(controllerClass: Function): void {
    const token = controllerClass as new (...args: unknown[]) => unknown;

    if (!this.container.isRegistered(token)) {
      this.container.register(token, { useClass: token }, { scope: 'singleton' });
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
