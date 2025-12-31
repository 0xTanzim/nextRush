---
title: Adapter Architecture
description: How NextRush adapters bridge platforms to the framework — Context implementation, request handling, and multi-runtime support.
---

# Adapter Architecture

> Understanding how adapters connect NextRush to different JavaScript runtimes: Node.js, Bun, Deno, and Edge.

## Overview

Adapters are the bridge between platform-specific HTTP APIs and NextRush's runtime-agnostic core:

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Platform                                    │
│                                                                      │
│  Node.js: http.createServer()                                        │
│  Bun: Bun.serve()                                                    │
│  Deno: Deno.serve()                                                  │
│  Edge: fetch handler                                                 │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Adapter                                      │
│                                                                      │
│  1. Receive platform request                                         │
│  2. Create Context object                                            │
│  3. Call app.callback()                                              │
│  4. Convert Context to platform response                             │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       @nextrush/core                                 │
│                                                                      │
│  Application.callback() → (ctx: Context) => Promise<void>            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## The Context Contract

Every adapter implements the `Context` interface from `@nextrush/types`:

```typescript
interface Context {
  // ===== Request (Read-Only) =====
  readonly method: HttpMethod;
  readonly path: string;
  readonly url: string;
  readonly query: Record<string, string>;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly ip: string;
  readonly runtime: Runtime;
  readonly raw: RawHttp;
  readonly bodySource: BodySource;

  // ===== Request (Mutable) =====
  body: unknown;
  params: Record<string, string>;
  state: Record<string, unknown>;

  // ===== Response =====
  status: number;
  json(data: unknown): void;
  send(data: string | Buffer | Stream): void;
  html(content: string): void;
  redirect(url: string, status?: number): void;
  set(field: string, value: string | number): void;
  get(field: string): string | undefined;

  // ===== Middleware =====
  next(): Promise<void>;
}
```

### Why a Contract?

The Context interface ensures:
- **Portability** — Same app code works on any runtime
- **Testability** — Mock contexts for testing
- **Consistency** — Predictable API across platforms

---

## Node.js Adapter

### Architecture

```typescript
// @nextrush/adapter-node

import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';

export function serve(app: Application, options: ServeOptions): ServerInstance {
  const handler = createHandler(app);

  const server = createServer((req, res) => {
    handler(req, res).catch((error) => {
      console.error('Unhandled error:', error);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    });
  });

  server.listen(options.port, options.hostname, options.callback);

  return { server, close: () => server.close() };
}

export function createHandler(app: Application) {
  const callback = app.callback();

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const ctx = new NodeContext(req, res);
    await callback(ctx);
  };
}
```

### NodeContext Implementation

```typescript
class NodeContext implements Context {
  readonly method: HttpMethod;
  readonly path: string;
  readonly url: string;
  readonly query: Record<string, string>;
  readonly headers: IncomingHeaders;
  readonly ip: string;
  readonly raw: { req: IncomingMessage; res: ServerResponse };
  readonly runtime: Runtime = 'node';
  readonly bodySource: BodySource;

  body: unknown = undefined;
  params: Record<string, string> = {};
  status: number = 200;
  state: Record<string, unknown> = {};

  constructor(req: IncomingMessage, res: ServerResponse) {
    this.raw = { req, res };
    this.method = req.method as HttpMethod;
    this.url = req.url ?? '/';

    // Parse path and query
    const questionIndex = this.url.indexOf('?');
    this.path = questionIndex !== -1 ? this.url.slice(0, questionIndex) : this.url;
    this.query = parseQueryString(this.url.slice(questionIndex + 1));

    this.headers = req.headers;
    this.ip = req.socket?.remoteAddress ?? '';
    this.bodySource = new NodeBodySource(req);
  }

  json(data: unknown): void {
    const buffer = Buffer.from(JSON.stringify(data));
    this.raw.res.statusCode = this.status;
    this.raw.res.setHeader('Content-Type', 'application/json');
    this.raw.res.setHeader('Content-Length', buffer.length);
    this.raw.res.end(buffer);
  }

  // ... other methods
}
```

---

## Bun Adapter

### Architecture

