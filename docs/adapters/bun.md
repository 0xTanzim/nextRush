# Bun Adapter

> High-performance HTTP adapter for Bun's native server.

## Installation

```bash
pnpm add @nextrush/adapter-bun
```

## Quick Start

```typescript
import { createApp } from '@nextrush/core';
import { serve } from '@nextrush/adapter-bun';

const app = createApp();

app.get('/', (ctx) => {
  ctx.json({ message: 'Hello from Bun!' });
});

serve(app, { port: 3000 });
console.log('Server running at http://localhost:3000');
```

## Why Bun?

Bun's native HTTP server is **significantly faster** than Node.js:

- **3-4x faster** request handling
- **Lower memory** usage
- **Native TypeScript** support
- **Built-in** Web APIs

NextRush's Bun adapter leverages these advantages while maintaining the same API.

## API Reference

### `serve(app, options)`

Start a Bun HTTP server.

```typescript
import { serve } from '@nextrush/adapter-bun';

const server = serve(app, {
  port: 3000,           // Port to listen on (default: 3000)
  hostname: '0.0.0.0',  // Hostname to bind (default: '0.0.0.0')
});

console.log(`Listening on ${server.hostname}:${server.port}`);

// Stop server
server.stop();
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | `number` | `3000` | Port to listen on |
| `hostname` | `string` | `'0.0.0.0'` | Hostname to bind |

**Returns:** `Server` (Bun server instance)

### `listen(app, options)`

Alias for `serve()`. Starts a Bun HTTP server.

```typescript
import { listen } from '@nextrush/adapter-bun';

const server = listen(app, { port: 8080 });
```

### `createHandler(app)`

Create a fetch handler without starting a server. Useful for:
- Integration with existing Bun servers
- Testing
- Custom server configurations

```typescript
import { createHandler } from '@nextrush/adapter-bun';

const handler = createHandler(app);

// Use with Bun.serve
Bun.serve({
  port: 3000,
  fetch: handler,
});
```

**Returns:** `(request: Request) => Promise<Response>`

### `createBunAdapter(app)`

Create a full adapter instance with multiple methods.

```typescript
import { createBunAdapter } from '@nextrush/adapter-bun';

const adapter = createBunAdapter(app);

// Start server
adapter.listen({ port: 3000 });

// Or get handler for custom use
const handler = adapter.handler;
```

## Context Properties

The Bun adapter provides these context properties:

### `ctx.runtime`

Always `'bun'` for this adapter.

```typescript
app.get('/runtime', (ctx) => {
  console.log(ctx.runtime); // 'bun'
});
```

### `ctx.bodySource`

Cross-runtime body reading interface. Uses Bun's native optimized methods.

```typescript
app.post('/data', async (ctx) => {
  // Uses Bun's native text() - highly optimized
  const text = await ctx.bodySource.text();

  // Uses Bun's native json() - faster than JSON.parse
  const json = await ctx.bodySource.json();

  // Uses Bun's native arrayBuffer()
  const buffer = await ctx.bodySource.buffer();
});
```

### `ctx.raw`

Access to underlying Bun Request/Response objects.

```typescript
app.get('/info', (ctx) => {
  const { req } = ctx.raw;

  // Access Web Request object
  const url = new URL(req.url);
  const headers = req.headers;

  ctx.json({
    url: url.pathname,
    userAgent: headers.get('user-agent'),
  });
});
```

## Patterns

### WebSocket Upgrade

```typescript
import { serve } from '@nextrush/adapter-bun';

const app = createApp();

app.get('/ws', (ctx) => {
  const { req } = ctx.raw;

  // Check for WebSocket upgrade
  if (req.headers.get('upgrade') === 'websocket') {
    const server = ctx.raw.server;
    const upgraded = server.upgrade(req);
    if (upgraded) {
      return; // Don't send HTTP response
    }
  }

  ctx.status = 426;
  ctx.json({ error: 'WebSocket upgrade required' });
});

const server = serve(app, {
  port: 3000,
  websocket: {
    message(ws, message) {
      ws.send(`Echo: ${message}`);
    },
  },
});
```

### HTTPS with TLS

```typescript
import { serve } from '@nextrush/adapter-bun';

serve(app, {
  port: 443,
  tls: {
    key: Bun.file('key.pem'),
    cert: Bun.file('cert.pem'),
  },
});
```

### File Serving

Bun has optimized file serving:

```typescript
app.get('/files/:name', async (ctx) => {
  const { name } = ctx.params;
  const file = Bun.file(`./public/${name}`);

  if (await file.exists()) {
    ctx.set('Content-Type', file.type);
    ctx.send(await file.arrayBuffer());
  } else {
    ctx.status = 404;
    ctx.json({ error: 'File not found' });
  }
});
```

### Testing with Bun Test

```typescript
import { createHandler } from '@nextrush/adapter-bun';
import { describe, it, expect } from 'bun:test';

const app = createApp();
app.get('/test', (ctx) => ctx.json({ ok: true }));

const handler = createHandler(app);

describe('API', () => {
  it('should return ok', async () => {
    const request = new Request('http://localhost/test');
    const response = await handler(request);
    const body = await response.json();

    expect(body).toEqual({ ok: true });
  });
});
```

## Performance Tips

### Use Bun's Native APIs

```typescript
// Prefer Bun.file over fs
const content = await Bun.file('data.json').text();

// Use Bun's native hashing
const hash = Bun.hash(data);

// Use Bun's native password hashing
const hashed = await Bun.password.hash(password);
```

### Optimize JSON

Bun's JSON parsing is faster than V8:

```typescript
app.post('/data', async (ctx) => {
  // This uses Bun's native JSON parsing
  const data = await ctx.bodySource.json();
  ctx.json(data);
});
```

### Static File Serving

For production, use Bun's static file serving:

```typescript
Bun.serve({
  port: 3000,
  fetch: handler,
  static: {
    '/public': './public',
  },
});
```

## TypeScript

Full TypeScript support:

```typescript
import type { BunServerOptions, BunContext } from '@nextrush/adapter-bun';

const options: BunServerOptions = {
  port: 3000,
  hostname: 'localhost',
};
```

## Bun-Specific Features

### Environment Variables

```typescript
// Bun loads .env automatically
const secret = process.env.SECRET;
// or
const secret = Bun.env.SECRET;
```

### SQLite

```typescript
import { Database } from 'bun:sqlite';

const db = new Database('app.db');

app.get('/users', (ctx) => {
  const users = db.query('SELECT * FROM users').all();
  ctx.json(users);
});
```

### Hot Reloading

```bash
bun --hot run server.ts
```

## See Also

- [Adapters Overview](/adapters/)
- [Node.js Adapter](/adapters/node)
- [Deno Adapter](/adapters/deno)
- [Edge Adapter](/adapters/edge)
