# NextRush 🚀

A modern, fast, and testable HTTP server framework for Node.js with TypeScript-first design, clean architecture, and Express-like API. Zero dependencies, maximum performance.

## 🌟 Features

- **🎯 Express-Compatible API** - Familiar `app.get()`, `req`, `res` syntax
- **⚡ Zero Dependencies** - Lightweight and fast
- **🔷 TypeScript First** - Full type safety out of the box
- **🧪 Testable Architecture** - Clean code with dependency injection
- **🏗️ Clean Architecture** - Single responsibility, interface-based design
- **🛡️ Built-in Error Handling** - Comprehensive error management
- **🔄 Dual API Support** - Choose between Express-style or Context-based APIs

## 📦 Installation

```bash
npm install nextrush
# or
yarn add nextrush
# or
pnpm add nextrush
```

## 🚀 Quick Start (Express-Style API)

**This is the recommended approach for most developers** - familiar and easy to use:

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Hello from NextRush!' });
});

app.get('/users/:id', (req, res) => {
  const userId = req.param('id');
  res.json({ userId, name: `User ${userId}` });
});

app.post('/users', (req, res) => {
  const userData = req.body;
  res.status(201).json({
    message: 'User created',
    user: { id: Date.now(), ...userData },
  });
});

// Start server
app.listen(3000, () => {
  console.log('🚀 Server running on http://localhost:3000');
});
```

## 🔄 API Comparison

### Express-Style API (Recommended for most users)

**Pros:**

- ✅ Familiar Express.js syntax
- ✅ Easy migration from Express
- ✅ Quick to learn and use
- ✅ Extensive middleware ecosystem patterns

**Example:**

```typescript
app.get('/users/:id', (req, res) => {
  res.json({ userId: req.param('id') });
});
```

### Context-Based API (For advanced users)

**Pros:**

- ✅ Better testability
- ✅ More explicit dependencies
- ✅ Better TypeScript integration
- ✅ Cleaner separation of concerns

**Example:**

```typescript
app.get('/users/:id', async (context: RequestContext) => {
  const { response, params } = context;
  response.statusCode = 200;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify({ userId: params.id }));
});
```

## 🎯 When to Use Which API?

### Use Express-Style API when

- 🔄 Migrating from Express.js
- � Working with a team familiar with Express
- ⚡ Need to build quickly
- 📚 Want to leverage existing Express knowledge

### Use Context-Based API when

- 🧪 Writing extensive tests
- 🏗️ Building large, complex applications
- 🔷 Want maximum TypeScript safety
- 🎯 Need precise control over request/response handling

## 📦 Installation

```bash
npm install nextrush
```

```bash
yarn add nextrush
```

```bash
pnpm add nextrush
```

## 🚀 Quick Start

### Hello World in 30 seconds

```typescript
import { createApp, ResponseHandler } from 'nextrush';

const app = createApp();
const responseHandler = new ResponseHandler();

app.get('/', async (context) => {
  responseHandler.json(context.response, {
    message: 'Hello from NextRush!',
    timestamp: new Date().toISOString(),
  });
});

await app.listen(3000);
console.log('🚀 Server running on http://localhost:3000');
```

### Real-World Example

```typescript
import {
  createApp,
  createRouter,
  ResponseHandler,
  type RequestContext,
  type MiddlewareHandler,
  ValidationError,
  NotFoundError,
} from 'nextrush';

const app = createApp();
const responseHandler = new ResponseHandler();

// Middleware
const loggingMiddleware: MiddlewareHandler = async (context, next) => {
  const start = Date.now();
  console.log(`→ ${context.request.method} ${context.request.pathname}`);
  await next();
  console.log(
    `← ${context.request.method} ${context.request.pathname} (${
      Date.now() - start
    }ms)`
  );
};

// Routes
app.use(loggingMiddleware);

app.get('/users/:id', async (context) => {
  const userId = context.params.id;

  if (!userId || isNaN(Number(userId))) {
    throw new ValidationError('User ID must be a valid number');
  }

  // Simulate database lookup
  const user = {
    id: userId,
    name: `User ${userId}`,
    email: `user${userId}@example.com`,
  };
  responseHandler.json(context.response, user);
});

app.post('/users', async (context) => {
  const userData = context.body as { name: string; email: string };

  if (!userData.name || !userData.email) {
    throw new ValidationError('Name and email are required');
  }

  const newUser = {
    id: Date.now(),
    ...userData,
    createdAt: new Date().toISOString(),
  };

  responseHandler.json(context.response, newUser, 201);
});

// Error handling
app.use(async (context, next) => {
  try {
    await next();
  } catch (error) {
    if (error instanceof ValidationError) {
      responseHandler.error(context.response, error.message, 400);
    } else {
      responseHandler.error(context.response, 'Internal Server Error', 500);
    }
  }
});

await app.listen(3000);
```

## 🏗️ Core Concepts

### Application

The main application instance that handles HTTP requests.

```typescript
import { createApp, Application } from 'nextrush';

// Factory function (recommended)
const app = createApp();

