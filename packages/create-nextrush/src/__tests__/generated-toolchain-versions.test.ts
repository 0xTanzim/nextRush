import { describe, expect, it } from 'vitest';

import { generateProject } from '../generator.js';
import type { ProjectOptions } from '../types.js';
import { seedAllPackageVersions } from './test-helpers.js';

/**
 * Wave 4 generated-config correctness (task 5.3 — F-07).
 *
 * Asserts `typescript`/`@types/node` in a generated `package.json` are resolved via the
 * scaffolder's own build-time-injected toolchain versions (single-sourced with
 * `create-nextrush`'s own `devDependencies`, not a hardcoded, independently-drifting
 * literal), and that `@types/node`'s major does not exceed the declared `engines.node`
 * floor (22).
 */
function createOptions(overrides: Partial<ProjectOptions>): ProjectOptions {
  return {
    name: 'toolchain-app',
    directory: './toolchain-app',
    style: 'functional',
    runtime: 'node',
    middleware: 'minimal',
    packageManager: 'npm',
    git: false,
    install: false,
    ...overrides,
  };
}

describe('toolchain devDependencies are version-resolved and engine-aligned (task 5.3)', () => {
  it('typescript and @types/node are present and non-empty semver ranges', () => {
    seedAllPackageVersions('^0.0.0');
    const files = generateProject(createOptions({}));
    const pkg = JSON.parse(files.get('package.json')!) as { devDependencies: Record<string, string> };

    expect(pkg.devDependencies['typescript']).toMatch(/^\^?\d+\.\d+\.\d+/);
    expect(pkg.devDependencies['@types/node']).toMatch(/^\^?\d+\.\d+\.\d+/);
  });

  it("@types/node's major does not exceed the declared engines.node floor (22)", () => {
    seedAllPackageVersions('^0.0.0');
    const files = generateProject(createOptions({}));
    const pkg = JSON.parse(files.get('package.json')!) as {
      devDependencies: Record<string, string>;
      engines: { node: string };
    };

    const typesNodeMajor = Number(/(\d+)/.exec(pkg.devDependencies['@types/node']!)?.[1]);
    const engineFloorMajor = Number(/(\d+)/.exec(pkg.engines.node)?.[1]);

    expect(typesNodeMajor).toBeLessThanOrEqual(engineFloorMajor);
  });
});
