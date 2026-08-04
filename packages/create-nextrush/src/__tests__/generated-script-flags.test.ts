import { describe, expect, it } from 'vitest';

import { generateProject } from '../generator.js';
import type { ProjectOptions, Runtime, Style } from '../types.js';
import { seedAllPackageVersions } from './test-helpers.js';

/**
 * Wave 3 runtime-honesty test (task 4.2 — F-02).
 *
 * Asserts NO generated script pins a transient `@latest` toolchain reference, and Deno
 * scripts request a scoped permission set rather than a blanket `-A`, across every runtime
 * this scaffolder offers.
 */
seedAllPackageVersions('^0.0.0');

function createOptions(overrides: Partial<ProjectOptions>): ProjectOptions {
  return {
    name: 'flags-app',
    directory: './flags-app',
    style: 'functional',
    runtime: 'node',
    middleware: 'minimal',
    packageManager: 'npm',
    git: false,
    install: false,
    ...overrides,
  };
}

const RUNTIMES: readonly Runtime[] = ['node', 'bun', 'deno'];
const STYLES: readonly Style[] = ['functional', 'class-based', 'full'];

describe('generated scripts avoid transient and over-broad flags (task 4.2)', () => {
  for (const runtime of RUNTIMES) {
    for (const style of STYLES) {
      it(`${runtime}/${style}: no script pins @latest for a toolchain package`, () => {
        const files = generateProject(createOptions({ runtime, style }));
        const pkg = JSON.parse(files.get('package.json')!) as { scripts: Record<string, string> };

        for (const script of Object.values(pkg.scripts)) {
          expect(script).not.toContain('@latest');
        }
      });
    }
  }

  for (const style of STYLES) {
    it(`deno/${style}: no script grants a blanket -A permission set`, () => {
      const files = generateProject(createOptions({ runtime: 'deno', style }));
      const pkg = JSON.parse(files.get('package.json')!) as { scripts: Record<string, string> };

      for (const script of Object.values(pkg.scripts)) {
        expect(script).not.toMatch(/(^|\s)-A(\s|$)/);
      }
    });

    it(`deno/${style}: dev/build scripts request a scoped, named permission set`, () => {
      const files = generateProject(createOptions({ runtime: 'deno', style }));
      const pkg = JSON.parse(files.get('package.json')!) as { scripts: Record<string, string> };

      for (const script of [pkg.scripts.dev, pkg.scripts.build]) {
        expect(script).toMatch(/--allow-net/);
        expect(script).toMatch(/--allow-read/);
        expect(script).toMatch(/--allow-env/);
        // --allow-sys: SWC's native binding under Deno >= 2.9 performs an `Object.uid`
        // os check during build; without it `nextrush build` fails with NotCapable.
        expect(script).toMatch(/--allow-sys/);
      }
    });
  }
});
