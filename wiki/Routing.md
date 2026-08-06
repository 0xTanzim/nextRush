# Routing

Routing maps a request's method + path to its handler. NextRush does it with a **segment trie**: a tree keyed by whole path segments (`users`, `:id`, `*`), not individual characters. Matching walks the URL one segment per level, so cost tracks *how deep the URL is*, never how many routes you registered. A thousand sibling routes cost the same to match as one.

A **radix tree** compresses on shared character prefixes — a different structure with different trade-offs. NextRush deliberately branches on whole segments instead; that distinction is why this is a "segment trie" and not a radix tree.

## Registering routes

`app.router` (auto-attached by `createApp()`) handles the verb methods. Or build a `Router` with `createRouter()` and mount it:

```ts
import { createApp, createRouter, listen } from 'nextrush';

const app = createApp();
const users = createRouter();

users.get('/', (ctx) => ctx.json([{ id: 1, name: 'Ada' }]));
users.get('/:id', (ctx) => ctx.json({ id: ctx.params.id }));

app.route('/users', users);   // every route lands under /users
await listen(app, 8080);
```

A `Router` is a self-contained bundle of routes you build in one place and mount wherever you need it. That is the whole model: build small routers, compose them.

## Static vs dynamic segments

- **Static routes** (`/health`) take an O(1) shortcut — a method-nested hash map lookup, no tree walk. Most routes in a real app are static.
- **Dynamic routes** (`/users/:id`) walk the trie in O(k), where `k` is the segment count, capturing params and wildcards as they descend.

## Path params and wildcards

Named parameters (`:id`) fit resource identifiers; a trailing wildcard (`*`) fits file paths and catch-alls. Both land in `ctx.params`:

```ts
import { createRouter } from '@nextrush/router';

const router = createRouter();

router.get('/users/:userId/posts/:postId', (ctx) => {
  const { userId, postId } = ctx.params; // both captured in one descent
  ctx.json({ userId, postId });
});

router.get('/files/*', (ctx) => {
  ctx.json({ path: ctx.params['*'] }); // /files/a/b.txt → "a/b.txt"
});
```

A captured param is **untrusted input** — validate type, range, and format before use:

```ts
import { createRouter } from '@nextrush/router';

const router = createRouter();

router.get('/users/:id', (ctx) => {
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id) || id < 1) {
    ctx.status = 400;
    return ctx.json({ error: 'id must be a positive integer' });
  }
  ctx.json({ id });
});
```

## Methods

`router.get/post/put/patch/delete/head` register a specific verb; `all()` registers every method. `all()` deliberately excludes `TRACE`/`CONNECT`, which carry request-smuggling risk. A wildcard `*` belongs at the **end** of a path (`/files/*`) — it captures the rest of the URL, so mid-path it matches more than you intend.

## Router options

`createRouter()` takes three options that shape matching — prefixing, case, and trailing slashes:

```ts
import { createRouter } from '@nextrush/router';

const router = createRouter({
  prefix: '/api/v1',    // prepended to every route registered here
  caseSensitive: false, // static segments match case-insensitively (default)
  strict: false,        // a trailing slash is normalized away (default)
});

router.get('/users', (ctx) => ctx.json({ ok: true })); // matches GET /api/v1/users
```

Parameter names and values always preserve their original case regardless of `caseSensitive`.

## Mounting and sub-routers

Mounting a router at a prefix is just a middleware push — `app.route(prefix, router)`. Order matters: the mount happens in call order, so a guard registered *after* a mount never protects that router. See [Middleware](Middleware).

**Common mistakes:**

- Registering the same method + path twice → the router throws at startup rather than silently shadowing. Catch it immediately.
- Creating a router but never mounting it → routes silently 404.
- Putting a wildcard mid-path → matches far more (or less) than intended.

## Runnable example

```ts
import { createApp, createRouter, listen } from 'nextrush';

const app = createApp();
const api = createRouter();

api.get('/health', (ctx) => ctx.json({ ok: true }));
api.get('/users/:id', (ctx) => ctx.json({ id: ctx.params.id }));

app.route('/api', api);
await listen(app, 8080);

// GET /api/health  → { ok: true }
// GET /api/users/42 → { id: "42" }
```

For route groups, per-group middleware, and redirects, see [Middleware](Middleware) and the docs [routing guide](https://0xtanzim.github.io/nextRush/docs/guides/api-development/mounting-and-grouping-routes).
