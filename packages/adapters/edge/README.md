# @nextrush/adapter-edge

> **Universal Edge Runtime Adapter for NextRush** — Deploy anywhere the Fetch API runs

[![npm version](https://img.shields.io/npm/v/@nextrush/adapter-edge)](https://www.npmjs.com/package/@nextrush/adapter-edge)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue)](https://www.typescriptlang.org/)
[![Edge Ready](https://img.shields.io/badge/Edge-Ready-orange)](https://workers.cloudflare.com/)

The Edge adapter enables NextRush applications to run on **any edge runtime** that supports the standard Fetch API — including Cloudflare Workers, Vercel Edge Functions, Netlify Edge Functions, and more.

## Why Edge?

Edge runtimes execute code at network points of presence close to users, reducing round-trip latency.

| Platform           | Compute Model |
| ------------------ | ------------- |
| Cloudflare Workers | V8 Isolates   |
| Vercel Edge        | V8 Isolates   |
| Netlify Edge       | Deno Deploy   |

## Quick Start

### Cloudflare Workers

```typescript
// src/index.ts
import { createApp } from '@nextrush/core';
import { createCloudflareHandler } from '@nextrush/adapter-edge';

const app = createApp();

app.use(async (ctx) => {
  ctx.json({
    message: 'Hello from the Edge!',
    runtime: ctx.runtime,
    timestamp: Date.now(),
  });
});

export default createCloudflareHandler(app);
```

```toml
# wrangler.toml
name = "my-nextrush-worker"
main = "src/index.ts"
compatibility_date = "2025-01-01"
```

### Vercel Edge Functions

```typescript
// api/hello.ts
import { createApp } from '@nextrush/core';
import { createVercelHandler } from '@nextrush/adapter-edge';

const app = createApp();

app.use(async (ctx) => {
  ctx.json({
    message: 'Hello from Vercel Edge!',
    region: process.env.VERCEL_REGION,
  });
});

export const config = { runtime: 'edge' };
export default createVercelHandler(app);
```

### Netlify Edge Functions

```typescript
// netlify/edge-functions/api.ts
import { createApp } from '@nextrush/core';
import { createNetlifyHandler } from '@nextrush/adapter-edge';

const app = createApp();

app.use(async (ctx) => {
  ctx.json({
    message: 'Hello from Netlify Edge!',
    geo: ctx.get('x-nf-geo'),
  });
});

export default createNetlifyHandler(app);
```

## Installation

```bash
# npm
npm install @nextrush/adapter-edge @nextrush/core

# pnpm
pnpm add @nextrush/adapter-edge @nextrush/core

# yarn
yarn add @nextrush/adapter-edge @nextrush/core
```

## API Reference

### `createFetchHandler(app, options?)`

Creates a universal fetch handler compatible with any edge runtime.

```typescript
import { createFetchHandler } from '@nextrush/adapter-edge';

const handler = createFetchHandler(app, {
  onError: (error, ctx) => {
    console.error('Request failed:', error);
    return new Response('Something went wrong', { status: 500 });
  },
});
```

**Parameters:**

| Parameter         | Type                                                                | Description                                                                                          |
| ----------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `app`             | `Application`                                                       | NextRush application instance                                                                        |
| `options.onError` | `(error: Error, ctx: EdgeContext) => Response \| Promise<Response>` | Custom error handler                                                                                 |
| `options.timeout` | `number`                                                            | Request timeout in ms. Returns 504 if exceeded. Recommended: 30000 for Cloudflare, 25000 for Vercel. |

**Returns:** `FetchHandler` — A function `(request: Request, ctx?: EdgeExecutionContext) => Response | Promise<Response>`

### `createCloudflareHandler(app, options?)`

Creates a Cloudflare Workers module export.

```typescript
import { createCloudflareHandler } from '@nextrush/adapter-edge';

export default createCloudflareHandler(app);
// Returns: { fetch: FetchHandler }
```

### `createVercelHandler(app, options?)`

Creates a Vercel Edge Function handler.

```typescript
import { createVercelHandler } from '@nextrush/adapter-edge';

export const config = { runtime: 'edge' };
export default createVercelHandler(app);
```

### `createNetlifyHandler(app, options?)`

Creates a Netlify Edge Function handler.

```typescript
import { createNetlifyHandler } from '@nextrush/adapter-edge';

export default createNetlifyHandler(app);
```

## EdgeContext

`EdgeContext` implements the `Context` interface for edge runtimes:

```typescript
class EdgeContext implements Context {
  // Runtime detection
  readonly runtime: Runtime; // 'cloudflare-workers' | 'vercel-edge' | 'edge'
  readonly bodySource: BodySource;

  // Request data
  readonly path: string;
  readonly method: HttpMethod;
  readonly url: string;
  readonly query: QueryParams;
  readonly params: RouteParams;
  readonly headers: IncomingHeaders;
  readonly ip: string;

  // Raw Web API Request
  readonly raw: { req: Request; res: undefined };

  // Edge-specific
  readonly executionContext?: EdgeExecutionContext;
  waitUntil(promise: Promise<unknown>): void;

  // Response methods
  json(data: unknown): void;
  send(data: ResponseBody): void;
  html(content: string): void;
  redirect(url: string, status?: number): void;

  // Response building
  getResponse(): Response;
  readonly responded: boolean;
}
```

### Body Parsing

Use `bodySource` for cross-runtime body reading:

```typescript
app.use(async (ctx) => {
  // Using bodySource (cross-runtime compatible)
  const text = await ctx.bodySource.text();
  const buffer = await ctx.bodySource.buffer();
  const json = await ctx.bodySource.json();
  const stream = ctx.bodySource.stream();
});
```

### Cloudflare-Specific Features

Access Cloudflare-specific request metadata when running on Workers:

```typescript
app.use(async (ctx) => {
  const request = ctx.raw.req;
  const cf = (request as Request & { cf?: Record<string, unknown> }).cf;

  if (cf) {
    ctx.json({
      colo: cf.colo,
      country: cf.country,
      city: cf.city,
      timezone: cf.timezone,
    });
  }
});
```

### Execution Context

Use the `waitUntil` method for fire-and-forget background tasks:

```typescript
app.use(async (ctx) => {
  // Run background task after response is sent
  ctx.waitUntil(
    fetch('https://analytics.example.com', {
      method: 'POST',
      body: JSON.stringify({ path: ctx.path }),
    })
  );

  ctx.json({ status: 'ok' });
});
```

## Routing with @nextrush/router

```typescript
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { createCloudflareHandler } from '@nextrush/adapter-edge';

const app = createApp();
const router = createRouter();

router.get('/users', async (ctx) => {
  ctx.json({ users: [] });
});

router.get('/users/:id', async (ctx) => {
  ctx.json({ id: ctx.params.id });
});

router.post('/users', async (ctx) => {
  const body = await ctx.bodySource.text();
  ctx.status = 201;
  ctx.json({ created: true, data: JSON.parse(body) });
});

// Mount router — Hono-style
app.route('/api', router);

export default createCloudflareHandler(app);
```

## Middleware Compatibility

All NextRush middleware works on edge:

```typescript
import { createApp } from '@nextrush/core';
import { cors } from '@nextrush/cors';
import { createCloudflareHandler } from '@nextrush/adapter-edge';

const app = createApp();

// CORS middleware
app.use(
  cors({
    origin: 'https://example.com',
    credentials: true,
  })
);

// Request timing
app.use(async (ctx) => {
  const start = Date.now();
  await ctx.next();
  const duration = Date.now() - start;
  ctx.set('X-Response-Time', `${duration}ms`);
});

app.use(async (ctx) => {
  ctx.json({ ok: true });
});

export default createCloudflareHandler(app);
```

## Error Handling

### Custom Error Handler

```typescript
const handler = createCloudflareHandler(app, {
  onError: (error, ctx) => {
    // Log to external service
    console.error({
      error: error.message,
      path: ctx.path,
      method: ctx.method,
    });

    // Return custom error response
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        requestId: crypto.randomUUID(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  },
});
```

### Application-Level Error Handling

```typescript
import { HttpError } from '@nextrush/errors';

app.use(async (ctx) => {
  try {
    await ctx.next();
  } catch (error) {
    if (error instanceof HttpError) {
      ctx.status = error.status;
      ctx.json({ error: error.message });
    } else {
      ctx.status = 500;
      ctx.json({ error: 'Internal Server Error' });
    }
  }
});
```

## Platform Deployment

### Cloudflare Workers

```bash
# Install Wrangler
npm install -g wrangler

# Login
wrangler login

# Deploy
wrangler deploy
```

### Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel
```

### Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod
```

## Runtime Detection

The adapter detects the specific edge platform at startup:

```typescript
import { detectEdgeRuntime } from '@nextrush/adapter-edge';

const info = detectEdgeRuntime();
// { runtime: 'cloudflare-workers', isCloudflare: true, isVercel: false, isNetlify: false, isGenericEdge: false }
```

```typescript
app.use(async (ctx) => {
  // ctx.runtime is set automatically
  console.log(ctx.runtime);
  // 'cloudflare-workers' | 'vercel-edge' | 'edge'
});
```

## Limitations

Edge runtimes share common constraints:

- No file system access — use R2, S3, or external storage
- No native Node.js modules — use Web API equivalents
- No native addons
- CPU time and memory limits vary by platform — consult platform documentation
- Stream large payloads instead of buffering in memory

## TypeScript

All exports are fully typed:

```typescript
import type { EdgeContext, FetchHandler, EdgeExecutionContext } from '@nextrush/adapter-edge';
import type { Middleware } from '@nextrush/types';

// Type-safe middleware
const authMiddleware: Middleware = async (ctx) => {
  const token = ctx.get('authorization');
  if (!token) {
    ctx.status = 401;
    ctx.json({ error: 'Unauthorized' });
    return;
  }
  await ctx.next();
};
```

## Related Packages

| Package                                    | Description                     |
| ------------------------------------------ | ------------------------------- |
| [@nextrush/core](../core)                  | Core application and middleware |
| [@nextrush/router](../router)              | High-performance routing        |
| [@nextrush/adapter-node](../adapters/node) | Node.js HTTP adapter            |
| [@nextrush/adapter-bun](../adapters/bun)   | Bun runtime adapter             |
| [@nextrush/adapter-deno](../adapters/deno) | Deno runtime adapter            |
| [@nextrush/runtime](../runtime)            | Runtime detection utilities     |

## License

MIT © NextRush Contributors
