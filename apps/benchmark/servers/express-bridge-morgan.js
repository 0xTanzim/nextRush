/**
 * NextRush bridged-morgan benchmark server — RFC-035 A/B/C arm B.
 *
 * Identical app shape to `nextrush-v3.js` (native arm A) PLUS a single
 * `compat(morgan('tiny'))` layer, so the ONLY difference between arm A and
 * arm B / hello-world is the bridge wrapping Morgan. Response bodies come from
 * the shared payload module and are byte-identical to arm A/C, so the p50/p99
 * delta isolates the bridged-path cost of wrapping a Connect/Express
 * (req, res, next) middleware as a NextRush `Middleware`.
 *
 * Fairness note: morgan writes to its own stream (stderr default sink here via
 * the default `Stream`), so it adds the middleware's per-request cost without
 * altering the response bytes — the same tradeoff Express arm C makes.
 */

import { serve } from '@nextrush/adapter-node';
import { json } from '@nextrush/body-parser';
import { createApp } from '@nextrush/core';
import { compat } from '@nextrush/express-bridge';
import { createRouter } from '@nextrush/router';
import { fileURLToPath } from 'node:url';
import morgan from 'morgan';

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

// Arm B: the bridged Express middleware wraps the whole request onion before
// the router. This is the only structural difference from native arm A.
app.use(compat(morgan('tiny')));
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

router.post('/large-post', json({ limit: '5mb' }), (ctx) => {
  const itemCount = Array.isArray(ctx.body?.items) ? ctx.body.items.length : 0;
  ctx.json(largePostResponse(itemCount));
});

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

app.setErrorHandler((_err, ctx) => {
  ctx.status = 500;
  ctx.json(ERROR_BODY);
});

app.route('/', router);

let serverInstance;
(async () => {
  serverInstance = await serve(app, { port: PORT, host: LISTEN_HOST });
  console.log(`NextRush bridged-morgan listening on http://${LISTEN_HOST}:${PORT}`);
})();

const shutdown = async () => {
  if (serverInstance) await serverInstance.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);