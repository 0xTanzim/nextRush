import { createApp } from './index';
import type { Context } from './types/context';

const app = createApp();

// Route 1: /root/:param_1/abc/:param2
app.get('/root/:param_1/abc/:param2', async (ctx: Context) => {
  ctx.res.json({
    route: 'Route 1 - /root/:param_1/abc/:param2',
    message: 'Multi-level routing works!',
    parameters: {
      param_1: ctx.params['param_1'],
      param2: ctx.params['param2'],
    },
    path: ctx.path,
    timestamp: new Date().toISOString(),
  });
});

// Route 2: /root/:param_1/abc/:param2/xyz/:parm3
app.get('/root/:param_1/abc/:param2/xyz/:parm3', async (ctx: Context) => {
  ctx.res.json({
    route: 'Route 2 - /root/:param_1/abc/:param2/xyz/:parm3',
    message: 'Deep multi-level routing works!',
    parameters: {
      param_1: ctx.params['param_1'],
      param2: ctx.params['param2'],
      parm3: ctx.params['parm3'], // keeping your parameter name
    },
    path: ctx.path,
    timestamp: new Date().toISOString(),
  });
});

// Demo route to show both routes work
app.get('/', async (ctx: Context) => {
  ctx.res.json({
    message: 'NextRush v2 Multi-Level Routing Demo',
    availableRoutes: [
      {
        path: '/root/:param_1/abc/:param2',
        example: '/root/user123/abc/data456',
        description: '4-segment route with 2 parameters',
      },
      {
        path: '/root/:param_1/abc/:param2/xyz/:parm3',
        example: '/root/user123/abc/data456/xyz/item789',
        description: '6-segment route with 3 parameters',
      },
    ],
    testUrls: [
      'http://localhost:3000/root/user123/abc/data456',
      'http://localhost:3000/root/user123/abc/data456/xyz/item789',
      'http://localhost:3000/root/alpha/abc/beta/xyz/gamma',
      'http://localhost:3000/root/test-value/abc/another-test',
    ],
  });
});

// Additional routes to test all HTTP methods
app.post('/root/:param_1/abc/:param2', async (ctx: Context) => {
  ctx.res.json({
    method: 'POST',
    message: 'POST request to multi-level route',
    parameters: ctx.params,
  });
});

app.put('/root/:param_1/abc/:param2/xyz/:parm3', async (ctx: Context) => {
  ctx.res.json({
    method: 'PUT',
    message: 'PUT request to deep multi-level route',
    parameters: ctx.params,
  });
});

app.delete('/root/:param_1/abc/:param2', async (ctx: Context) => {
  ctx.res.json({
    method: 'DELETE',
    message: 'DELETE request to multi-level route',
    parameters: ctx.params,
  });
});

// Error handler
app.use(async (ctx: Context, next: () => Promise<void>) => {
  try {
    await next();

    if (ctx.res.statusCode === 404) {
      ctx.res.status(404).json({
        error: 'Route not found',
        message: `No route found for ${ctx.method} ${ctx.path}`,
        availableRoutes: [
          '/root/:param_1/abc/:param2',
          '/root/:param_1/abc/:param2/xyz/:parm3',
        ],
      });
    }
  } catch (error) {
    ctx.res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

const PORT = Number(process.env['PORT']) || 3000;

app.listen(PORT, () => {
  console.log(
    `🚀 NextRush v2 Multi-Level Routing Demo running on http://localhost:${PORT}`
  );
  console.log('\n📋 Available Routes:');
  console.log('  GET  / - Demo information');
  console.log('  GET  /root/:param_1/abc/:param2');
  console.log('  POST /root/:param_1/abc/:param2');
  console.log('  GET  /root/:param_1/abc/:param2/xyz/:parm3');
  console.log('  PUT  /root/:param_1/abc/:param2/xyz/:parm3');
  console.log('  DELETE /root/:param_1/abc/:param2');

  console.log('\n🧪 Test URLs:');
  console.log(`  curl http://localhost:${PORT}/root/user123/abc/data456`);
  console.log(
    `  curl http://localhost:${PORT}/root/user123/abc/data456/xyz/item789`
  );
  console.log(`  curl http://localhost:${PORT}/root/alpha/abc/beta/xyz/gamma`);
  console.log(`  curl -X POST http://localhost:${PORT}/root/test/abc/value`);
  console.log(
    `  curl -X PUT http://localhost:${PORT}/root/test/abc/value/xyz/final`
  );

  console.log(
    '\n💡 All your multi-level routing patterns are working correctly!'
  );
});

export { app };
