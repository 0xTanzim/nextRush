import { describe, expect, it } from 'vitest';

import { generateProject } from '../generator.js';
import type { ProjectOptions } from '../types.js';
import { seedAllPackageVersions } from './test-helpers.js';

/**
 * Group 4 RED (task 4.1) — generated-project lint gate acceptance.
 *
 * The production preset currently emits `eslint.config.mjs` importing `@eslint/js` +
 * `typescript-eslint`, neither of which the generated manifest declares — the emitted
 * lint gate cannot run on a fresh install. These four tests pin the target contract:
 * (a) every package the emitted lint config imports is declared in the generated
 *     manifest; (b) the emitted editor recommendation names the configured linter;
 * (c) the emitted compiler range is on the framework's current compiler major;
 * (d) the file map carries the Oxlint config, not the ESLint one.
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
    expect(files.has('.oxlintrc.json')).toBe(true);
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
    expect(base.has('.oxlintrc.json')).toBe(false);
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

describe('generated lint gate (task 4.1 — RED against the ESLint emitter)', () => {
  it('(d) the file map carries the Oxlint config, not the ESLint one', () => {
    seedAllPackageVersions('^0.0.0');
    const files = generateProject(createOptions({ preset: 'production' }));

    expect(files.has('.oxlintrc.json')).toBe(true);
    expect(files.has('eslint.config.mjs')).toBe(false);
  });

  it('(a) every package the emitted lint config imports is a declared devDependency', () => {
    seedAllPackageVersions('^0.0.0');
    const files = generateProject(createOptions({ preset: 'production' }));
    const pkg = JSON.parse(files.get('package.json')!) as {
      devDependencies: Record<string, string>;
    };
    const config = files.get('.oxlintrc.json')!;

    // The emitted JSON config must be dependency-free (no imports at all), so the
    // generated lint script can run with `oxlint` alone — no undeclared package.
    const bareImports = [...config.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    expect(bareImports).toEqual([]);
    expect(pkg.devDependencies['oxlint']).toMatch(/^\^?\d+\.\d+\.\d+/);
  });

  it('(b) the emitted editor recommendation names the Oxlint extension', () => {
    seedAllPackageVersions('^0.0.0');
    const files = generateProject(createOptions({ preset: 'production' }));
    const extensions = JSON.parse(files.get('.vscode/extensions.json')!) as {
      recommendations: string[];
    };

    expect(extensions.recommendations).toContain('oxc.oxc-vscode');
    expect(extensions.recommendations).not.toContain('dbaeumer.vscode-eslint');
  });

  it('(c) the emitted typescript range is on the framework compiler major (7)', () => {
    seedAllPackageVersions('^0.0.0');
    const files = generateProject(createOptions({ preset: 'production' }));
    const pkg = JSON.parse(files.get('package.json')!) as {
      devDependencies: Record<string, string>;
    };

    expect(pkg.devDependencies['typescript']).toMatch(/^\^?7\./);
  });

  it('(task 4.5) the generated lint script runs the emitted config as written', () => {
    seedAllPackageVersions('^0.0.0');
    const files = generateProject(createOptions({ preset: 'production' }));
    const pkg = JSON.parse(files.get('package.json')!) as {
      scripts: Record<string, string>;
    };

    // The documented command must exist and invoke the configured linter — the
    // generated docs reference `npm run <script>`, so the script name is contract.
    expect(pkg.scripts['lint']).toMatch(/oxlint/);
  });

  it('(task 4.4) the offline fallback path stays on the framework compiler major (7)', () => {
    // Dev-mode (no build-time injection) IS the offline-fallback shape: the
    // `__TYPESCRIPT_RANGE__` define is absent under vitest, so getToolchainRange
    // returns its hardcoded fallback — it must never be a stale older line.
    seedAllPackageVersions('^0.0.0');
    const files = generateProject(createOptions({ preset: 'production' }));
    const pkg = JSON.parse(files.get('package.json')!) as {
      devDependencies: Record<string, string>;
    };

    expect(pkg.devDependencies['typescript']).toMatch(/^\^?7\./);
    expect(pkg.devDependencies['oxlint']).toMatch(/^\^?\d+\.\d+\.\d+/);
  });
});
