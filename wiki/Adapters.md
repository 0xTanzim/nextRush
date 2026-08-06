# Adapters

NextRush applications run unmodified on Node, Bun, Deno, Cloudflare Workers, and the major
serverless platforms. That is not a promise made per adapter — it is the consequence of an
architectural invariant: **the core never touches a runtime API.**

Your route handlers, middleware, and routers speak only Web-standard `Request`, `Response`,
`ReadableStream`, `AbortSignal`, `URL`, and `crypto.subtle`. A runtime is a separate package that
lives behind an adapter interface and translates those Web standards to and from the platform.

## Why an adapter boundary

If the core imported `node:http`, every other runtime (and the test runner, and edge deploys)
would either inherit Node or need a fork. Keeping runtime code out of the core means:

- **One code path.** Routing, middleware composition, error mapping, and context building happen
  in `@nextrush/core`. Adapters only build the standard interceptor `Context` and call the same
  `app.callback()` pipeline everyone else uses — they never reimplement framework logic.
- **Runtime is interchangeable.** The app you write for `listen()` on Node is the same app you
  export as a Cloudflare Worker handler.
- **Capabilities are declared, not guessed.** Behavior is decided by features the runtime
  actually exposes (`runtime.capabilitiesFor()` on `@nextrush/runtime`), never by an
  `if (runtime === 'node')` branch. See [Architecture](Architecture).

The adapter contract is enforced, not conventional. `ServerAdapter`, `FetchAdapter`, and
`AdapterContextFactory` are exported types in `@nextrush/types`; every adapter source carries a
compile-time `satisfies` guard against one of them, so a method-signature drift fails `tsc`
before it ever runs.

## The adapter packages

| Package | Runtime | Shape | Handler |
| -------- | ------- | ----- | ------- |
| `@nextrush/adapter-node` | Node.js (`node:http`) | server | `createHandler`, `serve`, `listen` |
| `@nextrush/adapter-bun` | Bun (`Bun.serve`) | fetch | `serve` |
| `@nextrush/adapter-deno` | Deno (`Deno.serve`) | fetch | `serve` |
| `@nextrush/adapter-edge` | Cloudflare Workers / edge | fetch | `createCloudflareHandler` |
| `@nextrush/adapter-serverless` | AWS Lambda · GCF · Azure | event → fetch | `createLambdaHandler` |
| `@nextrush/adapter-nextjs` | Next.js | fetch | prepends to the Next app |

`@nextrush/adapter-node` ships inside the `nextrush` meta-package by default; the others are
separate packages you install when you target that runtime. `nextrush` re-exports `listen` and
`serve` directly.

## The same app on Node and on edge

Write it once with Web-standard mechanics:

```js
// app.js — Any runtime
import { createApp, createRouter } from 'nextrush';

export const app = createApp();
const users = createRouter();
users.get('/', (ctx) => ctx.json([]));
users.get('/:id', (ctx) => ctx.json({ id: ctx.params.id }));
app.route('/users', users);
```

Run it on Node with a real TCP server on port 8080:

```js
// node-entry.js
import { createApp, createRouter, listen } from 'nextrush';

const app = createApp();
const router = createRouter();
router.get('/', (ctx) => ctx.json({ hello: 'NextRush' }));
app.route('/', router);

await listen(app, 8080); // http://localhost:8080
```

Run the same `app` on Cloudflare Workers:

```js
// worker-entry.js
import { createCloudflareHandler } from '@nextrush/adapter-edge';
import { app } from './shared-app.js';

export default createCloudflareHandler(app); // workerd expects a { fetch } shape
```

Both entries import the same `app`. The edge handler returns the `{ fetch }` object workerd
expects, and — because Cloudflare gives you a real `Request` directly — there is no event-map
step. Serverless is the one case with a translation layer.

## Serverless: event maps

Lambda/GCF/Azure do not hand you a `Request`; they hand you a platform-specific event object.
`@nextrush/adapter-serverless` ships an internal `EventMapper` (a pure `toRequest` /
`fromResponse` pair) that turns, say, an API Gateway v2 event into the same `Request` your app
sees on Node. Your handlers never notice:

```ts
import { createApp } from '@nextrush/core';
import { createLambdaHandler } from '@nextrush/adapter-serverless';

const app = createApp();
app.use((ctx) => ctx.json({ hello: 'lambda' }));

// API Gateway v1/v2, Lambda Function URL, GCF, Azure all work by default.
export const handler = createLambdaHandler(app);
```

