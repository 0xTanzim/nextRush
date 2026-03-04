/**
 * Express 5 Benchmark Server — All scenarios.
 */

import express from 'express';

const PORT = parseInt(process.env.PORT || '3000', 10);
const app = express();

// Body parser ONLY for POST routes (fair comparison)
const jsonParser = express.json();

// 1. Hello World
app.get('/', (req, res) => {
  res.json({ message: 'Hello World' });
});

// 2. JSON serialization
app.get('/json', (req, res) => {
  res.json({ id: 1, name: 'John Doe', email: 'john@example.com', role: 'developer', active: true });
});

// 3. Route parameters
app.get('/users/:id', (req, res) => {
  const { id } = req.params;
  res.json({ id, name: `User ${id}`, email: `user${id}@example.com` });
});

// 4. Query strings
app.get('/search', (req, res) => {
  const { q = '', limit = '10' } = req.query;
  const limitNum = Math.min(parseInt(limit, 10), 10);
  res.json({
    query: q,
    limit: limitNum,
    results: Array.from({ length: limitNum }, (_, i) => ({
      id: i + 1,
      title: `Result ${i + 1} for "${q}"`,
    })),
  });
});

// 5. POST JSON
app.post('/users', jsonParser, (req, res) => {
  const data = req.body;
  res.json({
    success: true,
    user: { id: Math.floor(Math.random() * 10000), ...data, createdAt: new Date().toISOString() },
  });
});

// 6. Deep route
app.get('/api/v1/orgs/:orgId/teams/:teamId/members/:memberId', (req, res) => {
  res.json({ orgId: req.params.orgId, teamId: req.params.teamId, memberId: req.params.memberId });
});

// 7. Middleware stack
const mw1 = (req, res, next) => {
  res.set('X-Request-Id', '12345');
  next();
};
const mw2 = (req, res, next) => {
  res.set('X-Timestamp', Date.now().toString());
  next();
};
const mw3 = (req, res, next) => {
  res.set('X-Framework', 'express');
  next();
};
const mw4 = (req, res, next) => {
  res.set('X-Version', '5.0');
  next();
};
const mw5 = (req, res, next) => {
  res.set('X-Processed', 'true');
  next();
};

app.get('/middleware', mw1, mw2, mw3, mw4, mw5, (req, res) => {
  res.json({ middleware: true, layers: 5 });
});

// 8. Error handling
app.get('/error', (req, res) => {
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

app.get('/large-json', (req, res) => {
  res.json(largeData);
});

// 10. Empty response
app.get('/empty', (req, res) => {
  res.status(204).end();
});

// Error handler middleware
app.use((err, req, res, _next) => {
  res.status(500).json({ error: 'Internal Server Error' });
});

const server = app.listen(PORT, () => {
  console.log(`Express server listening on http://localhost:${PORT}`);
});

const shutdown = () => {
  server.close(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
