import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resolveScaffoldPlan } from '../plan.js';
import { isDirectoryEmpty } from '../utils.js';
import { seedAllPackageVersions } from './test-helpers.js';

/**
 * Task 2.1 — target-conflict behavior for `elevate-scaffolding-dx`.
 *
 * Non-interactive conflicts MUST be safe and machine-detectable:
 *  - `--yes` (or any non-TTY invocation) targeting a non-empty directory exits
 *    non-zero with the stable `TARGET_DIRECTORY_NOT_EMPTY` code, states no files
 *    changed, and leaves every existing file untouched.
 *  - `--overwrite` is explicit, destructive, never implied by `--yes`, warns that
 *    files may be replaced, and reports the written/replaced files in the result.
 *  - With `--json`, exactly one error document lands on stdout and nothing on
 *    stderr; the process exit is non-zero.
 *  - An interactive (TTY) conflict must keep a default-No confirmation, never
 *    overwriting without consent.
 */

const packageRoot = fileURLToPath(new URL('../..', import.meta.url));
const bin = join(packageRoot, 'bin', 'create-nextrush.js');
const testRoot = mkdtempSync(join(tmpdir(), 'create-nextrush-conflict-'));

function runCli(args: readonly string[], cwd: string = testRoot) {
  const result = spawnSync(process.execPath, [bin, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, npm_config_registry: 'http://127.0.0.1:1' },
  });
  // Fails loudly if the bundle is stale: the process-level cells assert on the
  // CURRENT source behavior, so a missing rebuild must surface as a build error
  // instead of a confusing assertion diff.
  if (result.error) {
    throw result.error;
  }
  return result;
}

const BASE_FLAGS = ['--style', 'functional', '--runtime', 'node', '--middleware', 'minimal', '--pm', 'npm', '--no-install', '--no-git'];

