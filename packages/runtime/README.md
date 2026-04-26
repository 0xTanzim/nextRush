# @nextrush/runtime

> Runtime detection and cross-runtime abstractions for NextRush

Detect the current JavaScript runtime and use unified abstractions that work across Node.js, Bun, Deno, Deno Deploy, and Edge environments.

## The Problem

JavaScript now runs everywhere:

```typescript
// Node.js - Uses IncomingMessage stream
req.on('data', (chunk) => { ... });

// Bun/Deno/Edge - Uses Web Request API
await request.text();
```

Writing framework code that works on all runtimes requires:

1. Runtime detection to know what environment you're in
2. Unified abstractions over platform-specific APIs

## The Solution

`@nextrush/runtime` provides both:

```typescript
import { getRuntime, type BodySource } from '@nextrush/runtime';

// 1. Detect runtime
const runtime = getRuntime();
// 'node' | 'bun' | 'deno' | 'deno-deploy' | 'cloudflare-workers'
// | 'vercel-edge' | 'edge' | 'unknown'

// 2. Use unified abstractions
async function parseBody(bodySource: BodySource) {
  const text = await bodySource.text(); // Works everywhere
  return JSON.parse(text);
}
```

## Installation

```bash
npm install @nextrush/runtime
# or
pnpm add @nextrush/runtime
# or
bun add @nextrush/runtime
```

## API Reference

### Runtime Detection

#### `detectRuntime(): Runtime`

Detect the current JavaScript runtime. Runs full detection logic each call.

```typescript
import { detectRuntime } from '@nextrush/runtime';

const runtime = detectRuntime();
// 'node' | 'bun' | 'deno' | 'deno-deploy' | 'cloudflare-workers'
// | 'vercel-edge' | 'edge' | 'unknown'
```

**Detection Order:**

1. **Bun** — has global `Bun` object
2. **Deno Deploy** — has global `Deno` object + `DENO_DEPLOYMENT_ID` env var
3. **Deno** — has global `Deno` object
4. **Cloudflare Workers** — `navigator.userAgent` contains `'Cloudflare-Workers'`
5. **Node.js** — has `process.versions.node`
6. **Vercel Edge** — has `process.env.VERCEL_REGION` (but NOT `process.versions.node`)
7. **Edge** — has `Request`/`Response` globals (generic Web API runtime)
8. **Unknown** — none of the above

#### `getRuntime(): Runtime`

Get the cached runtime identifier. More efficient for repeated calls.

```typescript
import { getRuntime } from '@nextrush/runtime';

// First call detects and caches
const runtime1 = getRuntime();

// Subsequent calls return cached value (no re-detection)
const runtime2 = getRuntime();
```

#### `getRuntimeVersion(): string | undefined`

Get the runtime version string.

```typescript
import { getRuntimeVersion } from '@nextrush/runtime';

console.log(getRuntimeVersion());
// Node.js: '20.10.0'
// Bun: '1.0.0'
// Deno: '1.38.0'
```

#### `getRuntimeCapabilities(): RuntimeCapabilities`

Check what features the current runtime supports.

```typescript
import { getRuntimeCapabilities } from '@nextrush/runtime';

const caps = getRuntimeCapabilities();

console.log(caps);
// {
//   nodeStreams: true,   // Supports Node.js streams
//   webStreams: true,    // Supports Web Streams API
//   fileSystem: true,    // Supports file system operations
//   webSocket: true,     // Supports WebSocket
//   fetch: true,         // Supports native fetch
//   cryptoSubtle: true,  // Supports crypto.subtle
//   workers: true        // Supports Worker threads
// }
```

#### `getRuntimeInfo(): RuntimeInfo`

Get complete runtime information in one call.

```typescript
import { getRuntimeInfo } from '@nextrush/runtime';

const info = getRuntimeInfo();
// {
//   runtime: 'node',
//   version: '20.10.0',
//   capabilities: { nodeStreams: true, ... }
// }
```

#### `detectEdgeRuntime(): EdgeRuntimeInfo`

Detect the specific edge runtime platform. Provides more granular information than `detectRuntime()` for edge runtimes. Result is cached.

```typescript
import { detectEdgeRuntime } from '@nextrush/runtime';

const edgeInfo = detectEdgeRuntime();
// {
//   runtime: 'cloudflare-workers',
//   isCloudflare: true,
//   isVercel: false,
//   isNetlify: false,
//   isGenericEdge: false,
// }
```

