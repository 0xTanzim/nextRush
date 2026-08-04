import { describe, expect, it } from 'vitest';

import { generateProject } from '../generator.js';
import type { ProjectOptions } from '../types.js';
import { seedAllPackageVersions } from './test-helpers.js';

function createOptions(overrides: Partial<ProjectOptions>): ProjectOptions {
  return {
    name: 'yarn-app',
    directory: './yarn-app',
    style: 'functional',
    runtime: 'node',
    middleware: 'minimal',
    packageManager: 'yarn',
    git: false,
    install: false,
    ...overrides,
  };
}

describe('generated .yarnrc.yml pins node-modules linker (yarn-berry PnP fix)', () => {
  it('emits .yarnrc.yml with nodeLinker: node-modules for yarn projects', () => {
    seedAllPackageVersions('^0.0.0');
    const files = generateProject(createOptions({}));

    expect(files.get('.yarnrc.yml')).toBe('nodeLinker: node-modules\n');
  });

  it('does not emit .yarnrc.yml for non-yarn package managers', () => {
    seedAllPackageVersions('^0.0.0');
    for (const pm of ['npm', 'pnpm', 'bun'] as const) {
      const files = generateProject(createOptions({ packageManager: pm }));
      expect(files.has('.yarnrc.yml')).toBe(false);
    }
  });

  it('emits .yarnrc.yml regardless of runtime', () => {
    seedAllPackageVersions('^0.0.0');
    for (const runtime of ['node', 'bun', 'deno'] as const) {
      const files = generateProject(createOptions({ runtime }));
      expect(files.get('.yarnrc.yml')).toBe('nodeLinker: node-modules\n');
    }
  });
});
