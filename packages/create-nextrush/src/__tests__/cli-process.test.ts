import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const packageRoot = fileURLToPath(new URL('../..', import.meta.url));
const bin = join(packageRoot, 'bin', 'create-nextrush.js');
const testRoot = mkdtempSync(join(tmpdir(), 'create-nextrush-cli-'));

function runCli(args: readonly string[]) {
  return spawnSync(process.execPath, [bin, ...args], {
    cwd: testRoot,
    encoding: 'utf8',
    env: { ...process.env, npm_config_registry: 'http://127.0.0.1:1' },
  });
}

describe('CLI process input contract', () => {
  beforeAll(() => {
    execFileSync('pnpm', ['build'], { cwd: packageRoot, stdio: 'pipe' });
  });

  afterAll(() => {
    rmSync(testRoot, { recursive: true, force: true });
  });

  it.each([
    [['--unknown'], 'UNKNOWN_OPTION'],
    [['--runtime'], 'MISSING_OPTION_VALUE'],
    [['--runtime', 'nodee'], 'INVALID_RUNTIME'],
  ])('rejects invalid command input without writing (%j)', (args, code) => {
    const result = runCli(args);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(code === 'UNKNOWN_OPTION' ? 'Unknown option' : code === 'MISSING_OPTION_VALUE' ? 'requires a value' : 'Invalid value');
    expect(existsSync(join(testRoot, 'my-nextrush-app'))).toBe(false);
  });

  it('returns exactly one JSON error document without terminal decoration', () => {
    const result = runCli(['--json', '--runtime', 'nodee']);
    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toEqual({
      schemaVersion: 1,
      ok: false,
      error: expect.objectContaining({ code: 'INVALID_RUNTIME', remediation: expect.any(String) }),
    });
  });

  it('returns a schema-versioned JSON dry-run plan without target side effects', () => {
    const result = runCli([
      'planned-app',
      '--yes',
      '--json',
      '--dry-run',
      '--style',
      'functional',
      '--runtime',
      'node',
      '--middleware',
      'minimal',
      '--pm',
      'npm',
      '--no-install',
      '--no-git',
    ]);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toEqual({
      schemaVersion: 1,
      ok: true,
      dryRun: true,
      offline: false,
      project: expect.objectContaining({ name: 'planned-app', packageManager: 'npm' }),
      files: expect.arrayContaining([
        expect.objectContaining({ path: 'package.json', action: 'create' }),
        expect.objectContaining({ path: 'src/index.ts', action: 'create' }),
      ]),
    });
    expect(existsSync(join(testRoot, 'planned-app'))).toBe(false);
  });

  it('accepts complete non-interactive input without prompting', () => {
    const result = runCli([
      'complete-app',
      '--yes',
      '--style',
      'functional',
      '--runtime',
      'node',
      '--middleware',
      'minimal',
      '--pm',
      'npm',
      '--no-install',
      '--no-git',
    ]);
    expect(result.status).toBe(0);
    expect(existsSync(join(testRoot, 'complete-app', 'package.json'))).toBe(true);
  });

  it('rejects a non-empty target in --yes mode without writing', () => {
    const target = join(testRoot, 'conflict-app');
    mkdirSync(target);
    writeFileSync(join(target, 'keep.txt'), 'keep this file', 'utf8');
    const result = runCli(['conflict-app', '--yes', '--json', '--no-install', '--no-git']);
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toEqual({
      schemaVersion: 1,
      ok: false,
      error: expect.objectContaining({ code: 'TARGET_DIRECTORY_NOT_EMPTY', remediation: expect.any(String) }),
    });
    expect(existsSync(join(target, 'package.json'))).toBe(false);
  });

  it('allows an explicit overwrite and reports replaced files', () => {
    const target = join(testRoot, 'overwrite-app');
    mkdirSync(target);
    writeFileSync(join(target, 'keep.txt'), 'keep this file', 'utf8');
    const result = runCli([
      'overwrite-app',
      '--yes',
      '--overwrite',
      '--json',
      '--style',
      'functional',
      '--runtime',
      'node',
      '--middleware',
      'minimal',
      '--pm',
      'npm',
      '--no-install',
      '--no-git',
    ]);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).files).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'package.json', action: 'create' })])
    );
    expect(existsSync(join(target, 'package.json'))).toBe(true);
  });

  it('--offline succeeds with an unreachable registry and reports offline fallback ranges', () => {
    // The registry env points at an unroutable address; the embedded fallback map must
    // still resolve every emitted package so generation succeeds without any probe.
    const result = runCli([
      'offline-app',
      '--yes',
      '--json',
      '--offline',
      '--style',
      'functional',
      '--runtime',
      'node',
      '--middleware',
      'minimal',
      '--pm',
      'npm',
      '--no-install',
      '--no-git',
    ]);
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      ok: boolean;
      offline: boolean;
      files: { path: string; action: string }[];
    };
    expect(parsed.ok).toBe(true);
    expect(parsed.offline).toBe(true);
    expect(parsed.files.some((f) => f.path === 'package.json')).toBe(true);
    expect(existsSync(join(testRoot, 'offline-app', 'package.json'))).toBe(true);
  });

  it('states package-manager provenance in the human output (F-09)', () => {
    const result = runCli([
      'provenance-app',
      '--yes',
      '--style',
      'functional',
      '--runtime',
      'node',
      '--middleware',
      'minimal',
      '--pm',
      'npm',
      '--no-install',
      '--no-git',
    ]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Using npm package manager (explicit).');
  });

  it('--skip-runtime-check suppresses the missing-runtime preflight and still scaffolds (F-08)', () => {
    // The check is skipped entirely, so generation succeeds even though a local 'bun'
    // binary is not guaranteed on PATH here — and no preflight guidance is emitted.
    const result = runCli([
      'skip-runtime-app',
      '--yes',
      '--style',
      'functional',
      '--runtime',
      'bun',
      '--middleware',
      'minimal',
      '--no-install',
      '--no-git',
      '--skip-runtime-check',
    ]);
    expect(result.status).toBe(0);
    expect(existsSync(join(testRoot, 'skip-runtime-app', 'package.json'))).toBe(true);
    expect(result.stdout).not.toContain('not available on this machine');
  });

  it('--preset production emits production artifacts (F-04)', () => {
    const result = runCli([
      'preset-app',
      '--yes',
      '--style',
      'functional',
      '--runtime',
      'node',
      '--middleware',
      'minimal',
      '--pm',
      'npm',
      '--no-install',
      '--no-git',
      '--preset',
      'production',
    ]);
    expect(result.status).toBe(0);
    expect(existsSync(join(testRoot, 'preset-app', 'Dockerfile'))).toBe(true);
    expect(existsSync(join(testRoot, 'preset-app', '.editorconfig'))).toBe(true);
    expect(existsSync(join(testRoot, 'preset-app', 'eslint.config.mjs'))).toBe(true);
  });

  it('--workspace fails with actionable guidance when no workspace is detected', () => {
    const result = runCli(['ws-app', '--yes', '--workspace', '--no-install', '--no-git']);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Workspace scaffolding unavailable');
    expect(result.stdout).toMatch(/pnpm|workspace/i);
  });

  it('--workspace scaffolds into a detected pnpm workspace apps dir', () => {
    writeFileSync(join(testRoot, 'pnpm-workspace.yaml'), "packages:\n  - 'apps/*'\n");
    try {
      const result = runCli(['my-pkg', '--yes', '--workspace', '--no-install', '--no-git']);
      expect(result.status).toBe(0);
      expect(existsSync(join(testRoot, 'apps', 'my-pkg', 'src', 'index.ts'))).toBe(true);
      expect(result.stdout).toContain('apps/my-pkg');
    } finally {
      rmSync(join(testRoot, 'pnpm-workspace.yaml'), { force: true });
    }
  });
});
