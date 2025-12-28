# RFC-0004: NextRush v3 Adapter Architecture

> Multi-Runtime Support Strategy for Node.js, Bun, Deno, and Edge Environments

**Status:** Draft
**Created:** 2024-12-28
**Authors:** NextRush Core Team

---

## Executive Summary

This RFC defines the adapter architecture for NextRush v3, enabling the framework to run on **Node.js, Bun, Deno, Cloudflare Workers, and other JavaScript runtimes** with minimal code changes.

The key insight: **The Context interface is the boundary between framework and runtime.**

```
┌─────────────────────────────────────────────────────────────────┐
│                     Application Layer                           │
│   @nextrush/core, @nextrush/router, @nextrush/body-parser       │
│   Middleware, Plugins, User Code                                │
├─────────────────────────────────────────────────────────────────┤
│                     Context Interface                           │
│   ctx.method, ctx.path, ctx.body, ctx.json(), ctx.send()        │
│   ctx.raw ← Runtime-specific escape hatch                       │
├─────────────────────────────────────────────────────────────────┤
│                     Adapter Layer                               │
│   @nextrush/adapter-node                                        │
│   @nextrush/adapter-bun                                         │
│   @nextrush/adapter-deno                                        │
│   @nextrush/adapter-edge                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Problem Statement

### Current State

NextRush v3 currently only supports Node.js via `@nextrush/adapter-node`. The Context implementation is tightly coupled to Node.js's `IncomingMessage` and `ServerResponse`.

### Challenges

1. **Runtime Fragmentation**
   - Bun uses `Bun.serve()` with `Request`/`Response` (Web API)
   - Deno uses `Deno.serve()` with Web Fetch API
   - Cloudflare Workers use `fetch()` handler with `Request`/`Response`
   - Each has different stream APIs, header handling, and performance characteristics

2. **Middleware Compatibility**
   - `@nextrush/body-parser` accesses `ctx.raw.req.on('data', ...)` for Node.js streams
   - Web API runtimes use `Request.body` (ReadableStream)
   - Without abstraction, every middleware needs runtime-specific code

3. **Performance Overhead**
   - Abstractions can add overhead
   - Each runtime has different performance characteristics
   - We need zero-cost abstractions where possible

---

## Goals

1. **Single API, Multiple Runtimes** - Write middleware once, run everywhere
2. **Type-Safe Escape Hatches** - Access runtime-specific APIs when needed
3. **Zero-Cost Abstractions** - No performance penalty for common operations
4. **Incremental Adoption** - Adapters can be added without changing core

---

## Architecture Design

### Layer 1: Core Framework (Runtime-Agnostic)

These packages have **zero runtime-specific code**:

| Package | Purpose | Runtime Dependency |
|---------|---------|-------------------|
| `@nextrush/types` | Type definitions | None |
| `@nextrush/core` | Application, middleware composition | None |
| `@nextrush/router` | URL routing, param extraction | None |
| `@nextrush/errors` | Error classes | None |

### Layer 2: Context Interface

The `Context` interface is the **contract** between application code and adapters:

```typescript
// @nextrush/types/src/context.ts

export interface Context {
  // Input (Request)
  readonly method: HttpMethod;
  readonly path: string;
  readonly url: string;
  readonly query: QueryParams;
  readonly headers: IncomingHeaders;
  readonly ip: string;

  // State
  body: unknown;
  params: RouteParams;
  status: number;
  state: ContextState;

  // Output (Response)
  json(data: unknown): void;
  send(data: ResponseBody): void;
  html(content: string): void;
  redirect(url: string, status?: number): void;

  // Headers
  set(field: string, value: string | number): void;
  get(field: string): string | undefined;

  // Middleware
  next(): Promise<void>;

  // Escape Hatch
  readonly raw: RawHttp;
}
```

### Layer 3: Adapter Implementations

Each adapter implements the Context interface for its runtime:

```
packages/adapters/
├── node/         @nextrush/adapter-node
├── bun/          @nextrush/adapter-bun
├── deno/         @nextrush/adapter-deno
├── edge/         @nextrush/adapter-edge
└── universal/    @nextrush/adapter-universal  (Web Fetch API)
```

---

## Type-Safe Raw Access

### The `ctx.raw` Design

The `raw` property provides type-safe access to runtime-specific objects:

```typescript
// @nextrush/types/src/http.ts

