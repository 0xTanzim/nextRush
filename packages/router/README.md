# @nextrush/router

> The routing engine behind NextRush — a segment trie that matches a request to its handler in time proportional to the URL's depth, not the number of routes you've registered.

[![npm version](https://img.shields.io/npm/v/@nextrush/router.svg)](https://www.npmjs.com/package/@nextrush/router)
[![downloads](https://img.shields.io/npm/dm/@nextrush/router.svg)](https://www.npmjs.com/package/@nextrush/router)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@nextrush/router.svg)](https://bundlephobia.com/package/@nextrush/router)
[![types](https://img.shields.io/npm/types/@nextrush/router.svg)](https://www.npmjs.com/package/@nextrush/router)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)
[![license](https://img.shields.io/npm/l/@nextrush/router.svg)](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)

|  |  |
| --- | --- |
| **Purpose** | Route matching for NextRush — resolve `METHOD path` to its handler |
| **Package type** | Core |
| **Status** | Stable ✅ |
| **Included in `nextrush`?** | ✅ Yes — `createRouter` is re-exported from the meta package |
| **Support tier** | Public — core (stable, semver-guarded) — see [ADR-0005](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md) |
| **Maintenance** | Active |
| **Runtime** | Universal — Node · Bun · Deno · Edge |
| **Requires** | Node `>=22` · ESM-only · TypeScript `>=5.x` |
| **Introduced** | `v3.0.0` |

## Highlights

- ✅ **No third-party dependencies** — depends only on `@nextrush/types` (types, erased at build)
- ✅ **ESM-only**, tree-shakable, side-effect-free
- ✅ **Fully typed** — strict TypeScript, zero `any`
- 📦 Small, focused surface — the router and nothing else

<details>
<summary><strong>Table of contents</strong></summary>

[The problem](#the-problem) · [When to use](#when-to-use) · [Installation](#installation) · [Quick start](#quick-start) · [Capabilities](#capabilities) · [Mental model](#mental-model) · [Common tasks](#common-tasks) · [API overview](#api-overview) · [Options](#options) · [Performance](#performance) · [Compatibility](#compatibility) · [Troubleshooting](#troubleshooting) · [FAQ](#faq) · [Package relationships](#package-relationships) · [Architecture](#architecture) · [Resources](#resources)

</details>

---

## The problem

The simplest router is a list: keep every route in an array and, on each request, walk the list until one matches. It works — until it doesn't. The cost of every request grows with the number of routes, and the *order* you register them in starts to change behavior.

```ts
// TODAY, without a trie — a list router, O(n) in the route count:
for (const route of routes) {
  if (route.method === method && route.pattern.test(path)) {
    return route; // 1,000 routes → up to 1,000 regex tests, every request
  }
}
```

A list router that's fast with 20 routes is measurably slower with 2,000, and the slowdown lands on your hottest code path — the one every request pays. `@nextrush/router` removes the route count from that equation.

## When to use

`@nextrush/router` is the router built into NextRush; `createApp().route(...)` uses it under the hood. You reach for this package directly when you want to compose routing explicitly.

**Use `@nextrush/router` if:**

- ✓ You're building a NextRush app and want feature routers you can mount, group, and nest
- ✓ You want matching cost to stay flat as your route table grows into the hundreds or thousands
- ✓ You need named params (`/users/:id`), wildcards (`/files/*`), per-route and per-group middleware, or redirects

**Reach for something else if:**

- ✗ You just want the app-level shortcuts (`app.get(...)`) — those already use this router; import from [`nextrush`](../nextrush) instead
- ✗ You need a standalone router for a non-NextRush framework — the `Router` speaks NextRush's `Context`/`Middleware` contracts from [`@nextrush/types`](../types)

---

## Installation

```bash
pnpm add @nextrush/router
# npm i @nextrush/router · yarn add @nextrush/router · bun add @nextrush/router
```

> [!NOTE]
> Already using `nextrush`? `createRouter` is re-exported from the meta package, so
> `import { createRouter } from 'nextrush'` works without installing this directly. Install
> `@nextrush/router` when you want to depend on it explicitly.

## Quick start

```ts
import { createApp, listen } from 'nextrush';
import { createRouter } from '@nextrush/router';

const app = createApp();
const users = createRouter();

users.get('/', (ctx) => ctx.json([{ id: 1, name: 'Ada' }]));
users.get('/:id', (ctx) => ctx.json({ id: ctx.params.id }));

app.route('/users', users); // mount the feature router
listen(app, 8080);
```

A `Router` is a self-contained bundle of routes you register in one place and mount wherever you need it — here every route lands under `/users`. That's the whole model: build small routers, compose them.

## Capabilities

**Routing**
- **Segment trie matching** — O(k) in path depth, not route count (see [Mental model](#mental-model))
- **Named parameters** — `/users/:id`, multiple per path, original case preserved
- **Wildcards** — `/files/*` captures the remainder into `ctx.params['*']`
- **Route groups** — shared prefix + middleware, arbitrarily nestable
- **Composition** — `mount()` / `use()` sub-routers; `app.route()` for Hono-style mounting
- **Redirects** — `301`/`302`/`303`/`307`/`308` with param interpolation
- **Method handling** — per-method shortcuts plus `allowedMethods()` for correct `405`/`Allow`

**Performance**
- **Static-route fast path** — routes with no params resolve through an O(1) hash map
- **Compiled executors** — the middleware+handler chain is built once at registration, not per request

**Developer experience**
- **Introspection** — `getRoutes()` feeds `@nextrush/openapi` without touching the hot path
- **Fully typed** — strict TypeScript, zero `any`; contracts shared via `@nextrush/types`

## Mental model

A segment trie is a tree keyed by **whole path segments** — `users`, `:id` — not by individual characters (that would be a radix tree; this is deliberately not one). Registering a route walks the tree segment by segment, creating nodes as needed. Matching walks the same tree, and the depth of the walk is the number of segments in the URL — so a thousand sibling routes cost the same as one.

```text
Routes registered:                 Trie built:
  /users                             (root)
  /users/:id                          ├── "users"        ← static child
  /users/:id/posts                    │     └── :id       ← param child
  /products                           │           └── "posts"
  /products/:id                       └── "products"
                                            └── :id

Matching GET /users/123/posts:
  root → "users" → :id (captures id="123") → "posts"  →  handler + { id: "123" }
```

**Rule:** static routes (no `:param`, no `*`) skip the walk entirely — they live in a method-nested hash map for an O(1) lookup.

> [!TIP]
> The full match lifecycle, the two-path design, and the executor-compilation trick are in
> [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Common tasks

### Route parameters and wildcards

```ts
router.get('/users/:userId/posts/:postId', (ctx) => {
  const { userId, postId } = ctx.params; // both captured in one pass
  ctx.json({ userId, postId });
});

// Wildcard captures the remainder; must be the last segment.
router.get('/files/*', (ctx) => {
  ctx.json({ path: ctx.params['*'] }); // /files/docs/readme.md → "docs/readme.md"
});
```

### Route and group middleware

```ts
const auth: Middleware = async (ctx, next) => {
  if (!ctx.get('authorization')) {
    ctx.status = 401;
    return ctx.json({ error: 'Unauthorized' });
  }
  await next();
};

router.get('/protected', auth, (ctx) => ctx.json({ ok: true })); // per-route

router.group('/admin', [auth], (admin) => {                        // per-group
  admin.get('/dashboard', (ctx) => ctx.json({ page: 'dashboard' }));
});
```

Middleware runs in registration order, then the handler: `auth → handler`.

### Composing routers

```ts
const usersRouter = createRouter();
usersRouter.get('/', listUsers);
usersRouter.get('/:id', getUser);

const api = createRouter();
api.mount('/users', usersRouter); // explicit; equivalent to use('/users', usersRouter)

app.route('/api', api); // → /api/users, /api/users/:id
```

### Redirects and method handling

```ts
router.redirect('/old', '/new');            // 301 by default
router.redirect('/users/:id', '/people/:id'); // param interpolation
router.redirect('/legacy', '/v2', 308);     // 307/308 preserve the HTTP method

app.use(router.allowedMethods()); // OPTIONS → Allow header; unknown method on a known path → 405
```

## API overview

The sealed public surface (ADR-0005). Advanced trie internals are exported for tooling but are not part of the everyday API.

| Export | Signature | Since | Stability | Description |
| ------ | --------- | ----- | --------- | ----------- |
| `createRouter` | `(options?: RouterOptions) => Router` | `3.0.0` | Stable ✅ | Create a router instance. |
| `Router` | `class` | `3.0.0` | Stable ✅ | The router class (see methods below). |
| `endpoint` | `(metadata) => RouteEntry` | `3.1.0` | Stable ✅ | Attach inline route metadata (consumed by `getRoutes()` / OpenAPI). |
| `createNode` | `(segment, type?) => TrieNode` | `3.0.0` | Advanced 🔧 | Build a trie node (tooling). |
| `parseSegments` | `(path, caseSensitive?) => ParsedSegment[]` | `3.0.0` | Advanced 🔧 | Split a path into typed segments (tooling). |
| `NodeType` | `const enum` | `3.0.0` | Advanced 🔧 | `STATIC` / `PARAM` / `WILDCARD`. |
| `type Router` (as `RouterInterface`) · `RouterOptions` · `Route` · `RouteHandler` · `RouteMatch` · `Middleware` · `HttpMethod` | — | `3.0.0` | Stable ✅ | Re-exported contracts from [`@nextrush/types`](../types). |
| `type TrieNode` · `HandlerEntry` · `ParsedSegment` · `RouteGroup` | — | `3.0.0` | Advanced 🔧 | Trie/group types. |

### `Router` methods

| Method | Signature | Description |
| ------ | --------- | ----------- |
| `get` / `post` / `put` / `delete` / `patch` / `head` / `options` | `(path, ...entries: RouteEntry[]) => this` | Register a handler (+ optional per-route middleware) for one method. |
| `all` | `(path, ...entries) => this` | Register for every standard method (GET/POST/PUT/DELETE/PATCH/HEAD/OPTIONS); one consolidated introspection row. |
| `route` | `(method, path, ...entries) => this` | Register for a method chosen at runtime. |
| `group` | `(prefix, callback)` or `(prefix, middleware[], callback) => this` | Register routes under a shared prefix (and optional middleware); nestable. |
| `mount` | `(path, subRouter) => this` | Mount a sub-router at a prefix (explicit form of `use(path, subRouter)`). |
| `use` | `(middleware)` · `(path, subRouter)` · `(subRouter) => this` | Add router-level middleware or mount a sub-router. |
| `redirect` | `(from, to, status?: 301\|302\|303\|307\|308) => this` | Register a redirect (default `301`; `307`/`308` preserve the method). |
| `match` | `(method, path) => RouteMatch \| null` | Resolve a request to its handler + params (used internally by `routes()`). |
| `routes` | `() => Middleware` | The dispatch middleware to mount on the app (`app.use(router.routes())`). |
| `allowedMethods` | `() => Middleware` | Middleware that answers `OPTIONS` and returns `405` for a known path + unknown method. |
| `getRoutes` | `() => readonly RouteDefinition[]` | Introspection registry (doc/OpenAPI generation) — never read on the request path. |
| `reset` | `() => void` | Clear all routes, middleware, and caches; makes the router reusable (tests, hot reload). |

## Options

```ts
const router = createRouter({ prefix: '/api/v1', caseSensitive: false, strict: false });
```

| Option | Type | Required | Default | Security-sensitive | Description |
| ------ | ---- | -------- | ------- | ------------------ | ----------- |
| `prefix` | `string` | No | `''` | — | Prepended to every route registered on this router. |
| `caseSensitive` | `boolean` | No | `false` | — | When `false`, static segments are lowercased at registration and match case-insensitively. Parameter **names and values always preserve their original case.** |
| `strict` | `boolean` | No | `false` | — | When `false`, a trailing slash is normalized away (`/users` and `/users/` match the same route). |

## Performance

The router is designed so that **match cost tracks URL depth, not route count** — the property that matters as an app grows. Two mechanisms deliver it:

- **Static routes** (no `:param` / `*`) resolve through a method-nested hash map — an O(1) lookup, with no per-request `` `${method} ${path}` `` key string allocated.
- **Dynamic routes** walk the segment trie: O(k) where `k` is the number of path segments (typically a handful), regardless of how many routes are registered.

Per-route **executors are compiled once at registration**, not rebuilt per request, so dispatch allocates no middleware-chain closures on the hot path. A router with only static routes skips the trie walk entirely.

> [!NOTE]
> For reproducible throughput numbers on your own hardware, run the suite in
> [`apps/benchmark`](https://github.com/0xTanzim/nextRush/tree/main/apps/benchmark). Published
> figures are being re-measured on a hardened harness — see the
> [root README's Performance note](https://github.com/0xTanzim/nextRush#performance) — so this
> package documents the complexity characteristics, not point numbers.

## Compatibility

**Requirements**

| Requirement | Version |
| ----------- | ------- |
| NextRush | `3.x` |
| Node.js | `>=22` |
| TypeScript | `>=5.x` |

**Runtimes**

| Runtime | Supported | Notes |
| ------- | --------- | ----- |
| Node.js `>=22` | ✅ | ESM-only |
| Bun / Deno / Edge | ✅ / ✅ / ✅ | Pure Web-standard logic — no runtime API used; parity held by `@nextrush/adapter-*` |

**Integration**
- **Peer dependencies:** `@nextrush/core` (optional) — only needed when you mount via `app.route()` / `app.use()`; the `Router` itself works standalone.
- **Works with:** `@nextrush/core` (mounting), `@nextrush/openapi` (reads `getRoutes()`), any `@nextrush/*` middleware.
- **Incompatible with:** none.

> [!IMPORTANT]
> NextRush is **ESM-only, permanently** — no CommonJS build. On Node `>=22`, CommonJS consumers
> can `require()` this ESM package natively. See the
> [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

---

## Troubleshooting

<details>
<summary><strong><code>Error: Route conflict: GET /users is already registered</code></strong></summary>

**Cause:** the same method + path was registered twice — conflicts throw at registration time, not silently last-wins. **Fix:** register each method/path once; different methods on the same path are fine.

```ts
router.get('/users', listUsers);
router.post('/users', createUser); // ✅ different method — OK
// router.get('/users', other);    // ❌ throws
```

</details>

<details>
<summary><strong>My route isn't matched (404)</strong></summary>

**Cause:** the router was created but never mounted. **Fix:** mount it with `app.route(prefix, router)` (or `app.use(router.routes())`).

```ts
const router = createRouter();
router.get('/users', handler);
app.route('/', router); // ← without this, nothing is matched
```

</details>

<details>
<summary><strong>A wildcard in the middle of a path doesn't work</strong></summary>

**Cause:** a wildcard captures the remainder of the path, so it's only valid as the **last** segment. **Fix:** put `*` at the end (`/files/*`), not in the middle (`/*/files`).

</details>

## FAQ

**Can I use `@nextrush/router` without the rest of NextRush?**
Yes. The `Router` depends only on the `Context`/`Middleware` type contracts from `@nextrush/types`. `@nextrush/core` is an *optional* peer — you need it only to mount via `app.route()`.

**Is it really a "radix tree"?**
No — and the distinction is deliberate. This is a **segment trie**: it branches on whole path segments (`users`, `:id`), not individual characters. A radix tree (character/prefix-compressed) is a different structure; an opt-in `@nextrush/router-radix` is explored in [RFC-015](https://github.com/0xTanzim/nextRush/blob/main/docs/RFC/runtime-adapters/015-router-radix.md), but the segment trie is the default.

**Why ESM-only?**
See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

**Does it work on Bun, Deno, and Edge?**
Yes. The matching logic uses only standard JavaScript — no `node:*` APIs — so it runs identically on every supported runtime; cross-runtime parity is enforced by `@nextrush/adapter-*` conformance tests.

---

## Package relationships

```text
                 depends on          @nextrush/types  (Context / Middleware / RouteMatch contracts)
@nextrush/router ─────────────▶
                 often used with     @nextrush/core   (mounts routers via app.route())
                 usually used next   @nextrush/openapi (generates a spec from getRoutes())
```

- **Depends on:** [`@nextrush/types`](../types) — the shared `Context` / `Middleware` / `RouteMatch` contracts (types only, erased at build).
- **Often used with:** [`@nextrush/core`](../core) — the `Application` that mounts routers via `app.route()`.
- **Usually used next:** [`@nextrush/openapi`](../middleware/openapi) — turns `getRoutes()` into an OpenAPI document · [`@nextrush/validation`](../middleware/validation) · [`@nextrush/class`](../class) (decorator-based routing).
- **Alternative:** an opt-in `@nextrush/router-radix` is explored in [RFC-015](https://github.com/0xTanzim/nextRush/blob/main/docs/RFC/runtime-adapters/015-router-radix.md) for very large static route tables; the segment trie is the default.

## Architecture

Maintaining or contributing to the router? The internal design — the two-path match, the segment
trie and static map, executor compilation, the architectural invariants, and the decisions and
trade-offs behind them (with diagrams) — is in **[`ARCHITECTURE.md`](./ARCHITECTURE.md)**. Design
history: [RFC-015 (router-radix)](https://github.com/0xTanzim/nextRush/blob/main/docs/RFC/runtime-adapters/015-router-radix.md), [ADR-0005 (package tiers)](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md).

## Resources

- 📖 **Learn** — [Documentation](https://0xtanzim.github.io/nextRush/docs) · [Routing concept](https://0xtanzim.github.io/nextRush/docs/concepts/routing) · [Architecture](./ARCHITECTURE.md) · [RFCs](https://github.com/0xTanzim/nextRush/tree/main/docs/RFC)
- 📝 **Changelog** — [CHANGELOG.md](./CHANGELOG.md)
- 🧪 **Benchmarks** — [`apps/benchmark`](https://github.com/0xTanzim/nextRush/tree/main/apps/benchmark)
- 🐛 **Report an issue** — [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- 🤝 **Contribute** — [CONTRIBUTING.md](https://github.com/0xTanzim/nextRush/blob/main/CONTRIBUTING.md)

---

MIT © [Tanzim Hossain](https://github.com/0xTanzim)
