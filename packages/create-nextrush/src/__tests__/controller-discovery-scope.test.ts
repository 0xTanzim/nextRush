import { describe, expect, it } from 'vitest';

import { generateProject } from '../generator.js';
import type { ProjectOptions, Style } from '../types.js';
import { seedAllPackageVersions } from './test-helpers.js';

/**
 * Wave 5 conventions (task 6.1 — F-11).
 *
 * Asserts controller auto-discovery is scoped to the controllers directory
 * (`root: './src/controllers'`), not the whole `src` tree — so discovery never imports
 * non-controller files (routes, services) or the entry module itself.
 *
 * Only the `full` template uses filesystem discovery: the class-based template composes
 * controllers explicitly via `@Module`/`registerModule` (no discovery scope to constrain).
 */
function createOptions(overrides: Partial<ProjectOptions>): ProjectOptions {
  return {
    name: 'glob-app',
    directory: './glob-app',
    style: 'class-based',
    runtime: 'node',
    middleware: 'minimal',
    packageManager: 'npm',
    git: false,
    install: false,
    ...overrides,
  };
}

const STYLES_WITH_CONTROLLERS: readonly Style[] = ['full'];

describe('controller auto-discovery is scoped to the controllers directory (task 6.1)', () => {
  for (const style of STYLES_WITH_CONTROLLERS) {
    it(`${style}: discovery root targets src/controllers, not the whole src tree`, () => {
      seedAllPackageVersions('^0.0.0');
      const files = generateProject(createOptions({ style }));
      const entry = files.get('src/index.ts')!;

      expect(entry).toContain("? './dist/controllers' : './src/controllers'");
      expect(entry).not.toContain("? './dist' : './src';");
    });
  }
});