```typescript
// @nextrush/adapter-bun

export function serve(app: Application, options: ServeOptions) {
  const handler = createHandler(app);

  return Bun.serve({
    port: options.port,
    hostname: options.hostname,
    fetch: handler,
  });
}

export function createHandler(app: Application) {
  const callback = app.callback();

  return async (request: Request, server: Server): Promise<Response> => {
    const ctx = new BunContext(request, server);
    await callback(ctx);
    return ctx.getResponse();
  };
}
```

### BunContext Implementation

Bun uses Web APIs (Request/Response), so the implementation differs:

```typescript
class BunContext implements Context {
  readonly method: HttpMethod;
  readonly path: string;
  readonly url: string;
  readonly query: Record<string, string>;
  readonly headers: Record<string, string>;
  readonly ip: string;
  readonly raw: { request: Request; server: Server };
  readonly runtime: Runtime = 'bun';
  readonly bodySource: BodySource;

  private _response: Response | null = null;
  private _status = 200;
  private _headers = new Headers();
  private _body: BodyInit | null = null;

  constructor(request: Request, server: Server) {
    this.raw = { request, server };

    const url = new URL(request.url);
    this.method = request.method as HttpMethod;
    this.path = url.pathname;
    this.url = request.url;
    this.query = Object.fromEntries(url.searchParams);
    this.headers = Object.fromEntries(request.headers);
    this.ip = server.requestIP(request)?.address ?? '';
    this.bodySource = new WebBodySource(request);
  }

  json(data: unknown): void {
    this._headers.set('Content-Type', 'application/json');
    this._body = JSON.stringify(data);
  }

  getResponse(): Response {
    return new Response(this._body, {
      status: this._status,
      headers: this._headers,
    });
  }
}
```

---

## Edge Adapter

### Architecture

Edge functions (Cloudflare Workers, Vercel Edge) use the Web standard Fetch API:

```typescript
// @nextrush/adapter-edge

export function createHandler(app: Application) {
  const callback = app.callback();

  return async (request: Request): Promise<Response> => {
    const ctx = new EdgeContext(request);
    await callback(ctx);
    return ctx.getResponse();
  };
}

// Usage in Cloudflare Worker
export default {
  fetch: createHandler(app)
};

// Usage in Vercel Edge
export const config = { runtime: 'edge' };
export default createHandler(app);
```

### EdgeContext Implementation

Edge contexts are similar to Bun but with limitations:

```typescript
class EdgeContext implements Context {
  readonly runtime: Runtime = 'edge';
  readonly raw: { request: Request };

  // No access to:
  // - File system
  // - Long-running connections (limited)
  // - Some Node.js APIs

  constructor(request: Request) {
    // Similar to BunContext, uses Web APIs
  }
}
```

---

## Body Source Abstraction

### The Problem

Different runtimes handle request bodies differently:

- **Node.js**: `IncomingMessage` (stream)
- **Bun/Deno/Edge**: `Request.body` (ReadableStream)

### The Solution: BodySource

```typescript
interface BodySource {
  /** Read body as text */
  text(): Promise<string>;

  /** Read body as JSON */
  json<T = unknown>(): Promise<T>;

  /** Read body as bytes */
  buffer(): Promise<Uint8Array>;

  /** Get body as stream */
  stream(): ReadableStream<Uint8Array>;

  /** Content-Type header */
  readonly contentType: string | undefined;

  /** Content-Length header */
  readonly contentLength: number | undefined;

  /** Whether body has been consumed */
  readonly consumed: boolean;
}
```

### Node.js BodySource

```typescript
class NodeBodySource implements BodySource {
  private _buffer: Buffer | null = null;
  private _consumed = false;

  constructor(private req: IncomingMessage) {}

  async buffer(): Promise<Uint8Array> {
    if (this._consumed) {
      throw new BodyConsumedError();
    }

    const chunks: Buffer[] = [];
    for await (const chunk of this.req) {
      chunks.push(chunk);
    }

    this._buffer = Buffer.concat(chunks);
    this._consumed = true;
    return this._buffer;
  }

  async text(): Promise<string> {
    const buffer = await this.buffer();
    return buffer.toString('utf-8');
  }

  async json<T>(): Promise<T> {
    const text = await this.text();
    return JSON.parse(text);
  }
}
```

