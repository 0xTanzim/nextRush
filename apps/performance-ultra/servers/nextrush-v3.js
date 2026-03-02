/**
 * NextRush v3 Performance Test Server
 *
 * Configuration:
 * - Production mode
 * - Conditional body parser (only for POST requests via route-specific middleware)
 * - No logging middleware
 * - Keep-alive enabled
 *
 * FAIRNESS NOTE:
 * Body parser is conditionally applied ONLY to POST requests
 * to ensure fair comparison with other frameworks. This matches
 * the behavior of Hono (lazy parsing) and is fairer than
 * always-on body parsing.
 */

import { listen } from '@nextrush/adapter-node';
import { json } from '@nextrush/body-parser';
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';

const app = createApp();
const router = createRouter();

// 1. Hello World - Baseline performance
router.get('/', async (ctx) => {
  ctx.json({ message: 'Hello World' });
});

// 2. Route Parameters - Router performance
router.get('/users/:id', async (ctx) => {
  const { id } = ctx.params;
  ctx.json({
    id,
    name: `User ${id}`,
    email: `user${id}@example.com`,
  });
});

// 3. Query Strings - Query parsing
router.get('/search', async (ctx) => {
  const { q = '', limit = '10' } = ctx.query;
  ctx.json({
    query: q,
    limit: parseInt(limit),
    results: Array.from({ length: Math.min(parseInt(limit), 10) }, (_, i) => ({
      id: i + 1,
      title: `Result ${i + 1} for "${q}"`,
    })),
  });
});

// 4. POST JSON - Body parser performance
router.post('/users', json(), async (ctx) => {
  const data = ctx.body;
  ctx.json({
    success: true,
    user: {
      id: Math.floor(Math.random() * 10000),
      ...data,
      createdAt: new Date().toISOString(),
    },
  });
});

app.route('/', router);

// Start server
const port = process.env.PORT || 3000;

// Self-invoking async function to properly await server start
let serverInstance;

(async () => {
  serverInstance = await listen(app, port);
  console.log(`🚀 NextRush listening on http://localhost:${port}`);
})();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  if (serverInstance) {
    await serverInstance.close();
  }
  console.log('NextRush v3 server closed');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  if (serverInstance) {
    await serverInstance.close();
  }
  console.log('NextRush v3 server closed');
  process.exit(0);
});

export { app };
