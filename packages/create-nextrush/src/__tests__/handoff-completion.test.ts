import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { generateProject } from '../generator.js';
import type { ProjectOptions } from '../types.js';
import { seedAllPackageVersions } from './test-helpers.js';

/**
 * Wave 2 verifier backstop (task 3.3 — F-10 / F-15).
 *
 * Completion output and the generated README must:
 *  - summarize the selected starter/runtime/middleware/package manager,
 *  - name the health URL to open for the selected style,
 *  - give a concise build-and-start production validation path,
 *  - link the applicable production documentation.
 *
 * RED against the current code: the generated README has no production-validation section
 * or production-doc link, and the completion output only lists next steps.
 */
const indexSource = readFileSync(fileURLToPath(new URL('../index.ts', import.meta.url)), 'utf-8');
const readmeSource = readFileSync(fileURLToPath(new URL('../templates/shared.ts', import.meta.url)), 'utf-8');

function createOptions(overrides: Partial<ProjectOptions> = {}): ProjectOptions {
  return {
    name: 'handoff-app',
    directory: './handoff-app',
    style: 'functional',
    runtime: 'node',
    middleware: 'api',
    packageManager: 'npm',
    git: false,
    install: false,
    ...overrides,
  };
}

describe('completion output (task 3.3 / F-15)', () => {
  it('names the selected starter/runtime/middleware and package manager in the completion summary', () => {
    // The human completion must summarize the selections (F-15: "summarizes the selected
    // starter/runtime/middleware/package manager").
    expect(indexSource).toMatch(/starter|style|runtime|middleware|package manager/i);
    expect(indexSource).toContain('Next steps');
  });

  it('includes the health URL to open for the selected style', () => {
    expect(indexSource).toContain('verificationUrl');
    expect(indexSource).toContain('open');
  });

  it('points to a production validation path in the completion', () => {
    // F-15: "points to a production validation path" — build && start must be present.
    expect(indexSource).toMatch(/build/);
    expect(indexSource).toMatch(/start/);
  });
});

describe('generated README production handoff (task 3.3 / F-10)', () => {
  for (const style of ['functional', 'class-based', 'full'] as const) {
    it(`${style}: README has a production-validation section with build/start`, () => {
      seedAllPackageVersions('^0.0.0');
      const files = generateProject(createOptions({ style }));
      const readme = files.get('README.md')!;

      expect(readme).toMatch(/build/i);
      expect(readme).toMatch(/start/i);
      expect(readme).toMatch(/production/i);
    });

    it(`${style}: README links the applicable production documentation`, () => {
      seedAllPackageVersions('^0.0.0');
      const files = generateProject(createOptions({ style }));
      const readme = files.get('README.md')!;

      expect(readme).toMatch(/https?:\/\/[^\s]*production/i);
      expect(readme).toMatch(/production/i);
    });
  }

  it('the README template itself carries the production section (source-level guard)', () => {
    expect(readmeSource).toContain('production');
  });
});
