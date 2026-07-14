/**
 * @nextrush/runtime - Named Capability Profiles
 *
 * A named, documented view of {@link capabilitiesFor} for the known runtimes.
 * Profiles are capability *data* — for defaults, documentation, and debugging
 * ("why is streaming off here?"). They are derived from the single source of
 * truth ({@link capabilitiesFor}), never a hand-maintained duplicate.
 *
 * @remarks
 * A profile is NOT a licence to branch capability *decisions* on runtime
 * identity. Capability decisions stay governed by `getRuntimeCapabilities()`
 * (see RFC/ADR-R6). Reading a profile for display/defaults is fine; using it to
 * fork behavior by runtime name is the anti-pattern the negotiation contract
 * forbids.
 *
 * @packageDocumentation
 */

import type { Runtime, RuntimeCapabilities } from '@nextrush/types';
import { capabilitiesFor } from './detection';

/**
 * A named capability profile: a runtime paired with its capability matrix.
 */
export interface CapabilityProfile {
  /** The runtime this profile describes. */
  readonly runtime: Runtime;
  /** The capability matrix, derived from {@link capabilitiesFor}. */
  readonly capabilities: RuntimeCapabilities;
}

/**
 * Build the capability profile for a runtime.
 *
 * @remarks
 * Derived from {@link capabilitiesFor}, so known runtimes use the curated
 * matrix and `'unknown'` (and any future runtime) is answered by feature
 * probing — never a hardcoded per-runtime constant.
 *
 * @param runtime - The runtime to profile.
 * @returns The named capability profile.
 */
export function capabilityProfileFor(runtime: Runtime): CapabilityProfile {
  return { runtime, capabilities: capabilitiesFor(runtime) };
}

/** Node.js capability profile. */
export const NodeProfile: CapabilityProfile = capabilityProfileFor('node');
/** Bun capability profile. */
export const BunProfile: CapabilityProfile = capabilityProfileFor('bun');
/** Deno capability profile. */
export const DenoProfile: CapabilityProfile = capabilityProfileFor('deno');
/** Deno Deploy capability profile. */
export const DenoDeployProfile: CapabilityProfile = capabilityProfileFor('deno-deploy');
/** Cloudflare Workers capability profile. */
export const CloudflareProfile: CapabilityProfile = capabilityProfileFor('cloudflare-workers');
/** Vercel Edge capability profile. */
export const VercelEdgeProfile: CapabilityProfile = capabilityProfileFor('vercel-edge');
/** Generic edge capability profile. */
export const EdgeProfile: CapabilityProfile = capabilityProfileFor('edge');

/**
 * AWS Lambda runs on the Node.js runtime, so its capability profile is the
 * Node profile. Exposed as a named alias for the certification matrix /
 * deployment docs, which speak in platform terms.
 */
export const LambdaProfile: CapabilityProfile = NodeProfile;
