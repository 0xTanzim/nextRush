# Routing Guide

NextRush v2 supports three routing styles: Express-like methods, Fastify-style configuration, and modern convenience methods. Use whichever feels most comfortable.

## What you get

Three ways to define the same route with different levels of configuration and type safety.

## Before you begin

- Basic understanding of HTTP methods
- Familiarity with URL patterns and parameters
- TypeScript knowledge (recommended)

## Quick comparison

```typescript
// 1. Convenience methods (recommended for most cases)
app.get('/users/:id', async ctx => {
  ctx.json({ id: ctx.params.id });
});

// 2. Express-style (familiar syntax)
app.get('/users/:id', async ctx => {
  ctx.res.json({ id: ctx.params.id });
});

// 3. Fastify-style (advanced configuration)
app.get('/users/:id', {
  handler: async ctx => ctx.json({ id: ctx.params.id }),
  schema: {
    params: { type: 'object', properties: { id: { type: 'string' } } },
  },
  options: { name: 'getUser', description: 'Get user by ID' },
});
```

## Express-style routing

Familiar Express.js syntax with enhanced performance.

### Basic routes

```typescript
import { createApp } from 'nextrush';
import type { Context } from 'nextrush/types';

const app = createApp();

// GET route
app.get('/users', async (ctx: Context) => {
  const users = await getUsers();
  ctx.res.json(users);
});

// POST route
app.post('/users', async (ctx: Context) => {
  const userData = ctx.body as CreateUserData;
  const user = await createUser(userData);
  ctx.res.status(201).json(user);
});

// PUT route
app.put('/users/:id', async (ctx: Context) => {
  const userId = ctx.params.id;
  const updates = ctx.body as UpdateUserData;
  const user = await updateUser(userId, updates);
  ctx.res.json(user);
});

// DELETE route
app.delete('/users/:id', async (ctx: Context) => {
  await deleteUser(ctx.params.id);
  ctx.res.status(204).send();
});
```

### Route parameters

```typescript
// Single parameter
app.get('/users/:id', async ctx => {
  const userId = ctx.params.id;
  ctx.res.json({ userId });
});

// Multiple parameters
app.get('/users/:userId/posts/:postId', async ctx => {
  const { userId, postId } = ctx.params;
  const post = await getPost(userId, postId);
  ctx.res.json(post);
});

// Optional parameters (using regex)
app.get('/posts/:id(\\d+)?', async ctx => {
  const id = ctx.params.id;
  if (id) {
    const post = await getPost(id);
    ctx.res.json(post);
  } else {
    const posts = await getAllPosts();
    ctx.res.json(posts);
  }
});
```

### Query parameters

```typescript
app.get('/search', async ctx => {
  const query = ctx.query.q as string;
  const page = parseInt(ctx.query.page as string) || 1;
  const limit = parseInt(ctx.query.limit as string) || 10;

  const results = await search(query, { page, limit });
  ctx.res.json(results);
});
```

## Convenience methods routing

Modern, clean syntax with built-in best practices.

### Basic routes with convenience methods

```typescript
// JSON responses (most common)
app.get('/users', async ctx => {
  const users = await getUsers();
  ctx.json(users); // Automatically sets Content-Type: application/json
});

// With status codes
app.post('/users', async ctx => {
  const user = await createUser(ctx.body);
  ctx.json(user, 201); // Status code as second parameter
});

// Smart send method
app.get('/data/:format', async ctx => {
  const data = await getData();
  const format = ctx.params.format;

  if (format === 'json') {
    ctx.send(data); // Detects object → JSON
  } else if (format === 'text') {
    ctx.send(JSON.stringify(data, null, 2)); // Detects string → text
  }
});

// Redirects
app.post('/login', async ctx => {
  const isValid = await validateLogin(ctx.body);

  if (isValid) {
    ctx.redirect('/dashboard'); // 302 redirect
  } else {
    ctx.redirect('/login?error=invalid', 302);
  }
});
```

### Error handling with convenience methods

```typescript
app.get('/users/:id', async ctx => {
  const user = await findUser(ctx.params.id);

  if (!user) {
    ctx.json({ error: 'User not found' }, 404);
    return;
  }

  ctx.json(user);
});

// Using assertions
app.post('/users', async ctx => {
  const { name, email } = ctx.body as CreateUserData;

  ctx.assert(name, 400, 'Name is required');
  ctx.assert(email?.includes('@'), 400, 'Valid email required');

  const user = await createUser({ name, email });
  ctx.json(user, 201);
});
```

## Fastify-style routing

Advanced configuration with schema validation, middleware, and metadata.

### Basic Fastify-style route

```typescript
app.get('/users/:id', {
  handler: async ctx => {
    const user = await getUser(ctx.params.id);
    ctx.json(user);
  },
  options: {
    name: 'getUser',
    description: 'Retrieve user by ID',
  },
});
```

