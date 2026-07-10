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

import {
  ERROR_MESSAGE,
  HELLO_WORLD,
  JSON_USER,
  LARGE_JSON,
  MIDDLEWARE_BODY,
  MIDDLEWARE_HEADERS,
  deepRoute,
  mwHeaderValue,
  postUserResponse,
  searchResponse,
  userById,
} from './_shared/payloads.js';

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

// 5-layer middleware stack — one header per layer, chained via await next().
const middleware = MIDDLEWARE_HEADERS.map((header) => async (ctx, next) => {
  ctx.set(header.name, mwHeaderValue(header));
  await next();
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

app.use(router.routes());
app.use(router.allowedMethods());

const server = app.listen(PORT, () => {
  console.log(`Koa server listening on http://localhost:${PORT}`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
