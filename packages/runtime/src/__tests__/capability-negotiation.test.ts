/**
 * @nextrush/runtime - Capability Negotiation Tests (runtime-capability-negotiation)
 *
 * The negotiation contract: capability code queries `RuntimeCapabilities` and
 * either uses a capability, degrades, or refuses. Unknown runtimes are answered
 * by feature-probing, never a blanket all-false matrix.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from 'vitest';
import { capabilitiesFor } from '../detection.js';

describe('unknown-runtime probing (2.4)', () => {
  it('probes Web-platform globals rather than reporting all-false', () => {
    const caps = capabilitiesFor('unknown');
    // In the Node test env the Web globals exist, so fetch/webStreams/crypto
    // probe true — proving the fallback feature-detects instead of disabling
    // everything on an unrecognized-but-capable runtime.
    expect(caps.fetch).toBe(true);
    expect(caps.webStreams).toBe(true);
    expect(caps.cryptoSubtle).toBe(true);
    // Cannot be probed without importing node:*, so stay conservative-false.
    expect(caps.nodeStreams).toBe(false);
    expect(caps.fileSystem).toBe(false);
  });
});

describe('capability data supports degrade-vs-refuse decisions (2.5)', () => {
  it('reports filesystem absence on edge so fs-dependent code can refuse', () => {
    expect(capabilitiesFor('cloudflare-workers').fileSystem).toBe(false);
    expect(capabilitiesFor('vercel-edge').fileSystem).toBe(false);
    expect(capabilitiesFor('deno-deploy').fileSystem).toBe(false);
  });

  it('reports web streams present everywhere so streaming can be used or degraded consistently', () => {
    for (const rt of ['node', 'bun', 'deno', 'cloudflare-workers', 'edge'] as const) {
      expect(capabilitiesFor(rt).webStreams).toBe(true);
    }
  });

  it('reports node streams only where present, so code degrades to web streams elsewhere', () => {
    expect(capabilitiesFor('node').nodeStreams).toBe(true);
    expect(capabilitiesFor('bun').nodeStreams).toBe(true);
    expect(capabilitiesFor('deno').nodeStreams).toBe(false);
    expect(capabilitiesFor('edge').nodeStreams).toBe(false);
  });
});