### Route with schema validation

```typescript
app.post('/users', {
  handler: async ctx => {
    const userData = ctx.body as CreateUserData;
    const user = await createUser(userData);
    ctx.json(user, 201);
  },
  schema: {
    body: {
      type: 'object',
      required: ['name', 'email'],
      properties: {
        name: {
          type: 'string',
          minLength: 2,
          maxLength: 50,
        },
        email: {
          type: 'string',
          format: 'email',
        },
        age: {
          type: 'number',
          minimum: 18,
          maximum: 120,
        },
      },
    },
    response: {
      201: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  options: {
    name: 'createUser',
    description: 'Create a new user account',
    tags: ['users', 'registration'],
    version: '1.0.0',
  },
});
```

### Route with middleware

```typescript
// Define middleware
const authMiddleware = async (ctx, next) => {
  const token = ctx.headers.authorization;
  if (!token) {
    ctx.res.status(401).json({ error: 'No token provided' });
    return;
  }
  ctx.state.user = await validateToken(token);
  await next();
};

const adminMiddleware = async (ctx, next) => {
  if (!ctx.state.user?.isAdmin) {
    ctx.res.status(403).json({ error: 'Admin access required' });
    return;
  }
  await next();
};

// Route with multiple middleware
app.delete('/users/:id', {
  handler: async ctx => {
    await deleteUser(ctx.params.id);
    ctx.json({ message: 'User deleted successfully' });
  },
  middleware: [authMiddleware, adminMiddleware],
  schema: {
    params: {
      type: 'object',
      properties: {
        id: { type: 'string', pattern: '^[0-9]+$' },
      },
      required: ['id'],
    },
  },
  options: {
    name: 'deleteUser',
    description: 'Delete user (admin only)',
    tags: ['users', 'admin'],
    deprecated: false,
  },
});
```

### Complex route example

```typescript
app.get('/search', {
  handler: async ctx => {
    const { q, category, page, limit } = ctx.query;

    const results = await searchItems({
      query: q as string,
      category: category as string,
      page: parseInt(page as string) || 1,
      limit: parseInt(limit as string) || 10,
    });

    ctx.json({
      results: results.items,
      pagination: {
        page: results.page,
        limit: results.limit,
        total: results.total,
        pages: Math.ceil(results.total / results.limit),
      },
      query: q,
      category,
    });
  },
  middleware: [
    async (ctx, next) => {
      // Rate limiting middleware
      const ip = ctx.ip;
      const isAllowed = await checkRateLimit(ip);
      if (!isAllowed) {
        ctx.res.status(429).json({ error: 'Too many requests' });
        return;
      }
      await next();
    },
  ],
  schema: {
    query: {
      type: 'object',
      properties: {
        q: { type: 'string', minLength: 1, maxLength: 100 },
        category: { type: 'string', enum: ['products', 'users', 'posts'] },
        page: { type: 'string', pattern: '^[1-9]\\d*$' },
        limit: { type: 'string', pattern: '^([1-9]|[1-4]\\d|50)$' },
      },
      required: ['q'],
    },
    response: {
      200: {
        type: 'object',
        properties: {
          results: { type: 'array' },
          pagination: {
            type: 'object',
            properties: {
              page: { type: 'number' },
              limit: { type: 'number' },
              total: { type: 'number' },
              pages: { type: 'number' },
            },
          },
        },
      },
    },
  },
  options: {
    name: 'searchItems',
    description: 'Search for items with pagination and filtering',
    tags: ['search', 'public'],
    version: '2.1.0',
    summary: 'Global search endpoint with rate limiting',
    externalDocs: {
      description: 'Search API documentation',
      url: 'https://docs.example.com/search',
    },
  },
});
```

## Route patterns

### Wildcards

```typescript
// Wildcard routes
app.get('/files/*', async ctx => {
  const filePath = ctx.params['*']; // Captures everything after /files/
  ctx.send(`Requested file: ${filePath}`);
});

// Named wildcards
app.get('/api/v:version/*', async ctx => {
  const version = ctx.params.version;
  const path = ctx.params['*'];
  ctx.json({ version, path });
});
```

### Regular expressions

```typescript
// Regex parameters
app.get('/users/:id(\\d+)', async ctx => {
  const userId = ctx.params.id; // Only matches numbers
  ctx.json({ userId: parseInt(userId) });
});

// Complex patterns
app.get('/posts/:year(\\d{4})/:month(\\d{2})/:day(\\d{2})', async ctx => {
  const { year, month, day } = ctx.params;
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  ctx.json({ date: date.toISOString() });
});
```

### Optional parameters

