# @nextrush/adapter-deno

> Deno HTTP adapter for NextRush - Secure by default

Connect your NextRush application to [Deno](https://deno.land) for a secure, modern JavaScript runtime with built-in TypeScript support.

## Why Deno?

```
┌────────────────────────────────────────────────────────────────┐
│  Deno.serve()  →  NextRush Handler  →  Your Middleware/Routes  │
└────────────────────────────────────────────────────────────────┘

Deno Advantages:
├── Secure by default (explicit permissions)
├── Built-in TypeScript support
├── Web standard APIs
├── No node_modules
└── Fast cold starts
```

## Installation

```typescript
// Import from URL (Deno style)
import { createApp } from 'https://esm.sh/@nextrush/core';
import { serve } from 'https://esm.sh/@nextrush/adapter-deno';

// Or use import maps in deno.json
```

### deno.json

```json
{
  "imports": {
    "@nextrush/core": "https://esm.sh/@nextrush/core@3.0.0",
    "@nextrush/adapter-deno": "https://esm.sh/@nextrush/adapter-deno@3.0.0",
    "@nextrush/router": "https://esm.sh/@nextrush/router@3.0.0",
    "@nextrush/body-parser": "https://esm.sh/@nextrush/body-parser@3.0.0"
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
  port: 3000,           // Default: 3000
  hostname: '0.0.0.0',  // Default: '0.0.0.0'
  onListen: ({ port, hostname }) => { ... },
  onError: (error) => { ... },
  cert: certPem,        // Optional TLS certificate
  key: keyPem,          // Optional TLS key
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
  ctx.method     // 'GET', 'POST', etc.
  ctx.path       // '/users/123'
  ctx.query      // { page: '1' }
  ctx.params     // { id: '123' } (from router)
  ctx.headers    // Request headers
  ctx.body       // Parsed body (from body-parser)
  ctx.ip         // Client IP

  // Runtime info
  ctx.runtime    // 'deno'
  ctx.bodySource // BodySource for raw body access

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
  ctx.raw.req // Web API Request object
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

app.use(router.routes());

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

This adapter maintains **identical DX** with other NextRush adapters:

```typescript
// Same code works with all adapters!
// Just change the import:

// Node.js
import { serve } from '@nextrush/adapter-node';

// Bun
import { serve } from '@nextrush/adapter-bun';

// Deno
import { serve } from '@nextrush/adapter-deno';

// The rest of your code stays the same
serve(app, { port: 3000 });
```

## Deno Deploy

Deploy to [Deno Deploy](https://deno.com/deploy) for global edge deployment:

```typescript
// main.ts
import { createApp } from '@nextrush/core';
import { createHandler } from '@nextrush/adapter-deno';

const app = createApp();

app.use(async (ctx) => {
  ctx.json({
    message: 'Hello from Deno Deploy!',
    region: Deno.env.get('DENO_REGION'),
  });
});

// Export handler for Deno Deploy
export default {
  fetch: createHandler(app),
};
```

## Types

```typescript
import type {
  ServeOptions,
  ServerInstance,
  DenoContext,
} from '@nextrush/adapter-deno';
```

## Requirements

- Deno >= 1.38.0
- NextRush >= 3.0.0

## See Also

- [`@nextrush/core`](../core) - Core framework
- [`@nextrush/adapter-node`](../adapters/node) - Node.js adapter
- [`@nextrush/adapter-bun`](../adapters/bun) - Bun adapter
- [`@nextrush/adapter-edge`](../adapters/edge) - Edge runtime adapter
- [Deno Documentation](https://deno.land/manual)
- [Deno Deploy](https://deno.com/deploy)

## License

MIT