#### Runtime Check Helpers

```typescript
import { isNode, isBun, isDeno, isEdge, isRuntime } from '@nextrush/runtime';

if (isNode()) {
  // Node.js specific code
}

if (isBun()) {
  // Bun specific code
}

if (isDeno()) {
  // Deno specific code (does NOT match Deno Deploy)
}

if (isEdge()) {
  // Edge runtime (Cloudflare Workers, Vercel Edge, generic edge)
}

if (isRuntime('cloudflare-workers')) {
  // Specific runtime check
}

if (isRuntime('deno-deploy')) {
  // Deno Deploy specific code
}
```

### Query String Parsing

#### `parseQueryString(qs): QueryParams`

Secure query string parser. Uses `Object.create(null)` to prevent prototype pollution.
Enforces a maximum of 256 parameters and 2048 character query string length.
Rejects `__proto__`, `constructor`, and `prototype` keys.

```typescript
import { parseQueryString } from '@nextrush/runtime';

const params = parseQueryString('name=Alice&age=30&tag=a&tag=b');
// { name: 'Alice', age: '30', tag: ['a', 'b'] }
```

### Headers Utilities

#### `headersToRecord(headers): IncomingHeaders`

Convert a Web API `Headers` object to a plain record. Uses `Object.create(null)` to prevent prototype pollution. Multi-value headers are stored as `string[]`.

```typescript
import { headersToRecord } from '@nextrush/runtime';

const record = headersToRecord(request.headers);
```

#### `getClientIp(request, directIp, trustProxy): string`

Extract client IP from a Web API Request. When `trustProxy` is `false`, returns `directIp` only. When `true`, reads `X-Forwarded-For` (first entry) then `X-Real-IP`.

```typescript
import { getClientIp } from '@nextrush/runtime';

const ip = getClientIp(request, socketIp, true);
```

#### `getEdgeClientIp(request, trustProxy): string`

Extract client IP for Cloudflare-style edge runtimes. When `trustProxy` is `true`, checks `CF-Connecting-IP` first, then falls back to standard proxy headers.

```typescript
import { getEdgeClientIp } from '@nextrush/runtime';

const ip = getEdgeClientIp(request, true);
```

### Constants

#### `METHODS_WITHOUT_BODY`

`ReadonlySet<string>` containing HTTP methods that do not carry a request body: `GET`, `HEAD`, `OPTIONS`, `TRACE`.

DELETE is intentionally excluded — RFC 7231 §4.3.5 permits a body on DELETE.

```typescript
import { METHODS_WITHOUT_BODY } from '@nextrush/runtime';

if (METHODS_WITHOUT_BODY.has(ctx.method)) {
  // No body to parse
}
```

### BodySource Abstraction

The `BodySource` interface provides unified body reading across all runtimes.

#### Interface

```typescript
interface BodySource {
  text(): Promise<string>;
  buffer(): Promise<Uint8Array>;
  json<T = unknown>(): Promise<T>;
  stream(): NodeStreamLike | WebStreamLike;
  readonly consumed: boolean;
  readonly contentLength: number | undefined;
  readonly contentType: string | undefined;
}
```

#### `WebBodySource`

For Web API runtimes (Bun, Deno, Cloudflare Workers, Vercel Edge):

```typescript
import { WebBodySource } from '@nextrush/runtime';

const request = new Request('http://example.com', {
  method: 'POST',
  body: JSON.stringify({ hello: 'world' }),
  headers: { 'Content-Type': 'application/json' },
});

const bodySource = new WebBodySource(request);

const text = await bodySource.text(); // '{"hello":"world"}'
// or
const data = await bodySource.json(); // { hello: 'world' }
// or
const buffer = await bodySource.buffer(); // Uint8Array
```

With options:

```typescript
const bodySource = new WebBodySource(request, {
  limit: 512 * 1024,  // 512KB
  encoding: 'utf-8',
});
```

#### `createWebBodySource(request, options?)`

Factory function for `WebBodySource`:

```typescript
import { createWebBodySource } from '@nextrush/runtime';

const bodySource = createWebBodySource(request, { limit: 1024 * 1024 });
```

#### `EmptyBodySource`

For requests without a body (GET, HEAD, OPTIONS):

