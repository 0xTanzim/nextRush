import { describe, expect, it } from 'vitest';

/**
 * Subpath resolution-guard test (framework-composition-integrity, capability:
 * framework-composition, requirement "The nextrush/class subpath fails with an actionable
 * error when its peers are absent").
 *
 * Cannot literally uninstall `@nextrush/class` from this monorepo's node_modules to test a
 * true module-not-found in-process (it is a workspace package resolved by pnpm regardless of
 * the optional-peer declaration). Instead this test exercises the guard function directly —
 * the same function `class.ts` calls at load time — proving it produces the required,
 * actionable message shape without depending on the package manager's resolution behavior.
 */
describe('nextrush/class resolution guard', () => {
  it('names the missing package and the exact install command when the peer resolution fails', async () => {
    const { describeMissingClassPeerError } = await import('../class-peer-guard.js');

    const message = describeMissingClassPeerError(new Error("Cannot find module '@nextrush/class'"));

    expect(message).toContain('@nextrush/class');
    expect(message).toContain('reflect-metadata');
    expect(message).toMatch(/pnpm add @nextrush\/class reflect-metadata/);
  });

  it('passes through an unrelated error unchanged (only guards the specific missing-peer case)', async () => {
    const { describeMissingClassPeerError } = await import('../class-peer-guard.js');
    const unrelated = new Error('a totally unrelated failure');

    expect(describeMissingClassPeerError(unrelated)).toBeNull();
  });
});
