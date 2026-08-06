import { describe, expect, it } from 'vitest';

import { generateProject } from '../generator.js';
import type { ProjectOptions, Style } from '../types.js';
import { seedAllPackageVersions } from './test-helpers.js';

/**
 * Wave 4 generated-config correctness (task 5.5 — F-10).
 *
 * Asserts the generated project's README "Project Structure" section is derived from the
 * ACTUAL emitted `FileMap` — so it can never list a file the generator didn't produce (the
 * `not-found.ts` drift the review found) and always matches the ACTUAL per-style layout
 * (previously every non-`functional` style still showed the functional structure).
 */
function createOptions(overrides: Partial<ProjectOptions>): ProjectOptions {
  return {
    name: 'readme-app',
    directory: './readme-app',
    style: 'functional',
    runtime: 'node',
    middleware: 'minimal',
    packageManager: 'npm',
    git: false,
    install: false,
    ...overrides,
  };
}

const STYLES: readonly Style[] = ['functional', 'class-based', 'full'];

describe('generated README structure matches the emitted FileMap exactly (task 5.5)', () => {
  for (const style of STYLES) {
    it(`${style}: README lists exactly the emitted src/ files, nothing more`, () => {
      seedAllPackageVersions('^0.0.0');
      const files = generateProject(createOptions({ style }));
      const readme = files.get('README.md')!;

      const emittedSrcFiles = [...files.keys()].filter((p) => p.startsWith('src/'));
      for (const path of emittedSrcFiles) {
        expect(readme).toContain(path);
      }

      // The README's structure listing also reflects root-level env files actually emitted
      // (no phantom .env for Deno, which gets .env.example only).
      const emittedEnvFiles = [...files.keys()].filter((p) => p === '.env' || p === '.env.example');
      for (const path of emittedEnvFiles) {
        expect(readme).toContain(path);
      }
      if (files.has('.env')) {
        expect(readme).toContain('.env');
      } else {
        expect(readme).not.toContain('\n.env\n');
      }

      // The specific regression this test exists to catch: no phantom file that was
      // never emitted (e.g. `not-found.ts`, which the `full` style never generates).
      expect(readme).not.toContain('not-found.ts');
    });
  }
});