// Direct instantiation with options
const app = new Application({
  timeout: 30000,
  maxRequestSize: 1024 * 1024, // 1MB
});
```

### Routing

Express-like routing with parameter support.

```typescript
// Basic routes
app.get('/users', getUsersHandler);
app.post('/users', createUserHandler);
app.put('/users/:id', updateUserHandler);
app.delete('/users/:id', deleteUserHandler);

// Route parameters
app.get('/users/:id', async (context) => {
  const userId = context.params.id;
  // Handle user by ID
});

// Multiple parameters
app.get('/users/:userId/posts/:postId', async (context) => {
  const { userId, postId } = context.params;
  // Handle user's specific post
});

// Query parameters
app.get('/search', async (context) => {
  const { q, limit, page } = context.query;
  // Handle search with query parameters
});
```

### Middleware

Composable middleware functions with async/await support.

```typescript
import { MiddlewareHandler } from 'nextrush';

// Authentication middleware
const authMiddleware: MiddlewareHandler = async (context, next) => {
  const authHeader = context.request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return responseHandler.error(context.response, 'Unauthorized', 401);
  }

  // Verify token logic here
  await next();
};

// CORS middleware
const corsMiddleware: MiddlewareHandler = async (context, next) => {
  context.response.setHeader('Access-Control-Allow-Origin', '*');
  context.response.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE'
  );
  await next();
};

// Apply middleware
app.use(authMiddleware);
app.use(corsMiddleware);

// Route-specific middleware
app.get('/protected', authMiddleware, protectedHandler);
```

### Response Handling

Built-in response helpers for common operations.

```typescript
import { ResponseHandler } from 'nextrush';

const responseHandler = new ResponseHandler();

// JSON responses
responseHandler.json(context.response, { data: 'value' });
responseHandler.json(context.response, { data: 'value' }, 201);

// Text responses
responseHandler.text(context.response, 'Hello World');
responseHandler.html(context.response, '<h1>Hello</h1>');

// Redirects
responseHandler.redirect(context.response, '/new-url');
responseHandler.redirect(context.response, '/moved', 301);

// Error responses
responseHandler.error(context.response, 'Not Found', 404);

// Custom headers
responseHandler.setHeaders(context.response, {
  'X-API-Version': '1.0',
  'Cache-Control': 'no-cache',
});
```

### Router

Create modular routers for better organization.

```typescript
import { createRouter } from 'nextrush';

// User router
const userRouter = createRouter();

userRouter.get('/', getAllUsers);
userRouter.get('/:id', getUserById);
userRouter.post('/', createUser);
userRouter.put('/:id', updateUser);
userRouter.delete('/:id', deleteUser);

// Admin router
const adminRouter = createRouter();
adminRouter.use(adminAuthMiddleware); // Apply to all admin routes
adminRouter.get('/dashboard', adminDashboard);

// Mount routers
app.mount('/api/users', userRouter);
app.mount('/admin', adminRouter);
```

## 🔧 Advanced Features

### Custom Error Handling

```typescript
import { ErrorHandler, NextRushError } from 'nextrush';

const errorHandler = new ErrorHandler({
  includeStack: process.env.NODE_ENV === 'development',
  logErrors: true,
  customErrorHandler: (error, context) => {
    // Send to monitoring service
    console.error('Application Error:', error);
  },
});

const app = createApp({ errorHandler });

// Custom error types
class CustomError extends NextRushError {
  constructor(message: string) {
    super(message, 'CUSTOM_ERROR', 400);
  }
}
```

### Request Body Parsing

```typescript
import { BodyParser } from 'nextrush';

const bodyParser = new BodyParser({
  maxSize: 10 * 1024 * 1024, // 10MB
  allowedContentTypes: [
    'application/json',
    'application/x-www-form-urlencoded',
    'text/plain',
  ],
  timeout: 30000,
});

const app = createApp({
  requestHandler: new RequestHandler(bodyParser),
});

// Handle JSON data
app.post('/api/data', async (context) => {
  const jsonData = context.body; // Automatically parsed
  responseHandler.json(context.response, { received: jsonData });
});
```

### Type Safety

Full TypeScript support with custom context types.

```typescript
import { RequestContext } from 'nextrush';

// Extend context with custom properties
interface CustomContext extends RequestContext {
  user?: {
    id: string;
    name: string;
    role: string;
  };
}

const authMiddleware: MiddlewareHandler = async (
  context: CustomContext,
  next
) => {
  // Add user to context
  context.user = await validateToken(context.request.headers.authorization);
  await next();
};

const protectedRoute = async (context: CustomContext) => {
  // Type-safe access to user
  const userName = context.user?.name;
  responseHandler.json(context.response, { user: userName });
};
```

## 🧪 Testing

NextRush is designed for easy testing with dependency injection.

```typescript
// test/app.test.ts
import { Application, RequestHandler, ErrorHandler } from 'nextrush';

