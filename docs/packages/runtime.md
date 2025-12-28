# Runtime Package

> Cross-runtime detection and abstractions for NextRush.

## Installation

```bash
pnpm add @nextrush/runtime
```

## Overview

The `@nextrush/runtime` package provides:

1. **Runtime Detection** - Detect Node.js, Bun, Deno, or Edge environments
2. **BodySource Abstraction** - Unified body reading across all runtimes
3. **Capability Checking** - Know what APIs are available

This package is used internally by adapters and body-parser, but can also be used directly for runtime-specific optimizations.

## Runtime Detection

### `detectRuntime()`

Detect the current JavaScript runtime.

```typescript
import { detectRuntime } from '@nextrush/runtime';

const runtime = detectRuntime();
// 'node' | 'bun' | 'deno' | 'cloudflare-workers' | 'vercel-edge' | 'edge' | 'unknown'
```

Detection order:
1. **Bun** - Has global `Bun` object
2. **Deno** - Has global `Deno` object
3. **Cloudflare Workers** - `navigator.userAgent` contains 'Cloudflare-Workers'
4. **Vercel Edge** - Has `process.env.VERCEL_REGION`
5. **Node.js** - Has `process.versions.node`
6. **Edge** - Has Web APIs but not Node.js
7. **Unknown** - None of the above

### `getRuntime()`

Get the runtime with caching (recommended for hot paths).

```typescript
import { getRuntime } from '@nextrush/runtime';

// First call detects and caches
const runtime1 = getRuntime();

// Subsequent calls return cached value
const runtime2 = getRuntime(); // No re-detection
```

### Helper Functions

```typescript
import { isNode, isBun, isDeno, isEdge, isRuntime } from '@nextrush/runtime';

if (isNode()) {
  // Node.js-specific code
}

if (isBun()) {
  // Bun-specific code
}

if (isDeno()) {
  // Deno-specific code
}

if (isEdge()) {
  // Edge runtime (Cloudflare, Vercel, generic)
}

// Or check specific runtime
if (isRuntime('cloudflare-workers')) {
  // Cloudflare Workers-specific code
}
```

## Runtime Capabilities

### `getRuntimeCapabilities()`

Check what features are available in the current runtime.

```typescript
import { getRuntimeCapabilities } from '@nextrush/runtime';

const caps = getRuntimeCapabilities();

console.log(caps);
// {
//   nodeStreams: true,   // Node.js streams (Readable, Writable)
//   webStreams: true,    // Web Streams API (ReadableStream)
//   fileSystem: true,    // File system access
//   webSocket: true,     // WebSocket support
//   fetch: true,         // Native fetch API
//   cryptoSubtle: true,  // crypto.subtle API
//   workers: true,       // Web Workers / Worker Threads
// }
```

Capabilities by runtime:

| Runtime | nodeStreams | webStreams | fileSystem | webSocket | fetch | cryptoSubtle | workers |
|---------|-------------|------------|------------|-----------|-------|--------------|---------|
| Node.js | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bun | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Deno | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edge | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ |

### `getRuntimeInfo()`

Get complete runtime information.

```typescript
import { getRuntimeInfo } from '@nextrush/runtime';

const info = getRuntimeInfo();
// {
//   runtime: 'node',
//   version: '20.10.0',
//   capabilities: { nodeStreams: true, ... }
// }
```

### `getRuntimeVersion()`

Get the runtime version string.

```typescript
import { getRuntimeVersion } from '@nextrush/runtime';

const version = getRuntimeVersion();
// Node.js: '20.10.0'
// Bun: '1.0.0'
// Deno: '1.38.0'
// Edge: undefined (no version available)
```

## BodySource Abstraction

The `BodySource` interface provides a unified way to read request bodies across all runtimes.

### Interface

```typescript
interface BodySource {
  // Read as string
  text(): Promise<string>;

  // Read as Uint8Array
  buffer(): Promise<Uint8Array>;

  // Read and parse as JSON
  json<T = unknown>(): Promise<T>;

  // Get underlying stream
  stream(): ReadableStream<Uint8Array> | NodeJS.ReadableStream;

  // Properties
  readonly consumed: boolean;
  readonly contentLength: number | undefined;
  readonly contentType: string | undefined;
}
```

### WebBodySource

For runtimes using Web Fetch API (Bun, Deno, Edge):

```typescript
import { WebBodySource } from '@nextrush/runtime';

const request = new Request('http://example.com', {
  method: 'POST',
  body: JSON.stringify({ hello: 'world' }),
  headers: { 'content-type': 'application/json' },
});

const bodySource = new WebBodySource(request);

// Read body
const json = await bodySource.json();
console.log(json); // { hello: 'world' }

// Check if consumed
console.log(bodySource.consumed); // true
```

### EmptyBodySource

For requests without a body:

```typescript
import { EmptyBodySource, createEmptyBodySource } from '@nextrush/runtime';

const emptySource = createEmptyBodySource();

await emptySource.text();   // ''
await emptySource.buffer(); // Uint8Array(0)
await emptySource.json();   // throws SyntaxError
```

### Size Limits

BodySource implementations enforce size limits:

