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
const fastify = Fastify({ logger: false });

fastify.get('/', async () => HELLO_WORLD);
fastify.get('/json', async () => JSON_USER);
fastify.get('/large-json', async () => LARGE_JSON);

fastify.get('/users/:id', async (req) => userById(req.params.id));

fastify.get('/search', async (req) => searchResponse(req.query.q, req.query.limit));

fastify.get('/api/v1/orgs/:orgId/teams/:teamId/members/:memberId', async (req) =>
  deepRoute(req.params.orgId, req.params.teamId, req.params.memberId)
);

fastify.post('/users', async (req) => postUserResponse(req.body));

// 5-layer middleware stack — one onRequest hook per layer, scoped to /middleware.
fastify.register(async (instance) => {
  for (const header of MIDDLEWARE_HEADERS) {
    instance.addHook('onRequest', async (_req, reply) => {
      reply.header(header.name, mwHeaderValue(header));
    });
  }
  instance.get('/middleware', async () => MIDDLEWARE_BODY);
});

fastify.get('/error', async () => {
  throw new Error(ERROR_MESSAGE);
});

fastify.get('/empty', async (_req, reply) => {
  reply.code(204).send();
});

fastify.setErrorHandler(async (_error, _req, reply) => {
  reply.code(500).send(ERROR_BODY);
});

const start = async () => {
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`Fastify server listening on http://localhost:${PORT}`);
};
start();

const shutdown = async () => {
  await fastify.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
