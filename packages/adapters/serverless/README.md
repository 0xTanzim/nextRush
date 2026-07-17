# @nextrush/adapter-serverless

Deploy a NextRush app to AWS Lambda, Google Cloud Functions, or Azure Functions — in one line.

**Support tier:** Internal — non-`-node` adapter until GA (may change without a major). See [ADR-0005](../../../docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md).
```ts
import { createLambdaHandler } from '@nextrush/adapter-serverless';

export const handler = createLambdaHandler(app);
```

That's the whole API for most people. No mapper registry, no provider strings, no
event plumbing — the handler runs your app's normal `Context` pipeline and hands the
platform back the result shape it expects.

## Install

```bash
pnpm add @nextrush/adapter-serverless
```

## The three handlers

Each takes your app and returns the platform's handler. `createLambdaHandler` covers
Lambda Function URL, API Gateway HTTP API (v2), and API Gateway REST (v1) — it detects
which event it got, so you don't pick.

```ts
// AWS Lambda — Function URL / API Gateway (v1 + v2), auto-detected
import { createLambdaHandler } from '@nextrush/adapter-serverless';
export const handler = createLambdaHandler(app);
```

```ts
// Google Cloud Functions (functions-framework hands you an Express-style req/res)
import { createGoogleHandler } from '@nextrush/adapter-serverless';
import * as functions from '@google-cloud/functions-framework';

const api = createGoogleHandler(app);
functions.http('api', async (req, res) => {
  const r = await api({ method: req.method, path: req.path, query: req.query,
    headers: req.headers, body: req.rawBody?.toString() });
  res.status(r.statusCode).set(r.headers).send(r.body);
});
```

```ts
// Azure Functions (v4 model hands you an HttpRequest)
import { createAzureHandler } from '@nextrush/adapter-serverless';
import { app as functions } from '@azure/functions';

const api = createAzureHandler(app);
functions.http('api', { handler: async (req) => {
  const r = await api({ method: req.method, url: req.url,
    headers: Object.fromEntries(req.headers), body: await req.text() });
  return { status: r.status, headers: r.headers, body: r.body };
}});
```

AWS hands your function a plain JSON event, so `createLambdaHandler(app)` is a true
drop-in. GCP and Azure hand you an SDK request object instead, so you map its fields
into the handler call — the one adapting line above. Cloudflare's one-liner
(`createCloudflareHandler`) lives in `@nextrush/adapter-edge`, since edge is a
fetch runtime, not a serverless-event one.

## Tuning (Tier 2)

The handlers take an options object when you need it. Nothing else changes.

```ts
export const handler = createLambdaHandler(app, { timeout: 5000 });
```

| Option    | Type     | Default | Description                                              |
| --------- | -------- | ------- | -------------------------------------------------------- |
| `timeout` | `number` | none    | Per-invocation cap in ms; exceeding it returns a **504** |

### Response streaming

`createLambdaHandler` buffers the response body into the result. For **true**
Function URL response streaming (lower TTFB, unbounded body), use the dedicated
streaming handler — it writes chunks to Lambda's `responseStream` as they are
produced, wrapped with `awslambda.streamifyResponse` on the real runtime:

```ts
import { createLambdaStreamingHandler } from '@nextrush/adapter-serverless';

export const handler = createLambdaStreamingHandler(app); // Function URL RESPONSE_STREAM mode
```

Configure the Function URL for `RESPONSE_STREAM` invoke mode. Anything your app
streams via `ctx.sendStream(...)` is written incrementally, not collected first.

## Advanced — adding a platform NextRush doesn't ship (Tier 3)

Runtime authors only. To support Oracle, Fly.io, OpenFaaS, or an internal platform,
implement an `EventMapper` and pass it to `createServerlessAdapter`. The adapter never
grows a provider `switch`; a new platform is a new mapper, nothing else.

```ts
import { createServerlessAdapter, type EventMapper } from '@nextrush/adapter-serverless';

const oracle: EventMapper<OracleEvent, OracleResult> = {
  name: 'oracle',
  toRequest: (event) => new Request(/* … */),
  fromResponse: (response) => ({ /* … */ }),
  detect: (event) => 'fnInvokeType' in event,
};

export const handler = createServerlessAdapter({ mappers: [oracle] }).createHandler(app);
```

Selection is explicit-first: a named `provider` wins; `detect()` runs only when you
omit one. The mapper list is per-adapter and immutable — there is no global registry.

## How it fits together

```
Platform event → EventMapper.toRequest → Context pipeline → Response → EventMapper.fromResponse → Platform result
```

The Tier-1 handlers are thin wrappers that pick the right mapper(s) for you. The
execution model (warm-instance reuse via `app.ready()`, the timeout→504 race, the
shared `Context` pipeline) is the same one the edge adapter uses.

## Container reuse (warm instances)

Serverless platforms keep a "warm" instance alive between invocations. Build the
handler **once at module scope** so the app boots once and is reused:

```ts
import { createApp } from '@nextrush/core';
import { createLambdaHandler } from '@nextrush/adapter-serverless';

// Module scope — runs once per cold start, reused across every warm invocation.
const app = createApp();
app.use(/* … */);
export const handler = createLambdaHandler(app);
```

The adapter memoizes the boot barrier: `app.ready()` runs **exactly once**, even
under concurrent warm invocations, and the booted handler is reused. Do **not**
call `createApp()` or `createLambdaHandler()` inside the handler — that re-boots on
every request and defeats warm reuse.

State isolation holds automatically: each invocation builds a fresh `Context`, so
no request state (`ctx.state`, headers, body) leaks between invocations on the same
warm instance. Keep per-request data on `ctx`/`ctx.state`, never in module-scope
mutable variables.

See `bench/README.md` for the cold-start baseline and the functional-vs-class/DI
cost difference.