```typescript
import { WebBodySource, BodyTooLargeError } from '@nextrush/runtime';

const bodySource = new WebBodySource(request, {
  limit: 1024, // 1KB limit
});

try {
  await bodySource.buffer();
} catch (err) {
  if (err instanceof BodyTooLargeError) {
    console.log(`Body too large: ${err.received} bytes, limit: ${err.limit}`);
  }
}
```

### Consumed Error

Bodies can only be read once:

```typescript
import { WebBodySource, BodyConsumedError } from '@nextrush/runtime';

const bodySource = new WebBodySource(request);

await bodySource.text(); // OK

try {
  await bodySource.text(); // Error!
} catch (err) {
  if (err instanceof BodyConsumedError) {
    console.log('Body already consumed');
  }
}
```

**Note:** After calling `buffer()`, subsequent `buffer()` or `text()` calls return cached values. But after calling `stream()`, the body cannot be read again.

## Creating Custom BodySources

Extend `AbstractBodySource` for custom implementations:

```typescript
import { AbstractBodySource } from '@nextrush/runtime';

class MyBodySource extends AbstractBodySource {
  private data: Uint8Array;

  constructor(data: Uint8Array) {
    super(data.length.toString(), 'application/octet-stream');
    this.data = data;
  }

  protected async _buffer(): Promise<Uint8Array> {
    return this.data;
  }

  protected _stream(): ReadableStream<Uint8Array> {
    return new ReadableStream({
      start: (controller) => {
        controller.enqueue(this.data);
        controller.close();
      },
    });
  }
}
```

## Use Cases

### Runtime-Specific Optimization

```typescript
import { getRuntime } from '@nextrush/runtime';

async function hashData(data: Uint8Array): Promise<string> {
  const runtime = getRuntime();

  if (runtime === 'bun') {
    // Bun has optimized hashing
    return Bun.hash(data).toString(16);
  }

  // Use Web Crypto API for others
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```

### Conditional Feature Usage

```typescript
import { getRuntimeCapabilities } from '@nextrush/runtime';

async function readFile(path: string): Promise<string> {
  const caps = getRuntimeCapabilities();

  if (!caps.fileSystem) {
    throw new Error('File system not available in this runtime');
  }

  // Safe to use file system APIs
  const fs = await import('fs/promises');
  return fs.readFile(path, 'utf-8');
}
```

### Cross-Runtime Middleware

```typescript
import type { BodySource } from '@nextrush/runtime';

async function parseJsonBody(bodySource: BodySource): Promise<unknown> {
  // Works on any runtime!
  const text = await bodySource.text();
  return JSON.parse(text);
}
```

## Error Classes

### `BodyConsumedError`

Thrown when trying to read a body that has already been consumed.

```typescript
import { BodyConsumedError } from '@nextrush/runtime';

try {
  await bodySource.text();
  await bodySource.text(); // Throws BodyConsumedError
} catch (err) {
  if (err instanceof BodyConsumedError) {
    // Handle consumed body
  }
}
```

### `BodyTooLargeError`

Thrown when body exceeds size limit.

```typescript
import { BodyTooLargeError } from '@nextrush/runtime';

try {
  await bodySource.buffer();
} catch (err) {
  if (err instanceof BodyTooLargeError) {
    console.log(`Limit: ${err.limit}, Received: ${err.received}`);
  }
}
```

## Constants

```typescript
import { DEFAULT_BODY_LIMIT } from '@nextrush/runtime';

console.log(DEFAULT_BODY_LIMIT); // 1048576 (1MB)
```

## TypeScript

Full TypeScript support with exported types:

```typescript
import type {
  Runtime,
  RuntimeCapabilities,
  RuntimeInfo,
  BodySource,
  BodySourceOptions,
} from '@nextrush/types';

import type {
  AbstractBodySource,
  WebBodySource,
  EmptyBodySource,
} from '@nextrush/runtime';
```

## API Summary

### Detection Functions

| Function | Returns | Description |
|----------|---------|-------------|
| `detectRuntime()` | `Runtime` | Detect runtime (no caching) |
| `getRuntime()` | `Runtime` | Get runtime (cached) |
| `getRuntimeVersion()` | `string \| undefined` | Get runtime version |
| `getRuntimeCapabilities()` | `RuntimeCapabilities` | Get available features |
| `getRuntimeInfo()` | `RuntimeInfo` | Get complete info |
| `isNode()` | `boolean` | Check if Node.js |
| `isBun()` | `boolean` | Check if Bun |
| `isDeno()` | `boolean` | Check if Deno |
| `isEdge()` | `boolean` | Check if edge runtime |
| `isRuntime(r)` | `boolean` | Check specific runtime |

### BodySource Classes

| Class | Use Case |
|-------|----------|
| `AbstractBodySource` | Base class for custom implementations |
| `WebBodySource` | Web Request API (Bun, Deno, Edge) |
| `EmptyBodySource` | Requests without body |

### Factory Functions

| Function | Returns | Description |
|----------|---------|-------------|
| `createWebBodySource(req, opts?)` | `BodySource` | Create from Request |
| `createEmptyBodySource()` | `BodySource` | Create empty source |

## See Also

- [Adapters Overview](/adapters/)
- [Body Parser](/middleware/body-parser)
