/**
 * @nextrush/dev - `nextrush dev` HTTP liveness integration test (task 2.1)
 *
 * Spawns the REAL built CLI binary against `examples/dev-cli-fixture` and asserts an
 * actual HTTP response from the served port — not just the startup banner text.
 * `cli-dev-integration.test.ts` proves the process starts without `ERR_MODULE_NOT_FOUND`;
 * this test proves the server it starts is actually reachable and answering requests,
 * which is the literal behavior a developer running `nextrush dev` depends on.
 *
 * @packageDocumentation
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../..');
const DEV_BIN = resolve(REPO_ROOT, 'packages/dev/bin/nextrush.js');
const FIXTURE_DIR = resolve(REPO_ROOT, 'examples/dev-cli-fixture');
const PORT = '58091';
const STARTUP_TIMEOUT_MS = 15_000;

let child: ChildProcess | undefined;

afterEach(() => {
  if (child && !child.killed) {
    child.kill('SIGKILL');
  }
  child = undefined;
});

async function waitForHttp(url: string, deadlineMs: number): Promise<Response> {
  const deadline = Date.now() + deadlineMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      return await fetch(url);
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Timed out waiting for HTTP liveness');
}

describe('nextrush dev — real HTTP liveness (task 2.1)', () => {
  it(
    'serves an actual HTTP response on the configured port, not just a startup banner',
    async () => {
      expect(existsSync(DEV_BIN)).toBe(true);

      child = spawn(process.execPath, [DEV_BIN, 'dev', '--port', PORT], {
        cwd: FIXTURE_DIR,
        env: { ...process.env, PORT, NODE_ENV: 'development' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const res = await waitForHttp(`http://127.0.0.1:${PORT}/`, STARTUP_TIMEOUT_MS);
      // Any real HTTP response (not a connection failure) proves the fixture app is
      // actually listening and answering — the literal liveness claim task 2.1 asks for.
      expect(res.status).toBeLessThan(600);
    },
    STARTUP_TIMEOUT_MS + 5_000
  );
});
