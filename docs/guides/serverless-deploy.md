# Deploy NextRush to serverless & edge

One app, many runtimes. The same `createApp()` you run on Node deploys to AWS Lambda, Google Cloud
Functions, Azure Functions, and Cloudflare Workers — you change the *handler wrapper*, not your
routes or middleware. Every example below uses the tested public API and is runnable as shown.

## AWS Lambda (Function URL / API Gateway)

`createLambdaHandler` serves Lambda Function URL and API Gateway (v1 and v2) events — it detects
which one it got, so you don't pick.

```ts
// handler.ts
import { createApp } from '@nextrush/core';
import { createLambdaHandler } from '@nextrush/adapter-serverless';

const app = createApp();
app.use((ctx) => ctx.json({ hello: 'lambda' }));

export const handler = createLambdaHandler(app);
```

Deploy the built file with the handler set to `handler.handler`. With AWS SAM:

```yaml
# template.yaml (excerpt)
Resources:
  Api:
    Type: AWS::Serverless::Function
    Properties:
      Handler: handler.handler
      Runtime: nodejs22.x
      FunctionUrlConfig:
        AuthType: NONE   # add auth for anything real — see the security note below
```

> **Security:** `AuthType: NONE` exposes the function publicly. For real endpoints use
> `AWS_IAM` (or an authorizer) and put authentication middleware *before* your business logic.

### True response streaming

For lower time-to-first-byte or unbounded bodies, use the streaming handler and set the Function
URL invoke mode to `RESPONSE_STREAM`:

```ts
import { createLambdaStreamingHandler } from '@nextrush/adapter-serverless';
export const handler = createLambdaStreamingHandler(app);
```

Anything your app writes with `ctx.sendStream(...)` is streamed to the client chunk-by-chunk
(wrapped with `awslambda.streamifyResponse` on the runtime), not buffered first.

## Cloudflare Workers

Cloudflare is a fetch runtime, so its handler lives in `@nextrush/adapter-edge`:

```ts
// worker.ts
import { createApp } from '@nextrush/core';
import { createCloudflareHandler } from '@nextrush/adapter-edge';

const app = createApp();
app.use((ctx) => ctx.json({ hello: 'workers' }));

export default createCloudflareHandler(app);
```

```jsonc
// wrangler.jsonc
{ "name": "my-api", "main": "worker.ts", "compatibility_date": "2026-01-01" }
```

`ctx.env` is typed if you pass your bindings type: `createCloudflareHandler<Env>(app)`.

## Google Cloud Functions & Azure Functions

These SDKs hand you a platform request object (not a plain JSON event), so you adapt its fields to
the handler in one line:

```ts
// GCF (functions-framework)
import { createGoogleHandler } from '@nextrush/adapter-serverless';
const api = createGoogleHandler(app);
functions.http('api', async (req, res) => {
  const r = await api({ method: req.method, path: req.path, query: req.query,
    headers: req.headers, body: req.rawBody?.toString() });
  res.status(r.statusCode).set(r.headers).send(r.body);
});
```

```ts
// Azure Functions v4
import { createAzureHandler } from '@nextrush/adapter-serverless';
const api = createAzureHandler(app);
functions.http('api', { handler: async (req) => {
  const r = await api({ method: req.method, url: req.url,
    headers: Object.fromEntries(req.headers), body: await req.text() });
  return { status: r.status, headers: r.headers, body: r.body };
}});
```

## Warm-instance reuse

Build the handler **once at module scope** (as every example above does). The adapter boots
`app.ready()` exactly once and reuses it across warm invocations; each invocation gets a fresh
`Context`, so no request state leaks. Never call `createApp()`/`createXHandler()` inside the
handler — that re-boots every request. See the `@nextrush/adapter-serverless` README for the
cold-start baseline.

## Edge-safe middleware

Edge and serverless-on-Node both run the Web-standard `Context` pipeline, but edge runtimes have
**no filesystem** and no Node streams. On edge, avoid middleware that needs those — e.g.
`@nextrush/static` (filesystem) — and prefer the Web-standard ones (`cors`, `helmet`, `cookies`,
`body-parser`, `compression`, `request-id`, `timer`). Capability decisions in your own middleware
must branch on `getRuntimeCapabilities()`, never on the runtime name. The published
[runtime certification matrix](../runtime-certification-matrix.md) shows exactly which features are
full/partial/N-A per runtime.

## Adding an unsupported platform (Tier 3 — runtime authors)

NextRush ships mappers for AWS/GCF/Azure. To support another platform (Oracle, Fly.io, OpenFaaS,
an internal one), implement an `EventMapper` and pass it to `createServerlessAdapter` — the adapter
never grows a provider `switch`.

```ts
import { createServerlessAdapter, type EventMapper } from '@nextrush/adapter-serverless';

interface OracleEvent { /* the platform's event shape */ }
interface OracleResult { /* what the platform expects back */ }

const oracle: EventMapper<OracleEvent, OracleResult> = {
  name: 'oracle',
  toRequest: (event) => new Request(/* build a Web Request from the event */),
  fromResponse: async (response) => ({ /* map the Response to the platform result */ }),
  detect: (event) => 'fnInvokeType' in event, // optional — used only when no `provider` is set
};

export const handler = createServerlessAdapter({ mappers: [oracle] }).createHandler(app);
```

A mapper is a pure function pair (`toRequest` / `fromResponse`), so it's fixture-testable in
isolation. Handle base64 bodies, multi-value headers, and query encoding the way the built-in
mappers do (see `packages/adapters/serverless/src/mappers`). To certify your adapter against the
shared behavioral suite, scaffold it with `nextrush generate adapter <name>` — it emits a
conformance test wired to `@nextrush/adapter-conformance` out of the box.

## Next steps

- Package usage & cold-start numbers: `@nextrush/adapter-serverless` README.
- Why the architecture is shaped this way: ADR-0007, `RFC-NEXTRUSH-ADAPTER-SERVERLESS`.
- Certify a new adapter: the Adapter Development Kit (`nextrush generate adapter`).
