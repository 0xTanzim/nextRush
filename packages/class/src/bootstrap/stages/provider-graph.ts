/**
 * Provider Graph stage: Compute service dependencies and request-scope bubbling.
 */

import type { BootstrapContext } from '../context.js';
import { bindRequestScopes } from '../../scope.js';

export async function providerGraphStage(ctx: BootstrapContext): Promise<void> {
  // Compute effective DI scopes (request-scope bubbling) and bind request-effective
  // classes to the container's request lifecycle.
  ctx.requestScoped = bindRequestScopes(
    ctx.discoveredClasses,
    ctx.resolvedOptions.container,
    ctx.resolvedOptions.isolate
  );

  // Provider graph is populated as a side-effect of bindRequestScopes.
  // (The providerGraph field can be populated from isolation/scope functions
  // if needed in the future; for now it serves as a placeholder.)
}
