/**
 * Provider Graph stage: Compute service dependencies and request-scope bubbling.
 */

import type { BootstrapContext } from '../context.js';
import { bindRequestScopes } from '../../request/scope.js';
import { collectDependencyClasses } from '../../request/isolation.js';

export async function providerGraphStage(ctx: BootstrapContext): Promise<void> {
  // Compute effective DI scopes (request-scope bubbling) and bind request-effective
  // classes to the container's request lifecycle.
  ctx.requestScoped = bindRequestScopes(
    ctx.discoveredClasses,
    ctx.resolvedOptions.container,
    ctx.resolvedOptions.isolate
  );

  // Populate the provider dependency graph (controller/service -> its constructor
  // dependency classes) so the frozen Application Graph carries real provider
  // data for diagnostics and introspection. Read once here, never at request time.
  const graph = new Map<Function, Function[]>();
  for (const cls of ctx.discoveredClasses) {
    graph.set(cls, collectDependencyClasses(cls));
  }
  ctx.providerGraph = graph;
}
