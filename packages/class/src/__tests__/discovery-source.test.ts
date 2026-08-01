/**
 * Unit tests for the DiscoverySource abstraction — MemorySource in particular,
 * proving programmatic (disk-free) controller discovery for tests/embedding.
 */
import { describe, expect, it } from 'vitest';

import { MemorySource, type DiscoverySource } from '../discovery/source.js';

class AlphaController {}
class BetaController {}

describe('MemorySource', () => {
  it('returns the provided controller classes synchronously (no filesystem I/O)', () => {
    const source = new MemorySource([AlphaController, BetaController]);

    const result = source.discover();

    // Synchronous return (not a Promise) is the proof there is no disk scan.
    expect(result).not.toBeInstanceOf(Promise);
    expect(result).toEqual([AlphaController, BetaController]);
  });

  it('returns an empty list when constructed with no controllers', () => {
    const source = new MemorySource([]);
    expect(source.discover()).toEqual([]);
  });

  it('satisfies the DiscoverySource contract', () => {
    const source: DiscoverySource = new MemorySource([AlphaController]);
    expect(typeof source.discover).toBe('function');
  });
});
