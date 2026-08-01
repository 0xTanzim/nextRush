import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Wave 4 generated-config correctness (task 5.4 — F-09).
 *
 * Asserts version resolution honors `npm_config_registry` before defaulting to
 * `registry.npmjs.org`, so the CLI works behind a private registry/proxy.
 */
describe('version resolution honors the configured registry (task 5.4)', () => {
  const originalFetch = globalThis.fetch;
  const originalRegistryEnv = process.env['npm_config_registry'];
  let requestedUrls: string[] = [];

  beforeEach(() => {
    requestedUrls = [];
    globalThis.fetch = vi.fn((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString();
      requestedUrls.push(url);
      return Promise.resolve(
        new Response(JSON.stringify({ version: '1.2.3' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalRegistryEnv === undefined) {
      delete process.env['npm_config_registry'];
    } else {
      process.env['npm_config_registry'] = originalRegistryEnv;
    }
    vi.resetModules();
  });

  it('probes the configured non-default registry, not registry.npmjs.org', async () => {
    process.env['npm_config_registry'] = 'https://private-registry.internal/npm';
    const { resolveVersions } = await import('../npm-version.js');

    await resolveVersions(['nextrush']);

    expect(requestedUrls).toHaveLength(1);
    expect(requestedUrls[0]).toContain('https://private-registry.internal/npm');
    expect(requestedUrls[0]).not.toContain('registry.npmjs.org');
  });

  it('defaults to registry.npmjs.org when no registry is configured', async () => {
    delete process.env['npm_config_registry'];
    const { resolveVersions } = await import('../npm-version.js');

    await resolveVersions(['nextrush']);

    expect(requestedUrls[0]).toContain('registry.npmjs.org');
  });
});
