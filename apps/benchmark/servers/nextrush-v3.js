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
import { serveStatic } from '@nextrush/static';

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

// Application-level middleware (runs for every request regardless of route
// match, unlike router.use() which seals into each registered route's own
// dispatch chain) — the correct mount point for static-file serving, which
// must handle a path with no registered route.
app.use(serveStatic({ root: new URL('../public', import.meta.url).pathname, fallthrough: true }));

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
