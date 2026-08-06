import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Wave 1 verifier backstop (task 2.2 — RFC-021 / ADR-0011).
 *
 * Unit-tests the per-package resolver with a STUB registry where `nextrush`/`@nextrush/cors`
 * are on the `3.x` line but `@nextrush/dev`, `@nextrush/rate-limit`, and
 * `@nextrush/adapter-deno` are on the `1.x` line — exactly the real-world split the review
 * documented. Asserts each emitted range equals its OWN package's resolved version, and
 * specifically that `@nextrush/dev` is NEVER given `nextrush`'s range.
 *
 * This is RED against the current `resolveVersions()` (npm-version.ts), which returns only
 * `{ core, mw }` — two scalars — with no per-package resolution at all.
 */

const STUB_REGISTRY: Record<string, string> = {
  nextrush: '3.1.0',
  '@nextrush/cors': '3.1.0',
  '@nextrush/types': '3.1.0',
  '@nextrush/class': '3.1.0',
  '@nextrush/dev': '1.0.0',
  '@nextrush/rate-limit': '1.0.0',
  '@nextrush/request-id': '1.0.0',
  '@nextrush/adapter-bun': '1.0.0',
  '@nextrush/adapter-deno': '1.0.0',
};

function stubFetch(pkg: string): Promise<Response> {
  const version = STUB_REGISTRY[decodeURIComponent(pkg)];
  if (version === undefined) {
    return Promise.resolve(new Response(null, { status: 404 }));
  }
  return Promise.resolve(
    new Response(JSON.stringify({ version }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  );
}

describe('per-package version resolution (task 2.2)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString();
      const match = /\/([^/]+(?:%2F[^/]+)?|@[^/]+\/[^/]+)\/latest$/.exec(url);
      const pkgName = match?.[1] ?? '';
      return stubFetch(pkgName);
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.resetModules();
  });

  it('resolves each package from its OWN registry entry — @nextrush/dev never gets nextrush\'s range', async () => {
    const { resolveVersions } = await import('../npm-version.js');

    const { versions } = await resolveVersions([
      'nextrush',
      '@nextrush/cors',
      '@nextrush/dev',
      '@nextrush/rate-limit',
      '@nextrush/adapter-deno',
    ]);

    expect(versions.get('nextrush')).toBe('^3.1.0');
    expect(versions.get('@nextrush/cors')).toBe('^3.1.0');
    expect(versions.get('@nextrush/dev')).toBe('^1.0.0');
    expect(versions.get('@nextrush/rate-limit')).toBe('^1.0.0');
    expect(versions.get('@nextrush/adapter-deno')).toBe('^1.0.0');

    // The specific regression this test exists to catch: @nextrush/dev must NEVER
    // be assigned nextrush's (or any other package's) version.
    expect(versions.get('@nextrush/dev')).not.toBe(versions.get('nextrush'));
  });

  it('resolves a scoped package on a different major line independently of an unscoped one', async () => {
    const { resolveVersions } = await import('../npm-version.js');

    const { versions } = await resolveVersions(['nextrush', '@nextrush/adapter-bun']);

    expect(versions.get('@nextrush/adapter-bun')).toBe('^1.0.0');
    expect(versions.get('nextrush')).toBe('^3.1.0');
  });
});