### Web BodySource (Bun/Deno/Edge)

```typescript
class WebBodySource implements BodySource {
  constructor(private request: Request) {}

  async buffer(): Promise<Uint8Array> {
    const arrayBuffer = await this.request.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  async text(): Promise<string> {
    return this.request.text();
  }

  async json<T>(): Promise<T> {
    return this.request.json();
  }

  stream(): ReadableStream<Uint8Array> {
    return this.request.body!;
  }
}
```

---

## Raw Platform Access

### Escape Hatch

When you need platform-specific features:

```typescript
app.get('/stream', async (ctx) => {
  // Access raw Node.js response
  if (ctx.runtime === 'node') {
    const res = ctx.raw.res as ServerResponse;
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    // ... SSE implementation
  }
});
```

### Type-Safe Raw Access

```typescript
interface RawHttp<TReq = unknown, TRes = unknown> {
  req?: TReq;
  res?: TRes;
  request?: Request;
  server?: unknown;
}

// Node.js
ctx.raw.req  // IncomingMessage
ctx.raw.res  // ServerResponse

// Bun
ctx.raw.request  // Request
ctx.raw.server   // Server

// Edge
ctx.raw.request  // Request
```

---

## Runtime Detection

### At Context Level

```typescript
app.use(async (ctx) => {
  switch (ctx.runtime) {
    case 'node':
      // Node.js specific
      break;
    case 'bun':
      // Bun specific
      break;
    case 'deno':
      // Deno specific
      break;
    case 'cloudflare-workers':
    case 'vercel-edge':
    case 'edge':
      // Edge runtime
      break;
  }
});
```

### Via Runtime Package

```typescript
import { getRuntime, getRuntimeCapabilities } from '@nextrush/runtime';

const runtime = getRuntime();
const caps = getRuntimeCapabilities();

if (caps.fileSystem) {
  // Can use file system APIs
}

if (caps.webStreams) {
  // Can use Web Streams API
}
```

---

## Adapter Development

### Creating a Custom Adapter

```typescript
import type { Application, Context } from '@nextrush/core';

// 1. Implement Context
class MyContext implements Context {
  readonly method: HttpMethod;
  readonly path: string;
  // ... implement all required properties and methods
}

// 2. Create handler factory
export function createHandler(app: Application) {
  const callback = app.callback();

  return async (platformRequest: PlatformRequest): Promise<PlatformResponse> => {
    const ctx = new MyContext(platformRequest);
    await callback(ctx);
    return ctx.getResponse();
  };
}

// 3. Create serve function
export function serve(app: Application, options: ServeOptions) {
  const handler = createHandler(app);
  // Start platform-specific server
}
```

### Adapter Checklist

- [ ] Implement all Context interface methods
- [ ] Parse URL, query string, headers correctly
- [ ] Implement BodySource for body reading
- [ ] Handle response methods (json, send, html, redirect)
- [ ] Support middleware `next()` chaining
- [ ] Provide raw platform access
- [ ] Set correct `runtime` value
- [ ] Handle errors gracefully
- [ ] Add tests for all functionality

---

## Performance Considerations

### Context Creation

Context creation happens per-request. Keep it fast:

```typescript
// ✅ Good: Lazy parsing
class NodeContext {
  private _query: Record<string, string> | null = null;

  get query(): Record<string, string> {
    if (this._query === null) {
      this._query = parseQueryString(this.url);
    }
    return this._query;
  }
}

// ❌ Bad: Eager parsing
class NodeContext {
  readonly query: Record<string, string>;

  constructor(req) {
    this.query = parseQueryString(req.url); // Always runs
  }
}
```

### Response Buffering

Avoid unnecessary buffering:

```typescript
// ✅ Good: Stream directly
ctx.send(readableStream);

// ❌ Bad: Buffer entire response
const data = await readEntireFile();
ctx.send(data);
```

---

## See Also

- [Runtime Compatibility](./runtime-compatibility) — Cross-runtime APIs
- [Core & Application](./core-application) — Middleware execution
- [Routing](./routing) — Route matching