```typescript
import { EmptyBodySource, createEmptyBodySource } from '@nextrush/runtime';

const bodySource = new EmptyBodySource();
// or use the shared singleton:
const bodySource2 = createEmptyBodySource();

await bodySource.text();   // ''
await bodySource.buffer(); // Uint8Array(0)
await bodySource.json();   // throws BadRequestError (code: 'EMPTY_BODY_JSON')
```

#### `AbstractBodySource`

Base class for creating custom BodySource implementations:

```typescript
import { AbstractBodySource } from '@nextrush/runtime';
import type { IncomingMessage } from 'node:http';

export class NodeBodySource extends AbstractBodySource {
  private readonly req: IncomingMessage;

  constructor(req: IncomingMessage) {
    super(req.headers['content-length'], req.headers['content-type']);
    this.req = req;
  }

  protected async _buffer(): Promise<Uint8Array> {
    const chunks: Buffer[] = [];
    for await (const chunk of this.req) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  protected _stream() {
    return this.req;
  }
}
```

### Error Classes

#### `BodyConsumedError`

Thrown when attempting to read a body that has already been consumed. Extends `BadRequestError`.

```typescript
import { BodyConsumedError } from '@nextrush/runtime';

try {
  await bodySource.text();
  await bodySource.text(); // throws BodyConsumedError
} catch (error) {
  if (error instanceof BodyConsumedError) {
    // Body already read
  }
}
```

#### `BodyTooLargeError`

Thrown when body exceeds the size limit. Extends `PayloadTooLargeError`. Exposes `limit` and `received` properties.

```typescript
import { BodyTooLargeError, WebBodySource } from '@nextrush/runtime';

const bodySource = new WebBodySource(request, { limit: 1024 }); // 1KB limit

try {
  await bodySource.buffer();
} catch (error) {
  if (error instanceof BodyTooLargeError) {
    console.log(`Body too large: ${error.received} > ${error.limit}`);
  }
}
```

#### `DEFAULT_BODY_LIMIT`

Default body size limit constant: `1048576` (1MB).

```typescript
import { DEFAULT_BODY_LIMIT } from '@nextrush/runtime';
```

## Types

```typescript
import type {
  Runtime,
  RuntimeCapabilities,
  RuntimeInfo,
  BodySource,
  BodySourceOptions,
  EdgeRuntimeInfo,
} from '@nextrush/runtime';
```

### `Runtime`

```typescript
type Runtime =
  | 'node'
  | 'bun'
  | 'deno'
  | 'deno-deploy'
  | 'cloudflare-workers'
  | 'vercel-edge'
  | 'edge'
  | 'unknown';
```

### `RuntimeCapabilities`

```typescript
interface RuntimeCapabilities {
  nodeStreams: boolean;
  webStreams: boolean;
  fileSystem: boolean;
  webSocket: boolean;
  fetch: boolean;
  cryptoSubtle: boolean;
  workers: boolean;
}
```

### `EdgeRuntimeInfo`

```typescript
interface EdgeRuntimeInfo {
  runtime: Runtime;
  isCloudflare: boolean;
  isVercel: boolean;
  isNetlify: boolean;
  isGenericEdge: boolean;
}
```

### `BodySourceOptions`

```typescript
interface BodySourceOptions {
  limit?: number; // Max body size in bytes (default: 1MB)
  encoding?: 'utf-8' | 'utf8' | 'ascii' | 'latin1' | 'iso-8859-1' | 'utf-16le' | 'utf-16be';
}
```

## Runtime Compatibility

| Feature              | Node.js | Bun | Deno | Deno Deploy | Edge |
| -------------------- | ------- | --- | ---- | ----------- | ---- |
| `detectRuntime()`    | ✅      | ✅  | ✅   | ✅          | ✅   |
| `WebBodySource`      | ❌      | ✅  | ✅   | ✅          | ✅   |
| `AbstractBodySource` | ✅      | ✅  | ✅   | ✅          | ✅   |
| Node.js streams      | ✅      | ✅  | ❌   | ❌          | ❌   |
| Web streams          | ✅      | ✅  | ✅   | ✅          | ✅   |
| File system          | ✅      | ✅  | ✅   | ❌          | ❌   |

## See Also

- [`@nextrush/adapter-node`](../adapters/node) — Node.js adapter
- [`@nextrush/adapter-bun`](../adapters/bun) — Bun adapter
- [`@nextrush/adapter-deno`](../adapters/deno) — Deno adapter
- [`@nextrush/adapter-edge`](../adapters/edge) — Edge runtime adapter

## License

MIT
