# Architecture Improvements — Why, What, and How

## 1. Error System Consolidation

### Current Architecture (Broken)

```
@nextrush/errors   → HttpError, NotFoundError, ...
@nextrush/core     → HttpError, NotFoundError (DUPLICATE)
@nextrush/adapter  → HttpError (DUPLICATE per adapter)
```

### Why This Is a Problem

When a controller throws `new NotFoundError()` from `@nextrush/errors`, and the error middleware checks `err instanceof HttpError` using its own import, the check **fails** — because `HttpError` from `@nextrush/core` and `HttpError` from `@nextrush/errors` are different classes. The client gets a 500 instead of a 404.

This happens silently. No warning. Wrong status code. Wrong error message. In production.

### Proposed Architecture

```
@nextrush/errors   → HttpError, NotFoundError, ...    (CANONICAL SOURCE)
@nextrush/core     → imports from @nextrush/errors     (DELETE local classes)
@nextrush/adapter  → imports from @nextrush/errors     (DELETE local classes)
```

### Use Case

- **User throws `new UnauthorizedError()` in guard** → error middleware checks `isHttpError()` → returns 401 ✅
- **Adapter `ctx.throw(404)` uses `createError(404)`** from `@nextrush/errors` → same class hierarchy → 404 ✅
- **Third-party plugin catches errors** → `instanceof HttpError` works regardless of import path ✅

### Why Not Duck-Typing Instead?

Duck-typing (`'status' in err && typeof err.status === 'number'`) works for simple cases but:

- Doesn't give you error subclass-specific behavior (e.g., `err.expose`, `err.details`)
- Makes type narrowing weaker
- Obscures the error taxonomy at compile time

Single canonical source + `instanceof` is the right pattern for a framework's own error hierarchy.

---

## 2. Runtime-Agnostic Types Foundation

### Current Architecture (Node-Coupled)

```
@nextrush/types
├── import type { Readable } from 'node:stream'
├── Buffer type usage
├── NodeJS.ReadableStream
├── tsconfig: "types": ["node"]
```

### Why This Is a Problem

`@nextrush/types` is the **foundation** of the entire package hierarchy. Every package depends on it. When it contains Node.js types:

- Edge/Deno/Bun adapters need `@types/node` installed just for type-checking
- CI pipelines for edge runtimes fail unless they carry Node type definitions
- It contradicts the framework's multi-runtime story

### Proposed Architecture

```
@nextrush/types
├── ReadableStream<Uint8Array>    (Web standard — supported everywhere)
├── Uint8Array                     (replaces Buffer)
├── string                         (replaces BufferEncoding)
├── No "types": ["node"]

@nextrush/adapter-node
├── import { Readable } from 'node:stream'
├── Buffer (Node-specific, adapter-scoped)
├── Converts Uint8Array ↔ Buffer at adapter boundary
```

### Use Case

- **Edge adapter author** implements `Context` interface without installing `@types/node` ✅
- **Deno adapter** uses `ReadableStream` natively without bridging ✅
- **Types package** is truly universal — foundation for all runtimes ✅
- **Node adapter** freely uses `Buffer` internally, converts at the boundary ✅

### Migration Path

1. Replace Node types in `@nextrush/types` with Web equivalents
2. Node adapter adds internal `Buffer` ↔ `Uint8Array` conversion helpers
3. Tests validate both Node and Web type paths

---

## 3. Proxy-Aware IP Extraction

### Current Architecture (Unsafe)

```
Client → [Reverse Proxy] → Node.js
                            └→ ctx.ip = X-Forwarded-For[0]  (ALWAYS)
```

### Why This Is a Problem

Every request, regardless of deployment topology, trusts `X-Forwarded-For`. In direct-to-server deployments (no reverse proxy), clients can set any IP they want. This defeats:

- Rate limiting (every request gets a fresh "IP")
- Geo-fencing (claim any origin)
- Audit trails (forge attacker attribution)
- IP allowlists (bypass access control)

### Proposed Architecture

```
ApplicationOptions {
  proxy?: boolean | string[];   // false (default), true, or CIDR list
}

// Context IP resolution
if (options.proxy === false) {
  return req.socket.remoteAddress;    // Direct connection only
} else if (options.proxy === true) {
  return parseForwardedFor(req);      // Trust all proxies
} else if (Array.isArray(options.proxy)) {
  return validateProxyChain(req, options.proxy);  // Trust specific CIDRs
}
```

### Use Case

- **Development** (`proxy: false`): IP = socket address. No spoofing possible.
- **Behind nginx** (`proxy: true`): IP = first `X-Forwarded-For` entry. Standard deployment.
- **Behind CDN** (`proxy: ['10.0.0.0/8']`): Only trusts known proxy IPs. Production-grade.

---

## 4. Streaming Body Size Enforcement

### Current Architecture (DoS Vulnerable)

```
Request arrives → Buffer entire body → Check size → Too large? Throw.
                  ^^^^^^^^^^^^^^^^
                  Memory already consumed!
```

### Why This Is a Problem

A 1 GB body without `Content-Length` will be fully buffered before the size check runs. Under concurrent attack, the server OOMs before any limit fires.

### Proposed Architecture

