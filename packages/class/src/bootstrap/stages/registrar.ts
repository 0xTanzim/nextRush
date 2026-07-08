/**
 * Registrar stage: Build routes and register controllers in the DI container.
 * Also performs eager validation if enabled.
 */

import type { BootstrapContext } from '../context.js';
import { ControllerRegistry } from '../../registrar/registry.js';
import { validateControllers, validateGuards } from '../../registrar/registrar.js';

export function registrarStage(ctx: BootstrapContext): void {
  // Create the registry with resolved options and request-scoped set
  const registry = new ControllerRegistry(
    ctx.resolvedOptions.container,
    ctx.resolvedOptions.prefix,
    ctx.resolvedOptions.middleware,
    ctx.resolvedOptions.debug,
    ctx.requestScoped
  );

  // Register all controllers and build routes
  const registered = registry.registerAll(ctx.discoveredClasses);

  // Collect all built routes for the router stage
  ctx.builtRoutes = [];
  for (const regCtrl of registered) {
    ctx.builtRoutes.push(...regCtrl.routes);
  }

  // Store registry instances for lifecycle integration
  ctx.registryInstances = registry.instances;

  // Store controller classes for lifecycle bridge
  ctx.lifecycleData.controllerClasses = ctx.discoveredClasses;

  // Validate controllers and guards if enabled
  if (ctx.resolvedOptions.validate) {
    validateControllers(registered, ctx.resolvedOptions.container, registry.instances);
    validateGuards(registered, ctx.resolvedOptions.container);
  }
}

