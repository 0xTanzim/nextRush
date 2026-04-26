# @nextrush/router

> High-performance radix tree router for NextRush. O(k) route matching where k = path length, not route count.

## The Problem

Traditional array-based routers iterate through all routes to find a match. With 1,000 routes, that's 1,000 comparisons per request. Route order matters. Performance degrades linearly.

## How NextRush Approaches This

The router uses a **radix tree** (compressed prefix tree):

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

app.route('/', router);
app.listen(3000);
```

## Features

- **Radix Tree Algorithm**: O(k) lookup where k = path length
- **Route Parameters**: Named parameters with `:param` syntax
- **Wildcard Routes**: Catch-all with `*` parameter
- **Route Groups**: Prefix-based grouping with middleware
- **Method-Based Routing**: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS
- **Redirects**: Built-in redirect support with parameter interpolation
- **Zero Dependencies**: Only depends on `@nextrush/types`

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
// Catch-all: captures everything after /files/
router.get('/files/*', (ctx) => {
  const filePath = ctx.params['*'];
  ctx.json({ path: filePath });
});

// /files/docs/readme.md → ctx.params['*'] = 'docs/readme.md'
```

Wildcards must be at the end of the route. Everything after the `*` segment is captured.

## HTTP Methods

```typescript
router.get('/resource', handler);
router.post('/resource', handler);
router.put('/resource/:id', handler);
router.patch('/resource/:id', handler);
router.delete('/resource/:id', handler);
router.head('/resource', handler);
router.options('/resource', handler);

// Register for all standard methods (GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS)
// TRACE and CONNECT are excluded for security reasons
router.all('/any', handler);

// Register specific method dynamically
router.route('GET', '/dynamic', handler);
```

## Route Groups

Group routes with a common prefix:

```typescript
const api = createRouter({ prefix: '/api/v1' });

api.get('/users', listUsers); // GET /api/v1/users
api.get('/users/:id', getUser); // GET /api/v1/users/:id
api.post('/users', createUser); // POST /api/v1/users

app.route('/', api);
```

### Nested Groups

```typescript
const router = createRouter();

router.group('/api', (api) => {
  api.group('/v1', (v1) => {
    v1.get('/users', handler); // GET /api/v1/users
    v1.get('/posts', handler); // GET /api/v1/posts
  });

  api.group('/v2', (v2) => {
    v2.get('/users', handler); // GET /api/v2/users
  });
});

app.route('/', router);
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
  admin.get('/dashboard', getDashboard);
  admin.get('/settings', getSettings);
});
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

// Single route with middleware
router.get('/protected', auth, handler);

// Multiple middleware
router.get('/admin', auth, adminOnly, handler);
```

Middleware executes in order: `auth` → `adminOnly` → `handler`

## Redirects

Built-in support for HTTP redirects:

```typescript
// Permanent redirect (301)
router.redirect('/old-page', '/new-page');

// Temporary redirect (302)
router.redirect('/temp', '/destination', 302);

// Redirect to external URL
router.redirect('/docs', 'https://docs.example.com');

// With parameter interpolation
router.redirect('/users/:id', '/profiles/:id');
// /users/123 → redirects to /profiles/123
```

Supported status codes: `301`, `302`, `303`, `307`, `308`

## Sub-Router Mounting

Compose routers together using `mount()` or `use()`:

### Using mount() (Recommended)

```typescript
const userRouter = createRouter();
userRouter.get('/', listUsers);
userRouter.get('/:id', getUser);
userRouter.post('/', createUser);

const postRouter = createRouter();
postRouter.get('/', listPosts);
postRouter.get('/:id', getPost);

const api = createRouter();
api.mount('/users', userRouter); // Clean explicit mounting
api.mount('/posts', postRouter);

app.route('/api', api);
// Results in: /api/users, /api/users/:id, /api/posts, /api/posts/:id
```

### Using use() (Classic Pattern)

The traditional `use()` method also works:

```typescript
const api = createRouter();
api.use('/users', userRouter);
api.use('/posts', postRouter);

app.route('/api', api);
// Or classic: app.use(api.routes());
```

