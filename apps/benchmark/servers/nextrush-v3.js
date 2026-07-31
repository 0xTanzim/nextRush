/**
 * NextRush v3 benchmark server — all scenarios.
 *
 * Fairness notes:
 * - Response bodies come from the shared payload module.
 * - Error handling uses `app.setErrorHandler` (fires only on error, zero
 *   per-request overhead) — matching Fastify/Express/Hono's dedicated handlers
 *   instead of a per-request try/catch middleware (audit FAIR-04).
 * - The body parser is attached only to the POST route.
 */

import { serve } from '@nextrush/adapter-node';
import { json } from '@nextrush/body-parser';
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { createSendFile } from '@nextrush/static';
import { fileURLToPath } from 'node:url';

import { LISTEN_HOST } from '../config/constants.js';

import {
  ERROR_BODY,
  ERROR_MESSAGE,
  HELLO_WORLD,
  JSON_USER,
  LARGE_JSON,
  MIDDLEWARE_BODY,
  MIDDLEWARE_HEADERS,
  SEND_OBJECT_BODY,
  deepRoute,
  largePostResponse,
  mwHeaderValue,
  postUserResponse,
  searchResponse,
  userById,
} from './_shared/payloads.js';

const PORT = parseInt(process.env.PORT || '8080', 10);

const app = createApp();
const router = createRouter();

router.get('/', (ctx) => ctx.json(HELLO_WORLD));
router.get('/json', (ctx) => ctx.json(JSON_USER));
router.get('/large-json', (ctx) => ctx.json(LARGE_JSON));

router.get('/users/:id', (ctx) => ctx.json(userById(ctx.params.id)));

router.get('/search', (ctx) => ctx.json(searchResponse(ctx.query.q, ctx.query.limit)));

router.get('/api/v1/orgs/:orgId/teams/:teamId/members/:memberId', (ctx) =>
  ctx.json(deepRoute(ctx.params.orgId, ctx.params.teamId, ctx.params.memberId))
);

router.post('/users', json(), (ctx) => ctx.json(postUserResponse(ctx.body)));

router.get('/send-object', (ctx) => ctx.json(SEND_OBJECT_BODY));

// A raised limit (default is exactly 1MB — the scenario body is ~1.5MB by
// design so it never rides the boundary of the default).
router.post('/large-post', json({ limit: '5mb' }), (ctx) => {
  const itemCount = Array.isArray(ctx.body?.items) ? ctx.body.items.length : 0;
  ctx.json(largePostResponse(itemCount));
});

// 5-layer middleware stack — one header per layer, using the modern ctx.next()
// syntax (now works for per-route middleware after the router compileExecutor fix).
const middleware = MIDDLEWARE_HEADERS.map((header) => (ctx) => {
  ctx.set(header.name, mwHeaderValue(header));
  return ctx.next();
});
router.get('/middleware', ...middleware, (ctx) => ctx.json(MIDDLEWARE_BODY));

router.get('/error', () => {
  throw new Error(ERROR_MESSAGE);
});

router.get('/empty', (ctx) => {
  ctx.status = 204;
  ctx.send();
});

// Diagnostic-only — never added to config/scenarios.js, never probed by
// validate-parity.js. Polled externally by scripts/profile.js during a
// profiling run; not part of any fairness comparison (add-benchmark-cpu-
// allocation-profiling).
router.get('/__elu-sample', (ctx) => ctx.json(performance.eventLoopUtilization()));

// Idiomatic error handler — invoked only when a route throws (no per-request cost).
app.setErrorHandler((_err, ctx) => {
  ctx.status = 500;
  ctx.json(ERROR_BODY);
});

// Static serving is registered as a ROUTE, not as `app.use()` middleware, and
// this is load-bearing for measurement fairness in two separate ways:
//
// 1. An `app.use()` layer here would run on EVERY request. Without a `prefix`
//    that meant a `decodeURIComponent` + traversal scan + path join + async
//    `fs.stat` per request — measured at a 2.1x throughput loss on
//    `hello-world` (23.7k -> 11.2k RPS @128c).
// 2. Even WITH a prefix short-circuit, an `app.use()` layer pushes
//    `Application`'s middleware stack from 1 entry (`router.routes()`) to 2,
//    which drops `compose()` off its `len === 1` fast path onto the general
//    recursive-dispatch path — a further +725 B/req of promise allocation on
//    every request (`bench:alloc:compose`: 803.6 -> 1528.7 B/op).
//
// Registering as a route keeps the middleware stack at exactly 1 entry, so
// unrelated scenarios pay nothing at all — matching how fastify (route
// registration) and hono (router-scoped) serve static in this same suite.
// `createSendFile` keeps `safeJoin`'s path-traversal protection and the
// dotfile policy; it is not a hand-rolled resolver.
const sendStaticFile = createSendFile({
  root: fileURLToPath(new URL('../public/static', import.meta.url)),
});
router.get('/static/*', async (ctx) => {
  const served = await sendStaticFile(ctx, ctx.params['*'] ?? '');
  if (!served) {
    ctx.status = 404;
    ctx.json({ error: 'Not Found' });
  }
});

app.route('/', router);

let serverInstance;
(async () => {
  // `serve` rather than `listen(app, PORT)`: the shorthand accepts no `host`, and
  // the adapter would default to '0.0.0.0' while raw-node/express/koa/hono bind
  // Node's dual-stack default — an unequalized listen-socket address family
  // (see LISTEN_HOST). keepAliveTimeout is left at the adapter's own default,
  // which already equals KEEP_ALIVE_TIMEOUT_MS.
  serverInstance = await serve(app, { port: PORT, host: LISTEN_HOST });
  console.log(`NextRush v3 listening on http://${LISTEN_HOST}:${PORT}`);
})();

const shutdown = async () => {
  if (serverInstance) await serverInstance.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
