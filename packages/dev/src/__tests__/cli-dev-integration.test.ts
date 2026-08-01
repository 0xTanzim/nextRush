/**
 * @nextrush/dev - CLI `dev` command integration test
 *
 * Spawns the REAL built CLI binary (`bin/nextrush.js` → `dist/cli.js`) against the
 * `examples/dev-cli-fixture` fixture and asserts the dev server actually starts.
 *
 * This is the layer the pure-function unit tests in `runtime-node-modules.test.ts`
 * cannot cover: those call `resolveLoaderFromUrl` directly with a hand-constructed
 * `import.meta.url`, so they never exercise what happens once tsup's `splitting: false`
 * inlines that function's code into `dist/cli.js` itself. Only a real spawn of the built
 * artifact proves the loader path is actually correct at zero directories under `dist/`
 * (see design.md D2, proposal.md's Why section).
 *
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REPO_ROOT = resolve(__dirname, '../../../..');
const DEV_BIN = resolve(REPO_ROOT, 'packages/dev/bin/nextrush.js');
const FIXTURE_DIR = resolve(REPO_ROOT, 'examples/dev-cli-fixture');

/** Startup timeout — spawns a real child process (SWC-transpiled Node server). */
const STARTUP_TIMEOUT_MS = 15_000;
/** Test-reserved port, unlikely to collide with a developer's local services. */
const FIXTURE_PORT = '58080';

/** Marker line `dev.ts`'s `banner()` call prints before spawning the target app. */
const STARTUP_BANNER_MARKER = 'NextRush Dev Server';
/** The exact symptom this change fixes — must never reappear once resolved. */
const MODULE_NOT_FOUND_MARKER = 'ERR_MODULE_NOT_FOUND';

let child: ChildProcess | undefined;

afterEach(() => {
  if (child && !child.killed) {
    child.kill('SIGTERM');
  }
  child = undefined;
});

describe('nextrush dev — real built CLI against dev-cli-fixture', () => {
  it('starts the dev server without ERR_MODULE_NOT_FOUND', async () => {
    expect(existsSync(DEV_BIN)).toBe(true);
    expect(existsSync(FIXTURE_DIR)).toBe(true);

    const { sawBanner, sawModuleNotFound, exitedEarly } = await runDevAndObserve();

    expect(exitedEarly).toBe(false);
    expect(sawModuleNotFound).toBe(false);
    expect(sawBanner).toBe(true);
  }, STARTUP_TIMEOUT_MS + 5_000);
});

interface DevObservation {
  sawBanner: boolean;
  sawModuleNotFound: boolean;
  exitedEarly: boolean;
}

/**
 * Spawn `bin/nextrush.js dev` against the fixture and observe its stdout/stderr for the
 * startup banner or the `ERR_MODULE_NOT_FOUND` failure symptom, whichever comes first.
 */
function runDevAndObserve(): Promise<DevObservation> {
  return new Promise((promiseResolve, promiseReject) => {
    let sawBanner = false;
    let sawModuleNotFound = false;
    let exitedEarly = false;
    let settled = false;

    const finish = (observation: DevObservation) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      promiseResolve(observation);
    };

    child = spawn(
      process.execPath,
      [DEV_BIN, 'dev', '--port', FIXTURE_PORT],
      {
        cwd: FIXTURE_DIR,
        env: { ...process.env, PORT: FIXTURE_PORT, NODE_ENV: 'development' },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    const spawnedChild = child;

    const onOutput = (chunk: Buffer) => {
      const text = chunk.toString('utf8');

      if (text.includes(MODULE_NOT_FOUND_MARKER)) {
        sawModuleNotFound = true;
        finish({ sawBanner, sawModuleNotFound, exitedEarly });
      }

      if (text.includes(STARTUP_BANNER_MARKER)) {
        sawBanner = true;
        // Banner printed and no ERR_MODULE_NOT_FOUND observed yet — the process is past
        // the loader-resolution step that this change fixes. Give it a brief grace
        // window in case the failure surfaces slightly after the banner, then finish.
        setTimeout(() => {
          finish({ sawBanner, sawModuleNotFound, exitedEarly });
        }, 1_000);
      }
    };

    spawnedChild.stdout?.on('data', onOutput);
    spawnedChild.stderr?.on('data', onOutput);

    spawnedChild.on('exit', (code) => {
      // The dev server is expected to keep running under --watch; an early exit before
      // the banner/marker was observed means startup failed outright.
      if (!settled) {
        exitedEarly = true;
        finish({ sawBanner, sawModuleNotFound, exitedEarly });
      } else if (code !== null && code !== 0 && !sawModuleNotFound) {
        // Already settled via banner/marker — nothing to do.
      }
    });

    spawnedChild.on('error', (err) => {
      promiseReject(err);
    });

    const timer = setTimeout(() => {
      finish({ sawBanner, sawModuleNotFound, exitedEarly });
    }, STARTUP_TIMEOUT_MS);
  });
}
