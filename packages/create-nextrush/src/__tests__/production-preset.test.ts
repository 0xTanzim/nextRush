import { describe, expect, it } from 'vitest';

import { generateProject } from '../generator.js';
import type { ProjectOptions } from '../types.js';
import { seedAllPackageVersions } from './test-helpers.js';

/**
 * Wave 2 verifier backstop (task 4.1 / 4.2 — design decision 6).
 *
 * The production-service preset is an ADDITIVE file-map contribution: with
 * `preset: 'production'`, the generated project gains editor settings, formatter/linter
 * config, CI validation, container files, ignore entries, and production/health docs.
 * Without it, the base starter output is byte-for-byte unchanged.
 *
 * RED against the current generator, which ignores `preset` entirely.
 */
function createOptions(overrides: Partial<ProjectOptions> = {}): ProjectOptions {
  return {
    name: 'prod-app',
    directory: './prod-app',
    style: 'functional',
    runtime: 'node',
    middleware: 'minimal',
    packageManager: 'npm',
    git: false,
    install: false,
    ...overrides,
  };
}

describe('production-service preset file map (task 4.1)', () => {
  it('adds editor settings, formatter/linter, CI, container, and ops artifacts', () => {
    seedAllPackageVersions('^0.0.0');
    const files = generateProject(createOptions({ preset: 'production' }));

    // Editor settings
    expect(files.has('.editorconfig')).toBe(true);
    expect(files.has('.vscode/extensions.json')).toBe(true);
    // Formatter/linter
    expect(files.has('eslint.config.mjs')).toBe(true);
    // CI validation
    expect(files.has('.github/workflows/ci.yml')).toBe(true);
    // Container files
    expect(files.has('Dockerfile')).toBe(true);
    expect(files.has('.dockerignore')).toBe(true);
    // Production/health documentation
    expect(files.has('docs/production.md')).toBe(true);
  });

  it('preset artifacts reference the generated scripts and health endpoint', () => {
    seedAllPackageVersions('^0.0.0');
    const files = generateProject(createOptions({ preset: 'production' }));

    const ci = files.get('.github/workflows/ci.yml')!;
    expect(ci).toMatch(/build|test/i);
    expect(ci).toContain('health');

    const dockerfile = files.get('Dockerfile')!;
    expect(dockerfile).toMatch(/build|start/i);

    const prodDocs = files.get('docs/production.md')!;
    expect(prodDocs).toMatch(/health/i);
    expect(prodDocs).toMatch(/production/i);
  });

  it('base starter output is unchanged when the preset is not selected', () => {
    seedAllPackageVersions('^0.0.0');
    const base = generateProject(createOptions({}));

    expect(base.has('.editorconfig')).toBe(false);
    expect(base.has('eslint.config.mjs')).toBe(false);
    expect(base.has('.github/workflows/ci.yml')).toBe(false);
    expect(base.has('Dockerfile')).toBe(false);
    expect(base.has('docs/production.md')).toBe(false);
  });

  it('works for every supported runtime (no unsupported-combination refusal)', () => {
    seedAllPackageVersions('^0.0.0');
    for (const runtime of ['node', 'bun', 'deno'] as const) {
      const files = generateProject(createOptions({ preset: 'production', runtime }));
      expect(files.has('Dockerfile')).toBe(true);
      expect(files.has('.editorconfig')).toBe(true);
    }
  });
});
