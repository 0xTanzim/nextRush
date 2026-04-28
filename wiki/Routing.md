# Routing

NextRush uses a high-performance segment-trie router (`@nextrush/router`) with O(k) path matching where k is the number of path segments. Static routes additionally use an O(1) hash map fast path.

---

## Creating a Router

```typescript
import { createRouter } from 'nextrush';

const router = createRouter();
// or with options:
const router = createRouter({
  prefix: '/api',         // prepended to all routes
  caseSensitive: false,   // (default) — /Users matches /users
  strict: false,          // (default) — trailing slash ignored
});
```

---

## HTTP Methods

```typescript
router.get('/users', (ctx) => ctx.json([]));
router.post('/users', (ctx) => ctx.json({ created: true }));
router.put('/users/:id', (ctx) => ctx.json({ updated: ctx.params.id }));
router.patch('/users/:id', (ctx) => ctx.json({ patched: ctx.params.id }));
router.delete('/users/:id', (ctx) => { ctx.status = 204; });
router.head('/users', (ctx) => { ctx.status = 200; });
router.options('/users', (ctx) => { ctx.status = 200; });

// All HTTP methods at once
router.all('/health', (ctx) => ctx.json({ status: 'ok' }));

// Explicit method name
router.route('GET', '/users', (ctx) => ctx.json([]));
```

---

## Route Parameters

Named route parameters are captured with `:name` syntax:

```typescript
router.get('/users/:id', (ctx) => {
  const { id } = ctx.params;    // string
  ctx.json({ id });
});

// Multiple parameters
router.get('/orgs/:orgId/repos/:repoId', (ctx) => {
  const { orgId, repoId } = ctx.params;
  ctx.json({ orgId, repoId });
});
```

### Wildcards

```typescript
// Matches /files/any/nested/path
router.get('/files/*', (ctx) => {
  ctx.json({ path: ctx.params['*'] });
});
```

---

## Inline Middleware

Pass middleware functions before the final handler:

```typescript
const auth = async (ctx, next) => {
  if (!ctx.get('authorization')) {
    ctx.status = 401;
    ctx.json({ error: 'Unauthorized' });
    return;
  }
  await next();
};

// auth runs first, then the handler
router.get('/protected', auth, (ctx) => {
  ctx.json({ data: 'secret' });
});
```

---

## Redirects

```typescript
// Permanent redirect (default 301)
router.redirect('/old-path', '/new-path');

// Temporary redirect
router.redirect('/temp', '/destination', 302);

// With parameter substitution
router.redirect('/users/:id', '/profiles/:id');
```

---

## Mounting Routers

Mount a router onto the application at a path prefix:

```typescript
import { createApp, createRouter, listen } from 'nextrush';

const users = createRouter();
users.get('/', (ctx) => ctx.json([]));         // GET /api/users
users.get('/:id', (ctx) => ctx.json({}));      // GET /api/users/:id
users.post('/', (ctx) => ctx.json({}));        // POST /api/users

const posts = createRouter();
posts.get('/', (ctx) => ctx.json([]));         // GET /api/posts

const app = createApp();
app.route('/api/users', users);
app.route('/api/posts', posts);

listen(app, 3000);
```

---

## Router Composition

Routers can also be composed with `app.use()` via `router.routes()`:

```typescript
// Directly as middleware
app.use(router.routes());

// Or via app.route() (recommended — handles prefix stripping automatically)
app.route('/api', router);
```

---

## Router Options Reference

| Option | Type | Default | Description |
|---|---|---|---|
| `prefix` | `string` | `''` | Path prefix prepended to all routes |
| `caseSensitive` | `boolean` | `false` | Whether path matching is case-sensitive |
| `strict` | `boolean` | `false` | Whether trailing slashes are significant |

---

## Query Parameters

Query parameters are available on `ctx.query` (not part of routing, always available):

```typescript
router.get('/search', (ctx) => {
  const { q, page = '1' } = ctx.query as { q?: string; page?: string };
  ctx.json({ query: q, page: Number(page) });
});
// GET /search?q=hello&page=2
```

---

## Duplicate Route Detection

Registering the same method + path twice throws at startup:

```typescript
router.get('/users', handler1);
router.get('/users', handler2);  // Error: Route conflict: GET /users is already registered
```
