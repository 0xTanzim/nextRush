/**
 * @nextrush/dev - Deno `nextrush build` integration test (task 2.3, F-01 regression guard)
 *
 * F-01 was `deno-builder.ts` passing `TypeScriptFile` OBJECTS where `node:path` APIs
 * expected string paths — every mapped output was empty/wrong. This test spawns the REAL
 * `deno` binary running the shipped CLI against `examples/dev-cli-fixture` and asserts
 * the mapped `.js` output is actually non-empty content, not just that a file exists
 * (an empty file would satisfy `existsSync` while still reproducing the original bug).
 *
 * Skipped (not failed) when `deno` is unavailable on the runner — see task 7.3: an
 * uncovered runtime must be documented, not silently asserted "stable" with no proof.
 *
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../..');
const DEV_BIN = resolve(REPO_ROOT, 'packages/dev/bin/nextrush.js');
const FIXTURE_DIR = resolve(REPO_ROOT, 'examples/dev-cli-fixture');
const OUT_DIR = 'dist-deno-regression-2-3';
const OUTPUT_JS = resolve(FIXTURE_DIR, OUT_DIR, 'index.js');
const BUILD_TIMEOUT_MS = 30_000;

const hasDeno = spawnSync('deno', ['--version'], { stdio: 'ignore' }).status === 0;

describe.skipIf(!hasDeno)('nextrush build (Deno) — non-empty mapped output (task 2.3, F-01)', () => {
  beforeEach(() => {
    rmSync(resolve(FIXTURE_DIR, OUT_DIR), { recursive: true, force: true });
  });

  afterEach(() => {
    rmSync(resolve(FIXTURE_DIR, OUT_DIR), { recursive: true, force: true });
  });

  it(
    'produces a non-zero-length, correctly-mapped .js output under real Deno',
    () => {
      const result = spawnSync(
        'deno',
        ['run', '-A', DEV_BIN, 'build', '--outDir', OUT_DIR, '--no-dts'],
        { cwd: FIXTURE_DIR, encoding: 'utf-8', timeout: BUILD_TIMEOUT_MS }
      );

      expect(result.status, `Deno build failed; stderr:\n${result.stderr}`).toBe(0);
      expect(existsSync(OUTPUT_JS)).toBe(true);

      const content = readFileSync(OUTPUT_JS, 'utf-8');
      // The exact F-01 regression: an object-as-path bug produced a zero-length or
      // garbage file at this path rather than a real transformed module.
      expect(content.length).toBeGreaterThan(0);
      expect(content).toContain('createApp');
    },
    BUILD_TIMEOUT_MS + 5_000
  );
});
