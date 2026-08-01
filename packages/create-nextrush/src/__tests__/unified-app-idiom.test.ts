import { describe, expect, it } from 'vitest';

import { generateProject } from '../generator.js';
import type { ProjectOptions, Style } from '../types.js';
import { seedAllPackageVersions } from './test-helpers.js';

/**
 * Wave 5 conventions (task 6.3 — F-17, F-19).
 *
 * Asserts every style uses the SAME app-construction idiom (`createApp({ router })`, not
 * `createApp()` + a separately mounted router — two shapes for one concept), and that the
 * generated `tsconfig` no longer defaults to library-shaped `declaration`/`declarationMap`
 * for a `private: true` app.
 */
function createOptions(overrides: Partial<ProjectOptions>): ProjectOptions {
  return {
    name: 'idiom-app',
    directory: './idiom-app',
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

describe('templates share one app-construction idiom and a lean app tsconfig (task 6.3)', () => {
  for (const style of STYLES) {
    it(`${style}: uses createApp({ router }), not createApp() + a separate mount`, () => {
      seedAllPackageVersions('^0.0.0');
      const files = generateProject(createOptions({ style }));
      const entry = files.get('src/index.ts')!;

      expect(entry).toContain('createApp({ router })');
      expect(entry).not.toContain('createApp()');
    });

    it(`${style}: tsconfig does not emit declaration/declarationMap for a private app`, () => {
      seedAllPackageVersions('^0.0.0');
      const files = generateProject(createOptions({ style }));
      const tsconfig = JSON.parse(files.get('tsconfig.json')!) as {
        compilerOptions: Record<string, unknown>;
      };

      expect(tsconfig.compilerOptions['declaration']).toBe(false);
      expect(tsconfig.compilerOptions['declarationMap']).toBe(false);
    });
  }
});
