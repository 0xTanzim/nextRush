# @nextrush/adapter-bun

> Bun HTTP adapter for NextRush

Connect your NextRush application to [Bun](https://bun.sh). This adapter bridges NextRush's middleware system to `Bun.serve()`, handling context creation, in-flight request tracking, and graceful shutdown.

## Why Bun?

```
┌────────────────────────────────────────────────────────────────┐
│  Bun.serve()  →  NextRush Handler  →  Your Middleware/Routes   │
└────────────────────────────────────────────────────────────────┘
```

Bun's built-in HTTP server uses direct syscalls and avoids the overhead of Node.js's `http` module. The adapter adds minimal overhead on top of `Bun.serve()`.

## Installation

```bash
bun add @nextrush/adapter-bun @nextrush/core
```

## Quick Start

```typescript
import { createApp } from '@nextrush/core';
import { serve } from '@nextrush/adapter-bun';

const app = createApp();

app.use(async (ctx) => {
  ctx.json({ message: 'Hello from Bun!' });
});

serve(app, {
  port: 3000,
  onListen: ({ port }) => console.log(`🚀 Server running on port ${port}`),
});
```

## API Reference

### `serve(app, options?)`

Start an HTTP server for your application.

```typescript
import { serve } from '@nextrush/adapter-bun';

const server = serve(app, {
  port: 3000,           // Default: 3000
  hostname: '0.0.0.0',  // Default: '0.0.0.0'
  onListen: ({ port, hostname }) => { ... },
  onError: (error) => { ... },
  development: false,   // Enable dev mode
  maxRequestBodySize: 128 * 1024 * 1024, // Bun default: 128MB
  shutdownTimeout: 30_000, // Default: 30s drain timeout
  tls: {                // Optional HTTPS
    cert: certFile,
    key: keyFile,
  },
});

// Server control
console.log(`Running on port ${server.port}`);
await server.close();
```

### `createHandler(app)`

Create a fetch handler for custom Bun.serve configurations.

```typescript
import { createHandler } from '@nextrush/adapter-bun';

const handler = createHandler(app);

// Use with custom Bun.serve setup
const server = Bun.serve({
  port: 3000,
  fetch: handler,
  // ... additional Bun options
});
```

### `listen(app, port?)`

Quick start shorthand with console output.

```typescript
import { listen } from '@nextrush/adapter-bun';

listen(app, 3000);
// Output: 🚀 NextRush listening on http://localhost:3000 (Bun)
```

## Context

The `BunContext` provides the standard NextRush Context interface optimized for Bun:

```typescript
app.use(async (ctx) => {
  // Request (input)
  ctx.method; // 'GET', 'POST', etc.
  ctx.path; // '/users/123'
  ctx.query; // { page: '1' }
  ctx.params; // { id: '123' } (from router)
  ctx.headers; // Request headers
  ctx.body; // Parsed body (from body-parser)
  ctx.ip; // Client IP

  // Runtime info
  ctx.runtime; // 'bun'
  ctx.bodySource; // BodySource for raw body access

  // Response (output)
  ctx.status = 201;
  ctx.json({ data: '...' });
  ctx.send('text');
  ctx.html('<h1>Hello</h1>');
  ctx.redirect('/other');

  // Headers
  ctx.set('X-Custom', 'value');
  ctx.get('content-type');

  // Middleware
  await ctx.next();

  // Raw access (escape hatch)
  ctx.raw.req; // Web API Request object
});
```

### Bun-Specific Features

```typescript
// Access Bun's native Request
const request = ctx.raw.req;
console.log(request.url);

// Get client IP (Bun provides this)
console.log(ctx.ip);

// Use Bun's fast JSON parsing via bodySource
const data = await ctx.bodySource.json();
```

## Body Parsing

The `BunBodySource` leverages Bun's optimized body parsing:

```typescript
// In middleware
const text = await ctx.bodySource.text(); // Bun's native text()
const json = await ctx.bodySource.json(); // Bun's native json()
const buffer = await ctx.bodySource.buffer(); // Bun's native arrayBuffer()
const stream = ctx.bodySource.stream(); // ReadableStream
```

### With @nextrush/body-parser

```typescript
import { json } from '@nextrush/body-parser';

app.use(json());

app.use(async (ctx) => {
  // ctx.body is automatically parsed
  const { name } = ctx.body as { name: string };
});
```

## HTTPS / TLS

```typescript
serve(app, {
  port: 443,
  tls: {
    cert: Bun.file('./cert.pem'),
    key: Bun.file('./key.pem'),
    ca: Bun.file('./ca.pem'), // Optional
  },
});
```

## Error Handling

```typescript
serve(app, {
  onError: (error) => {
    console.error('Server error:', error);
    // Log to monitoring service
  },
});

// In middleware
app.use(async (ctx) => {
  ctx.throw(404, 'Not found');
  // or
  ctx.assert(user, 404, 'User not found');
});
```

## Hot Reload

Bun supports hot reloading out of the box:

```bash
bun --hot run server.ts
```

Or use the `reload()` method to update non-structural configuration:

```typescript
const server = serve(app, { port: 3000 });

// Update configuration (port changes may not take effect)
server.reload({ development: true });
```

## Full Example

```typescript
// server.ts
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { json } from '@nextrush/body-parser';
import { cors } from '@nextrush/cors';
import { serve } from '@nextrush/adapter-bun';

const app = createApp();
const router = createRouter();

// Middleware
app.use(cors());
app.use(json());

// Routes
router.get('/health', (ctx) => {
  ctx.json({
    status: 'healthy',
    runtime: ctx.runtime, // 'bun'
    version: Bun.version,
  });
});

router.post('/users', async (ctx) => {
  const { name, email } = ctx.body as { name: string; email: string };

  ctx.status = 201;
  ctx.json({ id: Date.now(), name, email });
});

router.get('/users/:id', (ctx) => {
  const { id } = ctx.params;
  ctx.json({ id, name: 'John Doe' });
});

// Mount router — Hono-style
app.route('/', router);

// Start server
serve(app, {
  port: 3000,
  onListen: ({ port }) => {
    console.log(`🚀 Server running on http://localhost:${port}`);
    console.log(`   Runtime: Bun ${Bun.version}`);
  },
});
```

## DX Consistency

This adapter maintains **identical DX** with other NextRush adapters:

```typescript
// Same code works with all adapters.
// Change the import:

