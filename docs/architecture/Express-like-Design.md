# Express-like Design in NextRush v2

NextRush v2 combines the best of Koa's async middleware with Express's intuitive API design. This document explains how to use the Express-like features while maintaining the power of Koa-style context.

## Overview

NextRush v2 provides an Express-like developer experience while keeping the performance benefits of Koa's async middleware:

- **Koa-style Context**: Single `ctx` object for request/response handling
- **Express-like Properties**: `ctx.req`, `ctx.res`, `ctx.body` for intuitive access
- **Express-like Response Methods**: `ctx.res.json()`, `ctx.res.html()`, etc.
- **Express-like Request Body**: `ctx.body` for request body (not response)

## Context Object

The context object (`ctx`) provides Express-like access to request and response:

```typescript
import { createApp } from 'nextrush-v2';

const app = createApp();

app.get('/example', async ctx => {
  // Request properties (Express-like)
  console.log(ctx.req); // HTTP request object
  console.log(ctx.res); // Enhanced response object
  console.log(ctx.body); // Request body (Express-like)
  console.log(ctx.method); // 'GET'
  console.log(ctx.path); // '/example'
  console.log(ctx.url); // '/example?q=test'
  console.log(ctx.query); // { q: 'test' }
  console.log(ctx.headers); // Request headers
  console.log(ctx.params); // Route parameters
  console.log(ctx.ip); // Client IP
  console.log(ctx.secure); // true/false
  console.log(ctx.protocol); // 'http' or 'https'

  // Response methods (Express-like)
  ctx.res.json({ message: 'OK' });
});
```

## Request Body Access

Unlike Koa where `ctx.body` is for response, in NextRush v2 `ctx.body` is for **request body** (Express-like):

```typescript
app.post('/users', async ctx => {
  // ctx.body is the REQUEST body (Express-like)
  const { name, email } = ctx.body as { name?: string; email?: string };

  // Process the request body
  if (!name || !email) {
    ctx.res.status(400).json({ error: 'Name and email required' });
    return;
  }

  // Send response using ctx.res methods
  ctx.res.json({ message: 'User created', user: { name, email } });
});
```

## Enhanced Response Methods

NextRush v2 provides Express-like response methods on `ctx.res`:

### JSON Response

```typescript
app.get('/api/users', async ctx => {
  ctx.res.json({
    users: [
      { id: 1, name: 'John' },
      { id: 2, name: 'Jane' },
    ],
  });
});
```

### HTML Response

```typescript
app.get('/page', async ctx => {
  ctx.res.html(`
    <!DOCTYPE html>
    <html>
      <head><title>NextRush v2</title></head>
      <body><h1>Hello, World!</h1></body>
    </html>
  `);
});
```

### Text Response

```typescript
app.get('/text', async ctx => {
  ctx.res.text('Plain text response');
});
```

### CSV Response

```typescript
app.get('/data.csv', async ctx => {
  ctx.res.csv(
    'id,name,email\n1,John,john@example.com\n2,Jane,jane@example.com'
  );
});
```

### XML Response

```typescript
app.get('/data.xml', async ctx => {
  ctx.res.xml(`
    <?xml version="1.0" encoding="UTF-8"?>
    <users>
      <user id="1">
        <name>John</name>
        <email>john@example.com</email>
      </user>
    </users>
  `);
});
```

### File Download

```typescript
app.get('/download', async ctx => {
  ctx.res.download('/path/to/file.pdf', 'document.pdf');
});
```

### Redirect

```typescript
app.get('/old-page', async ctx => {
  ctx.res.redirect('/new-page', 301);
});
```

### Status and Headers

```typescript
app.post('/create', async ctx => {
  // Set status code
  ctx.res.status(201);

  // Set headers
  ctx.res.set('X-Custom-Header', 'value');
  ctx.res.set('Content-Type', 'application/json');

  // Send response
  ctx.res.json({ message: 'Created' });
});
```

## Object-Based Routes (Fastify-style)

NextRush v2 supports object-based route configuration without requiring explicit imports:

```typescript
// No need to import RouteConfig type!
app.post('/users', {
  handler: async ctx => {
    const { name, email } = ctx.body as { name?: string; email?: string };
    ctx.res.json({ message: 'User created', user: { name, email } });
  },
  schema: {
    body: {
      name: { type: 'string', required: true, minLength: 2 },
      email: { type: 'email', required: true },
    },
  },
  options: {
    name: 'createUser',
    description: 'Create a new user',
    tags: ['users'],
  },
});
```

## Modular Routing

NextRush v2 supports Express-like modular routing:

### Creating Routers