describe('NextRush Application', () => {
  let app: Application;
  let mockRequestHandler: jest.Mocked<RequestHandler>;

  beforeEach(() => {
    mockRequestHandler = {
      handle: jest.fn(),
    } as any;

    app = new Application({
      requestHandler: mockRequestHandler,
    });
  });

  it('should handle requests correctly', async () => {
    // Test your application with mocked dependencies
    expect(mockRequestHandler.handle).toHaveBeenCalled();
  });
});
```

## 📊 Performance

NextRush offers excellent performance characteristics:

- **Fast startup** - Minimal initialization overhead
- **Low memory usage** - Efficient request handling
- **High throughput** - Optimized for concurrent requests
- **Zero dependencies** - No external dependency overhead

## 🔒 Security Features

Built-in security features to protect your applications:

- **Request validation** - Automatic input sanitization
- **Path traversal protection** - Prevents directory traversal attacks
- **Request size limits** - Configurable body size limits
- **Timeout handling** - Request timeout protection

## 🔄 Migration from Express

NextRush provides a familiar API for Express users:

```typescript
// Express
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.json({ message: 'Hello' });
});

app.listen(3000);

// NextRush
import { createApp, ResponseHandler } from 'nextrush';

const app = createApp();
const responseHandler = new ResponseHandler();

app.get('/', async (context) => {
  responseHandler.json(context.response, { message: 'Hello' });
});

await app.listen(3000);
```

## 📚 API Reference

### Core Classes

- **`Application`** - Main application class
- **`Router`** - Router for organizing routes
- **`RequestHandler`** - Handles HTTP request parsing
- **`ResponseHandler`** - Provides response utilities
- **`BodyParser`** - Parses request bodies
- **`ErrorHandler`** - Manages error responses

### Factory Functions

- **`createApp(options?)`** - Create application instance
- **`createRouter(options?)`** - Create router instance

### Types

- **`RequestContext`** - Request/response context
- **`RouteHandler`** - Route handler function type
- **`MiddlewareHandler`** - Middleware function type
- **`HttpMethod`** - HTTP method types
- **`ApplicationOptions`** - Application configuration options

## 🌟 Examples

### Basic REST API

```typescript
import { createApp, ResponseHandler, ValidationError } from 'nextrush';

const app = createApp();
const responseHandler = new ResponseHandler();

// In-memory store
let users = [{ id: 1, name: 'John Doe', email: 'john@example.com' }];

// GET /users - List all users
app.get('/users', async (context) => {
  responseHandler.json(context.response, users);
});

// GET /users/:id - Get user by ID
app.get('/users/:id', async (context) => {
  const userId = parseInt(context.params.id);
  const user = users.find((u) => u.id === userId);

  if (!user) {
    return responseHandler.error(context.response, 'User not found', 404);
  }

  responseHandler.json(context.response, user);
});

// POST /users - Create new user
app.post('/users', async (context) => {
  const { name, email } = context.body as any;

  if (!name || !email) {
    throw new ValidationError('Name and email are required');
  }

  const newUser = {
    id: users.length + 1,
    name,
    email,
  };

  users.push(newUser);
  responseHandler.json(context.response, newUser, 201);
});

// Error handling
app.use(async (context, next) => {
  try {
    await next();
  } catch (error) {
    if (error instanceof ValidationError) {
      responseHandler.error(context.response, error.message, 400);
    } else {
      responseHandler.error(context.response, 'Internal Server Error', 500);
    }
  }
});

await app.listen(3000);
console.log('🚀 REST API running on http://localhost:3000');
```

### Middleware Example

```typescript
import { createApp, ResponseHandler, type MiddlewareHandler } from 'nextrush';

const app = createApp();
const responseHandler = new ResponseHandler();

// Request logging middleware
const logger: MiddlewareHandler = async (context, next) => {
  const start = Date.now();
  const { method, pathname } = context.request;

  console.log(`→ ${method} ${pathname}`);
  await next();

  const duration = Date.now() - start;
  console.log(
    `← ${method} ${pathname} ${context.response.statusCode} (${duration}ms)`
  );
};

// Rate limiting middleware
const rateLimit: MiddlewareHandler = async (context, next) => {
  // Simple rate limiting logic
  const clientIP = context.request.connection.remoteAddress;

  // Check rate limit for clientIP
  // If exceeded, return 429 Too Many Requests

  await next();
};

// Apply middleware globally
app.use(logger);
app.use(rateLimit);

app.get('/', async (context) => {
  responseHandler.json(context.response, { message: 'Hello World!' });
});

await app.listen(3000);
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 Links

- [GitHub Repository](https://github.com/0xTanzim/nextrush)
- [npm Package](https://www.npmjs.com/package/nextrush)
- [Issue Tracker](https://github.com/0xTanzim/nextrush/issues)
- [Documentation](https://github.com/0xTanzim/nextrush#readme)
- [Changelog](CHANGELOG.md)

## 💖 Support

If you find NextRush helpful, please consider:

- ⭐ Starring the repository
- 🐛 Reporting bugs
- 💡 Suggesting features
- 📖 Improving documentation
- 🤝 Contributing code

---

**Built with ❤️ by [Tanzim Hossain](https://github.com/0xTanzim)**

_NextRush - Fast, Modern, TypeScript-First HTTP Server Framework_
