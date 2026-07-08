/**
 * Bootstrap pipeline: Orchestrate all stages in sequence.
 */

import type { BootstrapContext } from './context.js';
import { discoverStage } from './stages/discover.js';
import { metadataStage } from './stages/metadata.js';
import { providerGraphStage } from './stages/provider-graph.js';
import { validationStage } from './stages/validation.js';
import { registrarStage } from './stages/registrar.js';
import { routerStage } from './stages/router.js';
import { registerLifecycleExtension } from '../lifecycle.js';
import { buildApplicationGraph } from './graph.js';

/**
 * Execute the bootstrap pipeline in sequence:
 *
 * 1. discover — Run DiscoverySource to populate discoveredClasses
 * 2. metadata — Extract controller metadata from each class
 * 3. providerGraph — Compute request-scope bubbling
 * 4. validation — Bootstrap DI factories and validate constraints
 * 5. registrar — Build routes and register in DI container
 * 6. router — Mount routes on the app's router
 * 7. lifecycle — Bridge service lifecycle hooks into app lifecycle
 */
export async function bootstrapPipeline(ctx: BootstrapContext): Promise<void> {
  // Discovery
  await discoverStage(ctx);

  if (ctx.discoveredClasses.length === 0) {
    return;
  }

  // Metadata extraction
  metadataStage(ctx);

  // Provider graph and request-scope bubbling
  await providerGraphStage(ctx);

  // DI validation
  await validationStage(ctx);

  // Registry and route building
  registrarStage(ctx);

  // Assemble + deep-freeze the immutable Application Graph (IR) once. The router
  // stage below registers from this frozen graph; request-time execution reads
  // only baked route data (zero Reflect on the request path).
  ctx.graph = buildApplicationGraph(ctx.builtRoutes, ctx.providerGraph, ctx.requestScoped);

  // Router registration (from the frozen graph)
  routerStage(ctx);

  // Lifecycle hook integration
  registerLifecycleExtension(
    ctx.app,
    ctx.lifecycleData.controllerClasses,
    ctx.resolvedOptions.container,
    ctx.registryInstances
  );
}