```typescript
// Optional segments
app.get('/posts/:id/:slug?', async ctx => {
  const { id, slug } = ctx.params;
  const post = await getPost(id);

  if (slug && post.slug !== slug) {
    ctx.redirect(`/posts/${id}/${post.slug}`, 301);
    return;
  }

  ctx.json(post);
});
```

## Router organization

### Sub-routers

```typescript
import { createRouter } from 'nextrush';

// Create sub-router
const userRouter = createRouter();

// Define routes on sub-router
userRouter.get('/', async ctx => {
  ctx.json(await getUsers());
});

userRouter.get('/:id', async ctx => {
  ctx.json(await getUser(ctx.params.id));
});

userRouter.post('/', async ctx => {
  const user = await createUser(ctx.body);
  ctx.json(user, 201);
});

// Mount sub-router
app.use('/users', userRouter);
```

### Modular routing

```typescript
// routes/users.ts
export const userRoutes = app => {
  app.get('/users', async ctx => {
    ctx.json(await getUsers());
  });

  app.post('/users', {
    handler: async ctx => {
      const user = await createUser(ctx.body);
      ctx.json(user, 201);
    },
    schema: {
      body: {
        type: 'object',
        required: ['name', 'email'],
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
        },
      },
    },
  });
};

// app.ts
import { userRoutes } from './routes/users';

const app = createApp();
userRoutes(app);
```

## Route middleware

### Route-specific middleware

```typescript
// Single middleware
const validateAuth = async (ctx, next) => {
  if (!ctx.headers.authorization) {
    ctx.res.status(401).json({ error: 'Authentication required' });
    return;
  }
  await next();
};

app.get('/profile', validateAuth, async ctx => {
  ctx.json({ profile: ctx.state.user });
});

// Multiple middleware
app.post('/admin/users', [validateAuth, validateAdmin], async ctx => {
  const user = await createUser(ctx.body);
  ctx.json(user, 201);
});
```

### Middleware with Fastify-style routes

```typescript
app.post('/protected', {
  handler: async ctx => {
    ctx.json({ message: 'Access granted' });
  },
  middleware: [
    async (ctx, next) => {
      // Authentication
      const token = ctx.headers.authorization;
      if (!token) {
        ctx.res.status(401).json({ error: 'No token' });
        return;
      }
      ctx.state.user = await validateToken(token);
      await next();
    },
    async (ctx, next) => {
      // Authorization
      if (!ctx.state.user.permissions.includes('write')) {
        ctx.res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }
      await next();
    },
  ],
});
```

## Complete routing example

```typescript
import { createApp, createRouter } from 'nextrush';
import type { Context, Middleware } from 'nextrush/types';

const app = createApp();

// Global middleware
const logger: Middleware = async (ctx, next) => {
  console.log(`${ctx.method} ${ctx.path}`);
  await next();
};

app.use(logger);

// Basic routes with convenience methods
app.get('/', async ctx => {
  ctx.json({ message: 'Welcome to NextRush v2 API' });
});

app.get('/health', async ctx => {
  ctx.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Express-style routes
app.get('/users', async ctx => {
  const users = await getUsers();
  ctx.res.json(users);
});

app.post('/users', async ctx => {
  const user = await createUser(ctx.body);
  ctx.res.status(201).json(user);
});

// Fastify-style routes
app.get('/users/:id', {
  handler: async ctx => {
    const user = await getUser(ctx.params.id);
    if (!user) {
      ctx.json({ error: 'User not found' }, 404);
      return;
    }
    ctx.json(user);
  },
  schema: {
    params: {
      type: 'object',
      properties: {
        id: { type: 'string', pattern: '^[0-9]+$' },
      },
    },
  },
  options: {
    name: 'getUser',
    description: 'Get user by ID',
  },
});

// Sub-router for API v2
const v2Router = createRouter();

v2Router.get('/posts', {
  handler: async ctx => {
    const posts = await getPosts(ctx.query);
    ctx.json(posts);
  },
  schema: {
    query: {
      type: 'object',
      properties: {
        page: { type: 'string', pattern: '^[1-9]\\d*$' },
        limit: { type: 'string', pattern: '^([1-9]|[1-4]\\d|50)$' },
      },
    },
  },
});

app.use('/api/v2', v2Router);

app.listen(3000);
```

## Performance tips

- Use route parameters instead of query strings when possible
- Define specific routes before wildcard routes
- Group related routes into sub-routers
- Use middleware efficiently (avoid unnecessary processing)

## Security considerations

- Always validate route parameters
- Use schema validation for complex input
- Implement rate limiting on public routes
- Sanitize user input in route handlers

## See also

- [Context API](./context.md) - Working with request/response context
- [Middleware guide](./middleware.md) - Creating and using middleware
- [Error handling](./errors.md) - Route error handling
- [Performance optimization](../guides/performance.md) - Route performance

---

_Added in v2.0.0-alpha.1_
