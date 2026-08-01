/**
 * NextRush v3 three-arm timeout diagnostic server — hello-world only.
 *
 * Isolates F-04's confound: `serve()` feeds one `timeout` option to both the
 * handler-level `Promise.race` and the socket-level `server.timeout` guard,
 * so a two-arm `timeout:0` vs. default A/B cannot attribute its result to
 * either mechanism. This server builds its own minimal `node:http` server
 * around `createHandler` directly (D4 — never through `serve()`'s
 * `ServeOptions`) so each arm can be selected via `ARM`:
 *
 *   - `default`       — both mechanisms active (production default)
 *   - `race-disabled` — handler race off, server.timeout stays configured
 *   - `both-disabled` — both mechanisms off (equivalent to `timeout: 0`)
 *
 * This is a DIAGNOSTIC harness, not part of the fairness-validated comparison
 * set — it serves only `hello-world` and is not registered in
 * `config/frameworks.js`'s default `--compare` set. Run it directly:
 *
 *   ARM=default node servers/nextrush-v3-timeout-diagnostic.js
 *   ARM=race-disabled node servers/nextrush-v3-timeout-diagnostic.js
 *   ARM=both-disabled node servers/nextrush-v3-timeout-diagnostic.js
 */

import { createHandler } from '@nextrush/adapter-node';
import { createApp } from '@nextrush/core';
import { createServer } from 'node:http';

import { HELLO_WORLD } from './_shared/payloads.js';

const PORT = parseInt(process.env.PORT || '8080', 10);
const ARM = process.env.ARM || 'default';

const VALID_ARMS = ['default', 'race-disabled', 'both-disabled'];
if (!VALID_ARMS.includes(ARM)) {
  console.error(`Unknown ARM "${ARM}". Expected one of: ${VALID_ARMS.join(', ')}`);
  process.exit(1);
}

const app = createApp();
app.use((ctx) => ctx.json(HELLO_WORLD));

const timeout = ARM === 'both-disabled' ? 0 : 30_000;
const diagnostics = ARM === 'race-disabled' ? { disableHandlerTimeoutRace: true } : undefined;

const handler = createHandler(app, { timeout }, diagnostics);
const server = createServer(handler);

// The socket-level guard: active at its configured value for `default` and
// `race-disabled`; 0 (Node's own disabled default) for `both-disabled`,
// mirroring `timeout: 0`'s existing pre-F-04 fast path exactly.
server.timeout = ARM === 'both-disabled' ? 0 : 30_000;

server.listen(PORT, () => {
  console.log(`NextRush v3 (timeout-diagnostic, ARM=${ARM}) listening on http://localhost:${PORT}`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
