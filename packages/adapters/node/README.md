# @nextrush/adapter-node

> **Node.js HTTP Adapter for NextRush** — Production-ready server with zero dependencies

[![npm version](https://img.shields.io/npm/v/@nextrush/adapter-node)](https://www.npmjs.com/package/@nextrush/adapter-node)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org/)

The Node.js adapter connects NextRush applications to Node's built-in HTTP server with **zero external dependencies** and **maximum performance**.

## Why Node.js?

Node.js remains the **most mature** runtime for server-side JavaScript:

| Aspect | Node.js Advantage |
|--------|-------------------|
| Ecosystem | 2M+ npm packages |
| Stability | LTS releases, enterprise-proven |
| Performance | Highly optimized V8 engine |
| Hosting | Supported everywhere |

## Quick Start

```typescript
import { createApp } from '@nextrush/core';
import { serve } from '@nextrush/adapter-node';

const app = createApp();

app.use(async (ctx) => {
  ctx.json({
    message: 'Hello from Node.js!',
    runtime: ctx.runtime,  // 'node'
    pid: process.pid
  });
});

serve(app, 3000, () => {
  console.log('Server running at http://localhost:3000');
});
```

## Installation

```bash
# npm
npm install @nextrush/adapter-node @nextrush/core

# pnpm
pnpm add @nextrush/adapter-node @nextrush/core

# yarn
yarn add @nextrush/adapter-node @nextrush/core
```

## API Reference

### `serve(app, port, callback?)`

Start an HTTP server on the specified port.

```typescript
import { serve } from '@nextrush/adapter-node';

// Basic usage
serve(app, 3000);

// With callback
serve(app, 3000, () => {
  console.log('Server running on http://localhost:3000');
});

// Returns the HTTP server instance
const server = serve(app, 3000);
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `app` | `Application` | NextRush application instance |
| `port` | `number` | Port number to listen on |
| `callback` | `() => void` | Optional callback when server starts |

**Returns:** `http.Server` — Node.js HTTP server instance

### `listen(app, options)`

More flexible server configuration.

```typescript
import { listen } from '@nextrush/adapter-node';

const server = listen(app, {
  port: 3000,
  host: '0.0.0.0',
  callback: () => console.log('Server started'),
});
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | `number` | `3000` | Port number |
| `host` | `string` | `'127.0.0.1'` | Host to bind |
| `socket` | `string` | - | Unix socket path |
| `callback` | `() => void` | - | Startup callback |
| `ssl` | `object` | - | HTTPS options |

### `createHandler(app)`

Create a request handler for use with existing servers.

```typescript
import { createServer } from 'http';
import { createHandler } from '@nextrush/adapter-node';

const handler = createHandler(app);
const server = createServer(handler);

server.listen(3000);
```

## NodeContext

The `NodeContext` class provides the execution context for Node.js requests:

```typescript
interface NodeContext extends Context {
  // Runtime information
  readonly runtime: 'node';
  readonly bodySource: NodeBodySource;

  // Request data
  readonly path: string;
  readonly method: string;
  readonly query: Record<string, string>;
  readonly params: Record<string, string>;
  readonly headers: Record<string, string>;

  // Raw Node.js objects
  readonly raw: {
    req: IncomingMessage;
    res: ServerResponse;
  };

  // Response methods
  json(data: unknown): void;
  send(body: string | Buffer): void;
  html(content: string): void;
  redirect(url: string, status?: number): void;
}
```

### Body Parsing

Parse request bodies using the cross-runtime `BodySource` interface:

```typescript
app.use(async (ctx) => {
  // Using bodySource (cross-runtime compatible)
  const text = await ctx.bodySource.text();
  const buffer = await ctx.bodySource.buffer();

  // Stream access for large bodies
  const stream = ctx.bodySource.stream();

  // Or use body-parser middleware
  // ctx.body already parsed when using @nextrush/body-parser
});
```

## Configuration

### Host and Port

```typescript
serve(app, {
  port: 3000,
  host: '0.0.0.0',  // Listen on all interfaces
});

// Environment-based
serve(app, {
  port: parseInt(process.env.PORT || '3000'),
  host: process.env.HOST || '127.0.0.1',
});
```

### HTTPS

```typescript
import { readFileSync } from 'fs';
import { listen } from '@nextrush/adapter-node';

listen(app, {
  port: 443,
  ssl: {
    key: readFileSync('server.key'),
    cert: readFileSync('server.cert'),
  },
});
```

### Unix Socket

```typescript
listen(app, {
  socket: '/var/run/myapp.sock',
});
```

## Graceful Shutdown

Built-in graceful shutdown support:

```typescript
const server = serve(app, 3000);

// Handle shutdown signals
process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
```

Using the shutdown helper:

```typescript
import { serve, gracefulShutdown } from '@nextrush/adapter-node';

const server = serve(app, 3000);

gracefulShutdown(server, {
  timeout: 30000,  // 30 seconds to finish requests
  signals: ['SIGTERM', 'SIGINT'],
  onShutdown: async () => {
    // Cleanup: close DB connections, etc.
    await db.close();
  },
});
```

## Integration Examples

### With HTTP/2

```typescript
import { createSecureServer } from 'http2';
import { createHandler } from '@nextrush/adapter-node';
import { readFileSync } from 'fs';

const handler = createHandler(app);

const server = createSecureServer({
  key: readFileSync('server.key'),
  cert: readFileSync('server.cert'),
  allowHTTP1: true,
}, handler);

server.listen(443);
```

### With Cluster

Scale to multiple CPU cores:

```typescript
import cluster from 'cluster';
import os from 'os';
import { serve } from '@nextrush/adapter-node';

if (cluster.isPrimary) {
  const numCPUs = os.cpus().length;
  console.log(`Primary ${process.pid} starting ${numCPUs} workers`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.process.pid} died, restarting...`);
    cluster.fork();
  });
} else {
  serve(app, 3000);
  console.log(`Worker ${process.pid} started`);
}
```

### Behind Reverse Proxy

```typescript
import { createApp } from '@nextrush/core';
import { serve } from '@nextrush/adapter-node';

