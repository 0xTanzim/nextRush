# Node.js Adapter

> Production-ready HTTP adapter for Node.js servers.

## Installation

```bash
pnpm add @nextrush/adapter-node
```

## Quick Start

```typescript
import { createApp } from '@nextrush/core';
import { serve } from '@nextrush/adapter-node';

const app = createApp();

app.get('/', (ctx) => {
  ctx.json({ message: 'Hello from Node.js!' });
});

await serve(app, { port: 3000 });
console.log('Server running at http://localhost:3000');
```

## API Reference

### `serve(app, options)`

Start an HTTP server.

```typescript
import { serve } from '@nextrush/adapter-node';

const server = await serve(app, {
  port: 3000,           // Port to listen on (default: 3000)
  hostname: '0.0.0.0',  // Hostname to bind (default: '0.0.0.0')
});

// Server is an http.Server instance
server.close(); // Graceful shutdown
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | `number` | `3000` | Port to listen on |
| `hostname` | `string` | `'0.0.0.0'` | Hostname to bind |

**Returns:** `Promise<http.Server>`

### `listen(app, options)`

Alias for `serve()`. Starts an HTTP server.

```typescript
import { listen } from '@nextrush/adapter-node';

await listen(app, { port: 8080 });
```

### `createHandler(app)`

Create a request handler without starting a server. Useful for:
- Integration with existing servers
- Testing
- Serverless functions

```typescript
import { createHandler } from '@nextrush/adapter-node';
import http from 'node:http';

const handler = createHandler(app);

const server = http.createServer(handler);
server.listen(3000);
```

**Returns:** `(req: IncomingMessage, res: ServerResponse) => Promise<void>`

### `createNodeAdapter(app)`

Create a full adapter instance with multiple methods.

```typescript
import { createNodeAdapter } from '@nextrush/adapter-node';

const adapter = createNodeAdapter(app);

// Start server
await adapter.listen({ port: 3000 });

// Or get handler for custom use
const handler = adapter.handler;
```

## Context Properties

The Node.js adapter provides these context properties:

### `ctx.runtime`

Always `'node'` for this adapter.

```typescript
app.get('/runtime', (ctx) => {
  console.log(ctx.runtime); // 'node'
});
```

### `ctx.bodySource`

Cross-runtime body reading interface.

```typescript
app.post('/data', async (ctx) => {
  const text = await ctx.bodySource.text();
  const buffer = await ctx.bodySource.buffer();
  const json = await ctx.bodySource.json();
});
```

### `ctx.raw`

Access to underlying Node.js objects.

```typescript
app.get('/ip', (ctx) => {
  const { req, res } = ctx.raw;

  // Access Node.js IncomingMessage
  const ip = req.socket.remoteAddress;

  // Access Node.js ServerResponse
  res.setHeader('X-Custom', 'value');

  ctx.json({ ip });
});
```

## Patterns

### HTTPS Server

```typescript
import { createHandler } from '@nextrush/adapter-node';
import https from 'node:https';
import fs from 'node:fs';

const app = createApp();
app.get('/', (ctx) => ctx.json({ secure: true }));

const handler = createHandler(app);

const server = https.createServer({
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem'),
}, handler);

server.listen(443);
```

### Graceful Shutdown

```typescript
import { serve } from '@nextrush/adapter-node';

const server = await serve(app, { port: 3000 });

process.on('SIGTERM', () => {
  console.log('Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
```

### Express/Fastify Integration

```typescript
import { createHandler } from '@nextrush/adapter-node';
import express from 'express';

const app = createApp();
app.get('/api/*', (ctx) => ctx.json({ nextrush: true }));

const handler = createHandler(app);
const expressApp = express();

// Mount NextRush at /api
expressApp.use('/api', handler);

expressApp.listen(3000);
```

### Testing

```typescript
import { createHandler } from '@nextrush/adapter-node';
import { describe, it, expect } from 'vitest';

const app = createApp();
app.get('/test', (ctx) => ctx.json({ ok: true }));

const handler = createHandler(app);

describe('API', () => {
  it('should return ok', async () => {
    // Use node-mocks-http or supertest
    const response = await makeRequest(handler, 'GET', '/test');
    expect(response.body).toEqual({ ok: true });
  });
});
```

## Performance Tips

### Use HTTP/2

```typescript
import { createHandler } from '@nextrush/adapter-node';
import http2 from 'node:http2';
import fs from 'node:fs';

const handler = createHandler(app);

const server = http2.createSecureServer({
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem'),
});

server.on('request', handler);
server.listen(443);
```

### Cluster Mode

```typescript
import cluster from 'node:cluster';
import os from 'node:os';
import { serve } from '@nextrush/adapter-node';

if (cluster.isPrimary) {
  const numCPUs = os.cpus().length;
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
} else {
  const app = createApp();
  app.get('/', (ctx) => ctx.json({ worker: process.pid }));
  await serve(app, { port: 3000 });
}
```

## TypeScript

Full TypeScript support with types:

```typescript
import type { NodeServerOptions, NodeContext } from '@nextrush/adapter-node';

const options: NodeServerOptions = {
  port: 3000,
  hostname: 'localhost',
};
```

## See Also

- [Adapters Overview](/adapters/)
- [Bun Adapter](/adapters/bun)
- [Deno Adapter](/adapters/deno)
- [Edge Adapter](/adapters/edge)
