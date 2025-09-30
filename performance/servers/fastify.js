/**
 * Fastify Performance Test Server
 *
 * Configuration:
 * - Production mode
 * - Built-in JSON parser
 * - No logging
 */

const fastify = require('fastify')({
  logger: false,
  ignoreTrailingSlash: true,
  caseSensitive: true,
});

// Test Routes

// 1. Hello World - Baseline performance
fastify.get('/', async (request, reply) => {
  return { message: 'Hello World' };
});

// 2. Route Parameters - Router performance
fastify.get('/users/:id', async (request, reply) => {
  const { id } = request.params;
  return {
    id,
    name: `User ${id}`,
    email: `user${id}@example.com`,
  };
});

// 3. Query Strings - Query parsing
fastify.get('/search', async (request, reply) => {
  const { q = '', limit = '10' } = request.query;
  return {
    query: q,
    limit: parseInt(limit),
    results: Array.from({ length: Math.min(parseInt(limit), 10) }, (_, i) => ({
      id: i + 1,
      title: `Result ${i + 1} for "${q}"`,
    })),
  };
});

// 4. POST JSON - Body parser performance
fastify.post('/users', async (request, reply) => {
  const data = request.body;
  return {
    success: true,
    user: {
      id: Math.floor(Math.random() * 10000),
      ...data,
      createdAt: new Date().toISOString(),
    },
  };
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log('Fastify server running on http://localhost:3000');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await fastify.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await fastify.close();
  process.exit(0);
});

module.exports = { fastify };
