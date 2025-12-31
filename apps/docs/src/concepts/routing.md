---
title: Routing
description: Route patterns, parameters, and groups in NextRush
---

# Routing

> High-performance radix tree routing with O(k) lookup time.

## The Problem

Traditional routers in Express, Koa, and most Node.js frameworks use **array-based matching**. Every incoming request iterates through all registered routes until one matches.

This creates real problems at scale:

**Performance degrades linearly with route count.** With 10 routes, matching is fast. With 500 routes in a large API, every request scans hundreds of patterns.

**Route order creates subtle bugs.** When routes are checked sequentially, the order of registration matters. A catch-all route defined before specific routes swallows requests.

## How NextRush Approaches This

NextRush uses a **radix tree** (compressed prefix tree) for route storage and matching:

```
Routes:
  GET /users
  GET /users/:id
  GET /users/:id/posts
  GET /products
  GET /products/:id

Tree Structure:
  /
  ├── users
  │   └── /:id
  │       └── /posts
  └── products
      └── /:id
```

When a request arrives for `/users/123/posts`:
1. Match `/` → found, descend
2. Match `users` → found, descend
3. Match `/:id` → parameter node, capture `123`, descend
4. Match `/posts` → found, return handler + params

**Four comparisons total**, regardless of how many other routes exist.

## Mental Model

Think of routing as **walking a directory tree**, not searching a list:

```
/
├── api/
│   └── v1/
│       ├── users/
│       │   ├── index (GET, POST)
│       │   └── :id/
│       │       └── index (GET, PUT, DELETE)
│       └── products/
│           └── index (GET)
└── health (GET)
```

Request matching is like `cd /api/v1/users/123`. You don't scan every file in the system. You follow the path.

## Basic Usage

```typescript
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';

const app = createApp();
const router = createRouter();

router.get('/users', (ctx) => {
  ctx.json({ users: [] });
});

router.get('/users/:id', (ctx) => {
  ctx.json({ userId: ctx.params.id });
});

app.use(router.routes());
app.listen(3000);
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

// Register for all HTTP methods
router.all('/any-method', handler);

// Register specific method dynamically
router.route('GET', '/dynamic', handler);
```

## Route Parameters

Parameters capture path segments and make them available in `ctx.params`:

```typescript
router.get('/users/:id', (ctx) => {
  console.log(ctx.params.id);  // '123' for /users/123
});

router.get('/users/:userId/posts/:postId', (ctx) => {
  const { userid, postid } = ctx.params;
  // /users/42/posts/7 → { userid: '42', postid: '7' }
});
```

::: warning Parameter Name Case
By default, the router operates in case-insensitive mode. Parameter names are lowercased in `ctx.params`. If you define `:userId`, access it as `ctx.params.userid`.

To preserve original case, use `caseSensitive: true` in router options.
:::

## Wildcard Routes

Wildcards capture all remaining path segments:

```typescript
router.get('/files/*', (ctx) => {
  const path = ctx.params['*'];
  // /files/docs/readme.md → ctx.params['*'] = 'docs/readme.md'
});
```

Wildcards must be the **last segment** in a route:

```typescript
// ✅ Valid: wildcard at end
router.get('/static/*', handler);

// ❌ Invalid: won't work as expected
router.get('/*/files', handler);
```

## Route Groups

Groups share a common prefix and optionally middleware.

### Simple Grouping

```typescript
router.group('/api', (api) => {
  api.get('/users', listUsers);     // GET /api/users
  api.post('/users', createUser);   // POST /api/users
  api.get('/posts', listPosts);     // GET /api/posts
});
```

### Nested Groups

```typescript
router.group('/api', (api) => {
  api.group('/v1', (v1) => {
    v1.get('/users', v1Handler);    // GET /api/v1/users
  });

  api.group('/v2', (v2) => {
    v2.get('/users', v2Handler);    // GET /api/v2/users
  });
});
```

### Group Middleware

Apply middleware to all routes in a group:

```typescript
const auth = async (ctx, next) => {
  if (!ctx.get('Authorization')) {
    ctx.status = 401;
    ctx.json({ error: 'Unauthorized' });
    return;
  }
  await next();
};

router.group('/admin', [auth], (admin) => {
  admin.get('/dashboard', getDashboard);   // Protected
  admin.get('/settings', getSettings);     // Protected
});

router.get('/public', publicHandler);      // Not protected
```

## Route Middleware

Apply middleware to individual routes:

```typescript
router.get('/protected', authMiddleware, handler);

// Multiple middleware execute in order
router.get('/admin', authMiddleware, roleCheck, rateLimiter, handler);
```

The last function is the handler. All preceding functions are middleware.

## Redirects

Built-in support for HTTP redirects with parameter interpolation:

