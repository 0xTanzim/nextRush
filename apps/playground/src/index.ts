import 'reflect-metadata';

import { controllersPlugin } from '@nextrush/controllers';
import type { Context } from 'nextrush';
import { createApp, createRouter, listen } from 'nextrush';

async function main() {
  const app = createApp();
  const router = createRouter();

  console.log('\n\x1b[36m⚡ NextRush Playground App\x1b[0m\n');
  console.log('\x1b[90mDemonstrating BOTH functional and class-based patterns\x1b[0m\n');

  // ═══════════════════════════════════════════════════════════════════════════
  // STYLE 1: Functional/ctx-style Routes (Simple, Direct)
  // ═══════════════════════════════════════════════════════════════════════════

  // Basic JSON response
  router.get('/', (ctx: Context) => {
    ctx.json({
      message: 'Welcome to NextRush v3!',
      styles: {
        functional: ['/', '/health', '/echo', '/users', '/users/:id'],
        classControllers: ['/api/hello/*', '/api/test/*'],
      },
    });
  });

  // Health check endpoint
  router.get('/health', (ctx: Context) => {
    ctx.json({
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // Echo endpoint with query params
  router.get('/echo', (ctx: Context) => {
    ctx.json({
      method: ctx.method,
      path: ctx.path,
      query: ctx.query,
      headers: {
        'user-agent': ctx.get('user-agent'),
        'accept': ctx.get('accept'),
      },
    });
  });

  // Simple GET with data
  router.get('/users', (ctx: Context) => {
    ctx.json([
      { id: 1, name: 'Alice', role: 'admin' },
      { id: 2, name: 'Bob', role: 'user' },
      { id: 3, name: 'Charlie', role: 'user' },
    ]);
  });

  // Route params example
  router.get('/users/:id', (ctx: Context) => {
    const users = [
      { id: 1, name: 'Alice', email: 'alice@example.com' },
      { id: 2, name: 'Bob', email: 'bob@example.com' },
      { id: 3, name: 'Charlie', email: 'charlie@example.com' },
    ];

    const userId = parseInt(ctx.params.id ?? '0', 10);
    const user = users.find((u) => u.id === userId);

    if (!user) {
      ctx.status = 404;
      ctx.json({ error: 'User not found', id: userId });
      return;
    }

    ctx.json({ user });
  });

  // POST with body (requires body-parser middleware)
  router.post('/users', (ctx: Context) => {
    const body = ctx.body as { name?: string; email?: string } | undefined;

    if (!body?.name || !body?.email) {
      ctx.status = 400;
      ctx.json({ error: 'Name and email are required' });
      return;
    }

    ctx.status = 201;
    ctx.json({
      user: { id: Date.now(), name: body.name, email: body.email },
      message: 'User created successfully',
    });
  });

  console.log('✓ Functional routes registered');

  // ═══════════════════════════════════════════════════════════════════════════
  // STYLE 2: Class-based Controllers (DI, Decorators, Auto-discovery)
  // ═══════════════════════════════════════════════════════════════════════════

  // Register controllers (auto-discovers from ./src directory)
  await app.pluginAsync(
    controllersPlugin({
      router,
      root: './src',
      prefix: '/api',
      debug: true,
    })
  );

  console.log('✓ Class-based controllers registered\n');

  // Mount router
  app.use(router.routes());

  // Start server
  const port = parseInt(process.env.PORT || '3000', 10);
  listen(app, port);

  console.log('\n\x1b[32m═══ Available Endpoints ═══\x1b[0m');
  console.log('\x1b[33mFunctional (ctx-style):\x1b[0m');
  console.log('  GET  /           - Welcome message');
  console.log('  GET  /health     - Health check');
  console.log('  GET  /echo       - Echo request info');
  console.log('  GET  /users      - List users');
  console.log('  GET  /users/:id  - Get user by ID');
  console.log('  POST /users      - Create user');
  console.log('\x1b[33mClass Controllers (with DI):\x1b[0m');
  console.log('  GET  /api/hello/         - Hello message');
  console.log('  GET  /api/hello/service  - From HelloService');
  console.log('  GET  /api/hello/simple   - Auto-returned JSON');
  console.log('  GET  /api/test/          - Test endpoint');
  console.log('');
}

main().catch(console.error);
