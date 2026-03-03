# @nextrush/adapter-node

Node.js HTTP adapter for NextRush. Connects your application to Node.js's built-in `http.createServer`.

## Installation

```bash
pnpm add @nextrush/adapter-node @nextrush/core
```

## Quick Start

```typescript
import { createApp } from '@nextrush/core';
import { serve } from '@nextrush/adapter-node';

const app = createApp();

app.use(async (ctx) => {
  ctx.json({ message: 'Hello from Node.js!' });
});

const server = await serve(app, {
  port: 3000,
  onListen: ({ port }) => console.log(`Listening on port ${port}`),
});
```

## API Reference

### `serve(app, options?)`

Start an HTTP server with full configuration.

```typescript
function serve(app: Application, options?: ServeOptions): Promise<ServerInstance>;
```

**Parameters:**

| Parameter | Type           | Description                     |
| --------- | -------------- | ------------------------------- |
| `app`     | `Application`  | NextRush application instance   |
| `options` | `ServeOptions` | Server configuration (optional) |

**Returns:** `Promise<ServerInstance>`

**ServeOptions:**

| Option             | Type                                             | Default      | Description                                     |
| ------------------ | ------------------------------------------------ | ------------ | ----------------------------------------------- |
| `port`             | `number`                                         | `3000`       | Port to listen on                               |
| `host`             | `string`                                         | `'0.0.0.0'`  | Host to bind to                                 |
| `timeout`          | `number`                                         | `30000`      | Request timeout in milliseconds                 |
| `keepAliveTimeout` | `number`                                         | `5000`       | Keep-alive timeout in milliseconds              |
| `shutdownTimeout`  | `number`                                         | `30000`      | Graceful shutdown timeout in milliseconds       |
| `onListen`         | `(info: { port: number; host: string }) => void` | —            | Callback when server starts listening           |
| `onError`          | `(error: Error) => void`                         | —            | Custom error handler for uncaught server errors |
| `logger`           | `Logger`                                         | `app.logger` | Logger for adapter diagnostics                  |

**ServerInstance:**

| Property    | Type                                   | Description                                         |
| ----------- | -------------------------------------- | --------------------------------------------------- |
| `server`    | `Server`                               | Node.js `http.Server` instance                      |
| `port`      | `number`                               | Actual listening port                               |
| `host`      | `string`                               | Bound host address                                  |
| `address()` | `() => { port: number; host: string }` | Get address info                                    |
| `close()`   | `() => Promise<void>`                  | Graceful shutdown — drains connections, then closes |

### `listen(app, port?)`

Shorthand that starts the server and logs a startup message.

```typescript
function listen(app: Application, port?: number): Promise<ServerInstance>;
```

```typescript
import { listen } from '@nextrush/adapter-node';

await listen(app, 3000);
// Output: 🚀 NextRush listening on http://localhost:3000
```

### `createHandler(app, options?)`

Create a raw `(req, res)` handler for use with custom servers (HTTPS, HTTP/2, test harnesses).

```typescript
function createHandler(
  app: Application,
  options?: { logger?: Logger }
): (req: IncomingMessage, res: ServerResponse) => void;
```

```typescript
import { createHandler } from '@nextrush/adapter-node';
import { createServer } from 'node:https';
import { readFileSync } from 'node:fs';

const handler = createHandler(app);

const server = createServer(
  {
    key: readFileSync('private-key.pem'),
    cert: readFileSync('certificate.pem'),
  },
  handler
);

server.listen(443);
```

## Graceful Shutdown

`ServerInstance.close()` stops accepting new connections, waits for in-flight requests to drain (up to `shutdownTimeout`), then calls `app.close()` for plugin cleanup.

```typescript
const server = await serve(app, { port: 3000 });

process.on('SIGTERM', async () => {
  await server.close();
  process.exit(0);
});
```

## Behind a Reverse Proxy

```typescript
import { createApp } from '@nextrush/core';
import { serve } from '@nextrush/adapter-node';

const app = createApp({ proxy: true });

app.use(async (ctx) => {
  // ctx.ip reads X-Forwarded-For when proxy is trusted
  ctx.json({ ip: ctx.ip });
});

await serve(app, { port: 3000 });
```

## Exports

```typescript
import {
  // Server
  serve,
  listen,
  createHandler,
  type ServeOptions,
  type ServerInstance,

  // Context
  NodeContext,
  createNodeContext,
  type NodeContextOptions,

  // Body source
  NodeBodySource,
  createNodeBodySource,
  createEmptyBodySource,

  // Errors (re-exported)
  HttpError,
  BodyConsumedError,
  BodyTooLargeError,

  // Utilities
  getContentLength,
  getContentType,
  parseQueryString,

  // Type re-exports
  type Application,
  type BodySource,
  type Context,
  type HttpMethod,
  type Middleware,
  type Runtime,
} from '@nextrush/adapter-node';
```

## License

MIT © NextRush Contributors
