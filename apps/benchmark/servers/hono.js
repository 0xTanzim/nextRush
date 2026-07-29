/**
 * Hono benchmark server — all scenarios via @hono/node-server.
 *
 * Fairness notes:
 * - Response bodies come from the shared payload module.
 * - `app.onError` is idiomatic and fires only on error (no per-request cost).
 */

import { createAdaptorServer } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { fileURLToPath } from 'node:url';

import { LISTEN_BACKLOG } from '../config/constants.js';

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
const app = new Hono();

// Fairness: Hono's c.json() emits `application/json` (no charset). Every other
// server emits `application/json; charset=utf-8`. This helper does the same work
// as c.json (stringify + set header) but with the identical content-type so
// responses are byte-identical on the wire, headers included (audit F-M02).
const CONTENT_TYPE = 'application/json; charset=utf-8';
const jsonRes = (c, obj, status = 200) => {
  c.header('Content-Type', CONTENT_TYPE);
  return c.body(JSON.stringify(obj), status);
};

app.get('/', (c) => jsonRes(c, HELLO_WORLD));
app.get('/json', (c) => jsonRes(c, JSON_USER));
app.get('/large-json', (c) => jsonRes(c, LARGE_JSON));

app.get('/users/:id', (c) => jsonRes(c, userById(c.req.param('id'))));

app.get('/search', (c) => jsonRes(c, searchResponse(c.req.query('q'), c.req.query('limit'))));

app.get('/api/v1/orgs/:orgId/teams/:teamId/members/:memberId', (c) =>
  jsonRes(c, deepRoute(c.req.param('orgId'), c.req.param('teamId'), c.req.param('memberId')))
);

app.post('/users', async (c) => jsonRes(c, postUserResponse(await c.req.json())));

app.get('/send-object', (c) => jsonRes(c, SEND_OBJECT_BODY));

app.post('/large-post', async (c) => {
  const body = await c.req.json();
  const items = body?.items;
  return jsonRes(c, largePostResponse(Array.isArray(items) ? items.length : 0));
});

app.use('/static/*', serveStatic({ root: fileURLToPath(new URL('../public', import.meta.url)) }));

// 5-layer middleware stack — one header per layer.
for (const header of MIDDLEWARE_HEADERS) {
  // Sync layer returning next() — see the koa/fastify notes: the async form
  // costs a promise per layer per request that the sync servers do not pay.
  app.use('/middleware', (c, next) => {
    c.header(header.name, mwHeaderValue(header));
    return next();
  });
}
app.get('/middleware', (c) => jsonRes(c, MIDDLEWARE_BODY));

app.get('/error', () => {
  throw new Error(ERROR_MESSAGE);
});

app.get('/empty', (c) => c.newResponse(null, 204));

app.onError((_err, c) => jsonRes(c, ERROR_BODY, 500));

// `serve()` has no backlog option, so the server is created without listening
// and `listen` is called directly — the only way to give Hono the same
// accept-queue depth as the other five servers.
const server = createAdaptorServer({ fetch: app.fetch });
server.listen({ port: PORT, backlog: LISTEN_BACKLOG }, () => {
  console.log(`Hono server listening on http://localhost:${PORT}`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
