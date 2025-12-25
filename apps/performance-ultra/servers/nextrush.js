/**
 * NextRush v2 Performance Test Server
 *
 * Configuration:
 * - Production mode (debug: false)
 * - Conditional body parser (only for POST requests)
 * - No logging middleware
 * - Keep-alive enabled
 *
 * FAIRNESS NOTE:
 * Body parser is conditionally applied ONLY to POST requests
 * to ensure fair comparison with other frameworks. This matches
 * the behavior of Hono (lazy parsing) and is fairer than
 * always-on body parsing.
 */

import { createApp } from 'nextrush';

const app = createApp({
  port: 3000,
  debug: false,
  keepAlive: 5000,
  timeout: 30000,
});

// Get the body parser middleware
const jsonBodyParser = app.smartBodyParser({
  maxSize: 1024 * 1024, // 1MB
  enableStreaming: false,
});

// Conditional body parser - only parse POST/PUT/PATCH requests
// This is FAIR because other frameworks do the same
app.use(async (ctx, next) => {
  // Only parse body for methods that typically have a body
  if (ctx.method === 'POST' || ctx.method === 'PUT' || ctx.method === 'PATCH') {
    return jsonBodyParser(ctx, next);
  }
  // Skip body parsing for GET, DELETE, etc.
  return next();
});

// Test Routes (Fast by default!)

// 1. Hello World - Baseline performance (no body parsing overhead)
app.get('/', async ctx => {
  ctx.json({ message: 'Hello World' });
});

// 2. Route Parameters - Router performance (no body parsing overhead)
app.get('/users/:id', async ctx => {
  const { id } = ctx.params;
  ctx.json({
    id,
    name: `User ${id}`,
    email: `user${id}@example.com`,
  });
});

// 3. Query Strings - Query parsing (no body parsing overhead)
app.get('/search', async ctx => {
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

// 4. POST JSON - Body parser IS applied here (fair comparison)
app.post('/users', async ctx => {
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

// Start server
const server = app.listen(3000, () => {
  console.log('NextRush v2 server running on http://localhost:3000');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await app.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await app.shutdown();
  process.exit(0);
});

export { app, server };
