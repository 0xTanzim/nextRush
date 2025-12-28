# Edge Adapter

> Deploy NextRush to edge runtimes: Cloudflare Workers, Vercel Edge, Netlify Edge.

## Installation

```bash
pnpm add @nextrush/adapter-edge
```

## Quick Start

::: code-group

```typescript [Cloudflare Workers]
import { createApp } from '@nextrush/core';
import { createCloudflareHandler } from '@nextrush/adapter-edge';

const app = createApp();

app.get('/', (ctx) => {
  ctx.json({ edge: 'Cloudflare Workers' });
});

export default createCloudflareHandler(app);
```

```typescript [Vercel Edge]
import { createApp } from '@nextrush/core';
import { createVercelHandler } from '@nextrush/adapter-edge';

const app = createApp();

app.get('/api/hello', (ctx) => {
  ctx.json({ edge: 'Vercel Edge' });
});

export default createVercelHandler(app);
```

```typescript [Netlify Edge]
import { createApp } from '@nextrush/core';
import { createNetlifyHandler } from '@nextrush/adapter-edge';

const app = createApp();

app.get('/', (ctx) => {
  ctx.json({ edge: 'Netlify Edge' });
});

export default createNetlifyHandler(app);
```

:::

## Why Edge?

Edge runtimes execute code close to users:

- **Low latency** - Requests served from nearest edge location
- **Global scale** - Automatic distribution across regions
- **No cold starts** - Instant startup (vs serverless functions)
- **Cost effective** - Pay only for execution time

Trade-offs:
- **Limited APIs** - No filesystem, limited Node.js APIs
- **Execution limits** - CPU time and memory constraints
- **Stateless** - No persistent connections or local state

## API Reference

### `createFetchHandler(app)`

Create a generic fetch handler for any edge runtime.

```typescript
import { createFetchHandler } from '@nextrush/adapter-edge';

const handler = createFetchHandler(app);

// Works with any runtime that supports fetch handler
export default handler;
```

**Returns:** `(request: Request) => Promise<Response>`

### `createCloudflareHandler(app)`

Create a handler optimized for Cloudflare Workers.

```typescript
import { createCloudflareHandler } from '@nextrush/adapter-edge';

const handler = createCloudflareHandler(app);

// Export as default for Workers
export default handler;

// Or use with env/ctx
export default {
  fetch: (request, env, ctx) => handler(request, { env, ctx }),
};
```

**Returns:** `CloudflareHandler`

### `createVercelHandler(app)`

Create a handler for Vercel Edge Functions.

```typescript
import { createVercelHandler } from '@nextrush/adapter-edge';

export default createVercelHandler(app);

// Configure as edge function
export const config = {
  runtime: 'edge',
};
```

**Returns:** `VercelHandler`

### `createNetlifyHandler(app)`

Create a handler for Netlify Edge Functions.

```typescript
import { createNetlifyHandler } from '@nextrush/adapter-edge';

export default createNetlifyHandler(app);
```

**Returns:** `NetlifyHandler`

## Context Properties

### `ctx.runtime`

Detected edge runtime:

```typescript
app.get('/runtime', (ctx) => {
  console.log(ctx.runtime);
  // 'cloudflare-workers' | 'vercel-edge' | 'edge'
});
```

### `ctx.bodySource`

Cross-runtime body reading:

```typescript
app.post('/data', async (ctx) => {
  const json = await ctx.bodySource.json();
  ctx.json({ received: json });
});
```

### `ctx.raw`

Access to Request object:

```typescript
app.get('/info', (ctx) => {
  const { req } = ctx.raw;

  ctx.json({
    url: req.url,
    method: req.method,
    headers: Object.fromEntries(req.headers),
  });
});
```

## Platform-Specific Patterns

### Cloudflare Workers

#### KV Storage

```typescript
interface Env {
  MY_KV: KVNamespace;
}

const app = createApp();

app.get('/kv/:key', async (ctx) => {
  const { key } = ctx.params;
  const env = ctx.state.env as Env;

  const value = await env.MY_KV.get(key);

  if (value) {
    ctx.json({ key, value });
  } else {
    ctx.status = 404;
    ctx.json({ error: 'Key not found' });
  }
});

app.put('/kv/:key', async (ctx) => {
  const { key } = ctx.params;
  const { value } = await ctx.bodySource.json() as { value: string };
  const env = ctx.state.env as Env;

  await env.MY_KV.put(key, value);
  ctx.json({ success: true });
});

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => {
    const handler = createCloudflareHandler(app);
    return handler(request, { env, ctx });
  },
};
```

#### D1 Database

```typescript
interface Env {
  DB: D1Database;
}

app.get('/users', async (ctx) => {
  const env = ctx.state.env as Env;
  const { results } = await env.DB.prepare('SELECT * FROM users').all();
  ctx.json(results);
});
```

#### R2 Storage

```typescript
interface Env {
  BUCKET: R2Bucket;
}

app.get('/files/:name', async (ctx) => {
  const { name } = ctx.params;
  const env = ctx.state.env as Env;

  const object = await env.BUCKET.get(name);

  if (object) {
    ctx.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
    ctx.send(await object.arrayBuffer());
  } else {
    ctx.status = 404;
    ctx.json({ error: 'File not found' });
  }
});
```

