# Adapters Reference

## Decision tree

```
Own long-running process?
├─ Node → import { serve, listen } from 'nextrush'   (@nextrush/adapter-node)
├─ Bun  → @nextrush/adapter-bun
└─ Deno → @nextrush/adapter-deno

Fetch API host?
├─ Cloudflare Workers → createCloudflareHandler(app)
├─ Vercel Edge        → createVercelHandler(app)
├─ Netlify Edge       → createNetlifyHandler(app)
└─ Other Fetch        → createFetchHandler(app)

FaaS events?
├─ AWS Lambda         → createLambdaHandler(app)
├─ Lambda streaming   → createLambdaStreamingHandler(app)
├─ Google Cloud Fn    → createGoogleHandler(app)
└─ Azure Functions v4 → createAzureHandler(app)

Inside Next.js App Router?
└─ handle(app) from 'nextrush/nextjs'
```

Deep dives: `serverless-edge.md`, `nextjs.md`.

## Node (default)

```typescript
import { serve, listen, createHandler } from 'nextrush';

const server = await serve(app, {
  port: 8080,
  hostname: '0.0.0.0',
  onListen: () => console.log('ready'),
  onError: (err) => console.error(err),
});
server.close();

// Simple
listen(app, 8080);

// Custom http.Server
import http from 'node:http';
http.createServer(createHandler(app)).listen(8080);
```

## Bun

```typescript
import { serve } from '@nextrush/adapter-bun';
const server = serve(app, { port: 8080 });
```

## Deno

```typescript
import { serve } from '@nextrush/adapter-deno';
serve(app, {
  port: 8080,
  onListen: ({ hostname, port }) => console.log(`${hostname}:${port}`),
});
```

## Edge (summary)

```typescript
import {
  createCloudflareHandler,
  createVercelHandler,
  createNetlifyHandler,
  createFetchHandler,
  detectEdgeRuntime,
} from '@nextrush/adapter-edge';

export default createCloudflareHandler<Env>(app);
// or createVercelHandler(app) / createNetlifyHandler(app)
// or createFetchHandler(app, { timeout: 24_000 })
```

## Serverless (summary)

```typescript
import {
  createLambdaHandler,
  createLambdaStreamingHandler,
  createGoogleHandler,
  createAzureHandler,
} from '@nextrush/adapter-serverless';

const app = createApp(); // MODULE SCOPE
export const handler = createLambdaHandler(app);
```

## Next.js (summary)

```typescript
import { handle } from 'nextrush/nextjs';
export const { GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS } = handle(app);
```

## ctx.runtime vs ctx.platform

- **runtime**: kind of execution environment (`node`, `bun`, `deno`, `edge`, `cloudflare-workers`, `vercel-edge`, …)
- **platform**: named deploy target (`lambda`, `gcf`, `azure`, `cloudflare-workers`, `vercel-edge`, `netlify-edge`)

Serverless Tier-1 handlers set `platform` explicitly. Do not assume Lambda ⇒ `runtime === 'node'`.

## Conformance

`packages/adapters/conformance` — parity suite. A feature that differs by adapter is incomplete.

## Custom adapter sketch

```typescript
function createMyHandler(app: Application) {
  return async (nativeReq: MyReq): Promise<MyRes> => {
    const request = toWebRequest(nativeReq);
    const response = await app.handle(request);
    return fromWebResponse(response);
  };
}
```
