# NextRush v3 Runtime Compatibility Guide

> Complete guide to NextRush's multi-runtime architecture, ensuring your application runs seamlessly on Node.js, Bun, Deno, and Edge environments.

## Overview

NextRush v3 is designed from the ground up to be **runtime-agnostic**. Every package in the ecosystem follows a consistent pattern that ensures compatibility across all modern JavaScript runtimes.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Your Application                                    │
│                                                                             │
│    const app = createApp();                                                 │
│    app.use(cors());                                                         │
│    app.use(bodyParser());                                                   │
│    app.use(router.routes());                                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
            ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
            │  adapter-    │ │  adapter-    │ │  adapter-    │
            │  node        │ │  bun         │ │  edge        │
            │              │ │              │ │              │
            │  Uses:       │ │  Uses:       │ │  Uses:       │
            │  Node HTTP   │ │  Bun.serve   │ │  Web APIs    │
            │  Streams     │ │  Web APIs    │ │  Only        │
            └──────────────┘ └──────────────┘ └──────────────┘
                    │               │               │
                    └───────────────┼───────────────┘
                                    │
                                    ▼
            ┌─────────────────────────────────────────────────┐
            │               @nextrush/core                     │
            │                                                  │
            │  Runtime-Agnostic:                               │
            │  • Application class                             │
            │  • Middleware composition                        │
            │  • Plugin system                                 │
            │  • Error handling                                │
            │                                                  │
            │  Only depends on: @nextrush/types                │
            └─────────────────────────────────────────────────┘
```

---

## Runtime Support Matrix

| Feature | Node.js 20+ | Bun 1.0+ | Deno 2.0+ | Edge (CF/Vercel) |
|---------|:-----------:|:--------:|:---------:|:----------------:|
| **Core** | ✅ | ✅ | ✅ | ✅ |
| **Router** | ✅ | ✅ | ✅ | ✅ |
| **Body Parser** | ✅ | ✅ | ✅ | ✅ |
| **CORS** | ✅ | ✅ | ✅ | ✅ |
| **Helmet** | ✅ | ✅ | ✅ | ✅ |
| **Compression (gzip/deflate)** | ✅ | ✅ | ✅ | ✅ |
| **Compression (brotli)** | ✅ | ✅ | ⚠️ Limited | ❌ |
| **Rate Limit** | ✅ | ✅ | ✅ | ✅ |
| **Static Files** | ✅ | ✅ | ✅ | ❌ No filesystem |
| **WebSocket** | ✅ | ✅ | ✅ | ✅ |
| **DI (Decorators)** | ✅ | ✅ | ✅ | ✅ |

---

## Package Architecture

### Independence Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INDEPENDENT PACKAGES                               │
│  These packages work standalone without @nextrush/core                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  @nextrush/types      Zero dependencies - TypeScript types only             │
│  @nextrush/errors     Depends on: types                                     │
│  @nextrush/router     Depends on: types (core is OPTIONAL peer dep)         │
│  @nextrush/runtime    Depends on: types                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MIDDLEWARE PACKAGES                                │
│  All middleware works with ANY framework that provides Context interface     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  @nextrush/body-parser    Uses: ctx.bodySource (cross-runtime body reading) │
│  @nextrush/cors           Uses: ctx.headers, ctx.set(), ctx.method          │
│  @nextrush/helmet         Uses: ctx.set() only                              │
│  @nextrush/compression    Uses: Web Compression Streams API                 │
│  @nextrush/rate-limit     Uses: ctx.ip, ctx.state                           │
│  @nextrush/cookies        Uses: ctx.get(), ctx.set()                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INTEGRATION PACKAGES                               │
│  These connect independent packages into a cohesive framework                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  @nextrush/core           Application, middleware composition, plugins      │
│  @nextrush/di             Dependency injection (wraps tsyringe)             │
│  @nextrush/decorators     @Controller, @Get, @Body, @UseGuard               │
│  @nextrush/controllers    Connects DI + decorators + router                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              META PACKAGE                                    │
│  Combines all essential packages into one convenient import                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  nextrush                 Re-exports: core, router, types, errors           │
│                           Plus: adapter auto-detection                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## How Cross-Runtime Works

### 1. Context Interface (The Contract)

All adapters implement the same `Context` interface from `@nextrush/types`:

```typescript
interface Context {
  // Request (READ)
  readonly method: HttpMethod;
  readonly path: string;
  readonly url: string;
  readonly query: QueryParams;
  readonly headers: IncomingHeaders;
  readonly ip: string;
  body: unknown;
  params: RouteParams;

  // Response (WRITE)
  status: number;
  json(data: unknown): void;
  send(data: ResponseBody): void;
  html(content: string): void;
  redirect(url: string, status?: number): void;
  set(field: string, value: string | number): void;
  get(field: string): string | undefined;

  // Middleware
  next(): Promise<void>;
  state: ContextState;

