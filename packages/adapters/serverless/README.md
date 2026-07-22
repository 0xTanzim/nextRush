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
| **Status** | Stable |
| **Included in `nextrush`?** | No -- standalone install |
| **Support tier** | Public -- see [ADR-0005](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md) |
| **Maintenance** | Active |
| **Runtime** | AWS Lambda, Google Cloud Functions, Azure Functions -- built on `@nextrush/adapter-edge`'s fetch engine |
| **Requires** | Node >=22 (Lambda's Node.js runtime) . ESM-only . TypeScript >=5.x |
| **Introduced** | v1.0.0 |

## Installation

```bash
pnpm add @nextrush/adapter-serverless
# npm i @nextrush/adapter-serverless . yarn add @nextrush/adapter-serverless . bun add @nextrush/adapter-serverless
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
> branches on `ctx.runtime === 'node'` will not match on any serverless platform.

## The three platform handlers

| Handler | Platform | Detection |
| --- | --- | --- |
| `createLambdaHandler(app, options?)` | AWS Lambda (Function URL, API Gateway v1/v2) | Automatic -- payload shape is unambiguous |
| `createGoogleHandler(app, options?)` | Google Cloud Functions (functions-framework) | Fixed to the `gcf` mapper |
| `createAzureHandler(app, options?)` | Azure Functions v4 model | Fixed to the `azure` mapper |

AWS hands your function a plain JSON event, so `createLambdaHandler(app)` is a true drop-in for
`export const handler = ...`. GCP and Azure hand you an SDK request object (Express-style
`req`/`res` for GCF, an `HttpRequest` for Azure) instead of a plain event, so you adapt its fields
into the mapper's request shape at the platform's own entry point:

```ts
// Google Cloud Functions
import { createGoogleHandler } from '@nextrush/adapter-serverless';
import * as functions from '@google-cloud/functions-framework';

const api = createGoogleHandler(app);
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

```ts
// Azure Functions (v4 model)
import { createAzureHandler } from '@nextrush/adapter-serverless';
import { app as functions } from '@azure/functions';

const api = createAzureHandler(app);
functions.http('api', {
  handler: async (req) => {
    const result = await api({
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers),
      body: await req.text(),
    });
    return { status: result.status, headers: result.headers, body: result.body };
  },
});
```

> [!NOTE]
> Cloudflare Workers is not a serverless-event platform (it speaks the Fetch API directly), so its
> one-line handler -- `createCloudflareHandler` -- ships in `@nextrush/adapter-edge`, not here.

## Tuning

```ts
export const handler = createLambdaHandler(app, { timeout: 5000 });
```

| Option | Type | Required | Default | Security-sensitive | Description |
| --- | --- | --- | --- | --- | --- |
| `timeout` | `number` | No | `25000` (edge default) | -- | Per-invocation cap in ms; exceeding it returns a 504 result instead of hanging |

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
| `createLambdaHandler` | `(app: Application, options?: ServerlessHandlerOptions) => ServerlessHandler<LambdaEvent, LambdaResult>` | 1.0.0 | Stable | AWS Lambda handler; auto-detects Function URL / API Gateway v1/v2 |
| `createLambdaStreamingHandler` | `(app: Application, options?: ServerlessHandlerOptions) => StreamingLambdaHandler` | 1.0.0 | Stable | True Function URL response streaming |
| `createGoogleHandler` | `(app: Application, options?: ServerlessHandlerOptions) => ServerlessHandler<GcfEvent, GcfResult>` | 1.0.0 | Stable | Google Cloud Functions (functions-framework) handler |
| `createAzureHandler` | `(app: Application, options?: ServerlessHandlerOptions) => ServerlessHandler<AzureEvent, AzureResult>` | 1.0.0 | Stable | Azure Functions v4 handler |
| `createServerlessAdapter` | `(options: ServerlessAdapterOptions<Event, Result, Ctx>) => { createHandler(app): ServerlessHandler<Event, Result, Ctx> }` | 1.0.0 | Stable | Runtime-author escape hatch -- build a handler from a custom `EventMapper` list |
| `type EventMapper<Event, Result, Ctx>` | -- | 1.0.0 | Stable | The plugin shape: `toRequest`, `fromResponse`, optional `detect` |
| `type ServerlessHandlerOptions` | -- | 1.0.0 | Stable | `{ timeout?: number }` -- Tier-1 handler tuning |
| `type ServerlessAdapterOptions<Event, Result, Ctx>` | -- | 1.0.0 | Stable | `{ mappers, provider?, timeout? }` -- Tier-3 adapter configuration |
| `lambdaFunctionUrl`, `apigwV1`, `apigwV2`, `gcf`, `azure` | `EventMapper<...>` | 1.0.0 | Stable | The built-in mappers each Tier-1 handler wires internally |

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
check `ctx.env`/platform-specific fields directly if you need to distinguish providers.

</details>

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
via `ctx.signal`. See the `timeout` option above.

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
