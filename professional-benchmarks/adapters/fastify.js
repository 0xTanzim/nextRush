#!/usr/bin/env node

/**
 * 🚀 Fastify Adapter for Professional Benchmarking
 *
 * Optimized Fastify server for performance comparison
 */

import Fastify from 'fastify';
const port = process.argv[2] || 3002;

// Create Fastify instance with optimized settings
const fastify = Fastify({
  logger: false,
  disableRequestLogging: true,
  ignoreTrailingSlash: true,
  maxParamLength: 100,
});

// Basic route for simple performance testing
fastify.get('/', async (request, reply) => {
  return {
    message: 'Hello from Fastify!',
    timestamp: Date.now(),
    framework: 'fastify',
    version: '4.28.1',
  };
});

// JSON response test
fastify.get('/json', async (request, reply) => {
  return {
    framework: 'fastify',
    version: '4.28.1',
    timestamp: Date.now(),
    data: {
      message: 'Hello World',
      status: 'success',
      benchmark: true,
    },
  };
});

// Plain text response for minimal overhead testing
fastify.get('/plaintext', async (request, reply) => {
  reply.type('text/plain');
  return 'Hello World';
});

// Parameter parsing test
fastify.get('/users/:id/posts/:postId', async (request, reply) => {
  const { id, postId } = request.params;
  return {
    userId: id,
    postId: postId,
    timestamp: Date.now(),
  };
});

// Query parameter test
fastify.get('/search', async (request, reply) => {
  const { q = '', page = 1, limit = 10 } = request.query;
  return {
    query: q,
    page: parseInt(page),
    limit: parseInt(limit),
    timestamp: Date.now(),
  };
});

// POST request test
fastify.post('/data', async (request, reply) => {
  return {
    received: true,
    timestamp: Date.now(),
    body: request.body,
  };
});

// Error handling test
fastify.get('/error', async (request, reply) => {
  reply.status(500);
  return {
    error: 'Test error',
    code: 500,
    timestamp: Date.now(),
  };
});

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  return {
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: Date.now(),
  };
});

// Static file serving test (commented out due to version mismatch)
// try {
//   await fastify.register(import('@fastify/static'), {
//     root: path.join(process.cwd(), '../public'),
//     prefix: '/public/',
//   });
// } catch (e) {
//   console.warn('Static file serving not available:', e.message);
// }

// Middleware chain test (using hooks in Fastify)
fastify.addHook('preHandler', async (request, reply) => {
  request.middleware1 = true;
});

fastify.addHook('preHandler', async (request, reply) => {
  request.middleware2 = true;
});

fastify.get('/middleware-test', async (request, reply) => {
  return {
    middleware1: request.middleware1,
    middleware2: request.middleware2,
    timestamp: Date.now(),
  };
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Fastify benchmark server running on port ${port}`);
  } catch (err) {
    console.error('Error starting Fastify server:', err);
    process.exit(1);
  }
};

start();

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('Received shutdown signal, shutting down gracefully...');
  try {
    await fastify.close();
    console.log('Fastify server closed');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

export default fastify;
