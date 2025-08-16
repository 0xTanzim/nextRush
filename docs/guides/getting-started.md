# Getting Started

Get NextRush v2 running in 5 minutes. This guide covers installation, your first API, and key concepts.

## What you'll build

A complete REST API with users, authentication, and error handling using all three routing styles NextRush v2 supports.

## Before you begin

- Node.js 18 or later
- TypeScript knowledge (basic)
- 5 minutes of your time

## Installation

Install NextRush v2:

```bash
npm install nextrush
# or
pnpm add nextrush
# or
yarn add nextrush
```

For development, install TypeScript tools:

```bash
npm install -D typescript tsx @types/node
```

## Your first server

Create `app.ts`:

```typescript
// app.ts
import { createApp } from 'nextrush';
import type { Context } from 'nextrush/types';

const app = createApp();

// Health check endpoint
app.get('/health', async (ctx: Context) => {
  ctx.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.0.0-alpha.1',
  });
});

app.listen(3000, () => {
  console.log('🚀 Server running on http://localhost:3000');
});
```

Run it:

```bash
npx tsx app.ts
```

Test it:

```bash
curl http://localhost:3000/health
```

You should see:

```json
{
  "status": "ok",
  "timestamp": "2025-08-16T10:30:00.000Z",
  "version": "2.0.0-alpha.1"
}
```

## Three routing styles

NextRush v2 supports three ways to define routes. Use what feels comfortable.

### 1. Convenience methods (recommended)

```typescript
// Modern, clean syntax
app.get('/users/:id', async ctx => {
  const user = await findUser(ctx.params.id);
  ctx.json(user);
});

app.post('/users', async ctx => {
  const userData = ctx.body as CreateUserData;
  const user = await createUser(userData);
  ctx.json(user, 201); // Status code as second parameter
});
```

### 2. Express-style methods

```typescript
// Familiar Express.js syntax
app.get('/users/:id', async ctx => {
  const user = await findUser(ctx.params.id);
  ctx.res.json(user);
});

app.post('/users', async ctx => {
  const userData = ctx.body as CreateUserData;
  const user = await createUser(userData);
  ctx.res.status(201).json(user);
});
```

### 3. Fastify-style configuration

```typescript
// Advanced configuration with schema and middleware
app.get('/users/:id', {
  handler: async ctx => {
    const user = await findUser(ctx.params.id);
    ctx.json(user);
  },
  schema: {
    params: {
      type: 'object',
      properties: {
        id: { type: 'string', minLength: 1 },
      },
      required: ['id'],
    },
    response: {
      200: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
        },
      },
    },
  },
  options: {
    name: 'getUser',
    description: 'Get user by ID',
    tags: ['users'],
  },
});
```

## Building a complete API

Let's build a real API with multiple endpoints, middleware, and error handling.

Create `server.ts`:

```typescript
// server.ts
import { createApp } from 'nextrush';
import type { Context, Middleware } from 'nextrush/types';

const app = createApp();

// Mock data
const users = [
  { id: '1', name: 'Alice', email: 'alice@example.com' },
  { id: '2', name: 'Bob', email: 'bob@example.com' },
];

// Request logging middleware
const logger: Middleware = async (ctx, next) => {
  const start = Date.now();
  console.log(`→ ${ctx.method} ${ctx.path}`);
  await next();
  const duration = Date.now() - start;
  console.log(`← ${ctx.status} ${duration}ms`);
};

// Error handling middleware
const errorHandler: Middleware = async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    console.error('Request failed:', error);
    ctx.res.status(500).json({
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
};

// Apply middleware
app.use(errorHandler);
app.use(logger);

// Routes using different styles

// 1. Convenience method style
app.get('/users', async ctx => {
  ctx.json({
    users,
    total: users.length,
    timestamp: new Date().toISOString(),
  });
});

// 2. Express-style with validation
app.get('/users/:id', async ctx => {
  const { id } = ctx.params;
  const user = users.find(u => u.id === id);

  if (!user) {
    ctx.res.status(404).json({ error: 'User not found' });
    return;
  }

  ctx.res.json(user);
});

// 3. Fastify-style with full configuration
app.post('/users', {
  handler: async ctx => {
    const userData = ctx.body as { name: string; email: string };

    // Validation
    if (!userData.name || !userData.email) {
      ctx.res.status(400).json({
        error: 'Name and email are required',
      });
      return;
    }

    // Create user
    const newUser = {
      id: String(users.length + 1),
      name: userData.name,
      email: userData.email,
    };

    users.push(newUser);
    ctx.json(newUser, 201);
  },
  schema: {
    body: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 2 },
        email: { type: 'string', format: 'email' },
      },
      required: ['name', 'email'],
    },
    response: {
      201: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
        },
      },
    },
  },
  options: {
    name: 'createUser',
    description: 'Create a new user',
    tags: ['users', 'create'],
  },
});

// Mixed style - Update user
app.put('/users/:id', async ctx => {
  const { id } = ctx.params;
  const userData = ctx.body as { name?: string; email?: string };

  const userIndex = users.findIndex(u => u.id === id);
  if (userIndex === -1) {
    ctx.res.status(404).json({ error: 'User not found' });
    return;
  }

  // Update user
  if (userData.name) users[userIndex].name = userData.name;
  if (userData.email) users[userIndex].email = userData.email;

  ctx.json(users[userIndex]);
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`
🚀 NextRush v2 API Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 http://localhost:${PORT}
👥 GET /users          - List all users
👤 GET /users/:id      - Get user by ID
➕ POST /users         - Create new user
✏️  PUT /users/:id      - Update user

