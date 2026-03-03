# @nextrush/adapter-deno

Deno HTTP adapter for NextRush. Connects your NextRush application to Deno's native `Deno.serve()` API.

## Installation

```typescript
import { createApp } from 'npm:@nextrush/core';
import { serve } from 'npm:@nextrush/adapter-deno';
```

Or use import maps in `deno.json`:

```json
{
  "imports": {
    "@nextrush/core": "npm:@nextrush/core",
    "@nextrush/adapter-deno": "npm:@nextrush/adapter-deno",
    "@nextrush/router": "npm:@nextrush/router"
  }
}
```

## Quick Start

```typescript
import { createApp } from '@nextrush/core';
import { serve } from '@nextrush/adapter-deno';

const app = createApp();

app.use(async (ctx) => {
  ctx.json({ message: 'Hello from Deno!' });
});

serve(app, {
  port: 3000,
  onListen: ({ port }) => console.log(`🚀 Server running on port ${port}`),
});
```

### Run

```bash
deno run --allow-net server.ts
```

## API Reference

### `serve(app, options?)`

Start an HTTP server for your application.

```typescript
import { serve } from '@nextrush/adapter-deno';

const server = serve(app, {
  port: 3000,            // Default: 3000
  hostname: '0.0.0.0',   // Default: '0.0.0.0'
  shutdownTimeout: 30000,// Default: 30000 (ms)
  onListen: ({ port, hostname }) => { ... },
  onError: (error) => { ... },
  cert: certPem,         // Optional TLS certificate
  key: keyPem,           // Optional TLS key
});

// Server control
console.log(`Running on port ${server.port}`);
await server.close();

// Wait for server to finish
await server.finished;
```

### `createHandler(app)`

Create a handler for custom Deno.serve configurations.

```typescript
import { createHandler } from '@nextrush/adapter-deno';

const handler = createHandler(app);

// Use with custom Deno.serve setup
Deno.serve({
  port: 3000,
  handler,
  // ... additional Deno options
});
```

### `listen(app, port?)`

Quick start shorthand with console output.

```typescript
import { listen } from '@nextrush/adapter-deno';

listen(app, 3000);
// Output: 🚀 NextRush listening on http://localhost:3000 (Deno)
```

## Context

The `DenoContext` provides the standard NextRush Context interface:

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
  ctx.runtime; // 'deno'
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
  ctx.raw.req; // Web API Request object (Deno)
});
```

## HTTPS / TLS

```typescript
const cert = await Deno.readTextFile('./cert.pem');
const key = await Deno.readTextFile('./key.pem');

serve(app, {
  port: 443,
  cert,
  key,
});
```

## Deno Permissions

NextRush requires minimal permissions:

```bash
# Basic server
deno run --allow-net server.ts

# With file serving
deno run --allow-net --allow-read server.ts

# With environment variables
deno run --allow-net --allow-env server.ts
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

## Full Example

```typescript
// server.ts
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { json } from '@nextrush/body-parser';
import { cors } from '@nextrush/cors';
import { serve } from '@nextrush/adapter-deno';

const app = createApp();
const router = createRouter();

// Middleware
app.use(cors());
app.use(json());

// Routes
router.get('/health', (ctx) => {
  ctx.json({
    status: 'healthy',
    runtime: ctx.runtime, // 'deno'
    version: Deno.version.deno,
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
    console.log(`   Runtime: Deno ${Deno.version.deno}`);
  },
});
```

## DX Consistency

All NextRush adapters share the same interface. Change the import to switch runtimes:

```typescript
// Deno
import { serve } from '@nextrush/adapter-deno';

// Node.js
import { serve } from '@nextrush/adapter-node';

// Bun
import { serve } from '@nextrush/adapter-bun';

serve(app, { port: 3000 });
```

## Deno Deploy

Use `createHandler` for [Deno Deploy](https://deno.com/deploy):

```typescript
import { createApp } from '@nextrush/core';
import { createHandler } from '@nextrush/adapter-deno';

const app = createApp();

app.use(async (ctx) => {
  ctx.json({
    message: 'Hello from Deno Deploy!',
    region: Deno.env.get('DENO_REGION'),
  });
});

Deno.serve(createHandler(app));
```

## Types

```typescript
import type { ServeOptions, ServerInstance } from '@nextrush/adapter-deno';

import { DenoContext } from '@nextrush/adapter-deno';
```

## Requirements

- Deno >= 2.0
- NextRush >= 3.0.0

## See Also

- [`@nextrush/core`](https://github.com/0xTanzim/nextrush/tree/main/packages/core) - Core framework
- [`@nextrush/adapter-node`](https://github.com/0xTanzim/nextrush/tree/main/packages/adapters/node) - Node.js adapter
- [`@nextrush/adapter-bun`](https://github.com/0xTanzim/nextrush/tree/main/packages/adapters/bun) - Bun adapter
- [`@nextrush/adapter-edge`](https://github.com/0xTanzim/nextrush/tree/main/packages/adapters/edge) - Edge runtime adapter

## License

MIT