Cold start is the expensive part and happens once per execution environment; warm invocations
reuse the built app. Measured locally (~65.6ms median for the functional style, ~79.5ms with the
class/DI runtime — hardware-dependent), the ~14ms delta is `reflect-metadata` + decorator
machinery loading. Response streaming on Lambda works only via Function URLs configured for
`RESPONSE_STREAM`; classic API Gateway always buffers. For a platform with no built-in mapper
(e.g. an internal PaaS), you write an `EventMapper` and pass it to
`createServerlessAdapter({ mappers: [...] })` — an `@advanced` escape hatch, not the daily API.

## Full conformance suite

The claim that these six adapters behave identically is proven, not asserted — and the proof
lives in [Testing](Testing). The cross-adapter conformance suite
(`@nextrush/adapter-conformance`, internal, unpublished) runs the **same** real requests —
cookies, multipart uploads, SSE streams, WebSockets upgrades, abort signals, timeouts —
through every adapter and asserts byte-identical responses. Critically, it runs on the **real**
Bun binary, the **real** Deno binary (`v2.6.3`), and inside a **real** `workerd`/miniflare
isolate (the engine behind Cloudflare Workers) — not Node processes pretending to be them.
Re-run the CI jobs locally with `act -j bun-conformance` / `deno-conformance` /
`workerd-conformance`.

### What conformance proves today

| Feature | node · bun · deno · edge · serverless |
| --- | --- |
| Request, Cookies, SSE, Timeouts, Streaming | ✅ full — a real conformance assertion executed on the real runtime |
| AbortSignal | ✅ full everywhere; serverless is partial (buffered event, timeout still fires) |
| Multipart / Compression / WebSockets | 🔷 capability-only — inferred from a `capabilitiesFor()` bit, no executed assertion |

The matrix is **generated** from real test results (`pnpm --filter @nextrush/adapter-conformance
cert:matrix`), never hand-maintained, so a regression that breaks a feature drops that runtime's
score automatically. Each cell carries how strong its proof is: `full` (a real executed
assertion) vs `capability-only` (inference from a capability bit). The honest gaps are disclosed,
not hidden — WebSocket capability comes from the runtime, for example, but there is no upgrade
path in the adapters today, so that cell is not scored as proven.

## Per-runtime caveats worth knowing

- **Node** — node uses `node:http`, and `ctx.body` can be a Buffer-backed `bodySource`. Long-lived
  sockets give you a transport-level abort (`ctx.signal` fires on both timeout and cancellation).
  Extension `destroy()` runs via a graceful close.
- **Bun / Deno** — both are fetch-native; adapters wrap `Bun.serve` / `Deno.serve`. Real-runtime
  conformance catches socket-level differences that a Node simulation would hide.
- **Edge (Cloudflare)** — no filesystem, no Node streams. Middleware that touches `fs` (e.g.
  `@nextrush/static`) will not work on Workers. Prefer Web-standard middleware (`cors`, `helmet`,
  `cookies`, `body-parser`, `compression`), which edge fully supports. Function bundle is capped
  at 1MB by Cloudflare; CI gates the minimal edge bundle gzip at an internal ~13.1KB target, so
  a Node-only dependency that would drag in a heavy build fails the gate at CI time, not a user
  deploy. There is no server lifetime, so extension `destroy()` never runs.
- **Serverless** — invocation has no server lifetime and delivers a buffered event: no
  mid-request transport abort (timeout still fires `ctx.signal`). Shutdown is not applicable.

## Identify the runtime

If you must branch on environment at all, do it through the negotiated capability, not by naming
a runtime:

```ts
import { getRuntime, capabilitiesFor } from '@nextrush/runtime';

const r = getRuntime();            // { platform: 'node'|'bun'|'deno'|'edge'|..., version }
const caps = capabilitiesFor(r);    // { streams, abortSignal, shutdown, ... }
```

`@nextrush/runtime` owns this detection, and the conformance suite drives its advertised bits.
Prefer writing code against the capability, not the platform name — a feature that works on one
runtime and not another is not done, and "capability negotiation" is how the framework keeps
that promise instead of a pile of `if (platform === 'x')` branches.

## Next steps

- [Core Concepts](Core-Concepts) — what applications are composed of under the adapter
- [Architecture](Architecture) — the layer invariant that makes this portable
- [Routing](Routing) — how `app.route()` composes the routers the adapter hands the pipeline
- [Testing](Testing) — test `app` through `serve()` on an ephemeral port, no real server needed
- [Request Lifecycle](Request-Lifecycle) — what runs between `Request` in and `Response` out
- Docs-site adapter reference: https://0xtanzim.github.io/nextRush/docs/reference/adapters