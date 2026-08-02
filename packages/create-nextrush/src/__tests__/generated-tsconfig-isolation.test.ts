import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { generateProject } from '../generator.js';
import { generateTsconfig } from '../templates/tsconfig.js';
import type { ProjectOptions } from '../types.js';
import { writeFiles } from '../utils.js';
import { seedAllPackageVersions } from './test-helpers.js';

/**
 * Wave 4 generated-config correctness (task 5.1 — F-06).
 *
 * Asserts the generated `tsconfig.json` carries `isolatedModules` + `verbatimModuleSyntax`
 * (the guards a per-file SWC transpiler needs — see templates/tsconfig.ts), pins
 * `types: ["node"]` (TS >= 6 no longer auto-includes `@types/*` — issue #40), and that a
 * type-only re-export mistake SWC would mistranspile is caught by `tsc --noEmit` against
 * the generated config.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WORKSPACE_ROOT = resolve(__dirname, '../../../../');

/**
 * Build a self-contained `node_modules` for a temp smoke project: typescript,
 * `@types/node`, and (optionally) `nextrush` via symlinked realpaths.
 *
 * A real dir (not a symlink to `examples/dev-cli-fixture/node_modules`) is deliberate:
 * the fixture has no `@types/` at all, and writing through a fixture symlink would
 * pollute the shared fixture. Raw package-dir symlinks do not populate
 * `node_modules/.bin`, so `npx tsc` cannot find the compiler — the smokes run
 * `node node_modules/typescript/bin/tsc` directly instead.
 */
function installSmokeToolchain(projectDir: string, opts: { withNextrush?: boolean } = {}): void {
  const nm = join(projectDir, 'node_modules');
  mkdirSync(nm, { recursive: true });
  symlinkSync(realpathSync(join(WORKSPACE_ROOT, 'node_modules', 'typescript')), join(nm, 'typescript'), 'dir');
  mkdirSync(join(nm, '@types'), { recursive: true });
  symlinkSync(
    realpathSync(join(WORKSPACE_ROOT, 'node_modules', '@types', 'node')),
    join(nm, '@types', 'node'),
    'dir'
  );
  if (opts.withNextrush) {
    symlinkSync(realpathSync(join(WORKSPACE_ROOT, 'packages', 'nextrush')), join(nm, 'nextrush'), 'dir');
  }
}

/** Run the smoke project's own tsc in `--noEmit` mode; returns captured stdout or null on success. */
function runTsc(projectDir: string): string | null {
  const tscBin = join(projectDir, 'node_modules', 'typescript', 'bin', 'tsc');
  try {
    execFileSync(process.execPath, [tscBin, '--noEmit'], { cwd: projectDir, stdio: ['ignore', 'pipe', 'pipe'] });
    return null;
  } catch (caught) {
    const err = caught as { stdout?: Buffer | string };
    return err.stdout?.toString() ?? '';
  }
}

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

  it('pins compilerOptions.types to node (TS >= 6 no longer auto-includes @types/*)', () => {
    seedAllPackageVersions('^0.0.0');
    const files = generateProject(createOptions({}));
    const tsconfig = JSON.parse(files.get('tsconfig.json')!) as {
      compilerOptions: { types?: unknown };
    };

    expect(tsconfig.compilerOptions.types).toEqual(['node']);
  });

  it('tsc --noEmit passes on a clean generated tsconfig with a process-using file', () => {
    seedAllPackageVersions('^0.0.0');
    projectDir = mkdtempSync(join(tmpdir(), 'nextrush-tsconfig-types-'));
    writeFileSync(join(projectDir, 'package.json'), '{ "name": "smoke", "private": true, "type": "module" }\n');
    writeFileSync(join(projectDir, 'tsconfig.json'), generateTsconfig(false));
    mkdirSync(join(projectDir, 'src'));
    // The functional template's generated entry uses process.uptime(); TS >= 6 with no
    // `types` pin fails this with TS2591 even though @types/node is installed (issue #40).
    writeFileSync(
      join(projectDir, 'src', 'index.ts'),
      "export function uptime(): number { return process.uptime(); }\n"
    );
    installSmokeToolchain(projectDir);

    const output = runTsc(projectDir);
    expect(output, `tsc --noEmit failed:\n${output ?? ''}`).toBeNull();
  });

  it('tsc --noEmit catches a type-only re-export written without `export type`', () => {
    seedAllPackageVersions('^0.0.0');
    projectDir = mkdtempSync(join(tmpdir(), 'nextrush-tsconfig-smoke-'));
    const files = generateProject(createOptions({}));
    writeFiles(projectDir, files);
    installSmokeToolchain(projectDir, { withNextrush: true });

    // A construct SWC would mistranspile: re-exporting a type without `export type`.
    // Under `verbatimModuleSyntax`, `tsc` rejects this at type-check time.
    writeFileSync(join(projectDir, 'src', 'types.ts'), 'export interface Widget { id: string }\n');
    writeFileSync(
      join(projectDir, 'src', 'bad-reexport.ts'),
      "export { Widget } from './types.js';\n"
    );

    const output = runTsc(projectDir) ?? '';
    expect(output).toMatch(/TS1205|isolatedModules/);
  });
});
