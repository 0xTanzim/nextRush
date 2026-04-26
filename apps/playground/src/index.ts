import { bodyParser } from '@nextrush/body-parser';
import { controllersPlugin } from '@nextrush/controllers';
import { createApp, createRouter, serve } from 'nextrush';
import 'reflect-metadata';

function main() {
  const app = createApp();
  const router = createRouter();
  const port = 3000;

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

  app.route('/', router);

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
