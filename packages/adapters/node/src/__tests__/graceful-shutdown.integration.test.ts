/**
 * Integration: opt-in, signal-wired graceful shutdown (T010).
 *
 * `serve()`'s `close()` already drains connections correctly (stop-accepting ->
 * force-close-after-timeout -> `app.close()`, see `adapter.ts` lines ~224-243). This
 * suite proves the NEW `gracefulShutdown` option wires `SIGTERM`/`SIGINT` to that
 * existing `close()` — without installing any handler when the option is omitted, and
 * without leaking the handler past a single `serve()`/`close()` cycle.
 *
 * Scenario 1 (SIGTERM completes an in-flight request) spawns a REAL, standalone child
 * process via plain `node` (deliberately NOT `tsx` — see the fixture's header comment:
 * `tsx`'s CLI wrapper relays signals to its child over an internal IPC handshake and
 * escalates to `SIGKILL` if the child doesn't ack within its own short race window,
 * which is fundamentally incompatible with a real, time-bounded drain; confirmed by
 * reading `tsx`'s `relaySignalToChild` source directly, not assumed). The `beforeAll`
 * rebuilds this package immediately before spawning, so the fixture's
 * `@nextrush/adapter-node` import always resolves to CURRENT source, never a stale
 * `dist/` artifact left over from a previous run.
 *
 * Scenarios 2 and 3 run in-process: they only ever assert on `process.listenerCount(...)`,
 * never send a real signal, so there is no risk to the vitest worker and no build step
 * is needed for them (they exercise `serve()` from source directly, same as any other
 * unit test in this suite).
 *
 * @packageDocumentation
 */

import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp, type Application } from '@nextrush/core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { serve } from '../adapter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PACKAGE_ROOT = resolve(__dirname, '../..');
const FIXTURE_SCRIPT = resolve(__dirname, 'fixtures/graceful-shutdown-server.mjs');

/** Spawn + drain-timeout headroom for a real child process on a loaded CI runner. */
const CHILD_STARTUP_TIMEOUT_MS = 10_000;
/** `tsup build` for this package is small; generous headroom for a cold CI cache. */
const BUILD_TIMEOUT_MS = 30_000;

let child: ChildProcess | undefined;

beforeAll(() => {
  // Rebuild so the fixture's `@nextrush/adapter-node` import (resolved through the pnpm
  // workspace to `dist/index.js`) reflects the CURRENT `adapter.ts` source, not whatever
  // was last built. A stale dist here would let this test pass against old code.
  execFileSync('pnpm', ['exec', 'tsup'], {
    cwd: PACKAGE_ROOT,
    stdio: 'pipe',
    timeout: BUILD_TIMEOUT_MS,
  });
}, BUILD_TIMEOUT_MS + 5_000);

afterEach(() => {
  if (child && !child.killed) {
    child.kill('SIGKILL');
  }
  child = undefined;
});

describe('serve() — gracefulShutdown option', () => {
  it(
    'lets an in-flight request complete after SIGTERM when gracefulShutdown: true (1.1)',
    async () => {
      expect(existsSync(FIXTURE_SCRIPT)).toBe(true);

      const { port, stdout } = await spawnFixtureAndWaitForPort();

      // Start a slow request against the child, then wait until the fixture confirms
      // the handler has actually begun before sending the signal — otherwise SIGTERM
      // could race ahead of the connection being accepted.
      const responsePromise = fetch(`http://127.0.0.1:${String(port)}/`);
      await waitForMarker(stdout, 'SLOW_REQUEST_START');

      child?.kill('SIGTERM');

      const response = await responsePromise;
      const body = (await response.json()) as { ok: boolean };

      expect(response.status).toBe(200);
      expect(body).toEqual({ ok: true });
      expect(stdout.text).toContain('SLOW_REQUEST_DONE');
    },
    CHILD_STARTUP_TIMEOUT_MS + 5_000
  );

  it('installs no SIGTERM/SIGINT listener when gracefulShutdown is omitted (1.2)', async () => {
    const beforeTerm = process.listenerCount('SIGTERM');
    const beforeInt = process.listenerCount('SIGINT');

    const app: Application = createApp();
    const server = await serve(app, { port: 0, host: '127.0.0.1' });

    expect(process.listenerCount('SIGTERM')).toBe(beforeTerm);
    expect(process.listenerCount('SIGINT')).toBe(beforeInt);

    await server.close();

    expect(process.listenerCount('SIGTERM')).toBe(beforeTerm);
    expect(process.listenerCount('SIGINT')).toBe(beforeInt);
  });

  it('removes the signal handler after close() completes, across repeated cycles (1.3)', async () => {
    const baselineTerm = process.listenerCount('SIGTERM');
    const baselineInt = process.listenerCount('SIGINT');

    for (let cycle = 0; cycle < 2; cycle += 1) {
      const app: Application = createApp();
      const server = await serve(app, {
        port: 0,
        host: '127.0.0.1',
        gracefulShutdown: true,
      });

      // While running, exactly one listener per signal should be attached beyond baseline.
      expect(process.listenerCount('SIGTERM')).toBe(baselineTerm + 1);
      expect(process.listenerCount('SIGINT')).toBe(baselineInt + 1);

      await server.close();

      // After close(), the handler must be gone — no leak across cycles.
      expect(process.listenerCount('SIGTERM')).toBe(baselineTerm);
      expect(process.listenerCount('SIGINT')).toBe(baselineInt);
    }
  });
});

interface StdoutBuffer {
  text: string;
}

/**
 * Spawn the fixture via plain `node` and resolve once it prints its `LISTENING:<port>`
 * marker. Rejects on early exit/error/timeout so a broken fixture fails fast with a
 * clear cause instead of hanging the suite.
 */
function spawnFixtureAndWaitForPort(): Promise<{ port: number; stdout: StdoutBuffer }> {
  return new Promise((promiseResolve, promiseReject) => {
    const stdout: StdoutBuffer = { text: '' };
    let settled = false;

    child = spawn(process.execPath, [FIXTURE_SCRIPT], {
      cwd: PACKAGE_ROOT,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const spawnedChild = child;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      promiseReject(
        new Error(`Fixture did not report LISTENING:<port> within timeout. stdout so far:\n${stdout.text}`)
      );
    }, CHILD_STARTUP_TIMEOUT_MS);

    spawnedChild.stdout?.on('data', (chunk: Buffer) => {
      stdout.text += chunk.toString('utf8');
      if (settled) return;

      const match = /LISTENING:(\d+)/.exec(stdout.text);
      if (match?.[1]) {
        settled = true;
        clearTimeout(timer);
        promiseResolve({ port: Number(match[1]), stdout });
      }
    });

    spawnedChild.stderr?.on('data', (chunk: Buffer) => {
      stdout.text += chunk.toString('utf8');
    });

    spawnedChild.on('exit', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      promiseReject(new Error(`Fixture exited early (code ${String(code)}). stdout:\n${stdout.text}`));
    });

    spawnedChild.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      promiseReject(err);
    });
  });
}

/** Poll the shared stdout buffer until it contains `marker`, or time out. */
function waitForMarker(stdout: StdoutBuffer, marker: string): Promise<void> {
  return new Promise((promiseResolve, promiseReject) => {
    const start = Date.now();
    const poll = () => {
      if (stdout.text.includes(marker)) {
        promiseResolve();
        return;
      }
      if (Date.now() - start > CHILD_STARTUP_TIMEOUT_MS) {
        promiseReject(new Error(`Timed out waiting for marker "${marker}". stdout:\n${stdout.text}`));
        return;
      }
      setTimeout(poll, 25);
    };
    poll();
  });
}
