/**
 * Hono Benchmark Server — All scenarios via @hono/node-server.
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';

const PORT = parseInt(process.env.PORT || '3000', 10);
const app = new Hono();

// 1. Hello World
app.get('/', (c) => c.json({ message: 'Hello World' }));

// 2. JSON serialization
app.get('/json', (c) =>
  c.json({ id: 1, name: 'John Doe', email: 'john@example.com', role: 'developer', active: true })
);

// 3. Route parameters
app.get('/users/:id', (c) => {
  const id = c.req.param('id');
  return c.json({ id, name: `User ${id}`, email: `user${id}@example.com` });
});

// 4. Query strings
app.get('/search', (c) => {
  const q = c.req.query('q') || '';
  const limit = Math.min(parseInt(c.req.query('limit') || '10', 10), 10);
  return c.json({
    query: q,
    limit,
    results: Array.from({ length: limit }, (_, i) => ({
      id: i + 1,
      title: `Result ${i + 1} for "${q}"`,
    })),
  });
});

// 5. POST JSON
app.post('/users', async (c) => {
  const data = await c.req.json();
  return c.json({
    success: true,
    user: { id: Math.floor(Math.random() * 10000), ...data, createdAt: new Date().toISOString() },
  });
});

// 6. Deep route
app.get('/api/v1/orgs/:orgId/teams/:teamId/members/:memberId', (c) => {
  return c.json({
    orgId: c.req.param('orgId'),
    teamId: c.req.param('teamId'),
    memberId: c.req.param('memberId'),
  });
});

// 7. Middleware stack — 5 middleware layers
app.use('/middleware', async (c, next) => {
  c.header('X-Request-Id', '12345');
  await next();
});
app.use('/middleware', async (c, next) => {
  c.header('X-Timestamp', Date.now().toString());
  await next();
});
app.use('/middleware', async (c, next) => {
  c.header('X-Framework', 'hono');
  await next();
});
app.use('/middleware', async (c, next) => {
  c.header('X-Version', '4.0');
  await next();
});
app.use('/middleware', async (c, next) => {
  c.header('X-Processed', 'true');
  await next();
});
app.get('/middleware', (c) => c.json({ middleware: true, layers: 5 }));

// 8. Error handling
app.get('/error', () => {
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

app.get('/large-json', (c) => c.json(largeData));

// 10. Empty response
app.get('/empty', (c) => {
  c.status(204);
  return c.body(null);
});

// Error handler
app.onError((err, c) => {
  return c.json({ error: 'Internal Server Error' }, 500);
});

const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`Hono server listening on http://localhost:${info.port}`);
});

const shutdown = () => {
  server.close(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
