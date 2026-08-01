/**
 * Fixture for the graceful-shutdown integration test (T010, scenario 1.1).
 *
 * Runs as a REAL, standalone child process (plain `node`, no test-runner transform, no
 * `tsx` wrapper) so `process.kill(<child pid>, 'SIGTERM')` exercises the exact signal
 * path a production deployment would hit. Deliberately NOT run through `tsx`: `tsx`'s
 * CLI wrapper relays signals to its child over an internal IPC handshake and escalates
 * to `SIGKILL` if the child doesn't ack within its own short internal race window —
 * fundamentally incompatible with a real, time-bounded drain (confirmed by reading
 * `tsx`'s `relaySignalToChild`/`bindHiddenSignalsHandler` source directly). Plain `node`
 * has no such wrapper, so the drain's own `shutdownTimeout` is what actually governs
 * completion, matching how `serve()` behaves in a real deployment.
 *
 * Imports from the PUBLISHED `@nextrush/adapter-node` entry point (resolves through the
 * pnpm workspace to `dist/index.js`) rather than a relative source path — this plain
 * `.mjs` file has no TypeScript step, so it needs a real ESM module to import; the
 * parent test rebuilds this package immediately before spawning (see
 * `graceful-shutdown.integration.test.ts`'s `beforeAll`), so `dist/` always reflects the
 * current `adapter.ts` source, never a stale artifact.
 *
 * Contract with the parent test:
 * - Prints `LISTENING:<port>` once bound (port 0 = OS-assigned, avoids collisions).
 * - Prints `SLOW_REQUEST_START` when the slow handler begins.
 * - Prints `SLOW_REQUEST_DONE` right before the handler resolves, so the parent can
 *   distinguish "the drain let the handler finish" from "the process was killed".
 *
 * @packageDocumentation
 */

import { createApp } from '@nextrush/core';
import { serve } from '@nextrush/adapter-node';

const SLOW_REQUEST_DELAY_MS = Number(process.env.SLOW_REQUEST_DELAY_MS ?? '500');

const app = createApp();

app.use(async (ctx) => {
  console.log('SLOW_REQUEST_START');
  await new Promise((r) => setTimeout(r, SLOW_REQUEST_DELAY_MS));
  console.log('SLOW_REQUEST_DONE');
  ctx.json({ ok: true });
});

const server = await serve(app, {
  port: 0,
  host: '127.0.0.1',
  gracefulShutdown: true,
  shutdownTimeout: 5_000,
});

console.log(`LISTENING:${String(server.port)}`);
