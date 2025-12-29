# @nextrush/router

> High-performance radix tree router for NextRush. O(k) route matching where k = path length, not route count.

## The Problem

Traditional array-based routers iterate through all routes to find a match. With 1,000 routes, that's 1,000 comparisons per request. Route order matters. Performance degrades linearly.

## How NextRush Approaches This

The router uses a **radix tree** (compact prefix tree):
- Routes share common prefixes in the tree structure
- Matching is O(k) where k is path length (typically 10-50 characters)
- Route count doesn't affect matching speed
- Memory efficient: shared prefixes stored once

## Mental Model

```
Routes:
  /users
  /users/:id
  /users/:id/posts
  /products
  /products/:id

Tree:
  /
  ├── users
  │   └── /:id
  │       └── /posts
  └── products
      └── /:id
```

When matching `/users/123/posts`:
1. Match `/` → found
2. Match `users` → found
3. Match `/:id` → captures `123`
4. Match `/posts` → found
5. Return handler + params

## Installation

```bash
pnpm add @nextrush/router
```

## Quick Start

```typescript
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';

const app = createApp();
const router = createRouter();

router.get('/', (ctx) => {
  ctx.json({ message: 'Home' });
});

router.get('/users/:id', (ctx) => {
  ctx.json({ userId: ctx.params.id });
});

app.use(router.routes());
```

## Features

- **Radix Tree Algorithm**: O(k) lookup where k = path length
- **Route Parameters**: Named parameters with `:param` syntax
- **Wildcard Routes**: Catch-all with `*` parameter
- **Route Groups**: Prefix-based grouping
- **Method-Based Routing**: GET, POST, PUT, DELETE, PATCH, etc.
- **Zero Dependencies**: Pure TypeScript implementation

## Route Patterns

### Static Routes

```typescript
router.get('/api/users', handler);
router.get('/api/posts', handler);
router.get('/health', handler);
```

### Named Parameters

```typescript
// Single parameter
router.get('/users/:id', (ctx) => {
  ctx.json({ id: ctx.params.id });
});

// Multiple parameters
router.get('/users/:userId/posts/:postId', (ctx) => {
  const { userId, postId } = ctx.params;
  ctx.json({ userId, postId });
});
```

### Wildcard Routes

```typescript
// Catch-all
router.get('/files/*', (ctx) => {
  const filePath = ctx.params['*'];
  ctx.json({ path: filePath });
});

// Named wildcard
router.get('/static/*path', (ctx) => {
  ctx.json({ path: ctx.params.path });
});
```

### Optional Segments

```typescript
// Optional parameter
router.get('/users/:id?', (ctx) => {
  if (ctx.params.id) {
    // Get single user
  } else {
    // List all users
  }
});
```

## HTTP Methods

```typescript
router.get('/resource', handler);
router.post('/resource', handler);
router.put('/resource/:id', handler);
router.patch('/resource/:id', handler);
router.delete('/resource/:id', handler);
router.head('/resource', handler);
router.options('/resource', handler);

// All methods
router.all('/any', handler);
```

## Route Groups

Group routes with a common prefix:

```typescript
const api = createRouter({ prefix: '/api/v1' });

api.get('/users', listUsers);      // GET /api/v1/users
api.get('/users/:id', getUser);    // GET /api/v1/users/:id
api.post('/users', createUser);    // POST /api/v1/users

app.use(api.routes());
```

### Nested Groups

```typescript
const router = createRouter();

router.group('/api', (api) => {
  api.group('/v1', (v1) => {
    v1.get('/users', handler);     // GET /api/v1/users
    v1.get('/posts', handler);     // GET /api/v1/posts
  });

  api.group('/v2', (v2) => {
    v2.get('/users', handler);     // GET /api/v2/users
  });
});

app.use(router.routes());
```

## Route Middleware

Apply middleware to specific routes:

```typescript
const auth = async (ctx, next) => {
  if (!ctx.get('Authorization')) {
    ctx.status = 401;
    ctx.json({ error: 'Unauthorized' });
    return;
  }
  await next();
};

// Single route
router.get('/protected', auth, handler);

// Multiple middleware
router.get('/admin', auth, adminOnly, handler);
```

