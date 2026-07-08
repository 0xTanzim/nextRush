/**
 * @nextrush/controllers - Module registrar
 *
 * `registerModule(app, RootModule, options?)` wires a whole `@Module` graph in
 * one call: it walks `imports`, registers every module's providers into the DI
 * container, then hands the flattened controller list to the existing
 * `registerControllers` pipeline (route building, eager validation, guard
 * validation, lifecycle-hook bridging, isolate/request-scope). It duplicates
 * none of that machinery. See RFC-NEXTRUSH-MODULES.
 *
 * @example
 * ```typescript
 * const app = createApp();
 * await registerModule(app, AppModule, { prefix: '/api' });
 * await serve(app, { port: 8080 });
 * ```
 */

import type { Application } from '@nextrush/core';
import {
  getModuleMetadata,
  type ModuleProvider,
  type ModuleProviderConfig,
} from '@nextrush/decorators';
import {
  container as globalContainer,
  createContainer,
  getServiceScope,
  hasServiceMetadata,
  type Constructor,
  type Container,
} from '@nextrush/di';
import { collectModuleControllers, collectModuleGraph } from './module-graph.js';
import { registerControllers } from './registrar.js';
import type { ControllersOptions } from './types.js';

/**
 * Options for {@link registerModule}. Mirrors the subset of
 * {@link ControllersOptions} that applies to module registration — module
 * composition replaces `root`/`controllers` discovery.
 */
export type ModuleRegistrationOptions = Pick<
  ControllersOptions,
  'prefix' | 'middleware' | 'container' | 'isolate' | 'validate' | 'debug'
>;

/**
 * Register a module graph on an application.
 *
 * Selects the DI container once (an explicit `options.container` wins, else
 * `isolate` gets a fresh container, else `app.container` → the global
 * container), registers every module's providers into it, then registers all
 * controllers across the graph through {@link registerControllers}. The chosen
 * container is passed explicitly so it wins inside `registerControllers` even
 * under `isolate: true`, keeping providers and controllers on one container.
 *
 * @param app - The application (must have a router — use `createApp()`).
 * @param rootModule - The root `@Module` class.
 * @param options - Registration options (prefix, middleware, container, etc.).
 * @throws {NotAModuleError} if `rootModule` or any imported class is not a module.
 */
export async function registerModule(
  app: Application,
  rootModule: Function,
  options: ModuleRegistrationOptions = {}
): Promise<void> {
  const container: Container =
    options.container ??
    (options.isolate ? createContainer() : (app.container ?? globalContainer));

  const modules = collectModuleGraph(rootModule);

  for (const mod of modules) {
    const metadata = getModuleMetadata(mod);
    for (const provider of metadata?.providers ?? []) {
      registerProvider(provider, container);
    }
  }

  const controllers = collectModuleControllers(modules);

  await registerControllers(app, { ...options, container, controllers });
}

/**
 * Register a single module provider into the container.
 *
 * A bare class is registered as `{ useClass }` with its declared `@Service`
 * scope (or `singleton` if undecorated), and only when not already registered.
 * A provider config is registered with the matching provider kind; value
 * providers ignore scope, class/factory providers default to `singleton`.
 */
function registerProvider(provider: ModuleProvider, container: Container): void {
  if (typeof provider === 'function') {
    registerClassProvider(provider, container);
    return;
  }
  registerConfigProvider(provider, container);
}

/** Register a bare class provider with its declared `@Service` scope. */
function registerClassProvider(target: Function, container: Container): void {
  const token = target as Constructor;
  if (container.isRegistered(token)) {
    return;
  }
  const scope = hasServiceMetadata(target) ? getServiceScope(target) : 'singleton';
  container.register(token, { useClass: token }, { scope: scope ?? 'singleton' });
}

/** Register a provider config (`useValue` / `useFactory` / `useClass`). */
function registerConfigProvider(provider: ModuleProviderConfig, container: Container): void {
  const { provide, scope } = provider;

  if ('useValue' in provider) {
    container.register(provide, { useValue: provider.useValue });
    return;
  }

  if (provider.useFactory) {
    container.register(
      provide,
      { useFactory: provider.useFactory, inject: provider.inject },
      { scope: scope ?? 'singleton' }
    );
    return;
  }

  if (provider.useClass) {
    container.register(provide, { useClass: provider.useClass }, { scope: scope ?? 'singleton' });
    return;
  }

  throw new Error(
    `Invalid module provider for token "${String(provide)}": a provider config ` +
      `must set exactly one of "useValue", "useFactory", or "useClass".`
  );
}
