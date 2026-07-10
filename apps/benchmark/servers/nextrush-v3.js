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

import { listen } from '@nextrush/adapter-node';
import { json } from '@nextrush/body-parser';
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';

import {
  ERROR_BODY,
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

// Idiomatic error handler — invoked only when a route throws (no per-request cost).
app.setErrorHandler((_err, ctx) => {
  ctx.status = 500;
  ctx.json(ERROR_BODY);
});

app.route('/', router);

let serverInstance;
(async () => {
  serverInstance = await listen(app, PORT);
  console.log(`NextRush v3 listening on http://localhost:${PORT}`);
})();

const shutdown = async () => {
  if (serverInstance) await serverInstance.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
