/**
 * Fastify 5 Benchmark Server — All scenarios.
 * Logger disabled, default config for fair comparison.
 */

import Fastify from 'fastify';

const PORT = parseInt(process.env.PORT || '3000', 10);
const fastify = Fastify({ logger: false });

// 1. Hello World
fastify.get('/', async () => ({ message: 'Hello World' }));

// 2. JSON serialization
fastify.get('/json', async () => ({
  id: 1,
  name: 'John Doe',
  email: 'john@example.com',
  role: 'developer',
  active: true,
}));

// 3. Route parameters
fastify.get('/users/:id', async (req) => {
  const { id } = req.params;
  return { id, name: `User ${id}`, email: `user${id}@example.com` };
});

// 4. Query strings
fastify.get('/search', async (req) => {
  const { q = '', limit = '10' } = req.query;
  const limitNum = Math.min(parseInt(limit, 10), 10);
  return {
    query: q,
    limit: limitNum,
    results: Array.from({ length: limitNum }, (_, i) => ({
      id: i + 1,
      title: `Result ${i + 1} for "${q}"`,
    })),
  };
});

// 5. POST JSON (Fastify has built-in lazy body parser)
fastify.post('/users', async (req) => {
  const data = req.body;
  return {
    success: true,
    user: { id: Math.floor(Math.random() * 10000), ...data, createdAt: new Date().toISOString() },
  };
});

// 6. Deep route
fastify.get('/api/v1/orgs/:orgId/teams/:teamId/members/:memberId', async (req) => ({
  orgId: req.params.orgId,
  teamId: req.params.teamId,
  memberId: req.params.memberId,
}));

// 7. Middleware stack (using hooks for Fastify-idiomatic approach)
fastify.register(async (instance) => {
  instance.addHook('onRequest', async (req, reply) => {
    reply.header('X-Request-Id', '12345');
  });
  instance.addHook('onRequest', async (req, reply) => {
    reply.header('X-Timestamp', Date.now().toString());
  });
  instance.addHook('onRequest', async (req, reply) => {
    reply.header('X-Framework', 'fastify');
  });
  instance.addHook('onRequest', async (req, reply) => {
    reply.header('X-Version', '5.0');
  });
  instance.addHook('onRequest', async (req, reply) => {
    reply.header('X-Processed', 'true');
  });

  instance.get('/middleware', async () => ({ middleware: true, layers: 5 }));
});

// 8. Error handling
fastify.get('/error', async () => {
  throw new Error('Benchmark error');
});

// 9. Large JSON
const largeData = Array.from({ length: 50 }, (_, i) => ({
  id: i + 1,
  name: `User ${i + 1}`,
  email: `user${i + 1}@example.com`,
  role: i % 2 === 0 ? 'developer' : 'designer',
  active: i % 3 !== 0,
}));

fastify.get('/large-json', async () => largeData);

// 10. Empty response
fastify.get('/empty', async (req, reply) => {
  reply.code(204).send();
});

// Custom error handler
fastify.setErrorHandler(async (error, req, reply) => {
  reply.code(500).send({ error: 'Internal Server Error' });
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
