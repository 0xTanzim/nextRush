# Deno Adapter

> Type-safe HTTP adapter for Deno's native server.

## Installation

```typescript
// Import directly (Deno style)
import { serve } from 'npm:@nextrush/adapter-deno';

// Or via import map
import { serve } from '@nextrush/adapter-deno';
```

## Quick Start

```typescript
import { createApp } from '@nextrush/core';
import { serve } from '@nextrush/adapter-deno';

const app = createApp();

app.get('/', (ctx) => {
  ctx.json({ message: 'Hello from Deno!' });
});

await serve(app, { port: 3000 });
console.log('Server running at http://localhost:3000');
```

## Why Deno?

Deno offers unique advantages:

- **Secure by default** - Explicit permissions for network, filesystem, etc.
- **TypeScript native** - No compilation step needed
- **Web standard APIs** - Uses fetch, Request, Response
- **Modern tooling** - Built-in formatter, linter, test runner

NextRush's Deno adapter embraces these principles while providing a consistent API.

## API Reference

### `serve(app, options)`

Start a Deno HTTP server.

```typescript
import { serve } from '@nextrush/adapter-deno';

const server = await serve(app, {
  port: 3000,           // Port to listen on (default: 3000)
  hostname: '0.0.0.0',  // Hostname to bind (default: '0.0.0.0')
});

console.log(`Listening on ${server.addr.hostname}:${server.addr.port}`);

// Shutdown server
server.shutdown();
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | `number` | `3000` | Port to listen on |
| `hostname` | `string` | `'0.0.0.0'` | Hostname to bind |
| `signal` | `AbortSignal` | - | Signal for graceful shutdown |

**Returns:** `Promise<Deno.HttpServer>`

### `listen(app, options)`

Alias for `serve()`. Starts a Deno HTTP server.

```typescript
import { listen } from '@nextrush/adapter-deno';

const server = await listen(app, { port: 8080 });
```

### `createHandler(app)`

Create a fetch handler without starting a server.

```typescript
import { createHandler } from '@nextrush/adapter-deno';

const handler = createHandler(app);

// Use with Deno.serve
Deno.serve({ port: 3000 }, handler);
```

**Returns:** `(request: Request) => Promise<Response>`

### `createDenoAdapter(app)`

Create a full adapter instance.

```typescript
import { createDenoAdapter } from '@nextrush/adapter-deno';

const adapter = createDenoAdapter(app);

// Start server
await adapter.listen({ port: 3000 });

// Or get handler
const handler = adapter.handler;
```

## Context Properties

### `ctx.runtime`

Always `'deno'` for this adapter.

```typescript
app.get('/runtime', (ctx) => {
  console.log(ctx.runtime); // 'deno'
});
```

### `ctx.bodySource`

Cross-runtime body reading interface.

```typescript
app.post('/data', async (ctx) => {
  const text = await ctx.bodySource.text();
  const json = await ctx.bodySource.json();
  const buffer = await ctx.bodySource.buffer();
});
```

### `ctx.raw`

Access to Deno's Request object.

```typescript
app.get('/info', (ctx) => {
  const { req } = ctx.raw;

  // Access Web Request object
  const url = new URL(req.url);

  ctx.json({
    url: url.pathname,
    method: req.method,
  });
});
```

## Patterns

### HTTPS with TLS

```typescript
import { createHandler } from '@nextrush/adapter-deno';

const handler = createHandler(app);

Deno.serve({
  port: 443,
  cert: await Deno.readTextFile('cert.pem'),
  key: await Deno.readTextFile('key.pem'),
}, handler);
```

### Graceful Shutdown

```typescript
const controller = new AbortController();

const server = await serve(app, {
  port: 3000,
  signal: controller.signal,
});

// Graceful shutdown on SIGINT
Deno.addSignalListener('SIGINT', () => {
  console.log('Shutting down...');
  controller.abort();
});
```

### File Serving

```typescript
app.get('/files/:name', async (ctx) => {
  const { name } = ctx.params;

  try {
    const content = await Deno.readFile(`./public/${name}`);
    ctx.set('Content-Type', 'application/octet-stream');
    ctx.send(content);
  } catch {
    ctx.status = 404;
    ctx.json({ error: 'File not found' });
  }
});
```

### Testing with Deno Test

```typescript
import { createHandler } from '@nextrush/adapter-deno';
import { assertEquals } from 'https://deno.land/std/assert/mod.ts';

const app = createApp();
app.get('/test', (ctx) => ctx.json({ ok: true }));

const handler = createHandler(app);

Deno.test('API returns ok', async () => {
  const request = new Request('http://localhost/test');
  const response = await handler(request);
  const body = await response.json();

  assertEquals(body, { ok: true });
});
```

### Deploy to Deno Deploy

```typescript
// main.ts
import { createApp } from '@nextrush/core';
import { createHandler } from '@nextrush/adapter-deno';

const app = createApp();

app.get('/', (ctx) => {
  ctx.json({ deployed: 'Deno Deploy' });
});

const handler = createHandler(app);

// Deno Deploy uses Deno.serve automatically
Deno.serve(handler);
```

## Permissions

Deno requires explicit permissions:

```bash
# Basic server
deno run --allow-net server.ts

# With file access
deno run --allow-net --allow-read server.ts

# With environment variables
deno run --allow-net --allow-env server.ts

# Production (all needed permissions)
deno run --allow-net --allow-read --allow-env server.ts
```

### Permission Checking

```typescript
app.get('/fs', async (ctx) => {
  // Check if we have permission before using
  const status = await Deno.permissions.query({ name: 'read', path: './' });

  if (status.state === 'granted') {
    const files = [];
    for await (const entry of Deno.readDir('./')) {
      files.push(entry.name);
    }
    ctx.json({ files });
  } else {
    ctx.status = 403;
    ctx.json({ error: 'File system access denied' });
  }
});
```

## Deno-Specific Features

### KV Store

```typescript
const kv = await Deno.openKv();

app.get('/counter', async (ctx) => {
  const key = ['counter'];
  const entry = await kv.get(key);
  const value = (entry.value as number) || 0;

  await kv.set(key, value + 1);

  ctx.json({ count: value + 1 });
});
```

### FFI (Foreign Function Interface)

```typescript
const dylib = Deno.dlopen('./libexample.so', {
  add: { parameters: ['i32', 'i32'], result: 'i32' },
});

app.get('/ffi', (ctx) => {
  const result = dylib.symbols.add(1, 2);
  ctx.json({ result });
});
```

### Web Streams

```typescript
app.get('/stream', (ctx) => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('Hello '));
      controller.enqueue(new TextEncoder().encode('World!'));
      controller.close();
    },
  });

  ctx.set('Content-Type', 'text/plain');
  ctx.send(stream);
});
```

## TypeScript

Full TypeScript support with Deno's built-in types:

```typescript
import type { DenoServerOptions, DenoContext } from '@nextrush/adapter-deno';

const options: DenoServerOptions = {
  port: 3000,
  hostname: 'localhost',
};
```

## Import Maps

Create `deno.json`:

```json
{
  "imports": {
    "@nextrush/core": "npm:@nextrush/core",
    "@nextrush/adapter-deno": "npm:@nextrush/adapter-deno"
  }
}
```

Then import cleanly:

```typescript
import { createApp } from '@nextrush/core';
import { serve } from '@nextrush/adapter-deno';
```

## See Also

- [Adapters Overview](/adapters/)
- [Node.js Adapter](/adapters/node)
- [Bun Adapter](/adapters/bun)
- [Edge Adapter](/adapters/edge)
