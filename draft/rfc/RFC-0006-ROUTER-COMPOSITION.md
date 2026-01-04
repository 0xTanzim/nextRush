s # RFC-0006: Router Composition (Hono/Koa Style)

| Field       | Value                |
|-------------|----------------------|
| **Status**  | ✅ Implemented       |
| **Created** | 2025-01-20           |
| **Authors** | NextRush Team        |

---

## Summary

Simplify NextRush router composition to match Hono's minimal DX. Remove the confusion between `app.use()` and `router.use()`.

---

## Current Problem

### Confusing API

```typescript
// ❌ DOES NOT WORK - app.use() only accepts middleware
app.use('/users', usersRouter);

// ✅ Works but verbose and confusing
const router = createRouter();
router.use('/users', usersRouter);  // Mount on router
router.use('/posts', postsRouter);
app.use(router.routes());           // Why do we need routes()?
```

### Why is this confusing?

1. `app.use()` and `router.use()` have different signatures
2. Must always create a "main router" to mount sub-routers
3. Must call `router.routes()` to get middleware — extra step
4. Developers expect `app.use('/path', router)` to work (Express pattern)

---

## Hono's Clean Pattern

```typescript
// Hono - simple and direct
const app = new Hono();
app.route('/users', users);
app.route('/posts', posts);
// Done! No routes() call needed
```

---

## Proposed Solution

### Option A: Add `app.route()` Method

Add direct router mounting to Application:

```typescript
const app = createApp();

// Direct mount - clean like Hono
app.route('/users', usersRouter);
app.route('/posts', postsRouter);

// Still works - for those who want explicit router
app.use(router.routes());
```

**Implementation:**

```typescript
// In Application class
route(path: string, router: Router): this {
  // Convert router to middleware with prefix
  const routerMiddleware = router.routes();

  // Create path-scoped middleware
  this.use(async (ctx, next) => {
    if (ctx.path.startsWith(path)) {
      // Temporarily modify path for router matching
      const originalPath = ctx.path;
      ctx.path = ctx.path.slice(path.length) || '/';
      await routerMiddleware(ctx, next);
      ctx.path = originalPath;
    } else {
      await next();
    }
  });

  return this;
}
```

### Option B: Make Router and App Unified (Like Hono)

Hono's secret: `Hono` is both app AND router. Everything is the same thing.

```typescript
// Every Hono instance is both app and router
const users = new Hono();
users.get('/', handler);

const app = new Hono();
app.route('/users', users);  // Mount another Hono instance
```

**For NextRush:**

```typescript
// Make Router mountable directly
const users = createRouter();
users.get('/', listUsers);
users.get('/:id', getUser);

const app = createApp();
app.route('/users', users);  // Direct mount!
app.route('/posts', posts);

// No router.routes() needed!
listen(app, 3000);
```

---

## Recommended: Option A (Minimal Change)

Keep current architecture, just add `app.route()`:

```typescript
// Application class addition
route(path: string, router: Router): this {
  this.use(createRouterMiddleware(path, router));
  return this;
}

function createRouterMiddleware(prefix: string, router: Router): Middleware {
  const handler = router.routes();
  const normalizedPrefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;

  return async (ctx, next) => {
    if (!ctx.path.startsWith(normalizedPrefix)) {
      return next();
    }

    // Strip prefix for router matching
    const originalPath = ctx.path;
    ctx.path = ctx.path.slice(normalizedPrefix.length) || '/';

    await handler(ctx, async () => {
      ctx.path = originalPath;
      await next();
    });

    ctx.path = originalPath;
  };
}
```

---

## Final API

```typescript
// routes/users.ts
import { createRouter } from '@nextrush/router';

const router = createRouter();
router.get('/', (ctx) => ctx.json([]));
router.get('/:id', (ctx) => ctx.json({ id: ctx.params.id }));
router.post('/', (ctx) => ctx.json({ created: true }));

export default router;
```

```typescript
// index.ts
import { createApp, listen } from 'nextrush';
import users from './routes/users';
import posts from './routes/posts';
import admin from './routes/admin';

const app = createApp();

// Middleware
app.use(cors());
app.use(json());

// Mount routers directly - clean like Hono!
app.route('/api/users', users);
app.route('/api/posts', posts);
app.route('/admin', admin);

// 404 handler
app.use((ctx) => {
  ctx.status = 404;
  ctx.json({ error: 'Not Found' });
});

listen(app, 3000);
```

---

## What Still Works

```typescript
// Old pattern still works for advanced use cases
const router = createRouter();
router.use('/users', users);
router.use('/posts', posts);
app.use(router.routes());

// Route groups still work
router.group('/api/v1', [authMiddleware], (r) => {
  r.get('/users', listUsers);
});
```

---

## Migration

| Before | After |
|--------|-------|
| `router.use('/x', xRouter); app.use(router.routes())` | `app.route('/x', xRouter)` |
| Create main router just for mounting | Direct mount on app |

---

## Implementation Plan

1. ✅ Add `app.route(path, router)` method to Application class
2. ✅ Add `Routable` interface for type-safe mounting
3. ✅ Add `router.mount(path, subRouter)` as cleaner alias
4. ✅ Update exports in @nextrush/core
5. ⏳ Update documentation with new pattern
6. ✅ Keep `router.routes()` for backward compatibility

**Implementation Details:**

- `app.route()` uses Proxy-based Context modification to handle readonly `path` property
- `router.mount()` is an alias for `router.use(path, router)`
- Both methods support fluent chaining

**Test Coverage:**

- Core: 13 tests for `app.route()` in `route.test.ts`
- Router: 5 tests for `router.mount()` in `router-edge-cases.test.ts`

---

## Summary

| Method | Purpose |
|--------|---------|
| `app.use(middleware)` | Add middleware |
| `app.route('/path', router)` | Mount router at path |
| `router.get/post/...` | Define routes |
| `router.group()` | Group routes with shared prefix/middleware |
| `router.use(middleware)` | Add middleware to router |
| `router.use('/path', subRouter)` | Mount sub-router (for nesting) |

Clean, minimal, Hono-like.