### Direct App Mounting (Hono-Style)

For the cleanest DX, mount routers directly on the app:

```typescript
import { createApp } from '@nextrush/core';

const app = createApp();
app.route('/users', userRouter); // No routes() call needed!
app.route('/posts', postRouter);
```

## Allowed Methods

Automatically handle 405 Method Not Allowed:

```typescript
app.route('/', router);
app.use(router.allowedMethods());

// GET /users → 200 OK (if GET handler exists)
// POST /users (no POST handler) → 405 Method Not Allowed
// OPTIONS /users → Returns allowed methods in Allow header
```

## Router Options

```typescript
interface RouterOptions {
  // Route prefix prepended to all routes
  prefix?: string;

  // Case sensitive matching (default: false)
  caseSensitive?: boolean;

  // Strict trailing slash handling (default: false)
  strict?: boolean;
}

const router = createRouter({
  prefix: '/api/v1',
  caseSensitive: false,
  strict: false,
});
```

### Case Sensitivity

```typescript
// Default: case-insensitive
const router = createRouter();
router.get('/Users', handler);
router.match('GET', '/users'); // ✓ matches

// Case-sensitive mode
const router = createRouter({ caseSensitive: true });
router.get('/Users', handler);
router.match('GET', '/Users'); // ✓ matches
router.match('GET', '/users'); // ✗ no match
```

### Trailing Slash

```typescript
// Default: trailing slashes are normalized
router.get('/users', handler);
router.match('GET', '/users'); // ✓ matches
router.match('GET', '/users/'); // ✓ matches (normalized)
```

## Performance

The radix tree router provides:

- **O(k) Lookup**: Where k is the path length, not route count
- **Memory Efficient**: Shared prefixes are stored once
- **Fast Parameter Extraction**: Single-pass parsing

### Benchmarks

| Routes | Lookup Time |
| ------ | ----------- |
| 100    | ~0.02ms     |
| 1,000  | ~0.02ms     |
| 10,000 | ~0.02ms     |

Route count doesn't affect lookup time significantly.

## API Reference

### `createRouter(options?)`

Create a new router instance.

```typescript
function createRouter(options?: RouterOptions): Router;
```

**Parameters:**

| Parameter | Type            | Required | Default | Description          |
| --------- | --------------- | -------- | ------- | -------------------- |
| `options` | `RouterOptions` | No       | `{}`    | Router configuration |

**Options:**

| Option          | Type      | Default | Description                           |
| --------------- | --------- | ------- | ------------------------------------- |
| `prefix`        | `string`  | `''`    | Path prefix for all routes            |
| `caseSensitive` | `boolean` | `false` | Enable case-sensitive matching        |
| `strict`        | `boolean` | `false` | Enable strict trailing slash handling |

**Returns:** `Router` instance

### Router Methods

#### HTTP Method Shortcuts

```typescript
router.get(path: string, ...handlers: RouteHandler[]): this
router.post(path: string, ...handlers: RouteHandler[]): this
router.put(path: string, ...handlers: RouteHandler[]): this
router.delete(path: string, ...handlers: RouteHandler[]): this
router.patch(path: string, ...handlers: RouteHandler[]): this
router.head(path: string, ...handlers: RouteHandler[]): this
router.options(path: string, ...handlers: RouteHandler[]): this
router.all(path: string, ...handlers: RouteHandler[]): this
router.route(method: HttpMethod, path: string, ...handlers: RouteHandler[]): this
```

#### `router.redirect(from, to, status?)`

Register a redirect route.

```typescript
router.redirect(from: string, to: string, status?: 301 | 302 | 303 | 307 | 308): this
```

Default status is `301` (Moved Permanently). Status codes `307` and `308` register handlers for all standard HTTP methods (to preserve the original method). Other codes register GET and HEAD only.

#### `router.group(prefix, middleware?, callback)`

Create a route group with shared prefix and middleware.

```typescript
router.group(prefix: string, callback: (router: Router) => void): this
router.group(prefix: string, middleware: Middleware[], callback: (router: Router) => void): this
```

#### `router.use(pathOrMiddleware, routerOrUndefined?)`

