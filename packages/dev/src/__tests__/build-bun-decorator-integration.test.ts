/**
 * @nextrush/dev - Bun `nextrush build` decorator-metadata integration test (task 2.4, F-10)
 *
 * F-10 asked whether Bun's build path actually preserves `design:paramtypes` decorator
 * metadata (required for DI) or only claims to. This test spawns the REAL `bun` binary
 * running the shipped CLI's `build` command against a small, self-contained fixture with
 * a `reflect-metadata`-decorated class, and asserts the metadata literally appears in the
 * built output — settling the "verified" claim with real evidence instead of assertion.
 *
 * Skipped (not failed) when `bun` is unavailable on the runner — task 7.3: an uncovered
 * runtime must be documented, not silently asserted "stable" with no proof.
 *
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../..');
const DEV_BIN = resolve(REPO_ROOT, 'packages/dev/bin/nextrush.js');
const BUILD_TIMEOUT_MS = 30_000;

const hasBun = spawnSync('bun', ['--version'], { stdio: 'ignore' }).status === 0;

/** A minimal decorated class — enough to make SWC/Bun emit `design:paramtypes` if metadata survives. */
const DECORATED_SOURCE = `
function Injectable(): ClassDecorator {
  return () => {};
}

class Dependency {}

@Injectable()
export class Widget {
  constructor(private dep: Dependency) {}
}
`;

describe.skipIf(!hasBun)('nextrush build (Bun) — decorator metadata preserved (task 2.4, F-10)', () => {
  let workDir: string;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'nextrush-bun-decorator-'));
    mkdirSync(join(workDir, 'src'), { recursive: true });
    writeFileSync(join(workDir, 'src', 'index.ts'), DECORATED_SOURCE);
    writeFileSync(
      join(workDir, 'tsconfig.json'),
      JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            module: 'ESNext',
            moduleResolution: 'Bundler',
            experimentalDecorators: true,
            emitDecoratorMetadata: true,
            declaration: true,
            strict: true,
          },
          include: ['src/**/*'],
        },
        null,
        2
      )
    );
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  it(
    'emits design:paramtypes metadata for a decorated class in the built output',
    () => {
      const result = spawnSync(
        'bun',
        [DEV_BIN, 'build', '--outDir', 'dist', '--no-dts'],
        { cwd: workDir, encoding: 'utf-8', timeout: BUILD_TIMEOUT_MS }
      );

      expect(result.status, `Bun build failed; stderr:\n${result.stderr}`).toBe(0);

      const outFile = join(workDir, 'dist', 'index.js');
      expect(existsSync(outFile)).toBe(true);
      const content = readFileSync(outFile, 'utf-8');

      // The literal, cited evidence for F-10's claim: Reflect metadata calls must
      // actually appear in the emitted code, not just be assumed to survive Bun's bundler.
      expect(content).toMatch(/design:paramtypes|__metadata|Reflect\.metadata/);
    },
    BUILD_TIMEOUT_MS + 5_000
  );
});
