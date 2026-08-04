import { describe, expect, it } from 'vitest';

import { generateProject } from '../generator.js';
import type { ProjectOptions } from '../types.js';
import { seedAllPackageVersions } from './test-helpers.js';

/**
 * Wave 4 generated-config correctness (task 5.2 — F-08).
 *
 * Asserts a generated `package.json` declares `engines.node` (>= the framework floor) and a
 * `packageManager` entry for a non-npm manager (npm stays unset to avoid tripping users who
 * don't have Corepack enabled — see design.md's risk mitigation).
 */
function createOptions(overrides: Partial<ProjectOptions>): ProjectOptions {
  return {
    name: 'metadata-app',
    directory: './metadata-app',
    style: 'functional',
    runtime: 'node',
    middleware: 'minimal',
    packageManager: 'npm',
    git: false,
    install: false,
    ...overrides,
  };
}

describe('generated package.json carries production-ready metadata (task 5.2)', () => {
  it('declares engines.node >= 22.0.0', () => {
    seedAllPackageVersions('^0.0.0');
    const files = generateProject(createOptions({}));
    const pkg = JSON.parse(files.get('package.json')!) as { engines?: { node?: string } };

    expect(pkg.engines?.node).toBe('>=22.0.0');
  });

  it('omits packageManager for npm (avoids tripping users without Corepack)', () => {
    seedAllPackageVersions('^0.0.0');
    const files = generateProject(createOptions({ packageManager: 'npm' }));
    const pkg = JSON.parse(files.get('package.json')!) as { packageManager?: string };

    expect(pkg.packageManager).toBeUndefined();
  });

  it('omits packageManager for yarn so Yarn Classic (1.x) does not refuse to run', () => {
    seedAllPackageVersions('^0.0.0');
    const files = generateProject(createOptions({ packageManager: 'yarn' }));
    const pkg = JSON.parse(files.get('package.json')!) as { packageManager?: string };

    expect(pkg.packageManager).toBeUndefined();
  });

  it('omits packageManager for bun so pnpm does not reject the spec', () => {
    seedAllPackageVersions('^0.0.0');
    const files = generateProject(createOptions({ packageManager: 'bun', runtime: 'bun' }));
    const pkg = JSON.parse(files.get('package.json')!) as { packageManager?: string };

    expect(pkg.packageManager).toBeUndefined();
  });

  it('sets packageManager for pnpm (the one manager that validates and benefits from the pin)', () => {
    seedAllPackageVersions('^0.0.0');
    const files = generateProject(createOptions({ packageManager: 'pnpm' }));
    const pkg = JSON.parse(files.get('package.json')!) as { packageManager?: string };

    expect(pkg.packageManager).toMatch(/^pnpm@\d+\.\d+\.\d+$/);
  });
});