const app = createApp({
  proxy: true,  // Trust proxy headers
});

app.use(async (ctx) => {
  // Uses X-Forwarded-For when behind proxy
  ctx.json({ ip: ctx.ip });
});

serve(app, 3000);
```

## Routing with @nextrush/router

```typescript
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { serve } from '@nextrush/adapter-node';

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

serve(app, 3000);
```

## Middleware Compatibility

All NextRush middleware works seamlessly:

```typescript
import { createApp } from '@nextrush/core';
import { cors } from '@nextrush/cors';
import { json } from '@nextrush/body-parser';
import { serve } from '@nextrush/adapter-node';

const app = createApp();

// CORS middleware
app.use(cors());

// Body parsing
app.use(json());

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

serve(app, 3000);
```

## Error Handling

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

## Performance Tips

The adapter is optimized for maximum throughput:

### 1. Stream Large Responses

```typescript
app.use(async (ctx) => {
  const stream = createReadStream('large-file.json');
  ctx.type = 'application/json';
  ctx.body = stream;
});
```

### 2. Use Connection Keep-Alive

```typescript
// Keep-alive is enabled by default
// Explicit configuration:
const server = serve(app, 3000);
server.keepAliveTimeout = 60000; // 60 seconds
```

### 3. Enable Compression

```typescript
import { compression } from '@nextrush/compression';

app.use(compression());
```

## TypeScript

Full TypeScript support with intelligent types:

```typescript
import type { NodeContext } from '@nextrush/adapter-node';
import type { Middleware } from '@nextrush/core';

// Type-safe middleware
const logger: Middleware<NodeContext> = async (ctx) => {
  console.log(`${ctx.method} ${ctx.path}`);
  await ctx.next();
};
```

## Exports

```typescript
import {
  // Server functions
  serve,
  listen,
  createHandler,
  gracefulShutdown,

  // Context
  NodeContext,
  createNodeContext,

  // Body source
  NodeBodySource,

  // Types
  type ServeOptions,
  type ShutdownOptions,
  type Runtime,
  type BodySource,
} from '@nextrush/adapter-node';
```

## Related Packages

| Package | Description |
|---------|-------------|
| [@nextrush/core](../core) | Core application and middleware |
| [@nextrush/router](../router) | High-performance routing |
| [@nextrush/adapter-bun](../adapters/bun) | Bun runtime adapter |
| [@nextrush/adapter-deno](../adapters/deno) | Deno runtime adapter |
| [@nextrush/adapter-edge](../adapters/edge) | Edge runtime adapter |
| [@nextrush/runtime](../runtime) | Runtime detection utilities |

## License

MIT © NextRush Contributors