  // Cross-Runtime Body Reading
  readonly bodySource: BodySource;
  readonly runtime: Runtime;

  // Platform Escape Hatch
  readonly raw: RawHttp;
}
```

### 2. BodySource (Cross-Runtime Body Reading)

The `bodySource` property provides unified body reading across all runtimes:

```typescript
interface BodySource {
  /** Read body as text */
  text(): Promise<string>;

  /** Read body as JSON */
  json<T = unknown>(): Promise<T>;

  /** Read body as Uint8Array */
  buffer(): Promise<Uint8Array>;

  /** Get body as ReadableStream */
  stream(): ReadableStream<Uint8Array>;

  /** Content-Type header value */
  readonly contentType: string | undefined;

  /** Content-Length header value */
  readonly contentLength: number | undefined;

  /** Whether body has been consumed */
  readonly consumed: boolean;
}
```

**Usage in middleware:**

```typescript
// This works on ANY runtime!
export function json(options?: JsonOptions): Middleware {
  return async (ctx) => {
    if (ctx.method === 'GET' || ctx.method === 'HEAD') {
      return ctx.next();
    }

    // Uses cross-runtime bodySource API
    const buffer = await ctx.bodySource.buffer();
    const text = new TextDecoder().decode(buffer);
    ctx.body = JSON.parse(text);

    await ctx.next();
  };
}
```

### 3. Runtime Detection

The `@nextrush/runtime` package detects the current runtime:

```typescript
import { getRuntime, getRuntimeCapabilities } from '@nextrush/runtime';

const runtime = getRuntime();
// Returns: 'node' | 'bun' | 'deno' | 'cloudflare-workers' | 'vercel-edge' | 'edge'

const caps = getRuntimeCapabilities();
// Returns: {
//   nodeStreams: boolean,
//   webStreams: boolean,
//   fileSystem: boolean,
//   webSocket: boolean,
//   fetch: boolean,
//   cryptoSubtle: boolean,
//   workers: boolean
// }
```

---

## Adapter Implementation Pattern

Each adapter follows the same pattern:

```typescript
// 1. Import core (type-only dependency)
import type { Application } from '@nextrush/core';

// 2. Create runtime-specific context
function createContext(platformRequest: PlatformRequest): Context {
  return new RuntimeContext(platformRequest);
}

// 3. Create handler that bridges platform to core
function createHandler(app: Application) {
  const handler = app.callback();

  return async (platformRequest: PlatformRequest) => {
    const ctx = createContext(platformRequest);
    await handler(ctx);
    return ctx.getResponse();
  };
}

// 4. Provide serve() function
export function serve(app: Application, options: ServeOptions) {
  const handler = createHandler(app);
  // Start platform-specific server
}
```

### Node.js Adapter

```typescript
import { createServer } from 'node:http';

export function serve(app: Application, options: ServeOptions) {
  const handler = createHandler(app);
  const server = createServer((req, res) => handler(req, res));
  server.listen(options.port);
}
```

### Bun Adapter

```typescript
export function serve(app: Application, options: ServeOptions) {
  const handler = createHandler(app);

  Bun.serve({
    port: options.port,
    fetch: (request, server) => handler(request, server),
  });
}
```

### Edge Adapter

```typescript
export function createHandler(app: Application) {
  const handler = app.callback();

  return async (request: Request) => {
    const ctx = new EdgeContext(request);
    await handler(ctx);
    return ctx.getResponse();
  };
}

