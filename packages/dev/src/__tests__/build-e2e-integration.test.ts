/**
 * @nextrush/dev - `nextrush build` end-to-end integration test (T013)
 *
 * Spawns the REAL built CLI binary (`bin/nextrush.js` → `dist/cli.js`) to run
 * `nextrush build` against the `examples/dev-cli-fixture` fixture, then asserts on the
 * actual files written to disk — not on any exported build function called in-process.
 *
 * This is deliberately at the same layer as `cli-dev-integration.test.ts` (T013's sibling
 * for `dev`): a unit test calling `buildWithSwc()` directly would prove the function runs,
 * not that the shipped `nextrush build` CLI command produces a correct, complete artifact
 * set for a real fixture. Per design.md D3, this test is sequenced after the loader-path
 * fix (72afe3d) so it validates `build`'s output on top of already-correct `dev`/`build`
 * CLI plumbing, not a still-broken toolchain.
 *
 * Asserts, per specs/dev-build-e2e-integration/spec.md:
 * - The expected JS output file exists and is non-empty.
 * - The expected `.d.ts` file exists and contains the fixture's exported type signature.
 * - A sourcemap file exists.
 * - Extensions are mapped correctly: `.ts` source -> `.js` output (never `.ts` -> `.ts`).
 *
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REPO_ROOT = resolve(__dirname, '../../../..');
const DEV_BIN = resolve(REPO_ROOT, 'packages/dev/bin/nextrush.js');
const FIXTURE_DIR = resolve(REPO_ROOT, 'examples/dev-cli-fixture');
const FIXTURE_DIST_DIR = resolve(FIXTURE_DIR, 'dist');

/** Expected build output paths, relative to the fixture's `dist/` directory. */
const OUTPUT_JS = resolve(FIXTURE_DIST_DIR, 'index.js');
const OUTPUT_JS_MAP = resolve(FIXTURE_DIST_DIR, 'index.js.map');
const OUTPUT_DTS = resolve(FIXTURE_DIST_DIR, 'index.d.ts');
/** Must never exist — the extension-mapping regression this test guards against. */
const WRONG_OUTPUT_TS = resolve(FIXTURE_DIST_DIR, 'index.ts');

/** Real child process running `tsc --emitDeclarationOnly` for `.d.ts` emission — allow headroom. */
const BUILD_TIMEOUT_MS = 30_000;

/**
 * Spawn the real built CLI's `build` command against the fixture and wait for it to exit.
 * Rejects if the process errors to spawn; resolves with the exit code otherwise (a non-zero
 * exit is a build failure the caller should assert on explicitly, not have swallowed here).
 */
function runNextrushBuild(): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((promiseResolve, promiseReject) => {
    const child = spawn(process.execPath, [DEV_BIN, 'build'], {
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

describe('nextrush build — real built CLI against dev-cli-fixture', () => {
  beforeEach(() => {
    expect(existsSync(DEV_BIN)).toBe(true);
    expect(existsSync(FIXTURE_DIR)).toBe(true);
    // Start from a clean slate so a stale artifact from a previous run (or a developer's
    // manual `nextrush build`) can never masquerade as this run's output.
    rmSync(FIXTURE_DIST_DIR, { recursive: true, force: true });
  });

  afterEach(() => {
    rmSync(FIXTURE_DIST_DIR, { recursive: true, force: true });
  });

  it(
    'produces JS output, a sourcemap, and correctly-mapped extensions',
    async () => {
      const { code, stderr } = await runNextrushBuild();

      expect(code, `build exited non-zero; stderr:\n${stderr}`).toBe(0);

      expect(existsSync(OUTPUT_JS)).toBe(true);
      const jsContent = readFileSync(OUTPUT_JS, 'utf8');
      expect(jsContent.length).toBeGreaterThan(0);

      // Extension-mapping regression guard: `.ts` source must become `.js` output, never
      // an untransformed `.ts` copy sitting in `dist/`.
      expect(existsSync(WRONG_OUTPUT_TS)).toBe(false);

      expect(existsSync(OUTPUT_JS_MAP)).toBe(true);
      const mapContent = readFileSync(OUTPUT_JS_MAP, 'utf8');
      expect(mapContent.length).toBeGreaterThan(0);
      // A sourcemap is JSON with a `version` field — a sanity check that this is a real
      // sourcemap, not an empty or corrupt file that merely satisfies "exists".
      const parseMap = (): unknown => JSON.parse(mapContent);
      expect(parseMap).not.toThrow();
    },
    BUILD_TIMEOUT_MS
  );

  it(
    'generates a .d.ts file containing the fixture exported type signature',
    async () => {
      const { code, stderr } = await runNextrushBuild();

      expect(code, `build exited non-zero; stderr:\n${stderr}`).toBe(0);

      expect(existsSync(OUTPUT_DTS)).toBe(true);
      const dtsContent = readFileSync(OUTPUT_DTS, 'utf8');
      expect(dtsContent.length).toBeGreaterThan(0);

      // The fixture's `HealthStatus` interface and `describeHealth` function (added for
      // this test — see src/index.ts) must actually appear in the emitted declaration,
      // proving `.d.ts` generation captured real type information, not just an empty file.
      expect(dtsContent).toContain('HealthStatus');
      expect(dtsContent).toContain('describeHealth');
      expect(dtsContent).toMatch(/ok\s*:\s*boolean/);
    },
    BUILD_TIMEOUT_MS
  );
});