```
Request arrives → Stream body → Count bytes incrementally → Exceed limit? Abort stream.
                                ^^^^^^^^^^^^^^^^^^^^^^^^
                                O(1) memory overhead
```

### Implementation

```typescript
async buffer(): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  for await (const chunk of readable) {
    totalBytes += chunk.byteLength;
    if (totalBytes > this.options.limit) {
      readable.destroy();
      throw new BodyTooLargeError(this.options.limit);
    }
    chunks.push(chunk);
  }
  return concat(chunks);
}
```

### Use Case

- **File upload endpoint**: 10 MB limit. 100 MB upload → aborted at 10 MB mark. Server stays healthy.
- **JSON API**: 1 MB limit. Attacker sends 1 GB → aborted after first second. No memory spike.

---

## 5. Middleware Compose Optimization

### Current Architecture

```
Per request:
  dispatch(0) → nextFn₁ → dispatch(1) → nextFn₂ → ... → dispatch(n) → noop

Allocations: 1 dispatch + N nextFn closures + N+1 Promises
```

### Why This Matters

At 35K RPS with 10 middleware:

- 350K closures/sec just for `nextFn`
- 385K Promises/sec for async machinery
- GC pressure caps throughput well below hardware limits

### Proposed Optimization: Stack-Based Dispatch

```typescript
function compose(middleware: Middleware[]): ComposedMiddleware {
  const len = middleware.length;
  return async function composed(ctx: Context): Promise<void> {
    let index = -1;
    async function dispatch(i: number): Promise<void> {
      if (i <= index) throw new Error('next() called multiple times');
      index = i;
      if (i >= len) return;
      await middleware[i]!(ctx, () => dispatch(i + 1));
    }
    await dispatch(0);
  };
}
```

Key difference: `() => dispatch(i + 1)` is a minimal inline arrow (V8 optimizes better than named function + closure binding). The `composed` function and `dispatch` are created **once at compose time**, not per request.

### Performance Impact

- Removes `typeof ctx.setNext` check per hop
- Reduces closure scope (no `nextFn` variable)
- V8 can inline short arrow functions more aggressively

---

## 6. Router Match Path Optimization

### Current Path Processing

```
"/API/Users/123"
  → toLowerCase()        → "/api/users/123"     (1 string)
  → replace(/\/+/g,'/')  → "/api/users/123"     (0-1 string, ALWAYS runs)
  → split('/')           → ["","api","users","123"]  (1 array + 4 strings)
  → filter(Boolean)      → ["api","users","123"]     (1 array)
```

### Why It's Wasteful

- `replace` is called even when there are no double slashes (99%+ of requests)
- `split` + `filter` creates 2 arrays and N strings every request
- `toLowerCase` runs even when path is already lowercase (most APIs)

### Proposed Optimization

```typescript
// Guard: skip work when not needed
if (!caseSensitive && path !== path.toLowerCase()) {
  path = path.toLowerCase();
}
if (path.includes('//')) {
  path = path.replace(/\/+/g, '/');
}
// Segment via indexOf loop instead of split+filter
const segments = segmentize(path);
```

Where `segmentize` uses `indexOf('/')` in a loop to produce segments without intermediate array allocation.

### Expected Impact

- Common case (clean lowercase path): ~0 ns normalization overhead
- Uncommon case: same behavior as today
- Eliminates 2-4 allocations on hot path

---

## 7. Query Parser Hardening

### Current Architecture (Vulnerable)

```typescript
const result: QueryParams = {}; // Has Object.prototype chain
result[key] = value; // key could be '__proto__'
```

### Proposed Architecture

```typescript
const result: QueryParams = Object.create(null); // No prototype
const MAX_PARAMS = 100;
const MAX_QUERY_LENGTH = 2048;

if (qs.length > MAX_QUERY_LENGTH) return result;

let count = 0;
for (const pair of qs.split('&')) {
  if (++count > MAX_PARAMS) break;
  const [key, value] = splitOnce(pair, '=');
  if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
  result[decodeURIComponent(key)] = decodeURIComponent(value ?? '');
}
```

### Why These Specific Defenses

- `Object.create(null)`: Object has no prototype chain → `__proto__` becomes a regular key, not a mutation vector
- Key denylist: Even with `Object.create(null)`, explicit filtering adds defense-in-depth
- Parameter limits: Prevents CPU/memory amplification with thousands of query keys
- Length limits: Early-exit for obviously oversized query strings

---

## Architecture Decision Summary

| Decision              | Trade-off                    | Why We Chose This                                 |
| --------------------- | ---------------------------- | ------------------------------------------------- |
| Single error source   | Core depends on errors       | instanceof reliability + consistent serialization |
| Web-standard types    | Adapter needs conversion     | True runtime agnosticism for foundation package   |
| Proxy config required | Extra setup for users        | Secure by default; no silent IP spoofing          |
| Streaming body check  | Slightly more code           | Prevents OOM under attack                         |
| Stack-based compose   | Slightly different semantics | Lower allocation pressure at scale                |
| indexOf segmentation  | More code than split()       | Fewer allocations in hottest path                 |
| Object.create(null)   | Slightly different semantics | Eliminates prototype pollution class entirely     |
