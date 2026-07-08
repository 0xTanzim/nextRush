/**
 * BootstrapContext: Mutable accumulator for the class-based registration pipeline.
 *
 * Each stage reads from and mutates this context as it executes, building up
 * the state needed by downstream stages. This ensures a single thread of
 * execution with zero hidden coupling through global state or closure variables.
 */

import type { Application, Router, Middleware } from '@nextrush/core';
import type { Container } from '@nextrush/di';
import type { DiscoverySource } from '../discovery/source.js';
import type { BuiltRoute } from '../registrar-types.js';
import type { ControllerDefinition } from '../metadata.js';
import type { ApplicationGraph } from './graph.js';

/**
 * The complete bootstrap context. All fields are populated incrementally
 * as the pipeline stages execute.
 */
export interface BootstrapContext {
  // Configuration inputs
  readonly app: Application;
  readonly router: Router;
  readonly container: Container;

  // Resolved registration options (from ControllersOptions after defaults)
  resolvedOptions: ResolvedBootstrapOptions;

  // Discovery
  source: DiscoverySource;
  discoveredClasses: Function[];

  // Metadata & DI graph
  controllerDefinitions: ControllerDefinition[];
  providerGraph: Map<Function, Function[]>;
  requestScoped: Set<Function>;

  // Built artifacts
  registryInstances: Map<Function, unknown>;
  builtRoutes: BuiltRoute[];

  /**
   * The immutable Application Graph (IR), assembled and deep-frozen once after
   * the registrar stage. The router stage registers from `graph.routes`. Null
   * until the pipeline builds it. Freezes shape, not instances.
   */
  graph: ApplicationGraph | null;

  // Lifecycle integration state
  lifecycleData: LifecycleData;
}

/**
 * Resolved options after applying defaults and normalizing container/isolation logic.
 */
export interface ResolvedBootstrapOptions {
  prefix: string;
  middleware: Middleware[];
  include: string[];
  exclude: string[];
  debug: boolean;
  validate: boolean;
  strict: boolean;
  container: Container;
  isolate: boolean;
}

/**
 * Lifecycle state collected during bootstrap for later bridge into app hooks.
 */
export interface LifecycleData {
  controllerClasses: Function[];
}
