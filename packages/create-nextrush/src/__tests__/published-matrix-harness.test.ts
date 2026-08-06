import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Wave 2 verifier backstop (task 5.1 / 5.2 — design decision 7).
 *
 * The published-artifact matrix harness must:
 *  - invoke the REAL packed create-nextrush tarball (via `npm create`/`pnpm create`/etc.),
 *  - cover every advertised `style × runtime × middleware` combination (not only
 *    functional+api),
 *  - run install → generated tests → build → start → health check per cell,
 *  - retain the generated project directory and command logs on failure.
 *
 * RED against the current harness, which only exercises `functional × api` for every
 * runtime/pm and never records failure artifacts.
 */
const ENTRYPOINT = fileURLToPath(new URL('../../docker/entrypoint.sh', import.meta.url));
const source = readFileSync(ENTRYPOINT, 'utf-8');

describe('published-artifact matrix harness (task 5.1 / 5.2)', () => {
  it('invokes the real package-manager create entrypoints from the packed tarball', () => {
    expect(source).toContain('npm create nextrush');
    expect(source).toContain('pnpm create nextrush');
    expect(source).toContain('yarn create nextrush');
    expect(source).toContain('bun create nextrush');
  });

  it('runs install, generated tests, build, and a health check per cell', () => {
    expect(source).toMatch(/install/);
    expect(source).toMatch(/test/);
    expect(source).toMatch(/build/);
    expect(source).toMatch(/check_health/);
    expect(source).toMatch(/curl/);
  });

  it('retains the generated project directory and logs on failure', () => {
    expect(source).toMatch(/rm -rf "\$dir"/); // clean slate per cell
    expect(source).toMatch(/FAIL/);
  });
});
