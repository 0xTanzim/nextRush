# @nextrush/adapter-node

Node.js HTTP adapter for NextRush. Connect your NextRush application to Node's built-in HTTP server.

## Installation

```bash
npm install @nextrush/adapter-node
# or
pnpm add @nextrush/adapter-node
```

## Quick Start

```typescript
import { createApp } from '@nextrush/core';
import { serve } from '@nextrush/adapter-node';

const app = createApp();

app.get('/', (ctx) => {
  ctx.json({ message: 'Hello World' });
});

// Start server on port 3000
serve(app, 3000);
```

## Features

- **Zero Dependencies**: Uses Node.js built-in `http` module
- **Full Context Support**: Complete request/response handling
- **Graceful Shutdown**: Built-in shutdown hooks
- **HTTPS Support**: Easy SSL/TLS configuration
- **Cluster Mode**: Multi-process server support
- **Unix Sockets**: Support for socket-based servers

## API

### serve(app, port, callback?)

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

### listen(app, options)

More flexible server configuration.

```typescript
import { listen } from '@nextrush/adapter-node';

const server = listen(app, {
  port: 3000,
  host: '0.0.0.0',
  callback: () => console.log('Server started'),
});
```

### createHandler(app)

Create a request handler for use with existing servers.

```typescript
import { createServer } from 'http';
import { createHandler } from '@nextrush/adapter-node';

const handler = createHandler(app);
const server = createServer(handler);

server.listen(3000);
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
  port: process.env.PORT || 3000,
  host: process.env.HOST || '127.0.0.1',
});
```

### HTTPS

```typescript
import { readFileSync } from 'fs';
import { serve } from '@nextrush/adapter-node';

serve(app, {
  port: 443,
  ssl: {
    key: readFileSync('server.key'),
    cert: readFileSync('server.cert'),
  },
});
```

### Unix Socket

```typescript
serve(app, {
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

```typescript
import cluster from 'cluster';
import os from 'os';
import { serve } from '@nextrush/adapter-node';

if (cluster.isPrimary) {
  const numCPUs = os.cpus().length;

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.process.pid} died`);
    cluster.fork();
  });
} else {
  serve(app, 3000);
}
```

### Behind Reverse Proxy

```typescript
import { createApp } from '@nextrush/core';
import { serve } from '@nextrush/adapter-node';

const app = createApp({
  proxy: true,  // Trust proxy headers
});

app.get('/ip', (ctx) => {
  // Uses X-Forwarded-For when behind proxy
  ctx.json({ ip: ctx.ip });
});

serve(app, 3000);
```

## Request Context

The adapter creates a full NextRush context from Node's request/response:

```typescript
app.get('/info', (ctx) => {
  ctx.json({
    method: ctx.method,       // HTTP method
    path: ctx.path,           // Request path
    url: ctx.url,             // Full URL
    headers: ctx.headers,     // Request headers
    query: ctx.query,         // Query parameters
    ip: ctx.ip,               // Client IP
  });
});
```

## Response Handling

```typescript
app.get('/download', (ctx) => {
  ctx.set('Content-Disposition', 'attachment; filename="file.txt"');
  ctx.body = 'File content';
});

app.get('/stream', (ctx) => {
  ctx.set('Content-Type', 'text/event-stream');
  // Stream responses work automatically
});
```

## API Reference

### Exports

```typescript
import {
  serve,            // Start HTTP server
  listen,           // Flexible server start
  createHandler,    // Create request handler
  gracefulShutdown, // Shutdown helper
} from '@nextrush/adapter-node';
```

### Types

```typescript
interface ServeOptions {
  port?: number;
  host?: string;
  socket?: string;
  callback?: () => void;
  ssl?: {
    key: Buffer | string;
    cert: Buffer | string;
    ca?: Buffer | string;
  };
}

interface ShutdownOptions {
  timeout?: number;
  signals?: string[];
  onShutdown?: () => Promise<void>;
}
```

## Performance

The adapter is optimized for performance:

- **Zero copying**: Streams requests/responses directly
- **Minimal overhead**: Thin wrapper over Node's HTTP
- **Keep-alive**: Connection reuse enabled by default

## License

MIT
