/**
 * @nextrush/runtime - Capability Profile Tests (runtime-capability-negotiation)
 *
 * Profiles are a named, documented view of `capabilitiesFor()` — capability
 * *data* for defaults/docs/debugging, derived from the single source of truth
 * (never a hand-maintained duplicate).
 *
 */

import { describe, expect, it } from 'vitest';
import { capabilitiesFor } from '../detection.js';
import {
  BunProfile,
  CloudflareProfile,
  DenoProfile,
  NodeProfile,
  capabilityProfileFor,
} from '../profiles.js';

describe('capabilityProfileFor', () => {
  it('derives the profile from capabilitiesFor (single source of truth)', () => {
    const profile = capabilityProfileFor('cloudflare-workers');
    expect(profile.runtime).toBe('cloudflare-workers');
    expect(profile.capabilities).toEqual(capabilitiesFor('cloudflare-workers'));
    // Cloudflare: no filesystem, but web streams.
    expect(profile.capabilities.fileSystem).toBe(false);
    expect(profile.capabilities.webStreams).toBe(true);
  });

  it('builds an unknown runtime profile from probed capabilities, not a hardcoded table', () => {
    const profile = capabilityProfileFor('unknown');
    expect(profile.runtime).toBe('unknown');
    // Probe result: nodeStreams/fileSystem stay conservative-false; fetch reflects the env.
    expect(profile.capabilities).toEqual(capabilitiesFor('unknown'));
    expect(typeof profile.capabilities.fetch).toBe('boolean');
    expect(profile.capabilities.nodeStreams).toBe(false);
  });
});

describe('named profiles', () => {
  it('expose the common runtimes, each derived from capabilitiesFor', () => {
    expect(NodeProfile.capabilities.fileSystem).toBe(true);
    expect(BunProfile.capabilities.nodeStreams).toBe(true);
    expect(DenoProfile.capabilities.nodeStreams).toBe(false);
    expect(CloudflareProfile.capabilities.fileSystem).toBe(false);
    // Derived, not duplicated:
    expect(NodeProfile.capabilities).toEqual(capabilitiesFor('node'));
  });
});
