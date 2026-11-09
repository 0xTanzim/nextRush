# Edge & Serverless Deep Dive

## Mental model

- **Edge package** (`@nextrush/adapter-edge`): host already speaks Fetch (`Request` → `Response`).
- **Serverless package** (`@nextrush/adapter-serverless`): host speaks **events** (Lambda/APIGW/GCF/Azure). Mappers convert event ↔ Request/Response, then reuse the edge fetch engine.

So Lambda reports `ctx.runtime === 'edge'` and `ctx.platform === 'lambda'`.

## Edge — `@nextrush/adapter-edge`

### Install

```bash
pnpm add @nextrush/adapter-edge @nextrush/core
# or use nextrush + adapter-edge
```

### Cloudflare Workers

```typescript
import { createApp } from 'nextrush';
import { createCloudflareHandler } from '@nextrush/adapter-edge';

interface Env {
  MY_KV: KVNamespace;
  DB: D1Database;
}

const app = createApp();
app.get('/', async (ctx) => {
  const value = await ctx.env?.MY_KV.get('key');
  ctx.json({ value, platform: ctx.platform });
});

export default createCloudflareHandler<Env>(app);
```

```toml
# wrangler.toml
name = "my-nextrush-worker"
main = "src/index.ts"
compatibility_date = "2025-01-01"
```

### Vercel Edge

```typescript
import { createApp } from 'nextrush';
import { createVercelHandler } from '@nextrush/adapter-edge';

const app = createApp();
app.get('/', (ctx) => ctx.json({ ok: true }));

export const config = { runtime: 'edge' };
export default createVercelHandler(app);
```

### Netlify Edge

```typescript
import { createNetlifyHandler } from '@nextrush/adapter-edge';
export default createNetlifyHandler(app);
```

### Generic Fetch host

```typescript
import { createFetchHandler } from '@nextrush/adapter-edge';
export default { fetch: createFetchHandler(app, { timeout: 24_000 }) };
// createHandler is a deprecated alias of createFetchHandler — use createFetchHandler
```

### Edge options

```typescript
createFetchHandler(app, {
  timeout: 24_000, // DEFAULT_EDGE_TIMEOUT_MS — races handler, aborts ctx.signal, returns 504
  onError: (err, ctx) => new Response('fail', { status: 500 }),
  platform: 'lambda', // usually set by serverless Tier-1 handlers, not by hand
});
```

### Runtime vs platform

| Host | `ctx.runtime` | `ctx.platform` |
|------|---------------|----------------|
| Cloudflare Workers | `'cloudflare-workers'` | `'cloudflare-workers'` |
| Vercel Edge | `'vercel-edge'` | `'vercel-edge'` |
| Netlify Edge | `'edge'` | `'netlify-edge'` |
| Generic Fetch | `'edge'` | `undefined` |
| Lambda via serverless | `'edge'` | `'lambda'` |
| GCF via serverless | `'edge'` | `'gcf'` |
| Azure via serverless | `'edge'` | `'azure'` |
| Vercel Serverless via serverless | `'edge'` | `'vercel'` |

Detection order (edge): Cloudflare UA → `VERCEL_REGION` → Netlify (`Deno` + `NETLIFY=true`) → generic edge.

### Edge capabilities

- `ctx.env` — Cloudflare bindings (typed via generic on `createCloudflareHandler`)
- `ctx.waitUntil(promise)` — background work when execution context exists
- `ctx.signal` — client disconnect + timeout abort
- No filesystem, no Node WebSocket package

### Edge limitations

- Short CPU budgets
- Prefer `ctx.sse` / `ctx.ndjson` over long-lived WS
- No `process.env` on Workers — use bindings / platform env

---

## Serverless — `@nextrush/adapter-serverless`

### Install

```bash
pnpm add @nextrush/adapter-serverless nextrush
```

### AWS Lambda (Function URL + API Gateway v1/v2)

