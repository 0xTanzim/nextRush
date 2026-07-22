import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Wave 5 conventions (task 6.5 — F-14, F-15, F-18).
 *
 * `index.ts` runs `main()` as a module-level side effect (see `public-surface.test.ts`), so
 * these are SOURCE-level assertions on the CLI entry file rather than behavioral imports —
 * the same testing shape `public-surface.test.ts` already uses for this file.
 */
const indexSource = readFileSync(fileURLToPath(new URL('../index.ts', import.meta.url)), 'utf-8');

describe('CLI onboarding is coherent and honest (task 6.5)', () => {
  it('F-14: outro uses correct NextRush branding (capital R), not "Nextrush"', () => {
    expect(indexSource).toContain('NextRush');
    expect(indexSource).not.toMatch(/Happy coding with Nextrush/);
  });

  it('F-15: next steps include the URL to open for the selected style', () => {
    expect(indexSource).toContain('getVerificationUrl');
    expect(indexSource).toMatch(/localhost:8080\/health/);
    expect(indexSource).toMatch(/localhost:8080\/api\/health/);
  });

  it('F-18: the version probe is gated on install (skipped when --no-install)', () => {
    // The probe still resolves a version map either way (constants/templates need SOME
    // map even for offline generation), but the SPINNER/network-latency-signalling path
    // ("Checking latest versions...") must only run when an install will actually happen —
    // this is the literal Doherty-Threshold complaint the review named.
    expect(indexSource).toMatch(/if \(args\.install\)/);
    expect(indexSource).toContain('Checking latest versions...');
  });
});
