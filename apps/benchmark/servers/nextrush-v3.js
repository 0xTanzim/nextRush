/**
 * NextRush v3 Benchmark Server
 *
 * All benchmark scenarios implemented with conditional body parser.
 * No logging middleware, production mode.
 */

import { listen } from '@nextrush/adapter-node';
import { json } from '@nextrush/body-parser';
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';

const PORT = parseInt(process.env.PORT || '3000', 10);

const app = createApp();
const router = createRouter();

// 1. Hello World — baseline
router.get('/', (ctx) => {
  ctx.json({ message: 'Hello World' });
});

// 2. JSON serialization — moderate payload
router.get('/json', (ctx) => {
  ctx.json({
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
    role: 'developer',
    active: true,
  });
});

// 3. Route parameters — router performance
router.get('/users/:id', (ctx) => {
  const { id } = ctx.params;
  ctx.json({ id, name: `User ${id}`, email: `user${id}@example.com` });
});

// 4. Query strings — query parsing
router.get('/search', (ctx) => {
  const { q = '', limit = '10' } = ctx.query;
  const limitNum = Math.min(parseInt(limit, 10), 10);
  ctx.json({
    query: q,
    limit: limitNum,
    results: Array.from({ length: limitNum }, (_, i) => ({
      id: i + 1,
      title: `Result ${i + 1} for "${q}"`,
    })),
  });
});

// 5. POST JSON — body parser performance
router.post('/users', json(), (ctx) => {
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

// 6. Deep route — radix tree depth
router.get('/api/v1/orgs/:orgId/teams/:teamId/members/:memberId', (ctx) => {
  ctx.json({
    orgId: ctx.params.orgId,
    teamId: ctx.params.teamId,
    memberId: ctx.params.memberId,
  });
});

// 7. Middleware stack — 5 layers (inline middleware on route)
const mw1 = (ctx) => {
  ctx.set('X-Request-Id', '12345');
  return ctx.next();
};
const mw2 = (ctx) => {
  ctx.set('X-Timestamp', Date.now().toString());
  return ctx.next();
};
const mw3 = (ctx) => {
  ctx.set('X-Framework', 'nextrush');
  return ctx.next();
};
const mw4 = (ctx) => {
  ctx.set('X-Version', '3.0');
  return ctx.next();
};
const mw5 = (ctx) => {
  ctx.set('X-Processed', 'true');
  return ctx.next();
};

router.get('/middleware', mw1, mw2, mw3, mw4, mw5, (ctx) => {
  ctx.json({ middleware: true, layers: 5 });
});

// 8. Error handling — error pipeline
router.get('/error', () => {
  throw new Error('Benchmark error');
});

// 9. Large JSON — payload serialization
const largeData = Array.from({ length: 50 }, (_, i) => ({
  id: i + 1,
  name: `User ${i + 1}`,
  email: `user${i + 1}@example.com`,
  role: i % 2 === 0 ? 'developer' : 'designer',
  active: i % 3 !== 0,
}));

router.get('/large-json', (ctx) => {
  ctx.json(largeData);
});

// 10. Empty response — 204 no content
router.get('/empty', (ctx) => {
  ctx.status = 204;
  ctx.send();
});

// Error handler — must wrap routes (Koa-style: add before routes)
app.use(async (ctx) => {
  try {
    await ctx.next();
  } catch {
    ctx.status = 500;
    ctx.json({ error: 'Internal Server Error' });
  }
});

app.route('/', router);

let serverInstance;
(async () => {
  serverInstance = await listen(app, PORT);
  console.log(`NextRush v3 listening on http://localhost:${PORT}`);
})();

const shutdown = async () => {
  if (serverInstance) await serverInstance.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
