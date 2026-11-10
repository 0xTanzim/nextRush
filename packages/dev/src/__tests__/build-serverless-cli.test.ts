/**
 * @nextrush/dev - `nextrush build --serverless` integration test
 *
 * Verifies that running `nextrush build --serverless` emits companion package.json
 * and dual-entry .mjs bridge, and that findEntry() discovers .mts entrypoints.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initFsSync } from '../runtime/index.js';
import { findEntry } from '../utils/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REPO_ROOT = resolve(__dirname, '../../../..');
const DEV_BIN = resolve(REPO_ROOT, 'packages/dev/bin/nextrush.js');
const FIXTURE_DIR = resolve(REPO_ROOT, 'examples/dev-cli-fixture');
const FIXTURE_DIST_DIR = resolve(FIXTURE_DIR, 'dist');

function runNextrushBuild(args: string[] = ['build']): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((promiseResolve, promiseReject) => {
    const child = spawn(process.execPath, [DEV_BIN, ...args], {
      cwd: FIXTURE_DIR,
      env: { ...process.env, NODE_ENV: 'production' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (err) => {
      promiseReject(err);
    });
    child.on('exit', (code) => {
      promiseResolve({ code, stdout, stderr });
    });
  });
}

describe('nextrush build --serverless packaging artifacts', () => {
  beforeEach(() => {
    rmSync(FIXTURE_DIST_DIR, { recursive: true, force: true });
  });

  afterEach(() => {
    rmSync(FIXTURE_DIST_DIR, { recursive: true, force: true });
  });

  it('emits package.json with {"type": "module"} and index.mjs bridge when --serverless is passed', async () => {
    const { code, stderr } = await runNextrushBuild(['build', '--serverless']);
    expect(code, `build exited non-zero; stderr:\n${stderr}`).toBe(0);

    // Companion package.json must exist
    const pkgJsonPath = resolve(FIXTURE_DIST_DIR, 'package.json');
    expect(existsSync(pkgJsonPath)).toBe(true);
    const parsed = JSON.parse(readFileSync(pkgJsonPath, 'utf8')) as { type?: string };
    expect(parsed.type).toBe('module');

    // Dual-entry .mjs bridge must exist
    const mjsBridgePath = resolve(FIXTURE_DIST_DIR, 'index.mjs');
    expect(existsSync(mjsBridgePath)).toBe(true);
    const bridgeContent = readFileSync(mjsBridgePath, 'utf8');
    expect(bridgeContent).toContain("export * from './index.js';");
    expect(bridgeContent).toContain("import * as _mod from './index.js';");
    expect(bridgeContent).toContain("export default _mod.default;");
  }, 30_000);
});

describe('findEntry with .mts entrypoints', () => {
  let tempProjectDir: string;

  beforeEach(async () => {
    await initFsSync();
    tempProjectDir = resolve(tmpdir(), `nextrush-mts-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(resolve(tempProjectDir, 'src'), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tempProjectDir)) {
      rmSync(tempProjectDir, { recursive: true, force: true });
    }
  });

  it('discovers src/index.mts when no index.ts exists', () => {
    writeFileSync(resolve(tempProjectDir, 'src/index.mts'), 'export const x = 1;');

    const entry = findEntry(tempProjectDir);
    expect(entry).toBe('src/index.mts');
  });

  it('resolves .mts from package.json main ending in .mjs', () => {
    writeFileSync(resolve(tempProjectDir, 'src/server.mts'), 'export const app = 1;');
    writeFileSync(
      resolve(tempProjectDir, 'package.json'),
      JSON.stringify({ main: 'dist/server.mjs' }),
      'utf8'
    );

    const entry = findEntry(tempProjectDir);
    expect(entry).toBe('src/server.mts');
  });
});