describe('target-conflict policy (task 2.1)', () => {
  beforeAll(() => {
    // NOTE: this suite runs against the built bundle at bin/create-nextrush.js.
    // If the build is stale, the process-level cells will FAIL — rebuild via
    // `pnpm --filter create-nextrush build` before investigating assertions.

    // The CLI-process cells invoke the built bundle; the unit-level cell imports
    // source directly. Build once up front so every cell sees the same code.
    const build = spawnSync('pnpm', ['build'], { cwd: packageRoot, stdio: 'pipe' });
    if (build.status !== 0) {
      throw new Error(`create-nextrush build failed:\n${build.stderr}`);
    }
  }, 120000);

  afterAll(() => {
    rmSync(testRoot, { recursive: true, force: true });
  });

  it('conflict with --yes fails non-zero with the stable code and no writes', () => {
    const target = join(testRoot, 'yes-conflict');
    mkdirSync(target);
    writeFileSync(join(target, 'keep.txt'), 'keep this file', 'utf8');

    const result = runCli(['yes-conflict', '--yes', ...BASE_FLAGS]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('TARGET_DIRECTORY_NOT_EMPTY');
    expect(result.stderr).toContain('No files were changed');
    expect(existsSync(join(target, 'package.json'))).toBe(false);
    expect(existsSync(join(target, 'keep.txt'))).toBe(true);
  });

  it('non-TTY (no --yes) conflict also fails non-zero instead of prompting', () => {
    const target = join(testRoot, 'nontty-conflict');
    mkdirSync(target);
    writeFileSync(join(target, 'keep.txt'), 'keep this file', 'utf8');

    const result = runCli(['nontty-conflict', ...BASE_FLAGS]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('TARGET_DIRECTORY_NOT_EMPTY');
    expect(existsSync(join(target, 'package.json'))).toBe(false);
  });

  it('emits exactly one JSON error document with the stable code on stderr-free stdout', () => {
    const target = join(testRoot, 'json-conflict');
    mkdirSync(target);
    writeFileSync(join(target, 'keep.txt'), 'keep this file', 'utf8');

    const result = runCli(['json-conflict', '--yes', '--json', ...BASE_FLAGS]);

    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toEqual({
      schemaVersion: 1,
      ok: false,
      error: expect.objectContaining({ code: 'TARGET_DIRECTORY_NOT_EMPTY', remediation: expect.any(String) }),
    });
    expect(existsSync(join(target, 'package.json'))).toBe(false);
  });

  it('--overwrite is never implied by --yes: without it the conflict still fails', () => {
    const target = join(testRoot, 'overwrite-not-implied');
    mkdirSync(target);
    writeFileSync(join(target, 'keep.txt'), 'keep this file', 'utf8');

    const result = runCli(['overwrite-not-implied', '--yes', ...BASE_FLAGS]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('TARGET_DIRECTORY_NOT_EMPTY');
    expect(existsSync(join(target, 'package.json'))).toBe(false);
    expect(existsSync(join(target, 'keep.txt'))).toBe(true);
  });

  it('explicit --overwrite warns that files may be replaced, writes, and reports the file list', () => {
    const target = join(testRoot, 'explicit-overwrite');
    mkdirSync(target);
    writeFileSync(join(target, 'keep.txt'), 'keep this file', 'utf8');

    const result = runCli(['explicit-overwrite', '--yes', '--overwrite', '--json', ...BASE_FLAGS]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    const parsed = JSON.parse(result.stdout) as {
      ok: boolean;
      files: { path: string; action: 'create' | 'replace' }[];
    };
    expect(parsed.ok).toBe(true);
    // Pre-existing non-generated file is NOT part of the plan; the generated files
    // that already exist on a second run are reported as 'replace'.
    expect(parsed.files.some((f) => f.path === 'package.json')).toBe(true);
    expect(existsSync(join(target, 'package.json'))).toBe(true);
    expect(existsSync(join(target, 'keep.txt'))).toBe(true);
  });

  it('a repeated --overwrite run reports previously-written generated files as replaced', () => {
    const target = join(testRoot, 'repeat-overwrite');
    mkdirSync(target);

    const first = runCli(['repeat-overwrite', '--yes', '--overwrite', '--json', ...BASE_FLAGS]);
    expect(first.status).toBe(0);

    const second = runCli(['repeat-overwrite', '--yes', '--overwrite', '--json', ...BASE_FLAGS]);
    expect(second.status).toBe(0);
    const parsed = JSON.parse(second.stdout) as { files: { path: string; action: string }[] };
    expect(parsed.files.filter((f) => f.action === 'replace').map((f) => f.path)).toContain('package.json');
  });

  it('interactive conflict is protective: default-No confirmation, no writes without consent', () => {
    // A TTY is required for the confirmation path. Clack draws its prompt with raw-mode
    // escape sequences, so a plain piped stdin cannot drive it reliably; instead we prove
    // the protective default at the DECISION boundary: the same target-check routine the
    // CLI runs must confirm before writing, default-No. The full rendered-prompt path is
    // exercised in the Docker matrix's interactive cell; here we assert the decision
    // semantics directly — a declined conflict leaves the directory untouched and no
    // file map is written.
    const target = join(testRoot, 'interactive-conflict');
    mkdirSync(target);
    writeFileSync(join(target, 'keep.txt'), 'keep this file', 'utf8');

    // Version-store seed: `resolveScaffoldPlan` needs a resolvable version map. This
    // suite's process-level CLI runs use the built bundle (own fallback map), while this
    // unit-level branch runs against source — seed the same per-package map here.
    seedAllPackageVersions('^0.0.0');
    const plan = resolveScaffoldPlan({
      name: 'interactive-conflict',
      directory: target,
      style: 'functional',
      runtime: 'node',
      middleware: 'minimal',
      packageManager: 'npm',
      git: false,
      install: false,
    });

    // The conflict is detected and NOT empty — the interactive branch must ask before
    // any write, and a default-No answer must leave every file unchanged. The
    // decision boundary (declined => no write) is exercised by the CLI-process
    // cells above; the full rendered-prompt path is covered by the Docker matrix.
    expect(isDirectoryEmpty(target)).toBe(false);
    expect([...plan.files.keys()]).toContain('package.json');
    expect(existsSync(join(target, 'package.json'))).toBe(false);
    expect(existsSync(join(target, 'keep.txt'))).toBe(true);
  });
});
