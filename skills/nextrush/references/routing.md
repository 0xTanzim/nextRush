# Routing

Functional-style HTTP routing with segment trie performance. Define CRUD endpoints,
route parameters, query strings, wildcards, redirects, and compose routers.

## Create a Router

```typescript
import { createApp, createRouter, listen } from 'nextrush';

const app = createApp();
const router = createRouter();
```

## Define Routes

All HTTP methods: `get`, `post`, `put`, `patch`, `delete`, `head`, `options`, `all`.

```typescript
router.get('/', (ctx) => ctx.json({ message: 'Hello' }));
router.post('/', (ctx) => {
  ctx.status = 201;
  ctx.json(ctx.body);
});
router.put('/:id', (ctx) => ctx.json({ id: ctx.params.id }));
router.patch('/:id', (ctx) => ctx.json({ id: ctx.params.id }));
router.delete('/:id', (ctx) => {
  ctx.status = 204;
  ctx.send('');
});
router.head('/', (ctx) => {
  ctx.status = 200;
});
router.options('/', (ctx) => {
  ctx.set('Allow', 'GET, POST');
  ctx.status = 204;
});
router.all('/health', (ctx) => ctx.json({ ok: true })); // matches ALL methods
```

## Route Parameters

Named params via `:param` — available on `ctx.params`:

```typescript
router.get('/users/:id', (ctx) => {
  ctx.json({ userId: ctx.params.id });
});

router.get('/orgs/:orgId/repos/:repoId', (ctx) => {
  ctx.json({ org: ctx.params.orgId, repo: ctx.params.repoId });
});
```

## Query Parameters

Parsed automatically on `ctx.query`:

```typescript
// GET /search?q=nextrush&page=2
router.get('/search', (ctx) => {
  const q = ctx.query.q ?? '';
  const page = Number(ctx.query.page) || 1;
  const limit = Math.min(Number(ctx.query.limit) || 10, 100);
  ctx.json({ q, page, limit });
});
```

## Request Body

Requires body-parser middleware. Available on `ctx.body`:

```typescript
import { json } from '@nextrush/body-parser';

app.use(json()); // parse JSON bodies

router.post('/users', (ctx) => {
  const body = ctx.body as { name: string; email: string };
  ctx.status = 201;
  ctx.json(body);
});
```

## Multiple Handlers

Stack middleware per route — handlers before the last act as inline middleware:

```typescript
const auth: RouteHandler = async (ctx, next) => {
  if (!ctx.get('authorization')) throw new UnauthorizedError();
  await next();
};

const validate: RouteHandler = async (ctx, next) => {
  if (!ctx.body) throw new BadRequestError('Body required');
  await next();
};

router.post('/users', auth, validate, (ctx) => {
  ctx.status = 201;
  ctx.json(ctx.body);
});
```

## Router Composition

Mount sub-routers with `router.use(prefix, childRouter)` or `router.mount(prefix, childRouter)`:

```typescript
const users = createRouter();
users.get('/', (ctx) => ctx.json([]));
users.get('/:id', (ctx) => ctx.json({ id: ctx.params.id }));

const posts = createRouter();
posts.get('/', (ctx) => ctx.json([]));

const api = createRouter();
api.use('/users', users); // mounts users at /users
api.mount('/posts', posts); // equivalent syntax

app.route('/api', api); // all routes prefixed with /api
```

## Router Redirect

```typescript
router.redirect('/old', '/new'); // 301 permanent (default)
router.redirect('/temp', '/dest', 302); // 302 temporary
router.redirect('/docs', 'https://docs.example.com'); // external URL
router.redirect('/users/:id', '/profiles/:id'); // preserves params
```

Status options: `301`, `302`, `303`, `307`, `308`. Status `307`/`308` register all HTTP methods.

## Mount on Application

Use `app.route(prefix, router)` to mount routers:

```typescript
const users = createRouter();
users.get('/', (ctx) => ctx.json([]));
users.post('/', (ctx) => {
  ctx.status = 201;
  ctx.json(ctx.body);
});

app.route('/users', users); // GET /users, POST /users
app.route('/', router); // mount at root
listen(app, 3000);
```

## Wildcard Routes

Catch-all with `/*` — must be the last segment:

