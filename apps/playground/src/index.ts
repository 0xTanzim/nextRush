import { bodyParser } from '@nextrush/body-parser';
import { controllersPlugin } from '@nextrush/controllers';
import { errorHandler } from '@nextrush/errors';
import { openapi } from '@nextrush/openapi';
import { validate } from '@nextrush/validation';
import { createApp, createRouter, endpoint, serve } from 'nextrush';
import 'reflect-metadata';
import { z } from 'zod';

function main() {
  const app = createApp();
  const router = createRouter();
  const port = Number(process.env.PORT ?? 8080);

  // Error handler must be the outermost middleware so it can catch anything
  // thrown downstream — including @nextrush/validation's ValidationError.
  app.use(errorHandler({ includeStack: process.env.NODE_ENV !== 'production' }));

  // Body parser middleware (required for @Body decorator)
  app.use(bodyParser());

  // ──────────────────────────────────────
  // Functional Routes (dual paradigm test)
  // ──────────────────────────────────────
  router.get('/hello', (ctx) => {
    ctx.json({ message: 'Hello from functional route!' });
  });

  router.get('/echo', (ctx) => {
    ctx.json({
      method: ctx.method,
      path: ctx.path,
      query: ctx.query,
      headers: {
        host: ctx.get('host'),
        userAgent: ctx.get('user-agent'),
      },
    });
  });

  // ──────────────────────────────────────
  // @nextrush/validation — real end-to-end proof
  // ──────────────────────────────────────

  // Golden path: validate(schema) — validates + overwrites ctx.body in place.
  const CreateUser = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    age: z.coerce.number().int().min(0).optional(),
  });

  router.post('/validate/user', validate(CreateUser),
    endpoint({
      summary: 'Create a user',
      tags: ['users'],
      responses: { 201: CreateUser },
    }),
    (ctx) => {
      ctx.status = 201;
      ctx.json({ received: ctx.body });
    }
  );

  // Advanced path: query-only — validated but intentionally left unmodified.
  const SearchQuery = z.object({
    q: z.string().min(1),
    sort: z.enum(['asc', 'desc']).default('asc'),
  });

  router.get('/validate/search', validate({ query: SearchQuery }), (ctx) => {
    ctx.json({ q: ctx.query.q, sort: ctx.query.sort });
  });

  // Advanced path: params + query together.
  const UserIdParam = z.object({ id: z.string().uuid() });
  const PageQuery = z.object({ page: z.coerce.number().int().min(1).optional() });

  router.get(
    '/validate/users/:id',
    validate({ params: UserIdParam, query: PageQuery }),
    (ctx) => {
      ctx.json({ id: ctx.params.id, page: ctx.query.page });
    }
  );

  app.route('/', router);

  // ──────────────────────────────────────
  // OpenAPI — zero-config, reads route metadata (validate() + endpoint())
  // GET /openapi.json + GET /docs
  // ──────────────────────────────────────
  app.plugin(
    openapi({
      router,
      info: { title: 'NextRush Playground API', version: '1.0.0' },
    })
  );

  // ──────────────────────────────────────
  // Class-Based Controllers (DI + Decorators)
  // Uses the SAME router — controllersPlugin registers
  // routes with /api prefix directly on it
  // ──────────────────────────────────────

  app.plugin(
    controllersPlugin({
      router,
      root: './src',
      prefix: '/api',
    })
  );

  // ──────────────────────────────────────
  // Start Server
  // ──────────────────────────────────────
  serve(app, {
    port,
    onListen: () => {
      console.log(`\n🚀 NextRush Playground running at http://localhost:${port}`);
      console.log('\n📋 Available endpoints:');
      console.log('  Functional:');
      console.log('    GET  /hello');
      console.log('    GET  /echo');
      console.log('  Validation (@nextrush/validation):');
      console.log('    POST /validate/user       (body schema)');
      console.log('    GET  /validate/search     (query schema)');
      console.log('    GET  /validate/users/:id  (params + query schemas)');
      console.log('  Controllers (class-based):');
      console.log('    GET  /api/health');
      console.log('    GET  /api/health/ready');
      console.log('    GET  /api/users');
      console.log('    GET  /api/users/:id');
      console.log('    GET  /api/users/ctx-test');
      console.log('    POST /api/users          (requires Authorization header)');
      console.log('    PUT  /api/users/:id       (requires Authorization header)');
      console.log('    DEL  /api/users/:id       (requires Authorization header)');
      console.log('    GET  /api/items');
      console.log('    GET  /api/items/:id');
      console.log('    POST /api/items           (requires Bearer admin-token)');
      console.log('');
    },
    onError: (err) => {
      console.error('Server error:', err);
    },
  });
}

main();