### Group Middleware

```typescript
router.group('/admin', [auth, adminOnly], (admin) => {
  admin.get('/users', listUsers);
  admin.get('/settings', getSettings);
});
```

## Mounting Routers

Compose routers together:

```typescript
const userRouter = createRouter();
userRouter.get('/', listUsers);
userRouter.get('/:id', getUser);
userRouter.post('/', createUser);

const postRouter = createRouter();
postRouter.get('/', listPosts);
postRouter.get('/:id', getPost);

const api = createRouter();
api.use('/users', userRouter.routes());
api.use('/posts', postRouter.routes());

app.use('/api', api.routes());
// Results in: /api/users, /api/users/:id, /api/posts, etc.
```

## Allowed Methods

Automatically handle 405 Method Not Allowed:

```typescript
app.use(router.routes());
app.use(router.allowedMethods());

// GET /users → 200 OK
// POST /users (no POST handler) → 405 Method Not Allowed
// OPTIONS /users → Returns allowed methods
```

## Route Parameters

### Accessing Parameters

```typescript
router.get('/users/:id', (ctx) => {
  // ctx.params is Record<string, string>
  const id = ctx.params.id;
});
```

### Parameter Validation

Validate parameters in your handler:

```typescript
router.get('/users/:id', (ctx) => {
  const id = parseInt(ctx.params.id, 10);
  if (isNaN(id)) {
    ctx.status = 400;
    ctx.json({ error: 'Invalid user ID' });
    return;
  }
  // Continue with valid id
});
```

## Query Parameters

```typescript
router.get('/search', (ctx) => {
  const { q, page, limit } = ctx.query;
  // ?q=hello&page=1&limit=10
  ctx.json({ query: q, page, limit });
});
```

## Router Options

```typescript
const router = createRouter({
  // Route prefix
  prefix: '/api',

  // Case sensitive matching (default: false)
  caseSensitive: false,

  // Strict trailing slash (default: false)
  strict: false,
});
```

## Route Inspection

```typescript
// List all registered routes
const routes = router.getRoutes();
// [
//   { method: 'GET', path: '/users' },
//   { method: 'GET', path: '/users/:id' },
//   { method: 'POST', path: '/users' },
// ]

// Check if route exists
const exists = router.has('GET', '/users');
```

## Performance

The radix tree router provides:

- **O(k) Lookup**: Where k is the path length, not route count
- **Memory Efficient**: Shared prefixes are stored once
- **Fast Parameter Extraction**: Single-pass parsing

### Benchmarks

| Routes | Lookup Time |
|--------|-------------|
| 100 | ~0.02ms |
| 1,000 | ~0.02ms |
| 10,000 | ~0.02ms |

Route count doesn't affect lookup time significantly.

## API Reference

### Exports

```typescript
import {
  createRouter,    // Create router instance
  Router,          // Router class
} from '@nextrush/router';
```

### Types

```typescript
import type {
  Router,
  RouterOptions,
  Route,
  RouteHandler,
  RouteParams,
  MatchResult,
} from '@nextrush/router';

interface RouterOptions {
  prefix?: string;
  caseSensitive?: boolean;
  strict?: boolean;
}

interface Route {
  method: string;
  path: string;
  handler: RouteHandler;
  middleware?: Middleware[];
}

interface MatchResult {
  handler: RouteHandler;
  params: Record<string, string>;
  middleware?: Middleware[];
}
```

### Router Methods

```typescript
const router = createRouter();

// HTTP methods
router.get(path, ...handlers);
router.post(path, ...handlers);
router.put(path, ...handlers);
router.patch(path, ...handlers);
router.delete(path, ...handlers);
router.head(path, ...handlers);
router.options(path, ...handlers);
router.all(path, ...handlers);

// Composition
router.use(path?, ...middleware);
router.group(prefix, middleware?, callback);
router.routes();
router.allowedMethods();

// Inspection
router.getRoutes();
router.has(method, path);
router.match(method, path);
```

## License

MIT