#### Durable Objects

```typescript
export class Counter {
  state: DurableObjectState;
  value = 0;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request) {
    this.value++;
    return new Response(JSON.stringify({ count: this.value }));
  }
}
```

### Vercel Edge

#### Edge Config

```typescript
import { get } from '@vercel/edge-config';

app.get('/config/:key', async (ctx) => {
  const { key } = ctx.params;
  const value = await get(key);

  ctx.json({ key, value });
});

export const config = {
  runtime: 'edge',
};
```

#### Geolocation

```typescript
app.get('/geo', (ctx) => {
  const { req } = ctx.raw;

  // Vercel provides geo headers
  ctx.json({
    city: req.headers.get('x-vercel-ip-city'),
    country: req.headers.get('x-vercel-ip-country'),
    region: req.headers.get('x-vercel-ip-country-region'),
  });
});
```

### Netlify Edge

#### Netlify Blobs

```typescript
import { getStore } from '@netlify/blobs';

app.get('/blob/:key', async (ctx) => {
  const { key } = ctx.params;
  const store = getStore('my-store');

  const value = await store.get(key, { type: 'json' });

  if (value) {
    ctx.json(value);
  } else {
    ctx.status = 404;
    ctx.json({ error: 'Not found' });
  }
});
```

## Edge Limitations

### No Filesystem

```typescript
// ❌ Does not work on edge
import fs from 'fs';
const content = fs.readFileSync('file.txt');

// ✅ Use KV, R2, or fetch instead
const content = await env.KV.get('file-content');
const content = await fetch('https://cdn.example.com/file.txt').then(r => r.text());
```

### Limited Node.js APIs

```typescript
// ❌ Not available
import { createServer } from 'http';
import { spawn } from 'child_process';

// ✅ Use Web APIs
const response = await fetch('https://api.example.com/data');
const hash = await crypto.subtle.digest('SHA-256', data);
```

### Execution Limits

| Platform | CPU Time | Memory | Body Size |
|----------|----------|--------|-----------|
| Cloudflare Workers | 10-30ms | 128MB | 100MB |
| Vercel Edge | 30s | 128MB | 4MB |
| Netlify Edge | 50ms | 512MB | 4MB |

### No Persistent Connections

```typescript
// ❌ Connection closes after response
const db = await connect('postgres://...');

// ✅ Use connection pooling services
const data = await fetch('https://your-api.com/query', {
  method: 'POST',
  body: JSON.stringify({ query: 'SELECT * FROM users' }),
});
```

## Best Practices

### Cache Responses

```typescript
app.get('/cached', (ctx) => {
  ctx.set('Cache-Control', 'public, max-age=3600');
  ctx.json({ data: 'cached for 1 hour' });
});
```

### Stream Large Responses

```typescript
app.get('/stream', (ctx) => {
  const stream = new ReadableStream({
    async start(controller) {
      for (let i = 0; i < 1000; i++) {
        controller.enqueue(new TextEncoder().encode(`Line ${i}\n`));
        await new Promise(r => setTimeout(r, 10));
      }
      controller.close();
    },
  });

  ctx.set('Content-Type', 'text/plain');
  ctx.send(stream);
});
```

### Use Waitlist for Background Work

```typescript
// Cloudflare Workers
app.post('/async', async (ctx) => {
  const executionCtx = ctx.state.ctx as ExecutionContext;
  const data = await ctx.bodySource.json();

  // Don't wait for background work
  executionCtx.waitUntil(
    fetch('https://analytics.example.com/track', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  );

  ctx.json({ queued: true });
});
```

## Testing

```typescript
import { createFetchHandler } from '@nextrush/adapter-edge';
import { describe, it, expect } from 'vitest';

const app = createApp();
app.get('/test', (ctx) => ctx.json({ ok: true }));

const handler = createFetchHandler(app);

describe('Edge Handler', () => {
  it('should handle requests', async () => {
    const request = new Request('http://localhost/test');
    const response = await handler(request);
    const body = await response.json();

    expect(body).toEqual({ ok: true });
  });
});
```

## TypeScript

Full TypeScript support:

```typescript
import type {
  EdgeContext,
  EdgeExecutionContext,
  EdgeRuntimeInfo,
} from '@nextrush/adapter-edge';
```

## Deployment

### Cloudflare Workers

```bash
# wrangler.toml
name = "my-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

# Deploy
wrangler deploy
```

### Vercel Edge

```bash
# vercel.json
{
  "functions": {
    "api/**/*.ts": {
      "runtime": "edge"
    }
  }
}

# Deploy
vercel deploy
```

### Netlify Edge

```bash
# netlify.toml
[[edge_functions]]
  function = "api"
  path = "/api/*"

# Deploy
netlify deploy
```

## See Also

- [Adapters Overview](/adapters/)
- [Node.js Adapter](/adapters/node)
- [Bun Adapter](/adapters/bun)
- [Deno Adapter](/adapters/deno)
