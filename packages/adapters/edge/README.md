# @nextrush/adapter-edge

> Runs a NextRush app on any Fetch API edge runtime -- Cloudflare Workers, Vercel Edge
> Functions, and Netlify Edge Functions -- through one shared handler implementation.

[![npm version](https://img.shields.io/npm/v/@nextrush/adapter-edge.svg)](https://www.npmjs.com/package/@nextrush/adapter-edge)
[![downloads](https://img.shields.io/npm/dm/@nextrush/adapter-edge.svg)](https://www.npmjs.com/package/@nextrush/adapter-edge)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@nextrush/adapter-edge.svg)](https://bundlephobia.com/package/@nextrush/adapter-edge)
[![types](https://img.shields.io/npm/types/@nextrush/adapter-edge.svg)](https://www.npmjs.com/package/@nextrush/adapter-edge)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)
[![license](https://img.shields.io/npm/l/@nextrush/adapter-edge.svg)](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)

|  |  |
| --- | --- |
| **Purpose** | Fetch-API entry points that run a NextRush `Application` on edge runtimes |
| **Package type** | Adapter |
| **Status** | Stable (implementation) -- but see Support tier below |
| **Included in `nextrush`?** | No -- standalone install |
| **Support tier** | Internal -- non-`-node` adapter until GA, may change without a major (see [ADR-0005](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md)) |
| **Maintenance** | Active |
| **Runtime** | Edge -- any runtime implementing the Fetch API (Cloudflare Workers, Vercel Edge, Netlify Edge) |
| **Requires** | Node `>=22` for local tooling/build -- ESM-only -- TypeScript `>=5.x` |
| **Introduced** | `v1.0.0` |

## Highlights

- Zero external runtime dependencies -- only `@nextrush/{core,errors,runtime,stream,types}` (workspace packages)
- ESM-only, tree-shakable, side-effect-free (`sideEffects: false`)
- One shared request runner behind three platform-specific entry points -- Cloudflare, Vercel,
  and Netlify handlers cannot silently drift from each other
- Fully typed -- strict TypeScript, zero `any`

## The problem

Edge runtimes agree on the Fetch API (`Request` in, `Response` out) but disagree on the
surrounding module contract: Cloudflare Workers export `{ fetch(request, env, ctx) }`, Vercel
Edge Functions export a plain `(request) => Response` with `export const config = { runtime:
'edge' }`, and Netlify Edge Functions export the same plain shape again. Writing a NextRush app
against each platform's raw contract by hand means re-deriving request timeout handling,
404/error fallback, and `Application` boot sequencing three separate times -- and one of those
copies quietly drifting is how a platform-specific bug ships.

```ts
// TODAY, without this package -- three near-duplicate handlers, easy to drift:
export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // boot the app, race a timeout, build a Response... written by hand, three times
  },
};
```

`@nextrush/adapter-edge` centralizes that request-handling logic in one internal runner and
exposes a thin, platform-shaped wrapper per target.

## When to use

**Use `@nextrush/adapter-edge` if:**

- You are deploying a NextRush app to Cloudflare Workers, Vercel Edge Functions, or Netlify
  Edge Functions.
- Your app only needs the Web-standard `Request`/`Response`/`fetch` surface -- no Node.js APIs.

**Reach for something else if:**

- You are deploying to a long-running Node.js process -> use
  [`@nextrush/adapter-node`](../node) instead.
- You are deploying to AWS Lambda, Google Cloud Functions, or another FaaS platform with its
  own event format -> use [`@nextrush/adapter-serverless`](../serverless) (built on top of this
  package's fetch handler -- see Package relationships below).
- You are running on Bun or Deno directly (not via an edge platform) -> use
  [`@nextrush/adapter-bun`](../bun) or [`@nextrush/adapter-deno`](../deno).

## Installation

```bash
pnpm add @nextrush/adapter-edge @nextrush/core
# npm i @nextrush/adapter-edge @nextrush/core
# yarn add @nextrush/adapter-edge @nextrush/core
# bun add @nextrush/adapter-edge @nextrush/core
```

> [!NOTE]
> Not included in the `nextrush` meta package. Install it directly when deploying to an edge
> runtime.

## Quick start

```ts
// Cloudflare Workers -- src/index.ts
import { createApp } from '@nextrush/core';
import { createCloudflareHandler } from '@nextrush/adapter-edge';

const app = createApp();

app.use(async (ctx) => {
  ctx.json({ message: 'Hello from the edge', runtime: ctx.runtime });
});

export default createCloudflareHandler(app);
```

The handler boots the `Application` on the first incoming request (there is no separate
`listen()` step on edge), then reuses that boot for every subsequent request in the same
isolate.

## Capabilities

**Capabilities**
- **Three platform entry points, one runner** -- `createCloudflareHandler`,
  `createVercelHandler`, and `createNetlifyHandler` all delegate to the same internal request
  runner (`createFetchHandler` is the runner exposed directly, for any other Fetch-API host).
- **Cloudflare `env` bindings threaded onto context** -- `createCloudflareHandler`'s `env`
  argument (KV, D1, R2, Durable Objects, Queues, secrets) is exposed as `ctx.env`, typed via a
  generic.
- **Cooperative request timeout** -- races the handler against a timer; on timeout, aborts
  `ctx.signal` and returns `504`, so the framework's own bounded timeout fires before the
  platform kills the isolate.
- **`waitUntil` for fire-and-forget work** -- `ctx.waitUntil(promise)` extends the request
  lifetime for background tasks (logging, analytics) when the platform provides an execution
  context; a no-op otherwise.

**Developer experience**
- Fully typed exports, including a compile-time guard (`FetchAdapter`,
  `AdapterContextFactory`) that fails the build if this adapter's shape drifts from the shared
  cross-adapter contract.

## Mental model

```text
Request (Fetch API) --> createXxxHandler --> shared request runner --> Application.callback()
                                                     |
                                                     +-- races Application against a timeout timer
                                                     +-- builds Response via EdgeContext
```

**Rule:** every platform-specific handler (`createCloudflareHandler`, `createVercelHandler`,
`createNetlifyHandler`) is a thin wrapper around the same internal runner -- there is exactly
one request-handling code path to reason about, regardless of platform.

> [!TIP]
> The full request lifecycle (Mermaid) is in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Common tasks

### Deploy to Cloudflare Workers

```ts
// src/index.ts
import { createApp } from '@nextrush/core';
import { createCloudflareHandler } from '@nextrush/adapter-edge';

interface Env {
  MY_KV: KVNamespace;
}

const app = createApp();
app.use(async (ctx) => {
  const value = await ctx.env?.MY_KV.get('key');
  ctx.json({ value });
});

export default createCloudflareHandler<Env>(app);
```

```toml
# wrangler.toml
name = "my-nextrush-worker"
main = "src/index.ts"
compatibility_date = "2025-01-01"
```

### Deploy to Vercel Edge Functions

```ts
// api/hello.ts
import { createApp } from '@nextrush/core';
import { createVercelHandler } from '@nextrush/adapter-edge';

const app = createApp();
app.use(async (ctx) => {
  ctx.json({ message: 'Hello from Vercel Edge' });
});

export const config = { runtime: 'edge' };
export default createVercelHandler(app);
```

### Deploy to Netlify Edge Functions

```ts
// netlify/edge-functions/api.ts
import { createApp } from '@nextrush/core';
import { createNetlifyHandler } from '@nextrush/adapter-edge';

const app = createApp();
app.use(async (ctx) => {
  ctx.json({ message: 'Hello from Netlify Edge' });
});

export default createNetlifyHandler(app);
```

### Read the request body across runtimes

```ts
app.use(async (ctx) => {
  const text = await ctx.bodySource.text();
  const json = await ctx.bodySource.json();
  const buffer = await ctx.bodySource.buffer();
  const stream = ctx.bodySource.stream();
});
```

### Handle errors with a custom handler

```ts
const handler = createCloudflareHandler(app, {
  onError: (error, ctx) => {
    console.error({ error: error.message, path: ctx.path });
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  },
});
```

## API overview

| Export | Signature | Since | Stability | Description |
| ------ | --------- | ----- | --------- | ------------ |
| `createFetchHandler` | `(app: Application, options?: FetchHandlerOptions) => FetchHandler` | `1.0.0` | Internal | Generic Fetch-API handler; the runner every other export delegates to |
| `createCloudflareHandler` | `<Env>(app: Application, options?: FetchHandlerOptions) => { fetch: CloudflareFetchHandler<Env> }` | `1.0.0` | Internal | Cloudflare Workers module export -- `(request, env, ctx)` signature; threads `env` onto `ctx.env` |
| `createVercelHandler` | `(app: Application, options?: FetchHandlerOptions) => FetchHandler` | `1.0.0` | Internal | Vercel Edge Function handler (delegates to `createFetchHandler`) |
| `createNetlifyHandler` | `(app: Application, options?: FetchHandlerOptions) => FetchHandler` | `1.0.0` | Internal | Netlify Edge Function handler (delegates to `createFetchHandler`) |
| `createHandler` | same as `createFetchHandler` | `1.0.0` | Internal | Alias of `createFetchHandler`, kept for naming consistency with other adapters |
| `DEFAULT_EDGE_TIMEOUT_MS` | `25_000` | `1.0.0` | Internal | Default request timeout in ms when `options.timeout` is omitted |
| `detectEdgeRuntime` | `() => EdgeRuntimeInfo` | `1.0.0` | Internal | Detects which edge platform is running -- see Runtime detection below |
| `EdgeContext` | class | `1.0.0` | Internal | `Context` implementation for edge runtimes |
| `createEdgeContext` | `<Env>(request, executionContext?, trustProxy?, env?) => EdgeContext<Env>` | `1.0.0` | Internal | Constructs an `EdgeContext` directly |
| `type FetchHandler` | `(request: Request, ctx?: EdgeExecutionContext) => Response \| Promise<Response>` | `1.0.0` | Internal | The handler signature every `createXxxHandler` returns |
| `type EdgeExecutionContext` | `{ waitUntil, passThroughOnException? }` | `1.0.0` | Internal | Platform execution-context shape consumed by `ctx.waitUntil` |
| `type EdgeRuntimeInfo` | `{ runtime, isCloudflare, isVercel, isNetlify, isGenericEdge }` | `1.0.0` | Internal | Result shape of `detectEdgeRuntime()` |
| `HttpError` | re-exported from `@nextrush/errors` | `1.0.0` | Internal | Uniform error class across all adapters |

## Options

`FetchHandlerOptions`, accepted by every `createXxxHandler`:

| Option | Type | Required | Default | Security-sensitive | Description |
| ------ | ---- | -------- | ------- | ------------------- | ------------ |
| `onError` | `(error: Error, ctx: EdgeContext) => Response \| Promise<Response>` | No | built-in JSON 500 | -- | Custom error handler; receives the thrown error and the in-flight context |
| `timeout` | `number` | No | `25000` (`DEFAULT_EDGE_TIMEOUT_MS`) | -- | Request timeout in ms; races the handler and returns `504` on expiry, aborting `ctx.signal`. `0` disables the framework timeout (the platform's own limit still applies) |

## Runtime detection

`detectEdgeRuntime()` (re-exported from `@nextrush/runtime`) answers "which edge platform am I
on", distinct from the generic `detectRuntime()`. Verified against
`packages/runtime/src/detection.ts`, it checks exactly three platforms in order and has no
AWS/Lambda branch:

1. **Cloudflare Workers** -- `navigator.userAgent` contains `'Cloudflare-Workers'` -> `runtime:
   'cloudflare-workers'`, `isCloudflare: true`.
2. **Vercel Edge** -- `process.env.VERCEL_REGION` is defined -> `runtime: 'vercel-edge'`,
   `isVercel: true`.
3. **Netlify Edge** -- a `Deno` global exists AND `process.env.NETLIFY === 'true'` (Netlify Edge
   Functions run on Deno under the hood) -> `runtime: 'edge'` (not a distinct string),
   `isNetlify: true`.

If none of the three match, `runtime` stays at its initial value of `'edge'` and
`isGenericEdge` is `true`. There is no fourth branch for AWS Lambda or any other FaaS platform
-- `@nextrush/adapter-serverless` builds its own handler on top of this package's fetch runner
and inherits this same detection, so `ctx.runtime` reports `'edge'` there too (see
[`@nextrush/adapter-serverless`](../serverless)'s own docs for that package's scope).

```ts
import { detectEdgeRuntime } from '@nextrush/adapter-edge';

const info = detectEdgeRuntime();
// Cloudflare Workers: { runtime: 'cloudflare-workers', isCloudflare: true,  isVercel: false, isNetlify: false, isGenericEdge: false }
// Vercel Edge:        { runtime: 'vercel-edge',        isCloudflare: false, isVercel: true,  isNetlify: false, isGenericEdge: false }
// Netlify Edge:        { runtime: 'edge',              isCloudflare: false, isVercel: false, isNetlify: true,  isGenericEdge: false }
// Anything else:       { runtime: 'edge',              isCloudflare: false, isVercel: false, isNetlify: false, isGenericEdge: true }
```

Result is cached after the first call within a given isolate.

## Compatibility

**Requirements**

| Requirement | Version |
| ----------- | ------- |
| NextRush | `1.x` (`@nextrush/core`) |
| Node.js (local build/test only) | `>=22` |
| TypeScript | `>=5.x` |

**Runtimes**

| Runtime | Supported | Notes |
| ------- | --------- | ------ |
| Cloudflare Workers | Yes | via `createCloudflareHandler` |
| Vercel Edge Functions | Yes | via `createVercelHandler` |
| Netlify Edge Functions | Yes | via `createNetlifyHandler` (runs on Deno under the hood) |
| Node.js | No | use [`@nextrush/adapter-node`](../node) |

**Integration**
- **Peer dependencies:** none -- direct workspace dependencies on `@nextrush/{core,errors,runtime,stream,types}`.
- **Works with:** any NextRush middleware that only touches the `Context` API (no raw Node
  `req`/`res` access).
- **Built on by:** [`@nextrush/adapter-serverless`](../serverless), which wraps this package's
  fetch handler for FaaS platforms (AWS Lambda, Google Cloud Functions).

> [!IMPORTANT]
> NextRush is ESM-only, permanently -- no CommonJS build. See the
> [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

## Limitations

Edge runtimes share constraints this package does not paper over:

- No file system access -- use platform storage (R2, KV) or an external store.
- No native Node.js modules or native addons -- Web API equivalents only.
- CPU time and memory limits vary by platform -- consult the platform's own documentation.
- Large payloads should be streamed rather than buffered in memory.

## FAQ

**Does `ctx.runtime` tell me I am on AWS Lambda?**
No. `detectEdgeRuntime()` has no Lambda branch; it only distinguishes Cloudflare, Vercel, and
Netlify, defaulting to the generic `'edge'` otherwise. `@nextrush/adapter-serverless` is built
on this package and inherits the same detection, so Lambda deployments also report
`runtime: 'edge'` -- verified in `packages/runtime/src/detection.ts`.

**Why is this package tier "Internal" instead of "Public"?**
Per [ADR-0005](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md),
non-`-node` adapters (bun, deno, edge, serverless) stay Internal until each is declared GA;
`@nextrush/adapter-node` is the only adapter in the Public-core tier today.

**Does it work without `@nextrush/router`?**
Yes -- `app.use()` alone is enough for simple handlers. Add
[`@nextrush/router`](../../router) only when you need dynamic route matching.

**Can I use it outside Cloudflare/Vercel/Netlify?**
Yes -- `createFetchHandler` (and its alias `createHandler`) is a plain `(request, ctx?) =>
Response` function usable on any host that speaks the Fetch API, not only the three named
platforms.

## Package relationships

```text
                        depends on            @nextrush/{core,errors,runtime,stream,types}
@nextrush/adapter-edge -------------->
                        often used with       @nextrush/router
                        usually used next     @nextrush/adapter-serverless (for FaaS platforms)
```

- **Depends on:** [`@nextrush/core`](../../core), [`@nextrush/errors`](../../errors),
  [`@nextrush/runtime`](../../runtime), [`@nextrush/stream`](../../stream),
  [`@nextrush/types`](../../types).
- **Often used with:** [`@nextrush/router`](../../router) -- for dynamic route matching beyond
  a single `app.use()` handler.
- **Usually used next:** [`@nextrush/adapter-serverless`](../serverless) -- if the deploy target
  turns out to be AWS Lambda or Google Cloud Functions rather than an edge platform.
- **Alternative:** [`@nextrush/adapter-node`](../node) -- for a long-running Node.js process
  instead of an edge isolate; [`@nextrush/adapter-bun`](../bun) / [`@nextrush/adapter-deno`](../deno)
  -- for running directly on Bun/Deno outside an edge platform.

## Architecture

Maintaining or contributing to this package? The internal design -- the shared request runner,
context construction, and the compile-time adapter-contract guards -- is in
[`ARCHITECTURE.md`](./ARCHITECTURE.md). Design history:
[RFC-013 (adapter contract)](https://github.com/0xTanzim/nextRush/blob/main/docs/RFC/runtime-adapters/013-adapter-contract.md),
[ADR-0010 (cross-runtime parity hardening)](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0010-cross-runtime-parity-hardening.md).

## Resources

- Learn -- [Documentation](https://0xtanzim.github.io/nextRush/docs) -- [Architecture](./ARCHITECTURE.md) -- [RFCs](https://github.com/0xTanzim/nextRush/tree/main/docs/RFC)
- Changelog -- [CHANGELOG.md](./CHANGELOG.md)
- Report an issue -- [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- Contribute -- [CONTRIBUTING.md](https://github.com/0xTanzim/nextRush/blob/main/CONTRIBUTING.md)

---

MIT (c) [Tanzim Hossain](https://github.com/0xTanzim)
