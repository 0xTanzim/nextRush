/**
 * NextRush + compat(response-time()) benchmark server — RFC-035 brigged path
 * for a LIGHTER middleware than `morgan`, to demonstrate that the bridged-path
 * cost is middleware-dependent (proportional to how much the middleware touches
 * req/res through the proxy) rather than a flat tax.
 *
 * response-time sets `X-Response-Time` via the `on-headers` surface, so it
 * exercises the bridge's writeHead pass-through — a realistic, small-surface
 * logger-like middleware (a `Full` registry cell).
 *
 * Serves byte-identical `{ message: 'Hello World' }` on `/`.
 */

import { serve } from '@nextrush/adapter-node';
import { createApp } from '@nextrush/core';
import { compat } from '@nextrush/express-bridge';
import { createRouter } from '@nextrush/router';
import responseTime from 'response-time';
import { LISTEN_HOST } from '../config/constants.js';
import { HELLO_WORLD } from './_shared/payloads.js';

const PORT = parseInt(process.env.PORT || '8080', 10);

const app = createApp();
app.use(compat(responseTime({ digits: 3 })));

const router = createRouter();
router.get('/', (ctx) => ctx.json(HELLO_WORLD));
app.route('/', router);

let serverInstance;
(async () => {
  serverInstance = await serve(app, { port: PORT, host: LISTEN_HOST });
  console.log(`NextRush + compat(response-time) listening on http://${LISTEN_HOST}:${PORT}`);
})();

const shutdown = async () => {
  if (serverInstance) await serverInstance.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);