✨ Ready to handle requests!
  `);
});
```

Test your API:

```bash
# Run the server
npx tsx server.ts

# Test in another terminal
curl http://localhost:3000/users
curl http://localhost:3000/users/1
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Charlie","email":"charlie@example.com"}'
```

## Key concepts

### Context object

The context (`ctx`) contains everything about the request and response:

```typescript
app.get('/demo', async ctx => {
  // Request data
  const method = ctx.method; // GET, POST, etc.
  const path = ctx.path; // /demo
  const params = ctx.params; // Route parameters
  const query = ctx.query; // Query string
  const body = ctx.body; // Request body
  const headers = ctx.headers; // Request headers

  // Response methods
  ctx.json({ data: 'response' }); // JSON response
  ctx.send('text response'); // Text response
  ctx.redirect('/other-page'); // Redirect
  ctx.res.status(201).json(data); // Express-style
});
```

### Middleware

Middleware functions run before route handlers:

```typescript
const authMiddleware: Middleware = async (ctx, next) => {
  const token = ctx.headers.authorization;

  if (!token) {
    ctx.res.status(401).json({ error: 'No token provided' });
    return; // Don't call next()
  }

  // Validate token and add user to context
  ctx.state.user = await validateToken(token);
  await next(); // Continue to next middleware or route
};

app.use(authMiddleware); // Apply to all routes
```

### Error handling

Handle errors gracefully:

```typescript
const errorHandler: Middleware = async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    console.error('Error:', error);

    if (error instanceof ValidationError) {
      ctx.res.status(400).json({ error: error.message });
    } else {
      ctx.res.status(500).json({ error: 'Internal server error' });
    }
  }
};

app.use(errorHandler);
```

## Next steps

You're ready to build with NextRush v2! Here's what to explore next:

### Build a real application

- **[Complete API example](../examples/complete-api.md)** - Full CRUD with auth
- **[WebSocket chat](../examples/websocket-chat.md)** - Real-time features
- **[File uploads](../examples/file-uploads.md)** - Handle multipart data

### Learn advanced features

- **[Middleware guide](../api/middleware.md)** - Built-in and custom middleware
- **[Error handling](../api/errors.md)** - Robust error management
- **[Plugins](../api/plugins.md)** - Extend functionality

### Performance and deployment

- **[Performance optimization](../guides/performance.md)** - Get maximum speed
- **[Production deployment](../guides/deployment.md)** - Deploy safely

## Troubleshooting

**TypeScript errors**: Make sure you have `@types/node` installed and TypeScript 4.8+

**Import errors**: Use `nextrush` as the import path, not `nextrush-v2`

**Port in use**: Change the port number or kill the existing process

**Request timeout**: Check middleware order - error handlers should be first

## See also

- [API Reference](../api/) - Complete documentation
- [Examples](../examples/) - Runnable code samples
- [Migration guide](../guides/migration.md) - From Express/Fastify/Koa

---

_Ready to build something amazing with NextRush v2!_
