/**
 * @nextrush/runtime - Capability Negotiation Tests (runtime-capability-negotiation)
 *
 * The negotiation contract: capability code queries `RuntimeCapabilities` and
 * either uses a capability, degrades, or refuses. Unknown runtimes are answered
 * by feature-probing, never a blanket all-false matrix.
 *
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

describe('transport capability flags are present (secureServing, http2)', () => {
  it('exposes secureServing and http2 on every known runtime', () => {
    for (const rt of ['node', 'bun', 'deno', 'deno-deploy', 'cloudflare-workers', 'vercel-edge', 'edge'] as const) {
      const caps = capabilitiesFor(rt);
      expect(caps).toHaveProperty('secureServing');
      expect(caps).toHaveProperty('http2');
      expect(typeof caps.secureServing).toBe('boolean');
      expect(typeof caps.http2).toBe('boolean');
    }
  });

  it('reports http2 false for edge/serverless runtimes (platform terminates TLS)', () => {
    const edgeCaps = capabilitiesFor('cloudflare-workers');
    expect(edgeCaps.http2).toBe(false);
    expect(edgeCaps.secureServing).toBe(false);

    // Node now reports true after TLS/HTTP2 implementation.
    const nodeCaps = capabilitiesFor('node');
    expect(nodeCaps.secureServing).toBe(true);
    expect(nodeCaps.http2).toBe(true);
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
