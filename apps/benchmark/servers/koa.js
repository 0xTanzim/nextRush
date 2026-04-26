/**
 * Koa 3 Benchmark Server — All scenarios.
 * With koa-router and koa-bodyparser.
 */

import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import Router from 'koa-router';

const PORT = parseInt(process.env.PORT || '3000', 10);
const app = new Koa();
const router = new Router();

// Body parser — conditional on POST to match other frameworks (avoid penalizing GET routes)
const jsonBodyParser = bodyParser({ enableTypes: ['json'] });
app.use(async (ctx, next) => {
  if (ctx.method === 'POST') {
    return jsonBodyParser(ctx, next);
  }
  return next();
});

// 1. Hello World
router.get('/', (ctx) => {
  ctx.body = { message: 'Hello World' };
});

// 2. JSON serialization
router.get('/json', (ctx) => {
  ctx.body = {
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
    role: 'developer',
    active: true,
  };
});

// 3. Route parameters
router.get('/users/:id', (ctx) => {
  const { id } = ctx.params;
  ctx.body = { id, name: `User ${id}`, email: `user${id}@example.com` };
});

// 4. Query strings
router.get('/search', (ctx) => {
  const { q = '', limit = '10' } = ctx.query;
  const limitNum = Math.min(parseInt(limit, 10), 10);
  ctx.body = {
    query: q,
    limit: limitNum,
    results: Array.from({ length: limitNum }, (_, i) => ({
      id: i + 1,
      title: `Result ${i + 1} for "${q}"`,
    })),
  };
});

// 5. POST JSON
router.post('/users', (ctx) => {
  const data = ctx.request.body;
  ctx.body = {
    success: true,
    user: { id: Math.floor(Math.random() * 10000), ...data, createdAt: new Date().toISOString() },
  };
});

// 6. Deep route
router.get('/api/v1/orgs/:orgId/teams/:teamId/members/:memberId', (ctx) => {
  ctx.body = { orgId: ctx.params.orgId, teamId: ctx.params.teamId, memberId: ctx.params.memberId };
});

// 7. Middleware stack
const mw1 = async (ctx, next) => {
  ctx.set('X-Request-Id', '12345');
  await next();
};
const mw2 = async (ctx, next) => {
  ctx.set('X-Timestamp', Date.now().toString());
  await next();
};
const mw3 = async (ctx, next) => {
  ctx.set('X-Framework', 'koa');
  await next();
};
const mw4 = async (ctx, next) => {
  ctx.set('X-Version', '3.0');
  await next();
};
const mw5 = async (ctx, next) => {
  ctx.set('X-Processed', 'true');
  await next();
};

router.get('/middleware', mw1, mw2, mw3, mw4, mw5, (ctx) => {
  ctx.body = { middleware: true, layers: 5 };
});

// 8. Error handling
router.get('/error', (ctx) => {
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

router.get('/large-json', (ctx) => {
  ctx.body = largeData;
});

// 10. Empty response
router.get('/empty', (ctx) => {
  ctx.status = 204;
});

// Error handler
app.use(async (ctx, next) => {
  try {
    await next();
  } catch {
    ctx.status = 500;
    ctx.body = { error: 'Internal Server Error' };
  }
});

app.use(router.routes());
app.use(router.allowedMethods());

const server = app.listen(PORT, () => {
  console.log(`Koa server listening on http://localhost:${PORT}`);
});

const shutdown = () => {
  server.close(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
