# @nextrush/adapter-edge

> **Universal Edge Runtime Adapter for NextRush** — Deploy anywhere the Fetch API runs

[![npm version](https://img.shields.io/npm/v/@nextrush/adapter-edge)](https://www.npmjs.com/package/@nextrush/adapter-edge)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue)](https://www.typescriptlang.org/)
[![Edge Ready](https://img.shields.io/badge/Edge-Ready-orange)](https://workers.cloudflare.com/)

The Edge adapter enables NextRush applications to run on **any edge runtime** that supports the standard Fetch API — including Cloudflare Workers, Vercel Edge Functions, Netlify Edge Functions, and more.

## Why Edge?

Edge computing brings your code closer to users, delivering **sub-50ms latencies worldwide**:

| Platform | Cold Start | Global Distribution | Compute Model |
|----------|------------|---------------------|---------------|
| Cloudflare Workers | ~0ms | 300+ cities | V8 Isolates |
| Vercel Edge | ~25ms | 100+ regions | V8 Isolates |
| Netlify Edge | ~25ms | 100+ PoPs | Deno Deploy |

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
    timestamp: Date.now()
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
    region: process.env.VERCEL_REGION
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
    geo: ctx.raw.req.headers.get('x-nf-geo')
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
  }
});
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `app` | `Application` | NextRush application instance |
| `options.onError` | `(error, ctx) => Response` | Custom error handler |

**Returns:** `FetchHandler` — A function that handles `Request` and returns `Response`

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

The `EdgeContext` class provides the execution context for edge requests:

```typescript
interface EdgeContext extends Context {
  // Standard Context properties
  readonly runtime: 'cloudflare-workers' | 'edge';
  readonly bodySource: BodySource;

  // Request data
  readonly path: string;
  readonly method: string;
  readonly query: Record<string, string>;
  readonly params: Record<string, string>;
  readonly headers: Record<string, string>;

  // Raw Web APIs
  readonly raw: {
    req: Request;           // Standard Request object
    ctx?: ExecutionContext; // Cloudflare execution context
  };

  // Response methods
  json(data: unknown): void;
  send(body: string | Uint8Array): void;
  html(content: string): void;
  redirect(url: string, status?: number): void;

  // Get final Response
  getResponse(): Response;
}
```

### Body Parsing

Edge uses the standard `Request` body methods:

```typescript
app.use(async (ctx) => {
  // Using bodySource (cross-runtime compatible)
  const text = await ctx.bodySource.text();
  const buffer = await ctx.bodySource.buffer();

  // Or standard Request methods
  const json = await ctx.raw.req.json();
  const formData = await ctx.raw.req.formData();
});
```

### Cloudflare-Specific Features

Access Cloudflare-specific APIs when running on Workers:

```typescript
app.use(async (ctx) => {
  const request = ctx.raw.req;

  // CF object with request metadata
  const cf = (request as any).cf;
  if (cf) {
    ctx.json({
      colo: cf.colo,           // Data center code
      country: cf.country,      // Country code
      city: cf.city,           // City name
      timezone: cf.timezone,    // Timezone
      asn: cf.asn,             // ASN number
      httpProtocol: cf.httpProtocol
    });
  }
});
```

### Execution Context

Use the execution context for advanced features:

```typescript
app.use(async (ctx) => {
  const execCtx = ctx.raw.ctx;

  if (execCtx?.waitUntil) {
    // Run background task after response
    execCtx.waitUntil(
      fetch('https://analytics.example.com', {
        method: 'POST',
        body: JSON.stringify({ path: ctx.path })
      })
    );
  }

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

router.get('/api/users', async (ctx) => {
  ctx.json({ users: [] });
});

router.get('/api/users/:id', async (ctx) => {
  ctx.json({ id: ctx.params.id });
});

router.post('/api/users', async (ctx) => {
  const body = await ctx.bodySource.text();
  ctx.status = 201;
  ctx.json({ created: true, data: JSON.parse(body) });
});

app.use(router.routes());

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
app.use(cors({
  origin: 'https://example.com',
  credentials: true
}));

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
      method: ctx.method
    });

    // Return custom error response
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        requestId: crypto.randomUUID()
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});
```

### Application-Level Error Handling

```typescript
app.use(async (ctx) => {
  try {
    await ctx.next();
  } catch (error) {
    ctx.status = error.status || 500;
    ctx.json({
      error: error.message,
      code: error.code || 'INTERNAL_ERROR'
    });
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

The adapter automatically detects the runtime environment:

```typescript
import { detectEdgeRuntime } from '@nextrush/adapter-edge';

const info = detectEdgeRuntime();
// { runtime: 'cloudflare-workers', isCloudflare: true, isVercel: false, ... }
```

```typescript
app.use(async (ctx) => {
  // ctx.runtime is automatically set
  console.log(ctx.runtime);
  // 'cloudflare-workers' | 'edge'
});
```

## Limitations

Edge runtimes have some constraints to be aware of:

| Feature | Cloudflare | Vercel Edge | Netlify Edge |
|---------|------------|-------------|--------------|
| Node.js APIs | Limited | Limited | Deno APIs |
| CPU Time | 50ms (free) | 30s | 50ms |
| Memory | 128MB | 1.5GB | 512MB |
| Request Size | 100MB | 4MB | 2MB |
| File System | ❌ | ❌ | ❌ |
| Native Addons | ❌ | ❌ | ❌ |

### Not Supported on Edge

- File system operations (use R2, S3, or external storage)
- Long-running connections (use Durable Objects or external WebSocket services)
- Native Node.js modules (use Web API equivalents)
- Large memory operations (stream large data instead)

## TypeScript

Full TypeScript support with intelligent types:

```typescript
import type { EdgeContext, FetchHandler } from '@nextrush/adapter-edge';
import type { Middleware } from '@nextrush/core';

// Type-safe middleware
const authMiddleware: Middleware<EdgeContext> = async (ctx) => {
  const token = ctx.headers['authorization'];
  if (!token) {
    ctx.status = 401;
    ctx.json({ error: 'Unauthorized' });
    return;
  }
  await ctx.next();
};
```

## Related Packages

| Package | Description |
|---------|-------------|
| [@nextrush/core](../core) | Core application and middleware |
| [@nextrush/router](../router) | High-performance routing |
| [@nextrush/adapter-node](../adapters/node) | Node.js HTTP adapter |
| [@nextrush/adapter-bun](../adapters/bun) | Bun runtime adapter |
| [@nextrush/adapter-deno](../adapters/deno) | Deno runtime adapter |
| [@nextrush/runtime](../runtime) | Runtime detection utilities |

## License

MIT © NextRush Contributors
