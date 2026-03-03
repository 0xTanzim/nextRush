# @nextrush/runtime

> Runtime detection and cross-runtime abstractions for NextRush

Detect the current JavaScript runtime and use unified abstractions that work across Node.js, Bun, Deno, and Edge environments.

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
const runtime = getRuntime(); // 'node' | 'bun' | 'deno' | 'edge' | ...

// 2. Use unified abstractions
async function parseBody(bodySource: BodySource) {
  const text = await bodySource.text(); // Works everywhere!
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

Detect the current JavaScript runtime.

```typescript
import { detectRuntime } from '@nextrush/runtime';

const runtime = detectRuntime();
// 'node' | 'bun' | 'deno' | 'cloudflare-workers' | 'vercel-edge' | 'edge' | 'unknown'
```

**Detection Order:**

1. **Bun** - Has global `Bun` object
2. **Deno** - Has global `Deno` object
3. **Cloudflare Workers** - Has `navigator.userAgent` containing 'Cloudflare-Workers'
4. **Node.js** - Has `process.versions.node`
5. **Vercel Edge** - Has `process.env.VERCEL_REGION` (but NOT `process.versions.node`)
6. **Edge** - Has `Request`/`Response` globals (generic Web API runtime)
7. **Unknown** - None of the above

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
  // Deno specific code
}

if (isEdge()) {
  // Edge runtime (Cloudflare Workers, Vercel Edge, etc.)
}

if (isRuntime('cloudflare-workers')) {
  // Specific runtime check
}
```

### BodySource Abstraction

The `BodySource` interface provides unified body reading across all runtimes.

#### Interface

```typescript
interface BodySource {
  // Read body as string
  text(): Promise<string>;

  // Read body as buffer
  buffer(): Promise<Uint8Array>;

  // Read body as parsed JSON
  json<T = unknown>(): Promise<T>;

  // Get underlying stream
  stream(): ReadableStream<Uint8Array> | NodeJS.ReadableStream;

  // Check if body was already consumed
  readonly consumed: boolean;

  // Content-Length header value
  readonly contentLength: number | undefined;

  // Content-Type header value
  readonly contentType: string | undefined;
}
```

#### `WebBodySource`

For Web API runtimes (Bun, Deno, Cloudflare Workers, Vercel Edge):

```typescript
import { WebBodySource } from '@nextrush/runtime';

// In your adapter
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

#### `EmptyBodySource`

For requests without a body (GET, HEAD, OPTIONS):

```typescript
import { EmptyBodySource, createEmptyBodySource } from '@nextrush/runtime';

const bodySource = new EmptyBodySource();
// or
const bodySource = createEmptyBodySource();

await bodySource.text(); // ''
await bodySource.buffer(); // Uint8Array(0)
await bodySource.json(); // throws SyntaxError
```

#### `AbstractBodySource`

Base class for creating custom BodySource implementations:

```typescript
import { AbstractBodySource } from '@nextrush/runtime';
import type { IncomingMessage } from 'node:http';

// Node.js implementation example
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

Thrown when attempting to read a body that has already been consumed:

```typescript
import { BodyConsumedError } from '@nextrush/runtime';

try {
  await bodySource.text();
  await bodySource.text(); // Throws BodyConsumedError
} catch (error) {
  if (error instanceof BodyConsumedError) {
    console.log('Body already read');
  }
}
```

#### `BodyTooLargeError`

Thrown when body exceeds the size limit:

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

## Usage in Middleware

The real power comes when writing middleware that works across all runtimes:

```typescript
import type { BodySource } from '@nextrush/runtime';

// This middleware works on Node.js, Bun, Deno, and Edge!
export function jsonParser() {
  return async (ctx: { bodySource: BodySource; body: unknown }) => {
    if (ctx.bodySource.contentType?.includes('application/json')) {
      ctx.body = await ctx.bodySource.json();
    }
  };
}
```

## Types

```typescript
import type {
  Runtime,
  RuntimeCapabilities,
  RuntimeInfo,
  BodySource,
  BodySourceOptions,
} from '@nextrush/runtime';
```

### `Runtime`

```typescript
type Runtime = 'node' | 'bun' | 'deno' | 'cloudflare-workers' | 'vercel-edge' | 'edge' | 'unknown';
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

### `BodySourceOptions`

```typescript
interface BodySourceOptions {
  limit?: number; // Max body size (default: 1MB)
  encoding?: BufferEncoding; // Text encoding (default: 'utf-8')
}
```

## Runtime Compatibility

| Feature              | Node.js | Bun | Deno | Edge |
| -------------------- | ------- | --- | ---- | ---- |
| `detectRuntime()`    | ✅      | ✅  | ✅   | ✅   |
| `WebBodySource`      | ❌      | ✅  | ✅   | ✅   |
| `AbstractBodySource` | ✅      | ✅  | ✅   | ✅   |
| Node.js streams      | ✅      | ✅  | ❌   | ❌   |
| Web streams          | ✅      | ✅  | ✅   | ✅   |

## See Also

- [`@nextrush/adapter-node`](../adapters/node) - Node.js adapter
- [`@nextrush/adapter-bun`](../adapters/bun) - Bun adapter
- [`@nextrush/adapter-deno`](../adapters/deno) - Deno adapter
- [`@nextrush/adapter-edge`](../adapters/edge) - Edge runtime adapter
- [RFC-0004: Adapter Architecture](../../draft/RFC-0004-ADAPTER-ARCHITECTURE.md)

## License

MIT
