# NextRush v2 Documentation

Welcome to NextRush v2 - a high-performance, type-safe web framework built on **Koa-style middleware** with **Express-inspired helpers**, **Fastify-style routing**, and modern convenience methods.

## What you get

NextRush v2 gives you three API styles on a Koa-style foundation: Convenience methods, Enhanced API (Express-inspired helpers), and Fastify-style configuration.

```typescript
import { createApp } from 'nextrush';
import type { Context } from 'nextrush/types';

const app = createApp();

app.get('/users/:id', async (ctx: Context) => {
  const userId = ctx.params.id; // Route parameters
  const requestData = ctx.body; // Request body (like req.body)

  // Three ways to send responses:
  ctx.json({ id: userId, name: 'Ada' }); // Convenience method
  ctx.res.json({ id: userId, name: 'Ada' }); // Enhanced API
  ctx.send({ id: userId, name: 'Ada' }); // Smart send method
});

app.listen(3000);
```

## Before you begin

You need Node.js 18 or later.

## Quick start

Install NextRush v2:

```bash
npm install nextrush
```

Create your first server:

```typescript
// app.ts
import { createApp } from 'nextrush';

const app = createApp();

app.get('/hello', async ctx => {
  ctx.json({ message: 'Hello, NextRush v2' }); // Convenience method
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

Run it:

```bash
npx tsx app.ts
```

Visit http://localhost:3000/hello and see your API in action.

## Documentation sections

### Getting started

- **[Installation and setup](./guides/getting-started.md)** - Get NextRush v2 running in 5 minutes
- **[Your first API](./examples/first-api.md)** - Build a complete REST API

### Core concepts

- **[Application](./api/application.md)** - Create and configure your app
- **[Context](./api/context.md)** - Koa-style context enhanced with Express-inspired helpers
- **[Routing](./api/routing.md)** - Define routes with multiple API styles on Koa-style middleware
- **[Middleware](./api/middleware.md)** - Built-in middleware and custom middleware

### Advanced features

- **[Error handling](./api/errors.md)** - Robust error handling with type safety
- **[Plugins](./api/plugins.md)** - Extend NextRush with plugins
- **[WebSocket](./api/websocket.md)** - Real-time communication
- **[Dependency injection](./api/dependency-injection.md)** - Built-in DI container

### Plugins

- **[Logger](./plugins/logger.md)** - Structured logging with multiple transports
- **[Static files](./plugins/static-files.md)** - Serve static content efficiently
- **[Template engine](./plugins/template.md)** - Server-side rendering

### Examples

- **[Basic API](./examples/basic-api.md)** - Simple CRUD operations
- **[Advanced API](./examples/advanced-api.md)** - Real-world API with authentication
- **[WebSocket chat](./examples/websocket-chat.md)** - Real-time messaging

## Key features

**Three API styles**: Convenience methods, Enhanced API (Express-inspired), or Fastify-style config

```typescript
// Convenience methods (recommended)
app.get('/users', ctx => ctx.json(users));

// Enhanced API (Express-inspired helpers)
app.get('/users', ctx => ctx.res.json(users));

// Fastify-style configuration
app.get('/users', {
  handler: ctx => ctx.json(users),
  schema: {
    response: { 200: UserArraySchema },
  },
  options: {
    name: 'getUsers',
    description: 'Get all users',
  },
});
```

**Type safety first**: Full TypeScript support with no `any` types

```typescript
import type { Context } from 'nextrush/types';

app.get('/users/:id', async (ctx: Context) => {
  const id = ctx.params.id; // string (typed automatically)
  const user = await findUser(id);
  ctx.res.json(user); // Type-safe response
});
```

**Performance optimized**: Sub-millisecond response times

- Zero runtime dependencies
- Optimized router with O(k) lookup
- Memory pooling for high throughput
- Built-in caching

**Production ready**: Enterprise-grade features out of the box

- Built-in error handling
- Request validation
- Security middleware (CORS, Helmet)
- Structured logging
- Graceful shutdown

## Performance

NextRush v2 delivers exceptional performance:

- **Response time**: < 1ms for simple routes
- **Throughput**: > 50,000 requests/second
- **Memory**: Low memory footprint with pooling
- **Startup**: Fast cold starts

## See also

- [API Reference](./api/) - Complete API documentation
- [Migration guide](./guides/migration.md) - Upgrade from Express or Koa
- [Architecture](./architecture/) - Framework design and principles

---

_Version: 2.0.0-alpha.1 | Node.js: >=18.0.0_
