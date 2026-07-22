import { describe, expect, it } from 'vitest';

import { generateProject } from '../generator.js';
import type { ProjectOptions } from '../types.js';
import { seedAllPackageVersions } from './test-helpers.js';

/**
 * Wave 3 runtime-honesty test (task 4.3 — F-04 / design.md D5).
 *
 * Asserts the generated `bun` + `class-based` project's `tsconfig` carries the decorator
 * flags Bun needs, and its `build` script routes through the `@nextrush/dev` toolchain
 * (`nextrush build`) rather than a raw `Bun.build` invocation the scaffolder would have to
 * maintain itself.
 *
 * This deliberately does NOT add a second Bun decorator-metadata CONFORMANCE test — that
 * guarantee ("does `Bun.build` actually emit `design:paramtypes`?") is owned and enforced by
 * `dev-tooling`'s own build-conformance suite
 * (`packages/dev/src/__tests__/build-bun-decorator-integration.test.ts`, RFC-019 task 2.4).
 * Duplicating it here would re-verify another capability's contract instead of this one's
 * (design.md D5: "Bun is a consumption boundary, not new work here").
 */
seedAllPackageVersions('^0.0.0');

function createOptions(overrides: Partial<ProjectOptions>): ProjectOptions {
  return {
    name: 'bun-app',
    directory: './bun-app',
    style: 'class-based',
    runtime: 'bun',
    middleware: 'minimal',
    packageManager: 'bun',
    git: false,
    install: false,
    ...overrides,
  };
}

describe('Bun class-based project carries decorator flags and routes through the toolchain (task 4.3)', () => {
  it('tsconfig carries experimentalDecorators + emitDecoratorMetadata', () => {
    const files = generateProject(createOptions({}));
    const tsconfig = JSON.parse(files.get('tsconfig.json')!) as {
      compilerOptions: Record<string, unknown>;
    };

    expect(tsconfig.compilerOptions['experimentalDecorators']).toBe(true);
    expect(tsconfig.compilerOptions['emitDecoratorMetadata']).toBe(true);
  });

  it('build script routes through `nextrush build` (the dev-tooling toolchain), not a raw Bun.build call', () => {
    const files = generateProject(createOptions({}));
    const pkg = JSON.parse(files.get('package.json')!) as { scripts: Record<string, string> };

    expect(pkg.scripts.build).toContain('nextrush build');
  });
});