// Node.js
import { serve } from '@nextrush/adapter-node';

// Bun
import { serve } from '@nextrush/adapter-bun';

// Deno
import { serve } from '@nextrush/adapter-deno';

// The rest of your code stays the same
serve(app, { port: 3000 });
```

## Performance Tips

### 1. Use Bun's Native Streaming

```typescript
router.get('/file', async (ctx) => {
  ctx.send(Bun.file('./large-file.txt').stream());
});
```

### 2. Enable Development Mode for Debugging

```typescript
serve(app, {
  development: true, // Enables Bun's dev features
});
```

### 3. Tune Body Size Limits

```typescript
serve(app, {
  maxRequestBodySize: 50 * 1024 * 1024, // 50MB for file uploads
});
```

## Types

```typescript
import type { ServeOptions, ServerInstance, BunContext } from '@nextrush/adapter-bun';
```

## Requirements

- Bun >= 1.0.0
- NextRush >= 3.0.0

## See Also

- [`@nextrush/core`](../core) - Core framework
- [`@nextrush/adapter-node`](../adapters/node) - Node.js adapter
- [`@nextrush/adapter-deno`](../adapters/deno) - Deno adapter
- [`@nextrush/adapter-edge`](../adapters/edge) - Edge runtime adapter
- [Bun Documentation](https://bun.sh/docs)

## License

MIT