```typescript
import { createApp } from 'nextrush';
import { createLambdaHandler } from '@nextrush/adapter-serverless';

// Module scope — once per cold start
const app = createApp();
app.get('/', (ctx) => ctx.json({
  message: 'Hello Lambda',
  platform: ctx.platform, // 'lambda'
  runtime: ctx.runtime,   // 'edge'
}));

export const handler = createLambdaHandler(app);
// optional: createLambdaHandler(app, { timeout: 10_000 })
```

**Wrong** (rebuilds every invocation):

```typescript
export const handler = (event) => createLambdaHandler(createApp())(event);
```

### Lambda response streaming (Function URL RESPONSE_STREAM)

```typescript
import { createLambdaStreamingHandler } from '@nextrush/adapter-serverless';
export const handler = createLambdaStreamingHandler(app);
// pairs with ctx.sendStream / ctx.sse / ctx.ndjson
```

### Google Cloud Functions

```typescript
import { createGoogleHandler } from '@nextrush/adapter-serverless';
import * as functions from '@google-cloud/functions-framework';

functions.http('api', createGoogleHandler(app));
```

### Azure Functions v4

```typescript
import { createAzureHandler } from '@nextrush/adapter-serverless';
import { app as functions } from '@azure/functions';

functions.http('api', { handler: createAzureHandler(app) });
```

### Vercel Serverless Functions (Node.js runtime / Fluid Compute)

For Node.js Serverless Functions on Vercel (`api/index.ts` or standalone API deployments), use `@nextrush/adapter-serverless`. It provides dual-dispatch:
- Native Web standard Route Handlers (`fetch`, `GET`, `POST`, `PUT`, etc.)
- Node.js `(req, res)` compatibility with backpressured chunk streaming and multi-cookie preservation
- Local standalone execution with `listenIfStandalone(handler)`

```typescript
import { createApp } from 'nextrush';
import { createVercelHandler, listenIfStandalone } from '@nextrush/adapter-serverless';

const app = createApp();
app.get('/api/health', (ctx) => ctx.json({ status: 'ok', platform: ctx.platform }));

const handler = createVercelHandler(app);

// 1. Universal default export (handles both Web Request and Node req/res)
export default handler;

// 2. Named route handler exports for Vercel Web Route Handlers
export const { GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS, fetch } = handler;

// 3. Standalone runner (starts server when NOT in serverless Vercel environment)
listenIfStandalone(handler);
```

> **Edge vs Serverless on Vercel:**
> - If you configure `export const config = { runtime: 'edge' }`, use `createVercelHandler` from `@nextrush/adapter-edge`.
> - If you use Node.js serverless functions (default Vercel Function runtime / Fluid Compute) or want hybrid standalone local execution, use `createVercelHandler` from `@nextrush/adapter-serverless`.

### Serverless rules

1. App + handler at **module scope**
2. Per-request data on `ctx` / `ctx.state` only — no module-scope mutable request state
3. Branch on `ctx.platform`, not `ctx.runtime === 'node'`
4. Timeout → cooperative cancel via `ctx.signal`, result 504
5. Cloudflare is **not** in this package — use adapter-edge
6. **Bun & Deno Runtime Guarding & Ergonomics**:
   - `createHandler(app)` from `@nextrush/adapter-bun` or `@nextrush/adapter-deno` produces `(request: Request, server?: ...) => Response | Promise<Response>`. Calling with 1 argument (`await handler(request)`) is fully typed and supported; no dummy server/info object is required.
   - Calling `serve(app)` from `@nextrush/adapter-bun` or `@nextrush/adapter-deno` in an incompatible runtime (such as Node.js or a Vercel Serverless Function without `"bunVersion": "1.4.x"` in `vercel.json`) throws `ServerStartError` with code `'ERR_RUNTIME_NOT_DETECTED'` and actionable instructions to use `@nextrush/adapter-node` or `@nextrush/adapter-serverless`.
   - Both adapters re-export `isBun` / `isDeno` (and `isBunRuntime` / `isDenoRuntime`) and `ServerStartError`.

### Warm instance note

Only the booted `app` persists across warm invocations. Fresh `Context` every call. DB pools OK at module scope; request caches are not.
