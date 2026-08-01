/**
 * Fastify 5 benchmark server — all scenarios. Logger disabled.
 *
 * Fairness notes:
 * - Response bodies come from the shared payload module.
 * - The middleware scenario uses 5 `onRequest` hooks — Fastify's idiomatic
 *   equivalent of a middleware chain (Fastify has no Koa-style middleware).
 * - `setErrorHandler` fires only on error (no per-request cost).
 */

import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { KEEP_ALIVE_TIMEOUT_MS, LISTEN_BACKLOG, LISTEN_HOST } from '../config/constants.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

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

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.env.PORT || '8080', 10);
// Fairness: Fastify's own default `keepAliveTimeout` is 72_000 ms while every
// other server in this suite runs Node's/NextRush's 5_000 ms. Passed explicitly
// so the idle-socket window is a controlled variable — see KEEP_ALIVE_TIMEOUT_MS.
const fastify = Fastify({ logger: false, keepAliveTimeout: KEEP_ALIVE_TIMEOUT_MS });

fastify.get('/', () => HELLO_WORLD);
fastify.get('/json', () => JSON_USER);
fastify.get('/large-json', () => LARGE_JSON);

fastify.get('/users/:id', (req) => userById(req.params.id));

fastify.get('/search', (req) => searchResponse(req.query.q, req.query.limit));

fastify.get('/api/v1/orgs/:orgId/teams/:teamId/members/:memberId', (req) =>
  deepRoute(req.params.orgId, req.params.teamId, req.params.memberId)
);

fastify.post('/users', (req) => postUserResponse(req.body));

fastify.get('/send-object', () => SEND_OBJECT_BODY);

// bodyLimit raised past the default (default is exactly 1MB — the scenario
// body is ~1.5MB by design so it never rides the boundary of a default).
fastify.post(
  '/large-post',
  { bodyLimit: 5 * 1024 * 1024 },
  (req) => largePostResponse(Array.isArray(req.body?.items) ? req.body.items.length : 0)
);

fastify.register(fastifyStatic, {
  root: join(__dirname, '..', 'public'),
});

// 5-layer middleware stack — one onRequest hook per layer, scoped to /middleware.
fastify.register(async (instance) => {
  for (const header of MIDDLEWARE_HEADERS) {
    // Sync `done`-callback hook form, matching every other server's sync
    // middleware layer — an `async` hook would allocate a promise per layer
    // per request that no other server pays.
    instance.addHook('onRequest', (_req, reply, done) => {
      reply.header(header.name, mwHeaderValue(header));
      done();
    });
  }
  instance.get('/middleware', () => MIDDLEWARE_BODY);
});

fastify.get('/error', () => {
  throw new Error(ERROR_MESSAGE);
});

fastify.get('/empty', (_req, reply) => {
  reply.code(204).send();
});

// Sync, not `async`: the handler awaits nothing, and an async form would allocate
// a promise per error request that no other server's handler pays — the same
// per-layer-allocation rule the middleware hooks above already follow (audit F-26).
fastify.setErrorHandler((_error, _req, reply) => {
  reply.code(500).send(ERROR_BODY);
});

const start = async () => {
  await fastify.listen({ port: PORT, host: LISTEN_HOST, backlog: LISTEN_BACKLOG });
  console.log(`Fastify server listening on http://${LISTEN_HOST}:${PORT}`);
};
start();

const shutdown = async () => {
  await fastify.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