Mount middleware or sub-router.

```typescript
router.use(middleware: Middleware): this
router.use(path: string, subRouter: Router): this
router.use(subRouter: Router): this
```

#### `router.mount(path, subRouter)`

Mount a sub-router at a path prefix. Equivalent to `use(path, router)` with clearer intent.

```typescript
router.mount(path: string, subRouter: Router): this
```

**Example:**

```typescript
const api = createRouter();
api.mount('/users', userRouter);
api.mount('/posts', postRouter);
```

#### `router.match(method, path)`

Match a route and return handler + params.

```typescript
router.match(method: HttpMethod, path: string): RouteMatch | null
```

**Returns:**

```typescript
interface RouteMatch {
  handler: RouteHandler;
  params: Record<string, string>;
  middleware: Middleware[];
}
```

#### `router.reset()`

Clear all registered routes, middleware, and internal state. Useful for testing or plugin teardown.

```typescript
const router = createRouter();
router.get('/users', handler);

router.reset();
// All routes, static route cache, middleware, param/wildcard children are cleared
```

> Calling `reset()` makes the router reusable — you can register fresh routes after resetting.

#### `router.routes()`

Get middleware function to mount on application.

```typescript
const middleware = router.routes();
app.use(middleware);
```

#### `router.allowedMethods()`

Get middleware that handles 405 responses and OPTIONS requests.

```typescript
app.use(router.allowedMethods());
```

## TypeScript Types

```typescript
import { createRouter, Router } from '@nextrush/router';

import type {
  HttpMethod,
  Middleware,
  Route,
  RouteHandler,
  RouteMatch,
  Router as RouterInterface,
  RouterOptions,
} from '@nextrush/router';
```

## Common Patterns

### RESTful Resource Routes

```typescript
const router = createRouter();

// Users resource
router.get('/users', listUsers);
router.post('/users', createUser);
router.get('/users/:id', getUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

app.route('/', router);
```

### API Versioning

```typescript
const v1 = createRouter({ prefix: '/api/v1' });
v1.get('/users', v1UsersHandler);

const v2 = createRouter({ prefix: '/api/v2' });
v2.get('/users', v2UsersHandler);

app.route('/', v1);
app.route('/', v2);
```

### Catch-All for SPA

```typescript
router.get('/api/*', apiHandler);

// Serve SPA for all other routes
router.get('/*', (ctx) => {
  ctx.html(indexHtml);
});
```

## Common Mistakes

### Forgetting to Mount Routes

```typescript
// ❌ Routes not mounted
const router = createRouter();
router.get('/users', handler);
// Missing: app.route('/api', router)

// ✅ Recommended: Use app.route()
const router = createRouter();
router.get('/users', handler);
app.route('/api', router);

// ✅ Also works: Classic pattern
app.use(router.routes());
```

### Parameter Name & Value Case

```typescript
// Parameter names preserve their original case from route definition
router.get('/users/:userId', (ctx) => {
  // ✅ Original case is preserved
  console.log(ctx.params.userId);
});

// Parameter values also preserve their original case
// GET /users/JohnDoe → ctx.params.userId === 'JohnDoe' (not 'johndoe')
```

### Wildcard Placement

```typescript
// ❌ Wildcard not at end (won't work as expected)
router.get('/*/files', handler);

// ✅ Wildcard at end
router.get('/files/*', handler);
```

### Duplicate Route Registration

```typescript
// ❌ Throws an error — same method + path registered twice
router.get('/users', handler1);
router.get('/users', handler2);
// Error: "Route conflict: GET /users is already registered"

// ✅ Different methods on the same path are fine
router.get('/users', handler1);
router.post('/users', handler2);
```

## Error Behavior

- **Duplicate routes**: Registering the same method + path throws immediately at registration time.
- **Unmatched routes**: `routes()` middleware sets `ctx.status = 404` and calls `next()`, allowing downstream middleware like `allowedMethods()` to respond.
- **Parameter name conflicts**: In development, a warning is logged when two routes define different parameter names at the same tree position. The first registered name takes precedence.

## License

MIT
