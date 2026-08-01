import { describe, expect, it } from 'vitest';

/**
 * Single-instance verification (openspec/changes/framework-composition-integrity, task 5.7).
 *
 * `nextrush/class` dynamically imports `@nextrush/di` and `@nextrush/class` once, at module
 * evaluation time. Node's ESM module cache guarantees a single instance per unique resolved
 * specifier for the lifetime of the process — dynamic `import()` does not bypass that cache, it
 * uses the same module registry as a static import. So there is exactly one `reflect-metadata`
 * global patch and one default DI container, matching the guarantee the root README documents
 * (no ESM/CJS dual-package hazard) — this test proves it holds through the optional-peer
 * refactor, not just that it held before it.
 */
describe('single DI/reflect-metadata instance across nextrush/class and @nextrush/class', () => {
  it('the container re-exported by nextrush/class is the same object as @nextrush/class exports directly', async () => {
    const viaMeta = await import('../class.js');
    const viaDirect = await import('@nextrush/class');

    expect(viaMeta.container).toBe(viaDirect.container);
  });

  it('@nextrush/di resolves to the same module instance whether imported directly or via the meta subpath', async () => {
    // Both `nextrush/class` and a direct `@nextrush/di` import resolve through Node's module
    // cache to the identical module object — proven by comparing a re-exported binding.
    const viaMeta = await import('../class.js');
    const diDirect = await import('@nextrush/di');

    expect(viaMeta.createContainer).toBe(diDirect.createContainer);
  });
});
