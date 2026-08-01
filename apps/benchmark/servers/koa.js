/**
 * Koa 3 benchmark server — all scenarios.
 *
 * Fairness notes:
 * - Body parser is attached ONLY to the POST route (koa-router per-route
 *   middleware), not a global method-gated middleware that ran on every request
 *   (audit FAIR-04).
 * - Error handling relies on Koa's built-in 500 behavior with logging silenced
 *   (`app.silent`). Koa has no dedicated error-handler hook; its idiomatic form
 *   is either built-in handling or a per-request try/catch — the former is used
 *   so GET routes carry no per-request error-handling overhead.
 */

import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import Router from 'koa-router';
import serve from 'koa-static';
import { KEEP_ALIVE_TIMEOUT_MS, LISTEN_BACKLOG, LISTEN_HOST } from '../config/constants.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
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

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.env.PORT || '8080', 10);
const app = new Koa();
app.silent = true; // suppress default error logging to stderr (fair: no logging)
const router = new Router();

const jsonBodyParser = bodyParser({ enableTypes: ['json'] });

router.get('/', (ctx) => {
  ctx.body = HELLO_WORLD;
});
router.get('/json', (ctx) => {
  ctx.body = JSON_USER;
});
router.get('/large-json', (ctx) => {
  ctx.body = LARGE_JSON;
});

router.get('/users/:id', (ctx) => {
  ctx.body = userById(ctx.params.id);
});

router.get('/search', (ctx) => {
  ctx.body = searchResponse(ctx.query.q, ctx.query.limit);
});

router.get('/api/v1/orgs/:orgId/teams/:teamId/members/:memberId', (ctx) => {
  ctx.body = deepRoute(ctx.params.orgId, ctx.params.teamId, ctx.params.memberId);
});

// Body parser attached only to this route.
router.post('/users', jsonBodyParser, (ctx) => {
  ctx.body = postUserResponse(ctx.request.body);
});

router.get('/send-object', (ctx) => {
  ctx.body = SEND_OBJECT_BODY;
});

// A second parser instance with a raised jsonLimit (default is 1mb — the
// scenario body is ~1.5MB by design so it never rides that boundary).
const largeJsonParser = bodyParser({ enableTypes: ['json'], jsonLimit: '5mb' });
router.post('/large-post', largeJsonParser, (ctx) => {
  const items = ctx.request.body?.items;
  ctx.body = largePostResponse(Array.isArray(items) ? items.length : 0);
});

// 5-layer middleware stack — one header per layer, chained via await next().
// Sync layer returning next() rather than `async`/`await next()` — Koa awaits
// the returned promise either way, but the async form allocates an extra
// promise + state machine per layer that the sync servers do not pay.
const middleware = MIDDLEWARE_HEADERS.map((header) => (ctx, next) => {
  ctx.set(header.name, mwHeaderValue(header));
  return next();
});
router.get('/middleware', ...middleware, (ctx) => {
  ctx.body = MIDDLEWARE_BODY;
});

router.get('/error', () => {
  throw new Error(ERROR_MESSAGE);
});

router.get('/empty', (ctx) => {
  ctx.status = 204;
});

// koa-static has no prefix option (its root is joined with the full request
// path), so it is registered as a koa-router ROUTE rather than as a global
// `app.use()` layer. Two reasons, matching nextrush-v3.js's own note:
//  1. As a global layer it ran an fs.stat on every request before falling
//     through — a ~1.7x throughput loss on unrelated scenarios.
//  2. Even guarded by a path check, a global layer adds a middleware frame to
//     every request; registering as a route keeps unrelated scenarios at zero
//     added cost, which is how fastify/hono/nextrush serve static here.
// Root stays `public` so `/static/bench.txt` still joins to
// `public/static/bench.txt` (koa-static uses the full ctx.path).
const staticServe = serve(join(__dirname, '..', 'public'), { defer: false });
router.get('/static/*filepath', staticServe);

app.use(router.routes());
// `router.allowedMethods()` is deliberately NOT mounted. It made Koa the only
// server answering a wrong-method request with 405 + `Allow` (verified: every
// other server, NextRush included, returns 404), so Koa alone paid a
// per-request layer for a behavior no scenario exercises and no competitor
// provides. Removing it equalizes the measured path; it does not handicap Koa.

const server = app.listen({ port: PORT, host: LISTEN_HOST, backlog: LISTEN_BACKLOG }, () => {
  console.log(`Koa server listening on http://${LISTEN_HOST}:${PORT}`);
});
server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