```typescript
// Permanent redirect (301)
router.redirect('/old-page', '/new-page');

// Temporary redirect (302)
router.redirect('/temp', '/destination', 302);

// Redirect to external URL
router.redirect('/docs', 'https://docs.example.com');

// Parameter interpolation
router.redirect('/users/:id', '/profiles/:id');
// /users/123 → Location: /profiles/123
```

### Redirect Status Codes

| Status | Name | Use Case |
|--------|------|----------|
| `301` | Moved Permanently | SEO-safe permanent redirect |
| `302` | Found | Temporary redirect (default) |
| `303` | See Other | Redirect after POST |
| `307` | Temporary Redirect | Preserves HTTP method |
| `308` | Permanent Redirect | Preserves HTTP method |

```typescript
// Preserve method during redirect
router.redirect('/api/old', '/api/new', 307);
// POST /api/old → POST /api/new (method preserved)

// Change to GET after POST
router.redirect('/submit', '/success', 303);
// POST /submit → GET /success
```

## Sub-Router Mounting

Compose smaller routers into larger applications:

```typescript
// users.ts
const userRouter = createRouter();
userRouter.get('/', listUsers);
userRouter.get('/:id', getUser);
userRouter.post('/', createUser);

// posts.ts
const postRouter = createRouter();
postRouter.get('/', listPosts);
postRouter.get('/:id', getPost);

// app.ts
const api = createRouter();
api.use('/users', userRouter);
api.use('/posts', postRouter);

app.use(api.routes());
// GET /users, GET /users/:id, POST /users
// GET /posts, GET /posts/:id
```

## Allowed Methods

Handle 405 Method Not Allowed automatically:

```typescript
app.use(router.routes());
app.use(router.allowedMethods());
```

When a path exists but the HTTP method doesn't have a handler:

```
GET  /users     → 200 OK (handler exists)
POST /users     → 405 Method Not Allowed (no POST handler)
                  Allow: GET, HEAD
OPTIONS /users  → 200 OK
                  Allow: GET, HEAD
```

## Router Options

```typescript
const router = createRouter({
  prefix: '/api/v1',     // Prepend to all routes
  caseSensitive: false,  // Case-insensitive matching (default)
  strict: false,         // Ignore trailing slashes (default)
});
```

### Case Sensitivity

```typescript
// Default: case-insensitive
router.get('/Users', handler);
// Matches: /users, /Users, /USERS

// Case-sensitive mode
const router = createRouter({ caseSensitive: true });
router.get('/Users', handler);
// Matches: /Users only
```

### Trailing Slash Handling

```typescript
// Default: trailing slashes normalized
router.get('/users', handler);
// Matches: /users, /users/

// Strict mode preserves distinction
const router = createRouter({ strict: true });
router.get('/users', handler);
router.get('/users/', differentHandler);
```

## Common Patterns

### RESTful Resources

```typescript
router.get('/users', listUsers);
router.post('/users', createUser);
router.get('/users/:id', getUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
```

### API Versioning

```typescript
const v1 = createRouter({ prefix: '/api/v1' });
v1.get('/users', v1UsersHandler);

const v2 = createRouter({ prefix: '/api/v2' });
v2.get('/users', v2UsersHandler);

app.use(v1.routes());
app.use(v2.routes());
```

### SPA Fallback

```typescript
// API routes first
router.get('/api/*', apiHandler);

// SPA catch-all for client-side routing
router.get('/*', (ctx) => {
  ctx.html(indexHtml);
});
```

## Common Mistakes

### Forgetting to Mount Routes

```typescript
// ❌ Routes defined but not mounted
const router = createRouter();
router.get('/users', handler);
app.listen(3000);  // No routes work

// ✅ Mount with routes()
const router = createRouter();
router.get('/users', handler);
app.use(router.routes());
app.listen(3000);
```

### Parameter Name Case

```typescript
router.get('/users/:userId', (ctx) => {
  // ❌ Won't work in case-insensitive mode
  const id = ctx.params.userId;

  // ✅ Correct
  const id = ctx.params.userid;
});
```

### Wildcard Placement

```typescript
// ❌ Wildcard must be last
router.get('/*/end', handler);

// ✅ Wildcard at path end
router.get('/start/*', handler);
```

## Performance

The radix tree router delivers consistent performance:

| Routes | Lookup Time |
|--------|-------------|
| 100 | ~0.02ms |
| 1,000 | ~0.02ms |
| 10,000 | ~0.02ms |

Time complexity: O(k) where k = path length (~10-50 chars), not route count.

## See Also

- [Context](/concepts/context) — The `ctx` object
- [Middleware](/concepts/middleware) — Route middleware
- [@nextrush/router](/packages/router) — Full API reference
