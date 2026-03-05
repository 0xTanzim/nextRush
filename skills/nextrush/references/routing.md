# Routing

Functional-style HTTP routing with radix tree performance. Define CRUD endpoints,
route parameters, query strings, and compose routers.

## Create a Router

```typescript
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';

const app = createApp();
const router = createRouter();
```

## Define Routes

```typescript
// GET /users
router.get('/', (ctx) => ctx.json(allUsers));

// GET /users/:id
router.get('/:id', (ctx) => {
  const user = findById(ctx.params.id);
  if (!user) throw new NotFoundError('User not found');
  return ctx.json(user);
});

// POST /users
router.post('/', (ctx) => {
  const body = ctx.body as { name: string; email: string };
  const user = createUser(body);
  ctx.status = 201;
  return ctx.json(user);
});

// PUT /users/:id
router.put('/:id', (ctx) => {
  const updated = updateUser(ctx.params.id, ctx.body);
  return ctx.json(updated);
});

// DELETE /users/:id
router.delete('/:id', (ctx) => {
  deleteUser(ctx.params.id);
  ctx.status = 204;
  return ctx.send('');
});
```

## Mount Router

```typescript
app.route('/users', router);
app.listen(3000);
```

## Query Parameters & Pagination

```typescript
router.get('/', (ctx) => {
  const page = Number(ctx.query.page) || 1;
  const limit = Math.min(Number(ctx.query.limit) || 10, 100);
  const all = getAllItems();
  return ctx.json({
    data: all.slice((page - 1) * limit, page * limit),
    page,
    limit,
    total: all.length,
  });
});
```

## Multiple Routers

```typescript
const users = createRouter();
const products = createRouter();

users.get('/', (ctx) => ctx.json([]));
products.get('/', (ctx) => ctx.json([]));

app.route('/users', users);
app.route('/products', products);
```

## Typed Errors in Routes

```typescript
import { NotFoundError, BadRequestError } from '@nextrush/errors';

router.get('/:id', (ctx) => {
  const item = db.get(ctx.params.id);
  if (!item) throw new NotFoundError('Item not found');
  return ctx.json(item);
});

router.post('/', (ctx) => {
  const body = ctx.body as Record<string, unknown>;
  if (!body.name) throw new BadRequestError('Name is required');
  // ...
});
```

## Rules

- Status codes: 201 for creation, 204 for deletion, 404 for not found
- Validate `ctx.body` at boundaries — never trust external input
- Cap pagination `limit` to prevent unbounded queries
- Mount routers with descriptive prefixes
- Supported methods: GET, POST, PUT, PATCH, DELETE

## Troubleshooting

| Problem                   | Cause                          | Solution                                                  |
| ------------------------- | ------------------------------ | --------------------------------------------------------- |
| 404 on all routes         | Router not mounted             | Call `app.route('/prefix', router)` before `app.listen()` |
| `ctx.body` undefined      | Missing body parser middleware | Add `@nextrush/body-parser` middleware before routes      |
| `ctx.params.id` undefined | Missing `:id` in route pattern | Use `router.get('/:id', handler)` with the colon          |
| Query not parsed          | Using wrong property           | Use `ctx.query.page`, not `ctx.params.page`               |
| Route not matching        | Wrong HTTP method              | Check `router.get` vs `router.post` matches the request   |
