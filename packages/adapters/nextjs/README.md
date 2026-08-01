# @nextrush/adapter-nextjs

> Mount a NextRush app in a Next.js App Router route handler — one function, seven exports, zero request rewriting.

[![npm version](https://img.shields.io/npm/v/@nextrush/adapter-nextjs.svg)](https://www.npmjs.com/package/@nextrush/adapter-nextjs)
[![downloads](https://img.shields.io/npm/dm/@nextrush/adapter-nextjs.svg)](https://www.npmjs.com/package/@nextrush/adapter-nextjs)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@nextrush/adapter-nextjs.svg)](https://bundlephobia.com/package/@nextrush/adapter-nextjs)
[![types](https://img.shields.io/npm/types/@nextrush/adapter-nextjs.svg)](https://www.npmjs.com/package/@nextrush/adapter-nextjs)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)
[![license](https://img.shields.io/npm/l/@nextrush/adapter-nextjs.svg)](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)

|  |  |
| --- | --- |
| **Purpose** | Mount a NextRush `Application` in a Next.js App Router route handler |
| **Package type** | Adapter |
| **Status** | Beta 🚧 |
| **Included in `nextrush`?** | ✅ Yes — re-exported as `nextrush/nextjs` (optional peer, functional installs skip it) |
| **Support tier** | Public — stable surface once out of beta — see [ADR-0014](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0014-adapter-nextjs-prepend-only.md) |
| **Maintenance** | Active |
| **Runtime** | Universal — Node · Bun · Deno · Cloudflare (via OpenNext) — anywhere Next.js itself runs |
| **Requires** | Node `>=22` · ESM-only · TypeScript `>=5.x` · Next.js `>=14.0.0` (App Router only) |
| **Introduced** | `v1.0.0-beta.0` |

## Highlights

- ✅ **Zero request rewriting** — `ctx.path`/`ctx.url`/`ctx.raw.req` are always the true request; no mount-prefix magic to undo
- ✅ **Fully Web-standard** — no `node:*`, `process`, `Buffer`, or runtime global; one entry point runs on every host Next.js runs on
- ✅ **`next` is an optional peer** — a functional-only `nextrush` install never resolves it
- 📦 **Bundle:** ~4 KB min+gzip

<details>
<summary><strong>Table of contents</strong></summary>

[The problem](#the-problem) · [When to use](#when-to-use) · [Installation](#installation) · [Quick start](#quick-start) · [Capabilities](#capabilities) · [Mental model](#mental-model) · [Common tasks](#common-tasks) · [Project structure](#project-structure-for-a-real-api) · [API overview](#api-overview) · [Options](#options) · [Compatibility](#compatibility) · [Troubleshooting](#troubleshooting) · [FAQ](#faq) · [Package relationships](#package-relationships) · [Architecture](#architecture) · [Resources](#resources)

</details>

---

## The problem

Next.js's App Router lets you drop an API into `app/api/.../route.ts` — but the moment your API
grows past a couple of routes, you're stuck choosing between two bad options:

- **Write everything by hand in `route.ts`** — every method (`GET`/`POST`/`PATCH`/…), every param,
  every validation check, one giant file per route segment, with no shared middleware, no router,
  no way to split "list users" and "create user" into separate concerns.
- **Reach for a full API framework that assumes it owns the process** — most expect to call
  `listen()` and run their own server. Next.js already owns the process; there's no `listen()` to
  call, and no way to hand a `Request` to something that only speaks `(req, res)`.

What you actually want is what [Hono](https://hono.dev) popularized: a real app — routers,
middleware, a service layer, typed context — built once, the same way regardless of where it
runs, then **mounted** into the route file with one line:

```ts
// app/api/[[...route]]/route.ts
import { app } from '@/server/app';
import { handle } from 'nextrush/nextjs';

export const { GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS } = handle(app);
```

That's this package's entire job: bridge a real NextRush `Application` — however you've built
it, across however many files — into the seven exports `route.ts` needs, without rewriting the
request or dropping background work. `ctx.waitUntil()` is silently a no-op under a hand-rolled
bridge (Next supplies no execution context on its own); `handle()` wires it to Next's `after()`
for you.

## When to use

**Use `@nextrush/adapter-nextjs` if:**

- ✓ You want to mount a NextRush API inside a Next.js App Router project (`app/api/.../route.ts`)
- ✓ You're on Next.js 14, 15, or 16

**Reach for something else if:**

- ✗ You're on the Pages Router → migrate the route to `app/api/[[...route]]/route.ts` (the App
  Router has been Next's default for three major versions; this package deliberately does not
  support Pages — see [ARCHITECTURE.md](./ARCHITECTURE.md#rejected-alternatives))
- ✗ You're deploying to Cloudflare Workers/Vercel Edge/AWS Lambda directly (no Next.js involved)
  → use [`@nextrush/adapter-edge`](../edge) or [`@nextrush/adapter-serverless`](../serverless)

---

## Installation

```bash
pnpm add @nextrush/adapter-nextjs
# npm i @nextrush/adapter-nextjs · yarn add @nextrush/adapter-nextjs · bun add @nextrush/adapter-nextjs
```

> [!NOTE]
> Already using `nextrush`? Import from `nextrush/nextjs` instead — same package, re-exported as
> an optional peer. A functional-only `pnpm add nextrush` never resolves it or `next`.

## Quick start

Build the app in its own file, then mount it. Even a tiny API is two files, not one — the route
file's only job is the bridge:

```ts
// src/server/app.ts
import { createApp, createRouter } from 'nextrush';

const app = createApp();

const api = createRouter();
api.get('/hello', (ctx) => ctx.json({ message: 'Hello Next.js!' }));
app.route('/api', api);

export { app };
```

```ts
// app/api/[[...route]]/route.ts
import { app } from '@/server/app';
import { handle } from 'nextrush/nextjs';

export const { GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS } = handle(app);
```

No `runtime` export (Node is already the default; the Edge runtime is deprecated upstream), no
mount-prefix configuration. The route is mounted the same way any NextRush route is mounted
anywhere else: `app.route('/api', router)`. See [Project structure](#project-structure-for-a-real-api)
below for how this splits further as the API grows.

## Capabilities

**Capabilities**
- **Seven-method export** — `handle(app)` returns `{ GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS }` in one call
- **Class/DI support** — pass a factory (`() => Application | Promise<Application>`) for apps needing `await registerModule(...)` before use
- **Background work** — `ctx.waitUntil()` is wired to Next's `after()` when available, and never throws even if `after()` itself does
- **Mount-mismatch diagnostic** — in development, a mounted-prefix mistake logs an actionable hint instead of a bare 404

**Developer experience**
- Fully typed, zero `any`
- No configuration for the common path — `timeout` and `onError` are the only options, both pass-throughs to the underlying engine

## Mental model

The request is never touched. `handle()` forwards it, unmodified, to the same execution engine
every edge/serverless target already uses:

```text
Next.js route handler ──▶ handle() ──▶ createFetchHandler (unchanged) ──▶ your Application
                              │
                              └─ wires ctx.waitUntil() to after(), if available
```

**Rule:** mount prefixes are the application's own (`app.route(prefix, router)`) — this package
never infers or strips one.

> [!TIP]
> The full request lifecycle (Mermaid) is in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Common tasks

### Project structure for a real API

`app.route(prefix, router)` composes the same way regardless of file count — split by feature,
keep business logic out of route handlers, mount everything once in `src/server/app.ts`:

```text
src/
├── server/
│   ├── app.ts                 # composes every feature router — the ONLY export route.ts imports
│   ├── routes/
│   │   ├── users.route.ts     # HTTP concerns only: params, status, calling into services
│   │   └── posts.route.ts
│   └── services/
│       ├── users.service.ts   # business logic, data access — no ctx, no Request/Response
│       └── posts.service.ts
app/
└── api/
    └── [[...route]]/
        └── route.ts           # the bridge — nothing else lives here
```

```ts
// src/server/services/users.service.ts — pure business logic, no framework types
export async function findUser(id: string) {
  return db.user.findUnique({ where: { id } }); // whatever your data layer is
}
```

```ts
// src/server/routes/users.route.ts — HTTP concerns only, delegates to the service
import { createRouter } from 'nextrush';
import { findUser } from '../services/users.service';

export const usersRouter = createRouter();

usersRouter.get('/:id', async (ctx) => {
  const user = await findUser(ctx.params.id);
  if (!user) return ctx.throw(404, 'User not found');
  ctx.json(user);
});
```

```ts
// src/server/app.ts — the one place every router gets mounted
import { createApp } from 'nextrush';
import { usersRouter } from './routes/users.route';
import { postsRouter } from './routes/posts.route';

const app = createApp();
app.route('/api/users', usersRouter);
app.route('/api/posts', postsRouter);

export { app };
```

```ts
// app/api/[[...route]]/route.ts — unchanged no matter how large the app grows
import { app } from '@/server/app';
import { handle } from 'nextrush/nextjs';

export const { GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS } = handle(app);
```

This is the same shape [Hono](https://hono.dev) popularized: routers are plain, composable
modules; the route file is a one-line bridge; and the app never knows or cares that it's running
inside Next.js — the identical `src/server/app.ts` also boots under `listen()`,
`@nextrush/adapter-edge`, or any other adapter, unchanged.

### Mounting under a prefix

```ts
const app = createApp();
const api = createRouter();
api.get('/users', (ctx) => ctx.json(listUsers()));
app.route('/api', api); // requests to /api/users match
```

### Class-based apps (DI, modules, guards)

```ts
import { registerModule } from 'nextrush/class';
import { AppModule } from '@/server/app.module';

export const { GET, POST } = handle(async () => {
  const app = createApp();
  await registerModule(app, AppModule, { prefix: '/api' });
  return app;
});
```

### Building the app once across route-file reloads (dev HMR)

```ts
const g = globalThis as unknown as { __nextrushApp?: Application };
const app = (g.__nextrushApp ??= buildApp());
```

## API overview

| Export | Signature | Since | Stability | Description |
| ------ | --------- | ----- | --------- | ----------- |
| `handle` | `(app: AppSource, options?: NextHandlerOptions) => NextRouteHandlers` | `1.0.0-beta.0` | Beta 🚧 | Mounts an app, returns all seven route-handler exports |
| `type AppSource` | — | `1.0.0-beta.0` | Beta 🚧 | An `Application`, or a (possibly async) factory producing one |
| `type NextRouteHandlers` | — | `1.0.0-beta.0` | Beta 🚧 | The seven exported handler functions |
| `type NextHandlerOptions` | — | `1.0.0-beta.0` | Beta 🚧 | `{ timeout?, onError? }` |
| `type NextRouteContext` | — | `1.0.0-beta.0` | Beta 🚧 | The structural shape of Next's second handler argument |

## Options

| Option | Type | Required | Default | Security-sensitive | Description |
| ------ | ---- | -------- | ------- | ------------------ | ----------- |
| `timeout` | `number` | No | the edge engine's default (25 000 ms) | — | Per-request timeout in ms, raced to a `504` |
| `onError` | `(error, ctx) => Response \| Promise<Response>` | No | the engine's default 500 handler | — | Custom error → `Response` mapping |

## Compatibility

**Requirements**

| Requirement | Version |
| ----------- | ------- |
| NextRush | `4.x` |
| Next.js | `>=14.0.0` (App Router only) |
| Node.js | `>=22` |
| TypeScript | `>=5.x` |

**Runtimes**

| Runtime | Supported | Notes |
| ------- | --------- | ----- |
| Node.js `>=22` | ✅ | Next's default runtime |
| Bun / Deno / Cloudflare (OpenNext) | ✅ / ✅ / ✅ | The package imports no runtime-specific API — pinned by `packages/adapters/conformance`'s `nextjs` driver |

**Integration**
- **Peer dependencies:** `next >=14.0.0` (optional)
- **Works with:** any NextRush middleware/class-runtime package — the mounted app is an ordinary `Application`
- **Incompatible with:** the Pages Router (not supported — see [ARCHITECTURE.md](./ARCHITECTURE.md#rejected-alternatives))

> [!IMPORTANT]
> NextRush is **ESM-only, permanently** — no CommonJS build. On Node `>=22`, CJS consumers can
> `require()` this ESM package natively. See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

---

## Troubleshooting

<details>
<summary><strong>404 for every route, even ones I declared</strong></summary>

**Cause:** the mount prefix in your route file's folder doesn't match your `app.route()` call.
**Fix:** in development, check the server log — a mismatch logs an actionable hint naming both
halves and the exact `app.route()` call to add.

```ts
// app/api/[[...route]]/route.ts mounts at /api — the app must declare it too:
app.route('/api', api); // not app.route('/', api)
```

</details>

<details>
<summary><strong>`GET` returns the same response on every request (Next 14 only)</strong></summary>

**Cause:** Next 14 statically caches `GET` route handlers by default (this changed to dynamic-by-default in 15.0.0-RC).
**Fix:** add one export.

```ts
export const dynamic = 'force-dynamic';
```

</details>

<details>
<summary><strong>`export const GET = createFetchHandler(app)` fails `next build`'s type check</strong></summary>

**Cause:** that's exactly the problem this package exists to solve — `createFetchHandler`'s second
parameter (`EdgeExecutionContext`) isn't assignable from Next's route context.
**Fix:** use `handle(app)` instead of `createFetchHandler` directly.

</details>

## FAQ

**Can I use this without `nextrush`?**
Yes — install `@nextrush/adapter-nextjs` directly and pass any `@nextrush/core` `Application`.

**Why ESM-only?**
See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

**Does it work on Bun / Deno / Edge?**
Yes — the package is fully Web-standard (no `node:*`, `process`, or runtime global), so it runs
on every host Next.js itself runs on. Verified by the conformance suite's `nextjs` driver.

**Does it support the Pages Router?**
No, deliberately — see [ARCHITECTURE.md](./ARCHITECTURE.md#rejected-alternatives) for why.

---

## Package relationships

```text
                        depends on            @nextrush/adapter-edge
@nextrush/adapter-nextjs ──────────────▶
                        often used with        @nextrush/class (for DI/module apps)
                        usually used next       @nextrush/openapi (for generated API docs)
```

- **Depends on:** [`@nextrush/adapter-edge`](../edge) — reuses its fetch engine, unmodified
- **Often used with:** [`@nextrush/class`](../../class) — for module/DI-based apps via the factory form
- **Usually used next:** [`@nextrush/openapi`](../../middleware/openapi) — if you want generated API docs for the mounted routes
- **Alternative:** none for Next.js specifically — for other platforms, see [`@nextrush/adapter-edge`](../edge) (Cloudflare/Vercel/Netlify) or [`@nextrush/adapter-serverless`](../serverless) (Lambda/GCF/Azure)

## Architecture

Maintaining or contributing to this package? The internal design — why the request is never
rewritten, the mount-mismatch diagnostic, and the Pages Router non-goal — is in
**[`ARCHITECTURE.md`](./ARCHITECTURE.md)**. Design history:
[RFC-024](../../../docs/RFC/runtime-adapters/024-adapter-nextjs.md),
[ADR-0014](../../../docs/adr/ADR-0014-adapter-nextjs-prepend-only.md).

## Resources

- 📖 **Learn** — [Documentation](https://0xtanzim.github.io/nextRush/docs) · [Architecture](./ARCHITECTURE.md) · [RFCs](https://github.com/0xTanzim/nextRush/tree/main/docs/RFC)
- 📝 **Changelog** — [CHANGELOG.md](./CHANGELOG.md)
- 🐛 **Report an issue** — [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- 🤝 **Contribute** — [CONTRIBUTING.md](https://github.com/0xTanzim/nextRush/blob/main/CONTRIBUTING.md)

---

MIT © [Tanzim Hossain](https://github.com/0xTanzim)
