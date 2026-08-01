# @nextrush/core

> The engine behind every NextRush app — the `Application` object, the Koa-style middleware pipeline (`compose` + `ctx.next()`), router mounting, the extension lifecycle, and the default error response — for framework and adapter authors.

[![npm version](https://img.shields.io/npm/v/@nextrush/core.svg)](https://www.npmjs.com/package/@nextrush/core)
[![downloads](https://img.shields.io/npm/dm/@nextrush/core.svg)](https://www.npmjs.com/package/@nextrush/core)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@nextrush/core.svg)](https://bundlephobia.com/package/@nextrush/core)
[![types](https://img.shields.io/npm/types/@nextrush/core.svg)](https://www.npmjs.com/package/@nextrush/core)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)
[![license](https://img.shields.io/npm/l/@nextrush/core.svg)](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)

|  |  |
| --- | --- |
| **Purpose** | The `Application` object, middleware composition, router mounting, extension lifecycle, and default error handling for NextRush |
| **Package type** | Core |
| **Status** | Stable ✅ |
| **Included in `nextrush`?** | ✅ Yes — `createApp`, `compose`, and the common error classes are re-exported. The `nextrush` meta-package's `createApp` wraps this one and auto-injects a router. |
| **Support tier** | Public — core (stable, semver-guarded) — see [ADR-0005](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md) |
| **Maintenance** | Active |
| **Runtime** | Universal — Node · Bun · Deno · Edge |
| **Requires** | Node `>=22` · ESM-only · TypeScript `>=5.x` |
| **Introduced** | `v3.0.0` |

## Highlights

- ✅ **No third-party dependencies** — depends only on `@nextrush/errors` and `@nextrush/types`
- ✅ **ESM-only**, tree-shakable, side-effect-free (`"sideEffects": false`)
- ✅ **Fully typed** — strict TypeScript, zero `any`; extension shapes inferred through `extend()`
- ✅ **Runtime-independent** — no `node:*` / `process` / runtime globals; the same code runs on every adapter

<details>
<summary><strong>Table of contents</strong></summary>

[The problem](#the-problem) · [When to use](#when-to-use) · [Installation](#installation) · [Quick start](#quick-start) · [Capabilities](#capabilities) · [Mental model](#mental-model) · [Common tasks](#common-tasks) · [API overview](#api-overview) · [Options](#options) · [Performance](#performance) · [Compatibility](#compatibility) · [Troubleshooting](#troubleshooting) · [FAQ](#faq) · [Package relationships](#package-relationships) · [Architecture](#architecture) · [Resources](#resources)

</details>

---

## The problem

Every HTTP framework needs the same plumbing before it can serve a single request: a place to register middleware, a way to run that middleware in order and let each step wrap the next, somewhere to mount routers, a boot step for long-lived services, and a single error path so a thrown error never crashes the process or leaks a stack trace. Hand-rolled, that plumbing is where subtle bugs live.

```ts
// TODAY, without a composition engine — chaining middleware by hand:
async function handle(ctx) {
  try {
    await mwA(ctx, () =>            // each layer must remember to await the next…
      mwB(ctx, () =>               // …and pass a `next` that's only safe to call once…
        handler(ctx)));            // …and one forgotten try/catch leaks the raw error.
  } catch (err) {
    ctx.status = 500;
    ctx.json({ error: String(err) }); // shape drifts; internals leak
  }
}
```

`@nextrush/core` owns exactly this plumbing so applications never write it. `compose()` runs the chain with correct ordering and single-call `next()` semantics, `Application` manages registration and a frozen-after-boot lifecycle, and one default error path serializes any thrown error through the same contract as `@nextrush/errors`.

## When to use

`@nextrush/core` is the engine the `nextrush` meta-package is built on. Most applications import `createApp` and `listen` from [`nextrush`](../nextrush) and never depend on `@nextrush/core` directly.

**Use `@nextrush/core` if:**

- ✓ You're building your own meta-package, runtime, or adapter on top of NextRush and need the raw `Application`
- ✓ You want `compose()` — the Koa-style middleware composer — as a standalone building block
- ✓ You're writing an extension or registrar and need the `Extension` / `ExtensionContext` contracts and the boot lifecycle

**Reach for something else if:**

- ✗ You're building an application — import `createApp`, `createRouter`, and `listen` from [`nextrush`](../nextrush); its `createApp` wires a router for you so `app.get(...)` works out of the box
- ✗ You need route matching — that's [`@nextrush/router`](../router); core only *mounts* a router, it doesn't match paths
- ✗ You need the concrete request/response object — the `Context` implementation is built by [`@nextrush/adapter-*`](../adapters); core defines the pipeline that operates on it

---

## Installation

```bash
pnpm add @nextrush/core
# npm i @nextrush/core · yarn add @nextrush/core · bun add @nextrush/core
```

> [!NOTE]
> Already using `nextrush`? `createApp`, `compose`, `isMiddleware`, and the common error classes are
> re-exported from the meta package — `import { createApp } from 'nextrush'` works without installing
> this directly, and that `createApp` auto-injects a router. Install `@nextrush/core` only to build
> your own meta-package/adapter or to use `compose()` on its own.

## Quick start

```ts
import { createApp, createRouter, listen } from 'nextrush';

const app = createApp();

// Middleware runs in registration order; each may await ctx.next().
app.use(async (ctx) => {
  const start = Date.now();
  await ctx.next();
  ctx.set('x-response-time', `${Date.now() - start}ms`);
});

// Feature router, mounted under a prefix (Hono-style composition).
const users = createRouter();
users.get('/:id', (ctx) => ctx.json({ id: ctx.params.id }));
app.route('/users', users);

listen(app, 8080);
```

`createApp()` (from `nextrush`) gives you an `Application` with a router already wired in. You register middleware and routers against it; `listen()` calls `app.ready()` to boot, then starts the adapter. That boot step is why extensions and mounted routers are all in place before the first request.

## Capabilities

**Application**
- **Middleware registration** — `app.use(...mw)`, chainable, validated (a non-function throws)
- **Router mounting** — `app.route(prefix, router)` mounts a feature router, rewriting `ctx.path` under the prefix
- **Route shortcuts** — `app.get/post/put/patch/delete/head/all(...)` delegate to the app-owned router
- **Frozen-after-boot lifecycle** — `ready()` -> `start()` -> `close()`, with config frozen once booted

**Middleware pipeline**
- **`compose()`** — Koa-style composition; each middleware may `await ctx.next()` to wrap downstream
- **Single-call `next()`** — a second `next()` rejects with `next() called multiple times`
- **Double-response warning** — opt-in dev warning when a middleware responds *and* calls `next()`

**Extensions**
- **`app.extend(ext)`** — register a long-lived service; `setup()` runs at `ready()`, `destroy()` at `close()`
- **Typed decorations** — `extend()` returns `this & TDecorated`, so `app.events` is statically inferred
- **Dependency assertion** — an extension's `needs` are checked at boot (registration order, no auto-sort)

**Error handling**
- **One default error path** — any thrown error is serialized through the `@nextrush/errors` contract
- **Custom handler** — `app.setErrorHandler((err, ctx) => ...)` overrides the default

**Performance**
- **Compose fast paths** — dedicated zero- and single-middleware paths avoid the recursive dispatch closure
- **Snapshot at compose** — the middleware array is snapshotted once, not walked per request

**Developer experience**
- **Fully typed, zero `any`** — contracts shared via `@nextrush/types`
- **Actionable errors** — misconfiguration (no router, config frozen, duplicate extension) throws with a fix

## Mental model

An `Application` is a **list of middleware plus a lifecycle**. `compose()` turns that list into one function where each middleware can wrap the next by `await`-ing `ctx.next()`; the app-owned router is mounted **last**, so it runs after all middleware.

```text
createApp() --> app.use(mw) --> app.route(prefix, router) --> await app.ready()
                                                                    |
                                                    compose([...mw, router.routes()])
                                                                    |
request --> ctx --> mw1 -> mw2 -> ... -> router --> handler --> ctx.json(...)
                     |______ await next() wraps downstream, unwinds back up ______|
```

**Rule:** `use`, `route`, and `extend` configure the app; `ready()` freezes that config and boots extensions. Configure before `ready()`, serve after — calling a configuration method post-boot throws.

> [!TIP]
> The full request lifecycle, the app state machine, and the `Application`/`Context` structure (with
> Mermaid diagrams) are in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Common tasks

### Register middleware

```ts
// Modern form — ctx.next()
app.use(async (ctx) => {
  await ctx.next();
  ctx.set('x-powered-by', 'nextrush');
});

// Traditional form — (ctx, next)
app.use(async (ctx, next) => {
  await next();
});

app.use(mwA, mwB, mwC); // register several at once; runs in this order
```

Both signatures are supported. Middleware runs in registration order, and each layer wraps the ones after it.

### Mount feature routers

```ts
import { createApp, createRouter } from 'nextrush';

const app = createApp();
const api = createRouter();
api.get('/health', (ctx) => ctx.json({ ok: true }));

app.route('/api', api);   // mounted under /api; ctx.path is rewritten for the sub-router
app.route('/', api);      // root mount — no prefix processing
```

`app.route()` strips the prefix from `ctx.path` while the sub-router runs and restores it afterwards, so middleware registered after the mount still sees the original path.

### Set a custom error handler

```ts
app.setErrorHandler((err, ctx) => {
  ctx.status = 500;
  ctx.json({ error: 'Something went wrong' });
});
```

If you set no handler, core writes the same JSON shape as `@nextrush/errors`' `errorHandler()` — a `NextRushError` serializes via its own `toJSON()`; any other error becomes a safe, coded `500` (its internal message is never sent to the client).

### Register an extension (long-lived service)

```ts
import { createApp } from 'nextrush';
import { events } from '@nextrush/events';

const app = createApp().extend(events());  // chain in one expression
await app.ready();                          // adapters call this automatically
app.events.emit('user:created', { id: '1' }); // available only AFTER ready()
```

`extend()` queues the extension and returns `this & TDecorated`; `setup()` runs once at `ready()` in registration order, and `destroy()` runs at `close()` in reverse. Anything an extension decorates (like `app.events`) exists only after `ready()`.

### Compose middleware standalone

```ts
import { compose } from '@nextrush/core';

const chain = compose([mwA, mwB, handler], { warnDoubleResponse: true });
await chain(ctx); // run the composed chain against a Context
```

`compose()` is the pipeline on its own — useful for building sub-pipelines or your own runtime. It validates its input, snapshots the array, and enforces single-call `next()` semantics.

## API overview

The sealed public surface (ADR-0005).

| Export | Signature | Since | Stability | Description |
| ------ | --------- | ----- | --------- | ----------- |
| `createApp` | `(options?: ApplicationOptions) => Application` | `3.0.0` | Stable ✅ | Create an `Application`. (The `nextrush` meta-package wraps this to inject a router.) |
| `Application` | `class` | `3.0.0` | Stable ✅ | The application object (methods below). |
| `compose` | `(middleware: Middleware[], options?: ComposeOptions) => ComposedMiddleware` | `3.0.0` | Stable ✅ | Koa-style middleware composer. |
| `isMiddleware` | `(fn: unknown) => fn is Middleware` | `3.0.0` | Stable ✅ | Type guard — a middleware is any function. |
| `flattenMiddleware` | `(arr: (Middleware \| Middleware[])[]) => Middleware[]` | `3.0.0` | Stable ✅ | Flatten nested middleware arrays (bounded depth), validating each entry. |
| `type ApplicationOptions` · `ErrorHandler` · `ListenCallback` · `Routable` | — | `3.0.0` | Stable ✅ | Application-level contracts. |
| `type ComposeOptions` · `ComposedMiddleware` | — | `3.0.0` | Stable ✅ | Composition contracts. |
| Error classes | `NextRushError` · `HttpError` · `BadRequestError` · `UnauthorizedError` · `ForbiddenError` · `NotFoundError` · `InternalServerError` | `3.0.0` | Stable ✅ | Re-exported from [`@nextrush/errors`](../errors) for convenience. |
| Type re-exports | `Context` · `ContextState` · `Extension` · `ExtensionContext` · `ExtensionHost` · `Middleware` · `Next` · `Router` · `RouteEntry` · `RouteHandler` · `RouteParams` · `QueryParams` · `HttpMethod` · `HttpStatusCode` · `Logger` | — | `3.0.0` | Stable ✅ | Re-exported from [`@nextrush/types`](../types). |
| Constant re-exports | `ContentType` · `HttpStatus` | — | `3.0.0` | Stable ✅ | Re-exported from `@nextrush/types`. |

### `Application` methods

| Member | Signature | Description |
| ------ | --------- | ----------- |
| `use` | `(...middleware: Middleware[]) => this` | Register middleware. Throws after boot; a non-function throws `TypeError`. |
| `route` | `(path: string, router: Routable) => this` | Mount anything with a `routes()` method at a prefix (`/` = root mount). |
| `get` / `post` / `put` / `patch` / `delete` / `head` / `all` | `(path, ...entries: RouteEntry[]) => this` | Delegate to the app-owned router. Requires a router (see FAQ). No `options()` verb — use `all()`. |
| `setErrorHandler` | `(handler: ErrorHandler) => this` | Replace the default error handler. |
| `extend` | `<TDecorated>(extension: Extension<TDecorated>) => this & TDecorated` | Queue an extension; `setup()` runs at `ready()`. |
| `ready` | `() => Promise<this>` | Boot: run each extension's `setup()`, mount the router last, freeze config. Idempotent. |
| `callback` | `() => (ctx: Context) => Promise<void>` | The request handler — snapshots the middleware stack and wraps it in the error path. |
| `start` | `() => void` | Mark the app running (adapters call this after `ready()`). |
| `close` | `() => Promise<Error[]>` | Graceful shutdown: `destroy()` extensions in reverse order; returns any failures. |
| `hasDecorator` | `(name: string) => boolean` | Whether a decoration already occupies `name`. |
| `isReady` / `isRunning` / `isProduction` | `boolean` (getters) | Lifecycle/env state. |
| `middlewareCount` / `extensionCount` | `number` (getters) | Registration counts. |
| `logger` / `options` / `router` / `container` | readonly | The configured logger, options, app-owned router, and DI container (last two optional). |

## Options

`createApp(options?)` takes `ApplicationOptions`; `compose(_, options?)` takes `ComposeOptions`.

| Option | Type | Required | Default | Security-sensitive | Description |
| ------ | ---- | -------- | ------- | ------------------ | ----------- |
| `env` | `'development' \| 'production' \| 'test'` | No | `'development'` | — | Environment mode. `production` hides dev warnings and error internals. |
| `proxy` | `boolean` | No | `false` | ⚠️ | Whether to trust proxy headers (`X-Forwarded-For`, etc.). Enable only behind a trusted proxy. |
| `logger` | `Logger` | No | no-op (silent) | — | Structured logger. Pass `console` for dev; a real logger (`@nextrush/logger`, pino) for prod. |
| `router` | `Router` | No | `undefined` | — | The app-owned router `app.get(...)` delegates to. The `nextrush` `createApp` injects one. |
| `container` | `Container` | No | `undefined` | — | Per-app DI container, exposed to extensions/registrars. Injected by `nextrush/class`. |
| `warnDoubleResponse` | `boolean` (on `ComposeOptions`) | No | `false` | — | Warn when a middleware responds *and* calls `next()`. `Application` enables it in non-production. |

## Performance

Core is on the request hot path — `callback()` wraps every request and `compose()` runs it — so the pipeline is built to allocate as little as possible per request:

- **The middleware array is snapshotted once** at `compose()` time, not re-read per request.
- **Two fast paths bypass the general dispatcher.** An empty chain returns a trivial pass-through; the **single-middleware** case (the overwhelmingly common shape — one mounted router) uses a flat closure with a per-invocation guard instead of the recursive `dispatch` used for longer chains.
- **`next()` guarding is per-invocation**, declared inside the returned function, so concurrent requests never corrupt each other's call state.

> [!NOTE]
> For reproducible throughput numbers on your own hardware, run the suite in
> [`apps/benchmark`](https://github.com/0xTanzim/nextRush/tree/main/apps/benchmark). Published
> figures are being re-measured on a hardened harness — see the
> [root README's Performance note](https://github.com/0xTanzim/nextRush#performance) — so this
> package documents the pipeline's allocation characteristics, not point numbers.

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
| Bun / Deno / Edge | ✅ / ✅ / ✅ | Uses only Web-standard JavaScript; no `node:*` API. Parity held by `@nextrush/adapter-*` |

**Integration**
- **Peer dependencies:** none — depends on `@nextrush/errors` (default error shape) and `@nextrush/types` (contracts; types erased at build).
- **Works with:** [`@nextrush/router`](../router) (mounted via `app.route()`), [`@nextrush/runtime`](../runtime) (`listen`), `@nextrush/adapter-*` (build the `Context`), any `@nextrush/*` middleware/extension.
- **Incompatible with:** none.

> [!IMPORTANT]
> NextRush is **ESM-only, permanently** — no CommonJS build. On Node `>=22`, CommonJS consumers
> can `require()` this ESM package natively. See the
> [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

---

## Troubleshooting

<details>
<summary><strong><code>Error: No router configured</code> when calling <code>app.get(...)</code></strong></summary>

**Cause:** you created the app with `@nextrush/core`'s own `createApp()`, which does **not** inject a router. **Fix:** import `createApp` from `nextrush` (it injects one), or pass one explicitly.

```ts
import { createApp } from 'nextrush';          // ← injects a router; app.get works
// or, using @nextrush/core directly:
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
const app = createApp({ router: createRouter() });
```

</details>

<details>
<summary><strong><code>Cannot call use() after the app has booted ... configuration is frozen</code></strong></summary>

**Cause:** `use` / `route` / `extend` / `get` were called after `ready()` or `start()` — configuration is frozen once the app boots. **Fix:** register everything before `await app.ready()` (and adapters call `ready()` for you inside `listen`).

</details>

<details>
<summary><strong><code>Error: next() called multiple times</code></strong></summary>

**Cause:** a middleware called `next()` (or `ctx.next()`) more than once in the same invocation. Each dispatch allows exactly one advance. **Fix:** call `next()` once; to run work after downstream, `await next()` and continue below it.

```ts
app.use(async (ctx) => {
  await ctx.next();     // once
  ctx.set('x-done', '1'); // work after downstream — no second next()
});
```

</details>

<details>
<summary><strong>Console warning: middleware called next() after the response was already committed</strong></summary>

**Cause:** a middleware sent a response (e.g. `ctx.json(...)`) *and* also called `next()`, so downstream may write to a finished response. This warning is on in non-production. **Fix:** either `await next()` to delegate, or respond without calling `next()` — not both.

</details>

<details>
<summary><strong>An un-awaited async call crashed the process</strong></summary>

**Cause:** NextRush installs **no** global `unhandledRejection` or `uncaughtException` handler by
default — the framework's core is deliberately silent on process-level policy, so an application
owns that decision rather than inheriting a hidden one. Fire-and-forget work (an un-awaited
`app.events.emit(...)`, a detached WebSocket message handler, a background task started from a
middleware) that later rejects surfaces as an **unhandled rejection**, and depending on your
process manager/runtime that can terminate the process. **Fix:** guard every detached call —
`void somePromise().catch((err) => logger.error(err))` — or explicitly install your own
`process.on('unhandledRejection', ...)` policy if your deployment needs one. This applies
everywhere NextRush hands you a promise you don't have to await synchronously: extension
`destroy()`/`onClose` hooks are awaited and isolated by the framework (see `app.onClose`), but a
promise your own handler code starts and does not return or await is your responsibility.

```ts
// Risky — a rejection here is unhandled, not caught by anything in the pipeline.
app.use(async (ctx) => {
  app.events.emit('audit:logged', { path: ctx.path }); // not awaited
  ctx.json({ ok: true });
});

// Safe — the detached call is explicitly guarded.
app.use(async (ctx) => {
  void app.events.emit('audit:logged', { path: ctx.path }).catch((err: unknown) => {
    app.logger.error('audit emit failed:', err);
  });
  ctx.json({ ok: true });
});
```

</details>

## FAQ

**Why does `app.get(...)` work with `nextrush`'s `createApp` but throw with `@nextrush/core`'s?**
The `nextrush` meta-package's `createApp` injects an app-owned router, so the route shortcuts have something to delegate to. `@nextrush/core`'s `createApp` is router-agnostic by design — pass `createApp({ router: createRouter() })` if you use it directly.

**Why does configuration freeze after `ready()`?**
Boot runs every extension's `setup()`, mounts the app-owned router last, and snapshots state. Allowing `use`/`route`/`extend` after that would mean middleware or extensions that never boot, or a router mounted in the wrong order — so those methods throw once the app is ready.

**Why ESM-only?**
See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

**Does it work on Bun, Deno, and Edge?**
Yes. Core uses only Web-standard JavaScript — no `node:*` APIs, no `process` — so it behaves identically on every supported runtime; platform specifics live in `@nextrush/adapter-*`, and parity is enforced by the conformance suite.

---

## Package relationships

```text
                depends on          @nextrush/errors  (default error response shape)
@nextrush/core ─────────────▶       @nextrush/types   (Context / Middleware / Extension contracts)

                often used with     @nextrush/router  (mounted via app.route())
                usually used next   @nextrush/runtime (listen) · @nextrush/adapter-* (build Context)
```

- **Depends on:** [`@nextrush/errors`](../errors) — the default error path reuses its serializer · [`@nextrush/types`](../types) — the shared `Context` / `Middleware` / `Extension` contracts (types erased at build).
- **Often used with:** [`@nextrush/router`](../router) — the router `app.route()` mounts and `app.get(...)` delegates to.
- **Usually used next:** [`@nextrush/runtime`](../runtime) — `listen(app, port)` boots and starts the app · `@nextrush/adapter-*` — build the concrete `Context` from a platform request.
- **Alternative:** none — `Application` and `compose` are the framework's composition core.

## Architecture

Maintaining or contributing to this package? The internal design — the `Application` lifecycle, the
`compose()` dispatcher and its fast paths, prefix mounting, the extension boot/teardown model, the
default error path, the architectural invariants, and the decisions and trade-offs behind them
(with diagrams) — is in **[`ARCHITECTURE.md`](./ARCHITECTURE.md)**. Design history:
[extension model RFC](https://github.com/0xTanzim/nextRush/tree/main/docs/RFC/class-runtime), [ADR-0005 (package tiers & sealed surface)](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md).

## Resources

- 📖 **Learn** — [Documentation](https://0xtanzim.github.io/nextRush/docs) · [Middleware concept](https://0xtanzim.github.io/nextRush/docs/concepts) · [Architecture](./ARCHITECTURE.md) · [RFCs](https://github.com/0xTanzim/nextRush/tree/main/docs/RFC)
- 📝 **Changelog** — [CHANGELOG.md](./CHANGELOG.md)
- 🐛 **Report an issue** — [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- 🤝 **Contribute** — [CONTRIBUTING.md](https://github.com/0xTanzim/nextRush/blob/main/CONTRIBUTING.md)

---

MIT © [Tanzim Hossain](https://github.com/0xTanzim)