```typescript
router.get('/files/*', (ctx) => {
  ctx.json({ path: ctx.path });
});

// 404 fallback
router.all('/*', (ctx) => {
  ctx.status = 404;
  ctx.json({ error: 'Not found' });
});
```

## CRUD Example

```typescript
import { createApp, createRouter, listen, NotFoundError, BadRequestError } from 'nextrush';
import { errorHandler, notFoundHandler } from 'nextrush';
import { json } from '@nextrush/body-parser';

interface User {
  id: string;
  name: string;
  email: string;
}
const db = new Map<string, User>();

const users = createRouter();

users.get('/', (ctx) => {
  const page = Number(ctx.query.page) || 1;
  const limit = Math.min(Number(ctx.query.limit) || 10, 100);
  const all = [...db.values()];
  ctx.json({ data: all.slice((page - 1) * limit, page * limit), total: all.length });
});

users.get('/:id', (ctx) => {
  const user = db.get(ctx.params.id);
  if (!user) throw new NotFoundError('User not found');
  ctx.json(user);
});

users.post('/', (ctx) => {
  const body = ctx.body as { name?: string; email?: string };
  if (!body.name) throw new BadRequestError('Name is required');
  const id = crypto.randomUUID();
  const user: User = { id, name: body.name, email: body.email ?? '' };
  db.set(id, user);
  ctx.status = 201;
  ctx.json(user);
});

users.put('/:id', (ctx) => {
  const existing = db.get(ctx.params.id);
  if (!existing) throw new NotFoundError('User not found');
  const body = ctx.body as { name: string; email: string };
  const updated = { ...existing, ...body };
  db.set(ctx.params.id, updated);
  ctx.json(updated);
});

users.delete('/:id', (ctx) => {
  if (!db.delete(ctx.params.id)) throw new NotFoundError('User not found');
  ctx.status = 204;
  ctx.send('');
});

const app = createApp();
app.use(errorHandler());
app.use(json());
app.route('/users', users);
app.use(notFoundHandler());
listen(app, 3000);
```

## Combining Functional + Class Routes

```typescript
import { createApp, createRouter, listen, errorHandler } from 'nextrush';
import { Controller, Get, Service, controllersPlugin } from 'nextrush/class';
import { json } from '@nextrush/body-parser';

// Functional routes
const health = createRouter();
health.get('/', (ctx) => ctx.json({ status: 'ok' }));

// Class-based routes
@Service()
class ProductService {
  findAll() {
    return [{ id: 1, name: 'Widget' }];
  }
}

@Controller('/products')
class ProductController {
  constructor(private products: ProductService) {}
  @Get() findAll() {
    return this.products.findAll();
  }
}

const app = createApp();
app.use(errorHandler());
app.use(json());
app.route('/health', health); // functional
app.plugin(controllersPlugin({ root: './src', prefix: '/api' })); // class at /api/products
listen(app, 3000);
```

## Rules

- Status codes: `201` for creation, `204` for deletion, `404` for not found
- Validate `ctx.body` at boundaries — never trust external input
- Cap pagination `limit` to prevent unbounded queries
- Register body-parser middleware before routes that read `ctx.body`
- Wildcard `/*` must be the last segment in a route pattern
- Duplicate route registration (same method + path) throws at startup
- Mount routers before calling `listen()`

## Troubleshooting

| Problem                   | Cause                          | Solution                                                |
| ------------------------- | ------------------------------ | ------------------------------------------------------- |
| 404 on all routes         | Router not mounted             | Call `app.route('/prefix', router)` before `listen()`   |
| `ctx.body` undefined      | Missing body parser middleware | Add `app.use(json())` from `@nextrush/body-parser`      |
| `ctx.params.id` undefined | Missing `:id` in route pattern | Use `router.get('/:id', handler)` with the colon        |
| Query not parsed          | Using wrong property           | Use `ctx.query.page`, not `ctx.params.page`             |
| Route not matching        | Wrong HTTP method              | Check `router.get` vs `router.post` matches the request |
| Duplicate route error     | Same method+path registered    | Remove duplicate or use a different path                |
| Sub-router not working    | Wrong mount syntax             | Use `router.use('/prefix', childRouter)` or `.mount()`  |
| Wildcard not matching     | `*` not at end                 | Wildcard must be the last path segment                  |
