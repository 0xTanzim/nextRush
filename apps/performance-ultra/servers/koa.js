/**
 * Koa Performance Test Server
 *
 * Configuration:
 * - Production mode
 * - koa-bodyparser ONLY on POST routes (fair comparison)
 * - koa-router for routing
 * - No logging middleware
 *
 * FAIRNESS NOTE:
 * Body parser is applied ONLY to POST routes to ensure fair
 * comparison with other frameworks. This matches the behavior
 * of Hono where body parsing only happens when actually needed.
 */

import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import Router from 'koa-router';

const app = new Koa();
const router = new Router();

// Suppress EPIPE errors during high-load benchmarks
app.on('error', (err) => {
  if (err.code === 'EPIPE' || err.code === 'ECONNRESET') {
    return;
  }
  console.error('Koa server error:', err);
});

// Body parser middleware (will be applied conditionally)
const parseBody = bodyParser({ jsonLimit: '1mb' });

// Test Routes

// 1. Hello World - Baseline performance (no body parser overhead)
router.get('/', async ctx => {
  ctx.body = { message: 'Hello World' };
});

// 2. Route Parameters - Router performance (no body parser overhead)
router.get('/users/:id', async ctx => {
  const { id } = ctx.params;
  ctx.body = {
    id,
    name: `User ${id}`,
    email: `user${id}@example.com`,
  };
});

// 3. Query Strings - Query parsing (no body parser overhead)
router.get('/search', async ctx => {
  const { q = '', limit = '10' } = ctx.query;
  ctx.body = {
    query: q,
    limit: parseInt(limit),
    results: Array.from({ length: Math.min(parseInt(limit), 10) }, (_, i) => ({
      id: i + 1,
      title: `Result ${i + 1} for "${q}"`,
    })),
  };
});

// 4. POST JSON - Body parser applied ONLY here (fair comparison)
router.post('/users', parseBody, async ctx => {
  const data = ctx.request.body;
  ctx.body = {
    success: true,
    user: {
      id: Math.floor(Math.random() * 10000),
      ...data,
      createdAt: new Date().toISOString(),
    },
  };
});

app.use(router.routes());
app.use(router.allowedMethods());

// Start server
const server = app.listen(3000, () => {
  console.log('Koa server running on http://localhost:3000');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Koa server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Koa server closed');
    process.exit(0);
  });
});

export { app, server };
