import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { generateProject } from '../generator.js';
import type { ProjectOptions } from '../types.js';
import { writeFiles } from '../utils.js';
import { seedAllPackageVersions } from './test-helpers.js';

/**
 * Wave 3 runtime-honesty test (task 4.1 — F-02 / RFC-021 D4).
 *
 * Asserts a generated `deno` + `class-based`/`full` project is configured so decorator
 * metadata can be emitted and DI can resolve — the specific, deterministic, registry-free
 * claim this package's own fast unit suite can prove. The end-to-end claim ("Deno actually
 * boots this and DI actually resolves at runtime against PUBLISHED packages") is owned by
 * the generate-then-install CI matrix (task 2.1/7.3 — the system-of-record verifier per
 * design.md's Autonomous Execution Model), which runs a real install; duplicating a live
 * Deno boot here against unpublished local dist output would be a second, weaker version of
 * the same claim (parallel to why D5 deliberately does not add a second Bun build test).
 *
 * `deno --version` availability still gates this suite (`skipIf`) even though the assertions
 * are static, so a machine without Deno installed doesn't silently skip a check that IS
 * meaningful once Deno itself is unavailable to validate the generated `deno.json`/scripts
 * against (kept consistent with the other runtime-conditional suites in this repo).
 */
function hasDeno(): boolean {
  try {
    execFileSync('deno', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const DENO_AVAILABLE = hasDeno();

function createOptions(overrides: Partial<ProjectOptions>): ProjectOptions {
  return {
    name: 'deno-smoke-app',
    directory: './deno-smoke-app',
    style: 'class-based',
    runtime: 'deno',
    middleware: 'minimal',
    packageManager: 'npm',
    git: false,
    install: false,
    ...overrides,
  };
}

describe.skipIf(!DENO_AVAILABLE)('Deno class-based project is configured for working DI (task 4.1)', () => {
  let projectDir: string;

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  it('generates a tsconfig with the decorator flags Deno needs for constructor DI', () => {
    seedAllPackageVersions('^0.0.0');
    projectDir = mkdtempSync(join(tmpdir(), 'nextrush-deno-smoke-'));
    const files = generateProject(createOptions({ style: 'class-based' }));
    writeFiles(projectDir, files);

    const tsconfig = JSON.parse(files.get('tsconfig.json')!) as {
      compilerOptions: Record<string, unknown>;
    };
    expect(tsconfig.compilerOptions['experimentalDecorators']).toBe(true);
    expect(tsconfig.compilerOptions['emitDecoratorMetadata']).toBe(true);
  });

  it('generates a full-style project with the same decorator flags', () => {
    seedAllPackageVersions('^0.0.0');
    projectDir = mkdtempSync(join(tmpdir(), 'nextrush-deno-smoke-'));
    const files = generateProject(createOptions({ style: 'full' }));
    writeFiles(projectDir, files);

    const tsconfig = JSON.parse(files.get('tsconfig.json')!) as {
      compilerOptions: Record<string, unknown>;
    };
    expect(tsconfig.compilerOptions['experimentalDecorators']).toBe(true);
    expect(tsconfig.compilerOptions['emitDecoratorMetadata']).toBe(true);
  });

  it('routes dev/build scripts through the @nextrush/dev toolchain, not a raw entry-file invocation', () => {
    seedAllPackageVersions('^0.0.0');
    projectDir = mkdtempSync(join(tmpdir(), 'nextrush-deno-smoke-'));
    const files = generateProject(createOptions({ style: 'class-based' }));
    writeFiles(projectDir, files);

    const pkg = JSON.parse(files.get('package.json')!) as { scripts: Record<string, string> };
    expect(pkg.scripts.dev).toContain('npm:nextrush dev');
    expect(pkg.scripts.build).toContain('npm:nextrush build');
  });
});
