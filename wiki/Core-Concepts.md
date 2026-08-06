# Core Concepts

NextRush is a small functional core — one `Application` object that composes middleware and routes into a request handler — with runtimes built on top. There is no plugin framework bolted on the side; the whole request path is one composed pipeline of async middleware. Understand those three ideas and the rest of the framework is detail.

## The Application: one composition root

`createApp()` from the `nextrush` meta-package gives you a single `Application`. It is the one object where a server declares everything it depends on before accepting a request: middleware, routes, and long-lived services (called **Extensions**, not plugins).

```ts
import { createApp, createRouter, listen } from 'nextrush';

const app = createApp();
```

Three methods build the pipeline, one freezes it:

- **`use(...middleware)`** pushes middleware onto a stack, in call order.
- **`route(path, router)`** mounts a router at a path prefix. A mounted router *is* middleware from the app's point of view.
- **`get`/`post`/`put`/`patch`/`delete`/`head`/`all`** delegate straight to the app-owned router (`app.router`).
- **`ready()`** boots every registered Extension's `setup()` once, mounts the app-owned router *last*, then freezes configuration — `use()`, `route()`, `extend()` all throw afterward. `listen()` calls `ready()` for you.

`createApp()` from `nextrush` wires a default router in, so `app.get()` works out of the box. The lower-level `@nextrush/core` `createApp()` has no router unless you pass one explicitly (`createApp({ router: createRouter() })`).

## Context: one object per request

Every request gets a single `ctx` object, handed from the adapter through every middleware to your handler and back — never copied, never replaced. Handlers **write through `ctx`**; they never return a `Response` object. The adapter builds `ctx` from the platform's real request at the front and serializes it back at the end.

`ctx` has three faces:

| Face | Members | Notes |
|---|---|---|
| **Input** | `ctx.method`, `ctx.path`, `ctx.query`, `ctx.headers`, `ctx.ip`, `ctx.get(name)`, `ctx.params`, `ctx.body` | `params` is populated by the router during matching. `body` is `undefined` until a body-parser middleware fills it in. |
| **Shared** | `ctx.state`, `ctx.next()` | `state` is a plain object the whole pipeline reads and writes; `next()` passes control onward. |
| **Output** | `ctx.status`, `ctx.json()`, `ctx.send()`, `ctx.html()`, `ctx.redirect()`, `ctx.set()` | Set `status`, then send exactly once. |

```ts
import { createApp, createRouter, listen } from 'nextrush';

const app = createApp();
const router = createRouter();

router.get('/users/:id', (ctx) => {
  const id = ctx.params.id;         // input: captured by the router
  const fields = ctx.query.fields;  // input: parsed query string
  ctx.json({ id, fields });         // output: JSON response
});

app.route('/', router);
await listen(app, 8080);
```

Everything the client sends arrives on `ctx` **unvalidated**. `ctx` guarantees a consistent shape across runtimes, never safe values — validating `params`/`query`/`body` is the handler's job. `ctx.raw` exposes the platform's native object and breaks cross-runtime portability; avoid it.

## The handler signature

A handler (or middleware) is an async function of `ctx` that sends a response through `ctx` and returns `undefined`. No `(req, res)` pair, no `return new Response(...)`:

```ts
router.get('/health', (ctx) => ctx.json({ ok: true }));
```

Middleware has two equivalent shapes — `ctx.next()` on the context, or `next` as the second argument:

```ts
import type { Middleware } from 'nextrush';

const a: Middleware = async (ctx) => { await ctx.next(); };
const b: Middleware = async (ctx, next) => { await next(); };
```

Both drive the same dispatch. See [Middleware](Middleware) for the onion model and why order matters.

## Middleware: the request path is one pipeline

Cross-cutting work (auth, logging, timing, body parsing) is registered once, in front of the handlers, instead of copy-pasted into every one. A middleware does its slice of work, calls `await ctx.next()`, and — because control comes back — can act after the response is produced too. See [Middleware](Middleware).

## Two composable layers

NextRush exposes two paradigms over the same core:

- **Functional core** (`nextrush`) — `createApp`, `createRouter`, `compose`, `listen`, HTTP errors, and typed `Middleware`/`Context`. This is what this page uses.
- **Class runtime** (`nextrush/class`) — `Controller`, `Get`, `@Service()`, DI, guards. Built on the same `Application`; see [Controllers-and-Decorators](Controllers-and-Decorators) and [Dependency-Injection](Dependency-Injection).

Same application code runs unchanged on Node, Bun, Deno, and edge — only the [adapter](Adapters) differs.

## Minimal runnable app

```ts
import { createApp, createRouter, listen } from 'nextrush';

const app = createApp();
const router = createRouter();

router.get('/', (ctx) => ctx.json({ status: 'ok' }));

app.route('/', router);
await listen(app, 8080);
```

The server answers `GET /` on port 8080. From here: [Routing](Routing), [Middleware](Middleware), and [Request-Lifecycle](Request-Lifecycle) walk the pieces in depth.
