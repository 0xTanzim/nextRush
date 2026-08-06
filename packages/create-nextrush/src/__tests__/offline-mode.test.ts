import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Wave 2 verifier backstop (task 2.3 — RFC-021 / ADR-0011 / design decision 4).
 *
 * `--offline` MUST be explicit: it skips all registry probes and resolves every emitted
 * dependency from the embedded per-package fallback map. The result (JSON + human)
 * MUST state that the generated ranges are offline fallback ranges.
 *
 * This is RED against the current API, which only exposes `resolveVersions(packageNames)`
 * with no offline path and whose success result carries no offline annotation.
 */

describe('explicit offline resolution (task 2.3)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // A registry that would answer — if offline mode probes it even once, that's a violation.
    globalThis.fetch = vi.fn((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString();
      const match = /\/([^/]+(?:%2F[^/]+)?|@[^/]+\/[^/]+)\/latest$/.exec(url);
      const pkgName = match?.[1] ?? '';
      return Promise.resolve(
        new Response(JSON.stringify({ version: '99.0.0' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      );
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.resetModules();
  });

  it('offline mode makes no registry request and uses per-package fallbacks', async () => {
    const { resolveVersions } = await import('../npm-version.js');

    const { versions } = await resolveVersions(['nextrush', '@nextrush/dev'], { offline: true });

    // The stub registry would have answered 99.0.0; offline must never ask.
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(versions.get('nextrush')).toBeDefined();
    expect(versions.get('nextrush')).not.toBe('^99.0.0');
    expect(versions.get('@nextrush/dev')).toBeDefined();
    expect(versions.get('@nextrush/dev')).not.toBe(versions.get('nextrush'));
  });

  it('offline returns a fallback-range annotation for reporting', async () => {
    const { resolveVersions } = await import('../npm-version.js');

    const { versions, offline } = await resolveVersions(['nextrush'], { offline: true });

    expect(offline).toBe(true);
    for (const [pkgName, range] of versions) {
      expect(range, `${pkgName} offline range "${range}" is not a fallback-shaped range`).toMatch(/^\^\d+\.\d+\.\d+/);
    }
  });

  it('online mode stays the default and reports offline=false', async () => {
    const { resolveVersions } = await import('../npm-version.js');

    const { versions, offline } = await resolveVersions(['nextrush']);

    expect(offline).toBe(false);
    expect(globalThis.fetch).toHaveBeenCalled();
    expect(versions.get('nextrush')).toBe('^99.0.0');
  });

  it('offline mode throws when a package has no embedded fallback entry', async () => {
    const { resolveVersions } = await import('../npm-version.js');

    await expect(resolveVersions(['no-such-package-xyz'], { offline: true })).rejects.toThrow(
      /no fallback entry exists/
    );
    // The failure must not have been caused by (or hidden by) a registry probe.
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('online mode throws when the probe fails and no fallback entry exists', async () => {
    // The default stub answers 200 for everything; make the registry 404 (probe fails → '')
    // for a name that also has no fallback entry.
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(new Response('not found', { status: 404 }))
    ) as unknown as typeof fetch;
    const { resolveVersions } = await import('../npm-version.js');

    await expect(resolveVersions(['no-such-package-xyz'])).rejects.toThrow(
      /probe failed and no fallback entry exists/
    );
  });
});
