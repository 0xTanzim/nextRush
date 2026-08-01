/**
 * Validation stage: Bootstrap async factories before DI resolution.
 * (Eager controller/guard validation happens in registrarStage after routes are built.)
 */

import type { BootstrapContext } from '../context.js';

export async function validationStage(ctx: BootstrapContext): Promise<void> {
  // Bootstrap async factory providers before controller resolution.
  await ctx.resolvedOptions.container.bootstrap();
}
