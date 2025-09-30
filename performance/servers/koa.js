/**
 * Koa Performance Test Server
 *
 * Configuration:
 * - Production mode
 * - koa-bodyparser for JSON
 * - koa-router for routing
 * - No logging middleware
 */

const Koa = require('koa');
const Router = require('koa-router');
const bodyParser = require('koa-bodyparser');

const app = new Koa();
const router = new Router();

// Body parser for POST routes
app.use(bodyParser({ jsonLimit: '1mb' }));

// Test Routes

// 1. Hello World - Baseline performance
router.get('/', async ctx => {
  ctx.body = { message: 'Hello World' };
});

// 2. Route Parameters - Router performance
router.get('/users/:id', async ctx => {
  const { id } = ctx.params;
  ctx.body = {
    id,
    name: `User ${id}`,
    email: `user${id}@example.com`,
  };
});

// 3. Query Strings - Query parsing
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

// 4. POST JSON - Body parser performance
router.post('/users', async ctx => {
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

module.exports = { app, server };
