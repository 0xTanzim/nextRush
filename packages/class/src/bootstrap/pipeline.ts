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
import { collectDiagnostics } from '../diagnostics/collector.js';
import type { Application } from '@nextrush/core';
import type { DiagnosticsReport } from '../diagnostics/types.js';

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
  const enableTiming = ctx.resolvedOptions.diagnostics ?? false;
  const now = enableTiming ? () => performance.now() : () => 0;
  let stageStart = now();

  // Discovery
  await discoverStage(ctx);
  if (enableTiming) {
    ctx.timings.push({ stage: 'discover', ms: performance.now() - stageStart });
  }

  if (ctx.discoveredClasses.length === 0) {
    return;
  }

  // Metadata extraction
  stageStart = now();
  metadataStage(ctx);
  if (enableTiming) {
    ctx.timings.push({ stage: 'metadata', ms: performance.now() - stageStart });
  }

  // Provider graph and request-scope bubbling
  stageStart = now();
  await providerGraphStage(ctx);
  if (enableTiming) {
    ctx.timings.push({ stage: 'providerGraph', ms: performance.now() - stageStart });
  }

  // DI validation
  stageStart = now();
  await validationStage(ctx);
  if (enableTiming) {
    ctx.timings.push({ stage: 'validation', ms: performance.now() - stageStart });
  }

  // Registry and route building
  stageStart = now();
  registrarStage(ctx);
  if (enableTiming) {
    ctx.timings.push({ stage: 'registrar', ms: performance.now() - stageStart });
  }

  // Assemble + deep-freeze the immutable Application Graph (IR) once. The router
  // stage below registers from this frozen graph; request-time execution reads
  // only baked route data (zero Reflect on the request path).
  stageStart = now();
  ctx.graph = buildApplicationGraph(ctx.builtRoutes, ctx.providerGraph, ctx.requestScoped);
  if (enableTiming) {
    ctx.timings.push({ stage: 'graph', ms: performance.now() - stageStart });
  }

  // Router registration (from the frozen graph)
  stageStart = now();
  routerStage(ctx);
  if (enableTiming) {
    ctx.timings.push({ stage: 'router', ms: performance.now() - stageStart });
  }

  // Lifecycle hook integration
  stageStart = now();
  registerLifecycleExtension(
    ctx.app,
    ctx.lifecycleData.controllerClasses,
    ctx.resolvedOptions.container,
    ctx.registryInstances
  );
  if (enableTiming) {
    ctx.timings.push({ stage: 'lifecycle', ms: performance.now() - stageStart });
  }

  // Collect diagnostics if enabled
  if (enableTiming && ctx.graph) {
    const report = collectDiagnostics(ctx.graph, ctx.timings);
    storeClassDiagnostics(ctx.app, report);
  }
}

// Module-level WeakMap to store diagnostics reports per app
const diagnosticsStore = new WeakMap<Application, DiagnosticsReport>();

/** Store diagnostics report for later retrieval via getClassDiagnostics */
function storeClassDiagnostics(app: Application, report: DiagnosticsReport): void {
  diagnosticsStore.set(app, report);
}

/** Retrieve stored diagnostics report, or undefined if diagnostics not enabled */
export function getClassDiagnosticsInternal(app: Application): DiagnosticsReport | undefined {
  return diagnosticsStore.get(app);
}