/**
 * Raw HTTP objects - runtime-specific escape hatch
 *
 * Generic types allow each adapter to specify its native types
 */
export interface RawHttp<TRequest = unknown, TResponse = unknown> {
  req: TRequest;
  res: TResponse;
}
```

### Per-Adapter Types

```typescript
// @nextrush/adapter-node
import type { IncomingMessage, ServerResponse } from 'node:http';

export type NodeRawHttp = RawHttp<IncomingMessage, ServerResponse>;

export interface NodeContext extends Context {
  readonly raw: NodeRawHttp;
}
```

```typescript
// @nextrush/adapter-bun
export type BunRawHttp = RawHttp<Request, { respond: (response: Response) => void }>;

export interface BunContext extends Context {
  readonly raw: BunRawHttp;
}
```

```typescript
// @nextrush/adapter-edge
export type EdgeRawHttp = RawHttp<Request, undefined>;

export interface EdgeContext extends Context {
  readonly raw: EdgeRawHttp;
}
```

---

## Middleware Compatibility Strategy

### Problem: Body Parser Access

The body parser needs to read request body streams. Different runtimes have different APIs:

```typescript
// Node.js
ctx.raw.req.on('data', (chunk: Buffer) => { ... });
ctx.raw.req.on('end', () => { ... });

// Web API (Bun, Deno, Edge)
const body = await ctx.raw.req.body?.getReader().read();
// or
const body = await ctx.raw.req.text();
```

### Solution: Body Source Abstraction

Create a minimal abstraction that adapters implement:

```typescript
// @nextrush/types/src/body.ts

/**
 * Body source interface - abstracts body reading across runtimes
 */
export interface BodySource {
  /**
   * Read body as text
   */
  text(): Promise<string>;

  /**
   * Read body as Buffer/Uint8Array
   */
  buffer(): Promise<Uint8Array>;

  /**
   * Read body as stream (if needed)
   */
  stream(): ReadableStream<Uint8Array> | NodeJS.ReadableStream;

  /**
   * Check if body has been read
   */
  readonly consumed: boolean;
}
```

### Adapter Implementations

```typescript
// @nextrush/adapter-node/src/body-source.ts
export class NodeBodySource implements BodySource {
  constructor(private req: IncomingMessage) {}

  async text(): Promise<string> {
    const buffer = await this.buffer();
    return new TextDecoder().decode(buffer);
  }

  async buffer(): Promise<Uint8Array> {
    const chunks: Buffer[] = [];
    for await (const chunk of this.req) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  stream() {
    return this.req;
  }
}
```

```typescript
// @nextrush/adapter-bun/src/body-source.ts
export class BunBodySource implements BodySource {
  constructor(private request: Request) {}

  text(): Promise<string> {
    return this.request.text();
  }

  buffer(): Promise<Uint8Array> {
    return this.request.arrayBuffer().then(ab => new Uint8Array(ab));
  }

  stream() {
    return this.request.body;
  }
}
```

### Updated Context Interface

```typescript
export interface Context {
  // ... existing properties ...

