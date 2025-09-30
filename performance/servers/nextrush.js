/**
 * NextRush v2 Performance Test Server
 *
 * Configuration:
 * - Production mode (debug: false)
 * - Smart body parser
 * - No logging middleware
 * - Keep-alive enabled
 */

const { createApp } = require('../../dist/index.js');
const app = createApp({
  port: 3000,
  debug: false,
  keepAlive: 5000,
  timeout: 30000,
});

// Body parser for POST routes
app.use(
  app.smartBodyParser({
    maxSize: 1024 * 1024, // 1MB
    enableStreaming: false,
  })
);

// Test Routes

// 1. Hello World - Baseline performance
app.get('/', async ctx => {
  ctx.json({ message: 'Hello World' });
});

// 2. Route Parameters - Router performance
app.get('/users/:id', async ctx => {
  const { id } = ctx.params;
  ctx.json({
    id,
    name: `User ${id}`,
    email: `user${id}@example.com`,
  });
});

// 3. Query Strings - Query parsing
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

// 4. POST JSON - Body parser performance
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

module.exports = { app, server };
