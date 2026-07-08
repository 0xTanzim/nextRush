/**
 * Discover stage: Runs the DiscoverySource to populate discoveredClasses.
 */

import type { BootstrapContext } from '../context.js';

export async function discoverStage(ctx: BootstrapContext): Promise<void> {
  ctx.discoveredClasses = await ctx.source.discover();
}
