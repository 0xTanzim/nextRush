/**
 * TypeScript Example for NextRush
 *
 * This example shows how to use NextRush with TypeScript
 * including type safety and custom interfaces.
 */

import {
  createApp,
  ResponseHandler,
  validate,
  ValidationRules,
  type MiddlewareHandler,
  type RequestContext,
} from '../src';

// Custom interfaces
interface User {
  id: number;
  name: string;
  email: string;
  role: 'user' | 'admin';
  createdAt?: string;
  updatedAt?: string;
}

interface CreateUserRequest {
  name: string;
  email: string;
  role?: 'user' | 'admin';
}

interface CustomContext extends RequestContext {
  user?: User;
}

// Create app and response handler
const app = createApp();
const responseHandler = new ResponseHandler();

// Type-safe middleware
const authMiddleware: MiddlewareHandler = async (
  context: CustomContext,
  next
) => {
  const authHeader = context.request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return responseHandler.error(context.response, 'Unauthorized', 401);
  }

  const token = authHeader.slice(7);

  // Mock user validation - in real app, validate JWT token
  if (token === 'valid-token') {
    context.user = {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      role: 'admin',
    };
    await next();
  } else {
    return responseHandler.error(context.response, 'Invalid token', 401);
  }
};

// Type-safe logging middleware
const typedLoggingMiddleware: MiddlewareHandler = async (context, next) => {
  const start = Date.now();
  console.log(`→ ${context.request.method} ${context.request.pathname}`);

  await next();

  const duration = Date.now() - start;
  console.log(
    `← ${context.request.method} ${context.request.pathname} (${duration}ms)`
  );
};

app.use(typedLoggingMiddleware);

// Users storage
const users: User[] = [
  { id: 1, name: 'John Doe', email: 'john@example.com', role: 'admin' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'user' },
];

// Type-safe route handlers
app.get('/', async (context: RequestContext) => {
  responseHandler.json(context.response, {
    message: 'NextRush TypeScript Example',
    version: '1.1.0',
    endpoints: [
      'GET /users - Get all users',
      'POST /users - Create user',
      'GET /protected - Protected route (requires auth)',
    ],
  });
});

app.get('/users', async (context: RequestContext) => {
  responseHandler.json(context.response, { users });
});

app.post('/users', async (context: RequestContext) => {
  const userData = context.body as CreateUserRequest;

  // Type-safe validation
  const nameValidation = validate(userData?.name, [
    ValidationRules.required,
    ValidationRules.minLength(2),
    ValidationRules.maxLength(50),
  ]);

  const emailValidation = validate(userData?.email, [
    ValidationRules.required,
    ValidationRules.email,
  ]);

  if (!nameValidation.isValid || !emailValidation.isValid) {
    const errors = [...nameValidation.errors, ...emailValidation.errors];
    return responseHandler.error(context.response, errors.join(', '), 400);
  }

  const newUser: User = {
    id: users.length + 1,
    name: userData.name,
    email: userData.email,
    role: userData.role || 'user',
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  responseHandler.json(context.response, { user: newUser }, 201);
});


app.get(
  '/protected',
  async (context: CustomContext) => {
    responseHandler.json(context.response, {
      message: 'This is a protected route',
      user: context.user,
    });
  },
  authMiddleware
);

// Generic error handler
const errorHandler = async (error: Error, context: RequestContext) => {
  console.error('Error:', error.message);
  responseHandler.error(context.response, 'Internal Server Error', 500);
};

// Start server with proper error handling
const startServer = async (): Promise<void> => {
  try {
    const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

    await app.listen(PORT);

    console.log(
      `🚀 TypeScript NextRush server started on http://localhost:${PORT}`
    );
    console.log('\n📍 Available endpoints:');
    console.log('  GET  /           - Welcome message');
    console.log('  GET  /users      - Get all users');
    console.log('  POST /users      - Create user');
    console.log('  GET  /protected  - Protected route');
    console.log('\n🔑 For protected route, use:');
    console.log(
      '  curl -H "Authorization: Bearer valid-token" http://localhost:' +
        PORT +
        '/protected'
    );
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async (): Promise<void> => {
  console.log('\n🛑 Shutting down gracefully...');
  try {
    await app.close();
    console.log('✅ Server closed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start the server
startServer();