  /**
   * Body source for middleware that needs raw body access
   * @internal Used by body parsers
   */
  readonly bodySource: BodySource;
}
```

### Updated Body Parser

```typescript
// @nextrush/body-parser - now runtime-agnostic

async function readBody(ctx: Context, limit: number): Promise<Buffer> {
  // Check Content-Length first
  const contentLength = getContentLength(ctx.headers);
  if (contentLength && contentLength > limit) {
    throw Errors.entityTooLarge(contentLength, limit);
  }

  // Use bodySource abstraction - works on all runtimes
  const buffer = await ctx.bodySource.buffer();

  if (buffer.length > limit) {
    throw Errors.entityTooLargeStreaming(limit);
  }

  return Buffer.from(buffer);
}
```

---

## Runtime Detection

### Automatic Detection

```typescript
// @nextrush/core/src/runtime.ts

export type Runtime =
  | 'node'
  | 'bun'
  | 'deno'
  | 'cloudflare-workers'
  | 'edge'
  | 'unknown';

/**
 * Detect the current JavaScript runtime
 */
export function detectRuntime(): Runtime {
  // Bun
  if (typeof globalThis.Bun !== 'undefined') {
    return 'bun';
  }

  // Deno
  if (typeof globalThis.Deno !== 'undefined') {
    return 'deno';
  }

  // Cloudflare Workers
  if (
    typeof globalThis.caches !== 'undefined' &&
    typeof globalThis.navigator?.userAgent === 'string' &&
    globalThis.navigator.userAgent.includes('Cloudflare-Workers')
  ) {
    return 'cloudflare-workers';
  }

  // Node.js
  if (
    typeof process !== 'undefined' &&
    typeof process.versions?.node === 'string'
  ) {
    return 'node';
  }

  // Edge (generic Web API runtime)
  if (typeof globalThis.Request !== 'undefined') {
    return 'edge';
  }

  return 'unknown';
}

// Cache the result
let _runtime: Runtime | undefined;

export function getRuntime(): Runtime {
  if (_runtime === undefined) {
    _runtime = detectRuntime();
  }
  return _runtime;
}
```

### Exposing Runtime in Context

```typescript
export interface Context {
  // ... existing properties ...

