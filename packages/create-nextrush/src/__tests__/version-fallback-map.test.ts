import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Wave 1 verifier backstop (task 2.3 — RFC-021 / ADR-0011).
 *
 * Asserts the OFFLINE path uses a per-package fallback MAP, not a single shared scalar —
 * so `@nextrush/dev`'s fallback is never equal to `nextrush`'s fallback. This is RED against
 * the current design, where `CORE_FALLBACK`/`MW_FALLBACK` are two build-time scalars
 * (`__CORE_RANGE__`/`__MW_RANGE__` in npm-version.ts) shared across every emitted package.
 */

describe('offline fallback map (task 2.3)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // Simulate total registry unavailability (offline).
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('network unreachable'))) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.resetModules();
  });

  it('falls back to a PER-PACKAGE map — @nextrush/dev fallback differs from nextrush fallback', async () => {
    const { resolveVersions } = await import('../npm-version.js');

    const { versions } = await resolveVersions(['nextrush', '@nextrush/dev', '@nextrush/adapter-deno']);

    const nextrushFallback = versions.get('nextrush');
    const devFallback = versions.get('@nextrush/dev');
    const denoAdapterFallback = versions.get('@nextrush/adapter-deno');

    expect(nextrushFallback).toBeDefined();
    expect(devFallback).toBeDefined();
    expect(denoAdapterFallback).toBeDefined();

    // The regression this test exists to catch: a single shared fallback scalar would make
    // @nextrush/dev's offline fallback identical to nextrush's — which is exactly F-01's bug,
    // just triggered by the offline path instead of the online path.
    expect(devFallback).not.toBe(nextrushFallback);
    expect(denoAdapterFallback).not.toBe(nextrushFallback);
  });

  it('every fallback entry is itself a resolvable-shaped semver range', async () => {
    const { resolveVersions } = await import('../npm-version.js');

    const { versions } = await resolveVersions(['nextrush', '@nextrush/dev', '@nextrush/rate-limit']);

    for (const [pkgName, range] of versions) {
      expect(range, `${pkgName} fallback range "${range}" is not a valid semver range`).toMatch(
        /^\^\d+\.\d+\.\d+/
      );
    }
  });
});
