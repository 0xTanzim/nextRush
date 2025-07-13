/**
 * Basic NextRush Server Example
 *
 * This example demonstrates the basic usage of NextRush framework
 * including routing, middleware, and request handling.
 */

import { createApp, ResponseHandler } from 'nextrush';

const app = createApp();
const responseHandler = new ResponseHandler();

// Global logging middleware
app.use(async (context, next) => {
  const start = Date.now();
  console.log(`→ ${context.request.method} ${context.request.pathname}`);

  await next();

  const duration = Date.now() - start;
  console.log(
    `← ${context.request.method} ${context.request.pathname} (${duration}ms)`
  );
});

// Basic routes
app.get('/', async (context) => {
  responseHandler.json(context.response, {
    message: 'Welcome to NextRush!',
    version: '1.1.0',
    features: [
      'Fast HTTP server',
      'TypeScript support',
      'Clean architecture',
      'Express-like API',
    ],
  });
});

app.get('/health', async (context) => {
  responseHandler.json(context.response, {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Route with parameters
app.get('/users/:id', async (context) => {
  const userId = context.params.id;

  responseHandler.json(context.response, {
    user: {
      id: userId,
      name: `User ${userId}`,
      email: `user${userId}@example.com`,
    },
  });
});

// POST route with body handling
app.post('/users', async (context) => {
  try {
    const userData = context.body;

    if (!userData || !userData.name) {
      return responseHandler.error(context.response, 'Name is required', 400);
    }

    const newUser = {
      id: Date.now(),
      ...userData,
      createdAt: new Date().toISOString(),
    };

    responseHandler.json(context.response, newUser, 201);
  } catch (error) {
    responseHandler.error(context.response, 'Failed to create user', 500);
  }
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(Number(PORT)).then(() => {
  console.log(`🚀 NextRush server started on http://localhost:${PORT}`);
  console.log('\n📍 Available endpoints:');
  console.log('  GET  /           - Welcome message');
  console.log('  GET  /health     - Health check');
  console.log('  GET  /users/:id  - Get user by ID');
  console.log('  POST /users      - Create new user');
  console.log('\n🧪 Test with curl:');
  console.log(`  curl http://localhost:${PORT}/health`);
  console.log(`  curl http://localhost:${PORT}/users/123`);
  console.log(
    `  curl -X POST http://localhost:${PORT}/users -H "Content-Type: application/json" -d '{"name":"John","email":"john@example.com"}'`
  );
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await app.close();
  process.exit(0);
});
