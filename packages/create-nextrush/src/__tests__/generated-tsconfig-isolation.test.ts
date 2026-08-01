import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { generateProject } from '../generator.js';
import type { ProjectOptions } from '../types.js';
import { writeFiles } from '../utils.js';
import { seedAllPackageVersions } from './test-helpers.js';

/**
 * Wave 4 generated-config correctness (task 5.1 — F-06).
 *
 * Asserts the generated `tsconfig.json` carries `isolatedModules` + `verbatimModuleSyntax`
 * (the guards a per-file SWC transpiler needs — see templates/tsconfig.ts), and that a
 * type-only re-export mistake SWC would mistranspile is caught by `tsc --noEmit` against
 * the generated config.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WORKSPACE_ROOT = resolve(__dirname, '../../../../');
const FIXTURE_NODE_MODULES = join(WORKSPACE_ROOT, 'examples', 'dev-cli-fixture', 'node_modules');

function createOptions(overrides: Partial<ProjectOptions>): ProjectOptions {
  return {
    name: 'tsconfig-app',
    directory: './tsconfig-app',
    style: 'functional',
    runtime: 'node',
    middleware: 'minimal',
    packageManager: 'npm',
    git: false,
    install: false,
    ...overrides,
  };
}

describe('generated tsconfig is safe for a per-file transpiler (task 5.1)', () => {
  let projectDir: string;

  afterEach(() => {
    if (projectDir) rmSync(projectDir, { recursive: true, force: true });
  });

  it('includes isolatedModules and verbatimModuleSyntax', () => {
    seedAllPackageVersions('^0.0.0');
    const files = generateProject(createOptions({}));
    const tsconfig = JSON.parse(files.get('tsconfig.json')!) as {
      compilerOptions: Record<string, unknown>;
    };

    expect(tsconfig.compilerOptions['isolatedModules']).toBe(true);
    expect(tsconfig.compilerOptions['verbatimModuleSyntax']).toBe(true);
  });

  it('tsc --noEmit catches a type-only re-export written without `export type`', () => {
    seedAllPackageVersions('^0.0.0');
    projectDir = mkdtempSync(join(tmpdir(), 'nextrush-tsconfig-smoke-'));
    const files = generateProject(createOptions({}));
    writeFiles(projectDir, files);
    symlinkSync(FIXTURE_NODE_MODULES, join(projectDir, 'node_modules'), 'dir');

    // A construct SWC would mistranspile: re-exporting a type without `export type`.
    // Under `verbatimModuleSyntax`, `tsc` rejects this at type-check time.
    writeFileSync(join(projectDir, 'src', 'types.ts'), 'export interface Widget { id: string }\n');
    writeFileSync(
      join(projectDir, 'src', 'bad-reexport.ts'),
      "export { Widget } from './types.js';\n"
    );

    let stderr = '';
    try {
      execFileSync('npx', ['tsc', '--noEmit'], { cwd: projectDir, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      stderr =
        error && typeof error === 'object' && 'stdout' in error
          ? String((error as { stdout: Buffer | string }).stdout)
          : '';
    }

    expect(stderr).toMatch(/TS1205|isolatedModules/);
  });
});