// Usage in Cloudflare Worker
export default {
  fetch: createHandler(app)
};
```

---

## Middleware Runtime Compatibility

### Body Parser

Uses `ctx.bodySource` which is implemented by all adapters:

```typescript
// Works on: Node.js, Bun, Deno, Edge
export async function readBody(ctx: Context, limit: number): Promise<Buffer> {
  if (ctx.bodySource) {
    // Modern cross-runtime path
    const uint8Array = await ctx.bodySource.buffer();
    return Buffer.from(uint8Array);
  }

  // Legacy Node.js fallback
  if (ctx.raw?.req) {
    return readFromNodeStream(ctx.raw.req, limit);
  }

  return Buffer.alloc(0);
}
```

### CORS

Pure header manipulation - works everywhere:

```typescript
// Works on: Node.js, Bun, Deno, Edge
export function cors(options?: CorsOptions): Middleware {
  return async (ctx) => {
    const origin = ctx.get('origin');

    if (isAllowed(origin, options)) {
      ctx.set('Access-Control-Allow-Origin', origin);
      ctx.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE');
    }

    if (ctx.method === 'OPTIONS') {
      ctx.status = 204;
      return;
    }

    await ctx.next();
  };
}
```

### Helmet

Pure header manipulation - works everywhere:

```typescript
// Works on: Node.js, Bun, Deno, Edge
export function helmet(options?: HelmetOptions): Middleware {
  return async (ctx) => {
    ctx.set('X-Content-Type-Options', 'nosniff');
    ctx.set('X-Frame-Options', 'SAMEORIGIN');
    ctx.set('X-XSS-Protection', '0');
    // ... more security headers

    await ctx.next();
  };
}
```

### Compression

Uses Web Compression Streams API with Node.js zlib fallback:

```typescript
// Works on: Node.js (full), Bun (full), Deno (gzip/deflate), Edge (gzip/deflate)
export async function compress(data: Uint8Array, encoding: string) {
  const caps = detectCapabilities();

  if (encoding === 'br' && caps.hasBrotli) {
    // Node.js/Bun: Use native brotli
    return compressWithNodeZlib(data, 'br');
  }

  if (caps.hasCompressionStreams) {
    // All runtimes: Use Web Compression Streams
    return compressWithWebStreams(data, encoding);
  }

  if (caps.hasNodeZlib) {
    // Node.js fallback
    return compressWithNodeZlib(data, encoding);
  }

  throw new Error(`Encoding ${encoding} not supported`);
}
```

---

## Test Coverage by Package

| Package | Tests | Runtime Coverage |
|---------|-------|------------------|
| @nextrush/core | 52 | All (runtime-agnostic) |
| @nextrush/router | 95 | All (runtime-agnostic) |
| @nextrush/runtime | 45 | Node.js (tests others via mocking) |
| @nextrush/adapter-node | 60 | Node.js |
| @nextrush/adapter-bun | 102 | Node.js (Bun APIs mocked) |
| @nextrush/adapter-deno | 101 | Node.js (Deno APIs mocked) |
| @nextrush/adapter-edge | 106 | Node.js (Web APIs used) |
| @nextrush/body-parser | 124 | All (uses bodySource) |
| @nextrush/cors | 57 | All (header-only) |
| @nextrush/helmet | 64 | All (header-only) |
| @nextrush/compression | 151 | All (Web Streams + zlib) |
| **Total** | **957** | |

---

## Best Practices

### 1. Use Cross-Runtime APIs

```typescript
// ✅ Good: Uses cross-runtime bodySource
const body = await ctx.bodySource.json();

// ❌ Avoid: Node.js specific
const body = await readNodeStream(ctx.raw.req);
```

### 2. Check Runtime Capabilities

```typescript
import { getRuntimeCapabilities } from '@nextrush/runtime';

const caps = getRuntimeCapabilities();

if (caps.fileSystem) {
  // Safe to use file operations
  await serveStaticFiles(ctx);
} else {
  // Edge runtime - use KV or R2 instead
  await serveFromStorage(ctx);
}
```

### 3. Use Type-Only Core Imports

```typescript
// ✅ Good: Type-only import, no runtime dependency
import type { Application } from '@nextrush/core';

// ❌ Avoid: Creates runtime dependency
import { Application } from '@nextrush/core';
```

### 4. Handle Missing Features Gracefully

```typescript
export function compression(options?: Options): Middleware {
  return async (ctx) => {
    const encoding = negotiateEncoding(ctx);

    if (!encoding || !isEncodingSupported(encoding)) {
      // No compression available - continue without error
      return ctx.next();
    }

    // Compress response...
  };
}
```

---

## Deployment Examples

### Node.js

```typescript
import { createApp } from '@nextrush/core';
import { serve } from '@nextrush/adapter-node';

const app = createApp();
// ... configure app

await serve(app, { port: 3000 });
```

### Bun

```typescript
import { createApp } from '@nextrush/core';
import { serve } from '@nextrush/adapter-bun';

const app = createApp();
// ... configure app

serve(app, { port: 3000 });
```

### Deno

```typescript
import { createApp } from '@nextrush/core';
import { serve } from '@nextrush/adapter-deno';

const app = createApp();
// ... configure app

await serve(app, { port: 3000 });
```

### Cloudflare Workers

```typescript
import { createApp } from '@nextrush/core';
import { createHandler } from '@nextrush/adapter-edge';

const app = createApp();
// ... configure app

export default {
  fetch: createHandler(app)
};
```

### Vercel Edge Functions

```typescript
import { createApp } from '@nextrush/core';
import { createHandler } from '@nextrush/adapter-edge';

const app = createApp();
// ... configure app

export const config = { runtime: 'edge' };
export default createHandler(app);
```

---

## Summary

NextRush v3's runtime compatibility is achieved through:

1. **Contract-based design**: `Context` interface defines the API contract
2. **Adapter pattern**: Each runtime has an adapter that implements Context
3. **Cross-runtime abstractions**: `BodySource` for body reading, Web APIs where possible
4. **Graceful degradation**: Features check runtime capabilities and adapt
5. **Comprehensive testing**: 957 tests ensure behavior consistency

The result: **Write once, run anywhere** - from traditional Node.js servers to edge functions.
