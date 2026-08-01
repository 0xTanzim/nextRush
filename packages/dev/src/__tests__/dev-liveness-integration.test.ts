/**
 * @nextrush/dev - `dev.ts` in-process integration tests
 *
 * `cli-dev-integration.test.ts` already proves the shipped CLI's dev server actually
 * starts and serves real HTTP against `examples/dev-cli-fixture` (spawning the built
 * `bin/nextrush.js`). This file covers the `dev()` scenario that test does NOT: the
 * synchronous "entry file not found" guard, which fires before any child is ever
 * spawned. `dev()` calls `exitProcess(1)`, which is `never` (calls `process.exit`) —
 * unsafe to trigger inside the vitest worker itself, so it's exercised out-of-process
 * via `spawnSync` against the built `dist/commands/dev.js`, matching the shipped
 * artifact rather than requiring a loader that only exists in `dist/`.
 *
 * A full in-process re-test of the happy-path liveness scenario was deliberately not
 * added here: `dev()`'s SWC-loader resolution (`resolveLoaderFromUrl`) falls back to a
 * bare `@swc-node/register` package specifier whenever `import.meta.url` has no `/dist/`
 * segment — true for every module vitest runs directly from `src/`. That bare specifier
 * can only resolve from the FIXTURE's own `node_modules`, which correctly does NOT hoist
 * `@nextrush/dev`'s own dependency there. This is an artifact of testing `src/` in-process,
 * not a product defect — real installs always run the compiled `dist/`, where the loader
 * resolves to a real `dist/loaders/swc-loader.mjs` file path, already proven by
 * `cli-dev-integration.test.ts` and this session's manual Node/Bun/Deno smokes.
 */

import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { dev } from '../commands/dev.js';
import * as runtime from '../runtime/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(__dirname, '../../../../examples/dev-cli-fixture');

describe('dev() — missing entry file (in-process)', () => {
  it('reports "Entry file not found" and calls exitProcess(1), never spawning a child', async () => {
    vi.spyOn(runtime, 'getCwd').mockReturnValue(FIXTURE_DIR);
    const errorLines: string[] = [];
    vi.spyOn(console, 'error').mockImplementation((message: unknown) => {
      errorLines.push(String(message));
    });
    const exitSpy = vi.spyOn(runtime, 'exitProcess').mockImplementation(() => {
      throw new Error('exit');
    });

    await expect(
      dev('./does-not-exist.ts', { clearScreen: false })
    ).rejects.toThrow('exit');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorLines.some((l) => l.includes('Entry file not found'))).toBe(true);

    vi.restoreAllMocks();
  });
});

describe('dev() — missing entry file (out-of-process, real dist build)', () => {
  it(
    'exits non-zero and reports an actionable error for a missing entry file',
    () => {
      // Imports the built `dist/` output (real compiled JS, matching what the shipped
      // CLI actually runs) via an absolute file:// URL so Node's ESM resolver isn't
      // affected by the child's cwd. pathToFileURL handles Windows drive-letter paths.
      const devModuleUrl = pathToFileURL(resolve(__dirname, '../../dist/commands/dev.js'))
        .href;
      const result = spawnSync(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `import { dev } from ${JSON.stringify(devModuleUrl)}; await dev('./does-not-exist.ts', { clearScreen: false });`,
        ],
        { cwd: resolve(__dirname, '../../../../examples/dev-cli-fixture'), encoding: 'utf-8' }
      );

      expect(result.status).not.toBe(0);
      expect(result.stderr).toMatch(/Entry file not found/);
    },
    15_000
  );
});