  /**
   * Current JavaScript runtime
   * @example 'node', 'bun', 'deno', 'cloudflare-workers'
   */
  readonly runtime: Runtime;
}
```

---

## Adapter Package Structure

### @nextrush/adapter-node (Current)

```
packages/adapters/node/
├── src/
│   ├── index.ts
│   ├── adapter.ts        # serve(), createHandler()
│   ├── context.ts        # NodeContext class
│   ├── body-source.ts    # NodeBodySource
│   └── utils.ts          # parseQueryString, etc.
├── package.json
└── README.md
```

### @nextrush/adapter-bun (Planned)

```
packages/adapters/bun/
├── src/
│   ├── index.ts
│   ├── adapter.ts        # Bun.serve() integration
│   ├── context.ts        # BunContext class
│   └── body-source.ts    # BunBodySource
├── package.json
└── README.md
```

```typescript
// @nextrush/adapter-bun/src/adapter.ts

import type { Application } from '@nextrush/core';
import { BunContext } from './context';

export interface BunServeOptions {
  port?: number;
  hostname?: string;
}

export function serve(app: Application, options: BunServeOptions = {}) {
  const handler = app.callback();

  return Bun.serve({
    port: options.port ?? 3000,
    hostname: options.hostname ?? '0.0.0.0',

    async fetch(request: Request): Promise<Response> {
      const ctx = new BunContext(request);

      await handler(ctx);

      // BunContext builds Response internally
      return ctx.getResponse();
    },
  });
}
```

### @nextrush/adapter-deno (Planned)

```typescript
// @nextrush/adapter-deno/src/adapter.ts

import type { Application } from '@nextrush/core';
import { DenoContext } from './context';

export interface DenoServeOptions {
  port?: number;
  hostname?: string;
}

export function serve(app: Application, options: DenoServeOptions = {}) {
  const handler = app.callback();

  return Deno.serve(
    {
      port: options.port ?? 3000,
      hostname: options.hostname ?? '0.0.0.0',
    },
    async (request: Request): Promise<Response> => {
      const ctx = new DenoContext(request);

      await handler(ctx);

      return ctx.getResponse();
    }
  );
}
```

### @nextrush/adapter-edge (Planned)

Generic Web Fetch API adapter for Cloudflare Workers, Vercel Edge, etc:

```typescript
// @nextrush/adapter-edge/src/adapter.ts

import type { Application } from '@nextrush/core';
import { EdgeContext } from './context';

/**
 * Create a fetch handler for edge environments
 */
export function createFetchHandler(app: Application) {
  const handler = app.callback();

  return async (request: Request): Promise<Response> => {
    const ctx = new EdgeContext(request);

    await handler(ctx);

    return ctx.getResponse();
  };
}

// Cloudflare Workers usage:
// export default { fetch: createFetchHandler(app) };

// Vercel Edge usage:
// export const config = { runtime: 'edge' };
// export default createFetchHandler(app);
```

---

## Package Compatibility Matrix

### Core Packages (All Runtimes)

| Package | Node.js | Bun | Deno | Edge |
|---------|---------|-----|------|------|
| `@nextrush/types` | ✅ | ✅ | ✅ | ✅ |
| `@nextrush/core` | ✅ | ✅ | ✅ | ✅ |
| `@nextrush/router` | ✅ | ✅ | ✅ | ✅ |
| `@nextrush/errors` | ✅ | ✅ | ✅ | ✅ |

### Middleware Packages

| Package | Node.js | Bun | Deno | Edge | Notes |
|---------|---------|-----|------|------|-------|
| `@nextrush/body-parser` | ✅ | ✅ | ✅ | ✅ | Uses BodySource |
| `@nextrush/cors` | ✅ | ✅ | ✅ | ✅ | Headers only |
| `@nextrush/helmet` | ✅ | ✅ | ✅ | ✅ | Headers only |
| `@nextrush/rate-limit` | ⚠️ | ⚠️ | ⚠️ | ⚠️ | Needs storage adapter |
| `@nextrush/compression` | ✅ | ⚠️ | ⚠️ | ❌ | Stream-dependent |
| `@nextrush/cookies` | ✅ | ✅ | ✅ | ✅ | Headers only |
| `@nextrush/request-id` | ✅ | ✅ | ✅ | ✅ | Headers only |
| `@nextrush/timer` | ✅ | ✅ | ✅ | ✅ | Performance API |

### Adapters

| Package | Node.js | Bun | Deno | Edge |
|---------|---------|-----|------|------|
| `@nextrush/adapter-node` | ✅ | ❌ | ❌ | ❌ |
| `@nextrush/adapter-bun` | ❌ | ✅ | ❌ | ❌ |
| `@nextrush/adapter-deno` | ❌ | ❌ | ✅ | ❌ |
| `@nextrush/adapter-edge` | ❌ | ❌ | ❌ | ✅ |

### Plugins

| Package | Node.js | Bun | Deno | Edge | Notes |
|---------|---------|-----|------|------|-------|
| `@nextrush/logger` | ✅ | ✅ | ✅ | ⚠️ | Console-based |
| `@nextrush/static` | ✅ | ✅ | ✅ | ❌ | Filesystem required |
| `@nextrush/websocket` | ✅ | ✅ | ✅ | ⚠️ | Adapter-dependent |
| `@nextrush/template` | ✅ | ✅ | ✅ | ✅ | String-based |

Legend:
- ✅ Fully supported
- ⚠️ Partial support / needs adapter
- ❌ Not supported

---

## Migration Path

### Phase 1: Current State (Shipped)

```typescript
import { createApp } from '@nextrush/core';
import { serve } from '@nextrush/adapter-node';
import { json } from '@nextrush/body-parser';

const app = createApp();
app.use(json());
app.use((ctx) => ctx.json({ hello: 'world' }));

await serve(app, { port: 3000 });
```

### Phase 2: Add BodySource (Next)

1. Add `BodySource` interface to `@nextrush/types`
2. Implement `NodeBodySource` in `@nextrush/adapter-node`
3. Update `@nextrush/body-parser` to use `ctx.bodySource`
4. Maintain backward compatibility with `ctx.raw.req`

### Phase 3: Add Runtime Detection

1. Add `detectRuntime()` to `@nextrush/core`
2. Expose `ctx.runtime` in Context
3. Add runtime checks to packages that need them

### Phase 4: Bun Adapter

1. Create `@nextrush/adapter-bun`
2. Implement `BunContext`, `BunBodySource`
3. Test all core middleware
4. Update documentation

### Phase 5: Deno & Edge Adapters

1. Create remaining adapters
2. Test cross-runtime compatibility
3. Update compatibility matrix
4. Add Edge runtime examples

---

## API Examples

### Universal Code (Works on All Runtimes)

```typescript
// app.ts - runs everywhere
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { json } from '@nextrush/body-parser';
import { cors } from '@nextrush/cors';

const app = createApp();
const router = createRouter();

app.use(cors());
app.use(json());

router.get('/health', (ctx) => {
  ctx.json({
    status: 'healthy',
    runtime: ctx.runtime
  });
});

router.post('/users', async (ctx) => {
  const { name, email } = ctx.body as { name: string; email: string };
  ctx.status = 201;
  ctx.json({ id: Date.now(), name, email });
});

app.use(router.routes());

export { app };
```

```typescript
// server-node.ts
import { serve } from '@nextrush/adapter-node';
import { app } from './app';

await serve(app, { port: 3000 });
```

```typescript
// server-bun.ts
import { serve } from '@nextrush/adapter-bun';
import { app } from './app';

serve(app, { port: 3000 });
```

```typescript
// server-edge.ts (Cloudflare Workers)
import { createFetchHandler } from '@nextrush/adapter-edge';
import { app } from './app';

export default {
  fetch: createFetchHandler(app)
};
```

### Runtime-Specific Code

```typescript
// Use runtime detection for conditional logic
app.use(async (ctx) => {
  if (ctx.runtime === 'node') {
    // Node.js specific: access raw IncomingMessage
    const socket = ctx.raw.req.socket;
    console.log('Connection from:', socket.remoteAddress);
  } else if (ctx.runtime === 'bun') {
    // Bun specific
    console.log('Running on Bun:', Bun.version);
  }

  await ctx.next();
});
```

---

## Performance Considerations

### Zero-Cost for Common Operations

Most operations should have zero overhead compared to native API:

```typescript
// These should be direct property access, not abstracted
ctx.method    // Direct property
ctx.path      // Direct property
ctx.headers   // Direct property
ctx.status    // Direct property assignment

// These can have minimal overhead
ctx.json(data)  // One function call to native response API
ctx.send(data)  // One function call to native response API
```

### Benchmarks Target

| Operation | Target Overhead |
|-----------|----------------|
| Property access | 0% |
| `ctx.json()` | <1% |
| `ctx.send()` | <1% |
| Body reading | <5% |
| Full request | <5% |

---

## Open Questions

1. **Should adapters auto-detect runtime?**
   - Pro: Single import works everywhere
   - Con: Bundle size, complexity
   - Decision: Keep separate adapters, add `@nextrush/universal` for auto-detection

2. **How to handle streaming responses?**
   - Node.js: `res.write()` chunks
   - Web API: `ReadableStream` in Response
   - Decision: Add `ctx.stream()` method with adapter-specific implementation

3. **WebSocket support?**
   - Each runtime has different WebSocket APIs
   - Decision: Create `@nextrush/websocket` with adapter plugins

4. **File uploads?**
   - Multipart parsing is complex and different per runtime
   - Decision: Create `@nextrush/multipart` with BodySource integration

---

## Implementation Timeline

| Phase | Target | Packages |
|-------|--------|----------|
| Phase 1 | Shipped | `@nextrush/adapter-node` |
| Phase 2 | v3.0.0-alpha.2 | BodySource abstraction |
| Phase 3 | v3.0.0-alpha.3 | Runtime detection |
| Phase 4 | v3.0.0-beta.1 | `@nextrush/adapter-bun` |
| Phase 5 | v3.0.0-beta.2 | `@nextrush/adapter-deno`, `@nextrush/adapter-edge` |
| Phase 6 | v3.0.0 | Full compatibility testing |

---

## Conclusion

The adapter architecture enables NextRush to be a **truly universal JavaScript framework** while maintaining:

- **Type safety** through generic raw types
- **Performance** through zero-cost abstractions
- **Flexibility** through escape hatches
- **Simplicity** for application developers

The key principle: **Write your application once, deploy anywhere.**

---

## References

- [Hono Multi-Runtime Support](https://hono.dev/concepts/stacks)
- [Bun.serve() API](https://bun.sh/docs/api/http)
- [Deno.serve() API](https://deno.land/api?s=Deno.serve)
- [Cloudflare Workers Fetch Handler](https://developers.cloudflare.com/workers/runtime-apis/handlers/fetch/)
- [Web Fetch API Specification](https://fetch.spec.whatwg.org/)