```typescript
import { createApp } from 'nextrush-v2';

const app = createApp();

// Create user router
const userRouter = app.router();

userRouter.get('/profile', async ctx => {
  ctx.res.json({ user: 'profile' });
});

userRouter.post('/login', async ctx => {
  const { email, password } = ctx.body;
  ctx.res.json({ message: 'Logged in' });
});

// Create admin router
const adminRouter = app.router();

adminRouter.get('/users', async ctx => {
  ctx.res.json({ admin: 'users list' });
});

adminRouter.post('/users', async ctx => {
  const { name, role } = ctx.body;
  ctx.res.json({ message: 'Admin user created' });
});

// Mount routers
app.use('/users', userRouter);
app.use('/admin', adminRouter);
```

### Router with Prefix

```typescript
import { createRouter } from 'nextrush-v2';

// Create router with prefix
const apiRouter = createRouter('/api/v1');

apiRouter.get('/users', async ctx => {
  ctx.res.json({ users: [] });
});

apiRouter.get('/users/:id', async ctx => {
  const id = ctx.params.id;
  ctx.res.json({ user: { id, name: `User ${id}` } });
});

// Mount the router
app.use(apiRouter);
```

### Nested Routers

```typescript
const userRouter = app.router();
const adminRouter = app.router();

// Admin routes
adminRouter.get('/dashboard', async ctx => {
  ctx.res.json({ admin: 'dashboard' });
});

// User routes
userRouter.get('/profile', async ctx => {
  ctx.res.json({ user: 'profile' });
});

// Nest admin router under user router
userRouter.use('/admin', adminRouter);

// Mount user router (admin routes become /users/admin/dashboard)
app.use('/users', userRouter);
```

## Middleware

NextRush v2 uses Koa-style async middleware:

```typescript
// Logging middleware
app.use(async (ctx, next) => {
  const start = Date.now();
  console.log(`${ctx.method} ${ctx.path} - ${new Date().toISOString()}`);

  await next();

  const duration = Date.now() - start;
  ctx.res.set('X-Response-Time', `${duration}ms`);
});

// Authentication middleware
app.use(async (ctx, next) => {
  const token = ctx.headers.authorization;

  if (!token && ctx.path.startsWith('/protected')) {
    ctx.res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  await next();
});

// Error handling middleware
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    ctx.res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal Server Error',
    });
  }
});
```

## Complete Example

```typescript
import { createApp } from 'nextrush-v2';

const app = createApp({
  port: 3000,
  debug: true,
  cors: true,
});

// Middleware
app.use(async (ctx, next) => {
  console.log(`${ctx.method} ${ctx.path}`);
  await next();
});

// Simple routes
app.get('/', async ctx => {
  ctx.res.json({ message: 'Welcome to NextRush v2!' });
});

app.get('/hello', async ctx => {
  const name = (ctx.query.name as string) || 'World';
  ctx.res.json({ message: `Hello, ${name}!` });
});

// Object-based route
app.post('/users', {
  handler: async ctx => {
    const { name, email } = ctx.body as { name?: string; email?: string };
    ctx.res.json({ message: 'User created', user: { name, email } });
  },
  schema: {
    body: {
      name: { type: 'string', required: true },
      email: { type: 'email', required: true },
    },
  },
});

// Router example
const apiRouter = app.router();

apiRouter.get('/data', async ctx => {
  ctx.res.json({ data: 'API data' });
});

app.use('/api', apiRouter);

// Start server
app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

## Migration from Express

If you're coming from Express.js, here are the key differences:

| Express                  | NextRush v2                        |
| ------------------------ | ---------------------------------- |
| `req.body`               | `ctx.body`                         |
| `res.json()`             | `ctx.res.json()`                   |
| `res.status()`           | `ctx.res.status()`                 |
| `res.set()`              | `ctx.res.set()`                    |
| `app.use(middleware)`    | `app.use(async (ctx, next) => {})` |
| `app.get(path, handler)` | `app.get(path, async (ctx) => {})` |

## Benefits

1. **Express-like DX**: Familiar API for Express developers
2. **Koa Performance**: Async middleware for better performance
3. **Type Safety**: Full TypeScript support with type inference
4. **Modular**: Router system for large applications
5. **Flexible**: Object-based routes for complex configurations
6. **No Imports**: Automatic type inference for route configs

## Best Practices

1. **Use `ctx.body` for request body**: Unlike Koa, `ctx.body` is for request data
2. **Use `ctx.res.json()` for responses**: Express-like response methods
3. **Use routers for modularity**: Organize routes by feature or module
4. **Use object-based routes for complex configs**: Schema validation, middleware, etc.
5. **Handle errors in middleware**: Use try-catch in middleware for error handling
6. **Use async/await**: All handlers and middleware should be async

This design provides the best of both worlds: Express's intuitive API with Koa's powerful async middleware system.
