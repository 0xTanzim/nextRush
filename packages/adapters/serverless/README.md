# @nextrush/adapter-serverless

> Deploy a NextRush app to AWS Lambda, Google Cloud Functions, or Azure Functions with one function call.

[![npm version](https://img.shields.io/npm/v/@nextrush/adapter-serverless.svg)](https://www.npmjs.com/package/@nextrush/adapter-serverless)
[![downloads](https://img.shields.io/npm/dm/@nextrush/adapter-serverless.svg)](https://www.npmjs.com/package/@nextrush/adapter-serverless)
[![types](https://img.shields.io/npm/types/@nextrush/adapter-serverless.svg)](https://www.npmjs.com/package/@nextrush/adapter-serverless)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)
[![license](https://img.shields.io/npm/l/@nextrush/adapter-serverless.svg)](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)

|  |  |
| --- | --- |
| **Purpose** | Run a NextRush app as an AWS Lambda / GCF / Azure Functions handler |
| **Package type** | Adapter |
| **Status** | Beta |
| **Included in `nextrush`?** | No -- standalone install |
| **Support tier** | Internal -- non-`-node` adapter until GA, may change without a major -- see [ADR-0005](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md) |
| **Maintenance** | Active |
| **Runtime** | AWS Lambda, Google Cloud Functions, Azure Functions -- built on `@nextrush/adapter-edge`'s fetch engine |
| **Requires** | Node >=22 (Lambda's Node.js runtime) . ESM-only . TypeScript >=5.x |
| **Introduced** | v1.0.0-beta.0 |

## Installation

```bash
pnpm add @nextrush/adapter-serverless @nextrush/core
# npm i @nextrush/adapter-serverless @nextrush/core
# yarn add @nextrush/adapter-serverless @nextrush/core
# bun add @nextrush/adapter-serverless @nextrush/core
```

> [!NOTE]
> Not included in the `nextrush` meta package. Adapters are installed separately because each
> targets a different deployment platform.

## Quick start

```ts
import { createApp } from '@nextrush/core';
import { createLambdaHandler } from '@nextrush/adapter-serverless';

// Module scope -- built once per cold start, reused across every warm invocation.
const app = createApp();
app.get('/', (ctx) => ctx.json({ message: 'Hello from Lambda!' }));

export const handler = createLambdaHandler(app);
```

`createLambdaHandler` covers Lambda Function URL, API Gateway HTTP API (payload format 2.0), and
API Gateway REST API (payload format 1.0) -- it detects which event shape it received, so you
never name a provider. Building the app and the handler at module scope (not inside the handler)
is what lets AWS reuse the same booted instance across warm invocations.

> [!IMPORTANT]
> `ctx.runtime` reports `'edge'` inside a NextRush handler running on this package, on every
> provider (Lambda, GCF, Azure) -- **not** `'node'`. This adapter is built on
> `@nextrush/adapter-edge`'s fetch engine, and edge's runtime detector has no AWS/GCP/Azure
> branches; it defaults to `'edge'` unless it recognizes Cloudflare, Vercel, or Netlify. Code that
> branches on `ctx.runtime === 'node'` will not match on any serverless platform. Use
> `ctx.platform` (`'lambda' | 'gcf' | 'azure' | ...`) instead when you need to know which provider
> you're actually running on -- each Tier-1 handler here sets it explicitly, so it is never
> detected/guessed on this package.

## The three platform handlers

| Handler | Platform | Detection |
| --- | --- | --- |
| `createLambdaHandler(app, options?)` | AWS Lambda (Function URL, API Gateway v1/v2) | Automatic -- payload shape is unambiguous |
| `createGoogleHandler(app, options?)` | Google Cloud Functions (functions-framework) | Fixed to the `gcf` mapper |
| `createAzureHandler(app, options?)` | Azure Functions v4 model | Fixed to the `azure` mapper |

All three are true drop-ins -- pass them straight to the platform's own registration call, with no
hand-written field mapping:

```ts
// Google Cloud Functions
import { createGoogleHandler } from '@nextrush/adapter-serverless';
import * as functions from '@google-cloud/functions-framework';

functions.http('api', createGoogleHandler(app));
```

```ts
// Azure Functions (v4 model)
import { createAzureHandler } from '@nextrush/adapter-serverless';
import { app as functions } from '@azure/functions';

functions.http('api', { handler: createAzureHandler(app) });
```

> [!NOTE]
> Cloudflare Workers is not a serverless-event platform (it speaks the Fetch API directly), so its
> one-line handler -- `createCloudflareHandler` -- ships in `@nextrush/adapter-edge`, not here. See
> the [full "which package do I install?" table](https://github.com/0xTanzim/nextRush/blob/main/apps/website/content/docs/start/runtime/decision-guide.mdx)
> if you're unsure which of the two packages a given platform needs.

### The struct-based path (`createGoogleEventHandler` / `createAzureEventHandler`)

Reach for these instead of the drop-ins only for fixture testing, a custom bridge, or a host whose
request shape doesn't match the platform's standard SDK object. They carry the exact behavior
`createGoogleHandler`/`createAzureHandler` had before this package's `1.0.0-beta.1`: a handler over
a normalized event struct, with the field mapping written by you at the boundary.

```ts
import { createGoogleEventHandler } from '@nextrush/adapter-serverless';

const api = createGoogleEventHandler(app);
functions.http('api', async (req, res) => {
  const result = await api({
    method: req.method,
    path: req.path,
    query: req.query,
    headers: req.headers,
    body: req.rawBody?.toString(),
  });
  res.status(result.statusCode).set(result.headers).send(result.body);
});
```

> [!NOTE]
> **Migrating from `1.0.0-beta.0`?** `createGoogleHandler`/`createAzureHandler` changed from a
> struct-taking handler to a true drop-in in `1.0.0-beta.1` (see
> [RFC-027](https://github.com/0xTanzim/nextRush/blob/main/docs/RFC/runtime-adapters/027-serverless-gcf-azure-drop-in-handlers.md)).
> If you have an existing hand-written bridge, either delete it and call the drop-in directly, or
> rename your call to `createGoogleEventHandler`/`createAzureEventHandler` to keep it working
> unchanged.

## Tuning

```ts
export const handler = createLambdaHandler(app, { timeout: 5000 });
```

| Option | Type | Required | Default | Security-sensitive | Description |
| --- | --- | --- | --- | --- | --- |
| `timeout` | `number` | No | `24000` (edge default) | -- | Per-invocation cap in ms; exceeding it returns a 504 result instead of hanging |

## Response streaming (AWS Lambda Function URL)

`createLambdaHandler` buffers the full response body into the result object. For true Function URL
response streaming (lower time-to-first-byte, unbounded body size), use the dedicated streaming
handler -- it writes chunks to Lambda's `responseStream` as your app produces them:

```ts
import { createLambdaStreamingHandler } from '@nextrush/adapter-serverless';

export const handler = createLambdaStreamingHandler(app); // Function URL, RESPONSE_STREAM mode
```

Configure the Lambda Function URL for `RESPONSE_STREAM` invoke mode. On the real Lambda runtime the
handler is wrapped with the runtime-injected `awslambda.streamifyResponse`; without that global
(local runs, tests) it falls back to driving the stream directly. Anything your app streams via
`ctx.sendStream(...)` is written incrementally, never collected first.

## Advanced: adding a platform NextRush does not ship

Runtime authors only. To support a platform without a built-in handler (Oracle Functions, Fly.io,
OpenFaaS, an internal platform), implement an `EventMapper` and pass it to
`createServerlessAdapter` -- the escape hatch the three Tier-1 handlers above are built from:

```ts
import { createServerlessAdapter, type EventMapper } from '@nextrush/adapter-serverless';

const oracle: EventMapper<OracleEvent, OracleResult> = {
  name: 'oracle',
  toRequest: (event) => new Request('http://localhost' /* map real fields */),
  fromResponse: (response) => ({ /* map the platform's expected shape */ }),
  detect: (event) => 'fnInvokeType' in event,
};

export const handler = createServerlessAdapter({ mappers: [oracle] }).createHandler(app);
```

Mapper selection is explicit-first: a configured `provider` name wins; `detect()` runs per
invocation only when no provider is set. The mapper list passed to `createServerlessAdapter` is
per-adapter and immutable -- there is no global mutable mapper registry.

## API reference

| Export | Signature | Since | Stability | Description |
| --- | --- | --- | --- | --- |
| `createLambdaHandler` | `(app: Application, options?: ServerlessHandlerOptions) => ServerlessHandler<LambdaEvent, LambdaResult>` | 1.0.0-beta.0 | Internal | AWS Lambda handler; auto-detects Function URL / API Gateway v1/v2 |
| `createLambdaStreamingHandler` | `(app: Application, options?: ServerlessHandlerOptions) => StreamingLambdaHandler` | 1.0.0-beta.0 | Internal | True Function URL response streaming |
| `createGoogleHandler` | `(app: Application, options?: ServerlessHandlerOptions) => (req: GcfHttpRequest, res: GcfHttpResponse) => Promise<void>` | 1.0.0-beta.1 | Internal | Google Cloud Functions true drop-in -- pass directly to `functions.http('api', handler)` |
| `createAzureHandler` | `(app: Application, options?: ServerlessHandlerOptions) => (req: AzureHttpRequestLike) => Promise<AzureHttpResponseLike>` | 1.0.0-beta.1 | Internal | Azure Functions v4 true drop-in -- pass directly to `app.http('api', { handler })` |
| `createGoogleEventHandler` | `(app: Application, options?: ServerlessHandlerOptions) => ServerlessHandler<GcfEvent, GcfResult>` | 1.0.0-beta.1 | Internal | The struct-based path `createGoogleHandler` had before `1.0.0-beta.1` -- fixture testing, custom bridges |
| `createAzureEventHandler` | `(app: Application, options?: ServerlessHandlerOptions) => ServerlessHandler<AzureEvent, AzureResult>` | 1.0.0-beta.1 | Internal | The struct-based path `createAzureHandler` had before `1.0.0-beta.1` -- fixture testing, custom bridges |
| `createServerlessAdapter` | `(options: ServerlessAdapterOptions<Event, Result, Ctx>) => { createHandler(app): ServerlessHandler<Event, Result, Ctx> }` | 1.0.0-beta.0 | Internal | Runtime-author escape hatch -- build a handler from a custom `EventMapper` list |
| `toGcfEvent`, `writeGcfResult` | `(req: GcfHttpRequest) => GcfEvent`; `(res: GcfHttpResponse, result: GcfResult) => void` | 1.0.0-beta.1 | Internal | The pure bridge functions `createGoogleHandler` composes -- exported for a custom drop-in variant |
| `toAzureEvent`, `toAzureResponse` | `(req: AzureHttpRequestLike) => Promise<AzureEvent>`; `(result: AzureResult) => AzureHttpResponseLike` | 1.0.0-beta.1 | Internal | The pure bridge functions `createAzureHandler` composes -- exported for a custom drop-in variant |
| `type EventMapper<Event, Result, Ctx>` | -- | 1.0.0-beta.0 | Internal | The plugin shape: `toRequest`, `fromResponse`, optional `detect` |
| `type ServerlessHandlerOptions` | -- | 1.0.0-beta.0 | Internal | `{ timeout?: number }` -- Tier-1 handler tuning |
| `type ServerlessAdapterOptions<Event, Result, Ctx>` | -- | 1.0.0-beta.0 | Internal | `{ mappers, provider?, timeout?, platform? }` -- Tier-3 adapter configuration |
| `type GcfHttpRequest`, `GcfHttpResponse`, `AzureHttpRequestLike`, `AzureHttpResponseLike` | -- | 1.0.0-beta.1 | Internal | Structural (duck-typed) shapes the real GCF/Azure SDK objects satisfy -- no SDK dependency |
| `lambdaFunctionUrl`, `apigwV1`, `apigwV2`, `gcf`, `azure` | `EventMapper<...>` | 1.0.0-beta.0 | Internal | The built-in mappers each Tier-1 handler wires internally |

## Compatibility

**Requirements**

| Requirement | Version |
| --- | --- |
| NextRush | 3.x |
| Node.js | >=22 (must match your Lambda/Functions runtime's Node version) |
| TypeScript | >=5.x |

**Runtimes**

| Runtime | Supported | Notes |
| --- | --- | --- |
| AWS Lambda | Yes | Function URL, API Gateway REST (v1) and HTTP API (v2) |
| Google Cloud Functions | Yes | functions-framework HTTP model |
| Azure Functions | Yes | v4 Node.js programming model |
| Cloudflare Workers | No | Use `@nextrush/adapter-edge`'s `createCloudflareHandler` instead |

**Integration**
- **Peer dependencies:** none (depends directly on `@nextrush/core` and `@nextrush/adapter-edge`)
- **Works with:** any NextRush middleware registered on `app` before the handler is exported
- **Incompatible with:** none

> [!IMPORTANT]
> NextRush is ESM-only, permanently -- no CommonJS build. On Node >=22, CommonJS consumers can
> `require()` this ESM package natively. See the
> [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

## Troubleshooting

<details>
<summary><strong>Cold start is slower than expected on every invocation, not only the first</strong></summary>

**Cause:** `createApp()` or `createLambdaHandler()` was called inside the exported handler function
instead of at module scope. Calling either per-invocation rebuilds the app and reboots it every
time, defeating warm-instance reuse. **Fix:** move both calls to module scope, above the
`export const handler = ...` line, exactly as shown in Quick start.

```ts
// Wrong -- rebuilds and reboots the app on every invocation
export const handler = (event) => createLambdaHandler(createApp())(event);

// Right -- built once at module scope, reused across warm invocations
const app = createApp();
export const handler = createLambdaHandler(app);
```

</details>

<details>
<summary><strong>A route handler branches on `ctx.runtime === 'node'` and the branch never runs</strong></summary>

**Cause:** this package's `ctx.runtime` value is `'edge'` on every provider (see the callout in
Quick start), not `'node'` -- it inherits `@nextrush/adapter-edge`'s runtime detection.
**Fix:** branch on a capability (e.g. an explicit option you pass in) instead of `ctx.runtime`, or
check `ctx.env`/platform-specific fields directly if you need to distinguish providers. `ctx.platform`
is the supported way to name the provider (`'lambda' | 'gcf' | 'azure'`).

</details>

### Diagnostics reference

**Mapper guard errors.** A mapper throws a named `[nextrush/serverless]` error, rather than a raw
`TypeError` from framework internals, when the event it received cannot be the payload format it
translates. Verbatim from `src/mappers/`:

| Thrown by | Message |
| --- | --- |
| `_v2.ts` (Function URL / API Gateway HTTP API) | `[nextrush/serverless] Received an event with no requestContext.http.method — this mapper expects payload format 2.0 (AWS Lambda Function URL or API Gateway HTTP API). This usually means the event came from a different payload format (API Gateway v1, GCF, or Azure) or an incomplete test fixture.` |
| `apigw-v1.ts` | `[nextrush/serverless] The apigw-v1 mapper received an event with no httpMethod. This usually means the event came from a different payload format (API Gateway v2, GCF, or Azure) or an incomplete test fixture — pass a real API Gateway REST API (v1) event.` |
| `gcf.ts` | `[nextrush/serverless] The gcf mapper received an event with no method. This usually means the request-to-event bridge at your function's entry point is incomplete — check that it maps req.method onto the event's method field before calling the handler.` |
| `azure.ts` | `[nextrush/serverless] The azure mapper received an event with no method.` / `... with no url.` — same "incomplete request-to-event bridge" guidance |

The two "incomplete bridge" messages point at *your* bridge, so they can only fire on the
struct-based path (`createGoogleEventHandler` / `createAzureEventHandler`); the drop-in handlers
build the event themselves.

**Missing raw body on GCF.** If `req.rawBody` is absent and `req.body` is a parsed object,
`toGcfEvent` omits the body and warns with a `[nextrush/serverless]` prefix naming `rawBody` as the
missing capability, instead of stringifying the object into `"[object Object]"`. Configure your
function host to preserve `rawBody` if the request body matters.

**Diagnostics inherited from `@nextrush/adapter-edge`.** Because every invocation here runs through
edge's fetch engine, three of its development-mode diagnostics apply on Lambda/GCF/Azure too:

- **`ctx.waitUntil()` no-op warning** — serverless invocations supply no execution context, so a
  promise passed to `ctx.waitUntil()` is dropped without running. Outside production the first such
  call warns once per context.
- **Boot-reuse warning** — if a *different* `Application` boots in the same process than the one
  that booted first (the mechanical signature of calling `createApp()` inside the exported handler),
  a one-time development warning fires.
- **Timeout attribution** — a 504 logs the effective timeout and whether it came from the default or
  an explicit `options.timeout`, plus the method and path.

Exact wording and the production/development gating are documented in
[`@nextrush/adapter-edge`'s README](../edge/README.md#diagnostics).

## FAQ

**Do I need to pick a mapper myself?**
No. Each Tier-1 handler (`createLambdaHandler`, `createGoogleHandler`, `createAzureHandler`) wires
its own mapper(s) internally. You only touch `EventMapper` directly when adding support for a
platform this package doesn't ship (see Advanced above).

**Why ESM-only?**
See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

**Does state leak between invocations on a warm instance?**
No. Each invocation builds a fresh `Context`; only the booted `app` (and anything you put in
module-scope variables yourself) persists across warm invocations. Keep per-request data on
`ctx`/`ctx.state`, never in module-scope mutable variables.

**What happens if my handler exceeds the timeout?**
The invocation resolves with a 504 result and the still-running handler is cancelled cooperatively
via `ctx.signal`. See the `timeout` option above

## Package relationships

```text
                        depends on             @nextrush/adapter-edge (fetch engine, runtime
@nextrush/adapter-      ---------------------> detection, timeout race), @nextrush/core
serverless
                        often used with         @nextrush/class (controllers on serverless)
                        usually used next       @nextrush/logger (structured cold-start logs)
```

- **Depends on:** [`@nextrush/adapter-edge`](../edge) -- supplies the fetch engine, warm-boot
  memoization, and timeout-to-504 race this package reuses for every provider
- **Often used with:** [`@nextrush/class`](../../../class) -- controllers and DI work unchanged on
  a serverless deployment
- **Usually used next:** [`@nextrush/logger`](../../../middleware/logger) -- structured logs across
  cold starts and warm invocations
- **Alternative:** [`@nextrush/adapter-edge`](../edge) -- if your target is Cloudflare Workers or
  Vercel Edge Functions directly (a Fetch-API runtime, not a serverless-event platform)

## Architecture

Maintaining or contributing to this package? The internal design -- how it reuses the edge
adapter's engine, the `EventMapper` plugin model, warm-instance reuse -- is in
[`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Resources

- Learn -- [Documentation](https://0xtanzim.github.io/nextRush/docs) . [Architecture](./ARCHITECTURE.md)
- Report an issue -- [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- Contribute -- [CONTRIBUTING.md](https://github.com/0xTanzim/nextRush/blob/main/CONTRIBUTING.md)

---

MIT (c) [Tanzim Hossain](https://github.com/0xTanzim)
