# Critical Issues — Must Fix Before Production

All 14 critical issues across 6 packages. Each issue includes location, evidence, impact analysis, and recommended fix.

---

## CRIT-01: Error Class Triplication Breaks `instanceof`

**Packages**: `@nextrush/errors`, `@nextrush/core`, `@nextrush/adapter-node` (+ edge, bun, deno)
**Severity**: CRITICAL — Correctness + Architecture

### Evidence

- `@nextrush/errors` defines `HttpError`: `packages/errors/src/base.ts#L84`
- `@nextrush/core` defines separate `HttpError`: `packages/core/src/errors.ts#L62`
- Every adapter defines its own `HttpError` for `ctx.throw()`:
  - Node: `packages/adapters/node/src/context.ts#L30`
  - Edge: `packages/adapters/edge/src/context.ts#L27`
  - Bun: `packages/adapters/bun/src/context.ts#L28`
  - Deno: `packages/adapters/deno/src/context.ts#L28`

### Impact

- `ctx.throw(404)` creates adapter's `HttpError`, NOT `@nextrush/errors`'s `HttpError`
- `errorHandler()` middleware checks `err instanceof HttpError` from `@nextrush/errors` → **fails for adapter errors**
- Intended 404 degrades to 500 silently
- Bug fixes must be replicated across 6+ files
- Users importing from different packages get incompatible error types

### Duplication Map

| Error Class           | @nextrush/errors | @nextrush/core | Adapters (×4) |
| --------------------- | :--------------: | :------------: | :-----------: |
| `NextRushError`       |        ✅        |       ✅       |       ✗       |
| `HttpError`           |        ✅        |       ✅       |      ✅       |
| `BadRequestError`     |        ✅        |       ✅       |       ✗       |
| `NotFoundError`       |        ✅        |       ✅       |       ✗       |
| `UnauthorizedError`   |        ✅        |       ✅       |       ✗       |
| `ForbiddenError`      |        ✅        |       ✅       |       ✗       |
| `InternalServerError` |        ✅        |       ✅       |       ✗       |

### Fix

1. **Delete** all error classes from `@nextrush/core/src/errors.ts` — core should import from `@nextrush/errors`
2. **Delete** all `HttpError` classes from adapter contexts — adapters should import from `@nextrush/errors`
3. Single source of truth: `@nextrush/errors` is the canonical error package
4. If package hierarchy prevents core importing errors, use structural duck-typing with a symbol brand

---

## CRIT-02: IP Spoofing — Unconditional X-Forwarded-For Trust

**Package**: `@nextrush/adapter-node`
**Severity**: CRITICAL — Security

### Evidence

```typescript
// packages/adapters/node/src/context.ts#L117-L127
private getClientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    const firstIp = forwarded.split(',')[0];
    return firstIp?.trim() ?? '';
  }
  return req.socket?.remoteAddress ?? '';
}
```

`Application` defines `proxy` option (`packages/core/src/application.ts#L21-L33`) but it is **never passed to or checked by the context**.

### Impact

- Any client can set `X-Forwarded-For: 1.2.3.4` to spoof their IP
- Rate limiting based on `ctx.ip` is completely bypassable
- Audit logs record attacker-chosen IPs
- IP-based access control is defeated
- Geo-fencing rules can be bypassed

### Fix

1. Pass `proxy` option from Application to adapter context creation
2. Default `proxy` to `false`
3. Only read `X-Forwarded-For` when `proxy === true`
4. Optionally support trusted proxy CIDR list for production deployments

---

## CRIT-03: Prototype Pollution in Query String Parser

**Package**: `@nextrush/adapter-node`
**Severity**: CRITICAL — Security

### Evidence

```typescript
// packages/adapters/node/src/utils.ts#L25-L57
export function parseQueryString(qs: string): QueryParams {
  const result: QueryParams = {};
  // ...
  result[key] = value; // key could be '__proto__', 'constructor', 'prototype'
}
```

### Impact

- Attacker sends `?__proto__[isAdmin]=true`
- `result.__proto__` assignment can pollute `Object.prototype`
- If `result` is later spread/merged into other objects, pollution propagates
- Can lead to privilege escalation, auth bypass, or remote code execution in downstream code

### Fix

```typescript
const result: QueryParams = Object.create(null); // No prototype chain
// AND add key sanitization:
if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
```

---

## CRIT-04: `ctx.send(object)` Produces Hung Connections

**Package**: `@nextrush/adapter-node`
**Severity**: CRITICAL — Correctness

### Evidence

```typescript
// packages/adapters/node/src/context.ts#L154-L204
send(data: ResponseBody): void {
  if (this._responded) return;
  this._responded = true;       // ← Sets responded FIRST
  // ...
  if (typeof data === 'object') {
    this.json(data);             // ← json() checks _responded, returns immediately!
    return;
  }
}
```

### Impact

- `ctx.send({ hello: 'world' })` marks response as sent but never actually writes to the socket
- Connection hangs until server timeout (default 30s)
- Under load, this becomes a denial-of-service vector as connections pool up
- Adapter fallback checks `!ctx.responded` → won't recover

### Fix

Move `this._responded = true` to AFTER the actual response write, or have `json()` not check `_responded` when called internally via `send()`.

---

## CRIT-05: Forbidden `any` Cast in Hot Path

**Package**: `@nextrush/core`
**Severity**: CRITICAL — Type Safety + Performance

### Evidence

```typescript
// packages/core/src/middleware.ts#L93-L100
if (typeof (ctx as any).setNext === 'function') {
  (ctx as any).setNext(nextFn);
}
```

### Impact

- Violates the project's zero-`any` rule (auto-block per global rules)
- Runs on **every middleware dispatch hop** — N+1 times per request
- Type-unsafe: hides real contract mismatch between `Context` interface and adapter implementations
- All adapters implement `setNext()` but `Context` interface doesn't declare it

### Fix

1. Add `setNext(fn: Next): void` to `Context` interface in `@nextrush/types` (mark `@internal`)
2. Call `ctx.setNext(nextFn)` directly — no `typeof` check, no `any` cast
3. Eliminates per-hop branch + type violation

---

## CRIT-06: Node.js Coupling in @nextrush/types

**Package**: `@nextrush/types`
**Severity**: CRITICAL — Architecture

### Evidence

```typescript
// packages/types/src/http.ts#L11
import type { Readable } from 'node:stream';

// packages/types/src/http.ts#L114-L139
export type ResponseBody = string | Buffer | ... | Readable | ...;

// packages/types/tsconfig.json#L26
"types": ["node"]
```

### Impact

- `@nextrush/types` is the **bottom of the package hierarchy** — everything depends on it
- Node.js types leak into every package transitively
- Deno/Edge/Bun builds fail or need Node type shims
- Breaks the "runtime-agnostic" core promise of the framework

### Fix

1. Replace `Readable` with `ReadableStream<Uint8Array>` (Web standard)
2. Replace `Buffer` with `Uint8Array` (Node `Buffer` extends `Uint8Array`, so assignment remains compatible)
3. Remove `"types": ["node"]` from `packages/types/tsconfig.json`
4. Replace `NodeJS.ReadableStream` + `BufferEncoding` in `runtime.ts` with web-standard alternatives

---

## CRIT-07: `require()` in ESM Module

**Package**: `@nextrush/adapter-node`
**Severity**: CRITICAL — Correctness

### Evidence

```typescript
// packages/adapters/node/src/body-source.ts#L195-L199
stream(): NodeJS.ReadableStream {
  const { Readable } = require('node:stream');  // CJS in ESM!
  return Readable.from([]);
}
```

### Impact

- When the package is consumed as ESM (which is the project standard), `require` is undefined
- `ctx.bodySource.stream()` for GET/HEAD/OPTIONS/DELETE requests throws `ReferenceError: require is not defined`
- Hard runtime crash on a common code path

### Fix

Replace with top-level `import { Readable } from 'node:stream'` or use `await import('node:stream')` for lazy loading.

---

## CRIT-08: `JSON.parse` Without try/catch at Body Boundary

**Packages**: `@nextrush/runtime`, `@nextrush/adapter-node`
**Severity**: CRITICAL — Rule Violation + Correctness

### Evidence

```typescript
// packages/runtime/src/body-source.ts#L144-L147
async json<T = unknown>(): Promise<T> {
  const text = await this.text();
  return JSON.parse(text) as T;  // No try/catch!
}

// packages/adapters/node/src/body-source.ts#L147-L150
// Same pattern
```

### Impact

- Malformed JSON body produces raw `SyntaxError` instead of a structured 400 Bad Request
- Violates project rule: "No `JSON.parse` without try/catch at system boundaries"
- Error handler may classify as 500 instead of 400

### Fix

Wrap in try/catch, throw a typed `BadRequestError` or `ValidationError` on parse failure.

---

## CRIT-09: `route()` Leaks Stripped Path to Downstream Middleware

**Package**: `@nextrush/core`
**Severity**: CRITICAL — Correctness

### Evidence

```typescript
// packages/core/src/application.ts#L194-L224
(ctx as { path: string }).path = adjustedPath;
await routerMiddleware(ctx, async () => {
  if (next) await next(); // downstream sees the STRIPPED path!
});
// path restored only AFTER routerMiddleware completes
```

### Impact

- If mounted router doesn't match and calls `next()`, downstream middleware sees `/users` instead of `/api/users`
- Breaks logging, auth rules, path-based routing, and mounted-router composition
- Uses `as { path: string }` type assertion to mutate a potentially readonly property

### Fix

Restore `ctx.path` BEFORE calling downstream `next()`, then re-apply for router continuation.

---

## CRIT-10: Core Application Coupled to Node.js via `process.env`

**Package**: `@nextrush/core`
**Severity**: CRITICAL — Architecture

### Evidence

```typescript
// packages/core/src/application.ts#L89-L94
env: options.env ?? (process.env['NODE_ENV'] as ApplicationOptions['env']) ?? 'development',
```

### Impact

- In edge/Deno/Bun environments, `process` may not exist → crash during Application construction
- Core is supposed to be runtime-agnostic; this couples it to Node.js

### Fix

Remove `process.env['NODE_ENV']` access. Default to `'development'` when `options.env` is not provided. Push env detection into adapters.

---

## CRIT-11: Vercel Edge Runtime Detection Misclassifies Node on Vercel

**Package**: `@nextrush/runtime`
**Severity**: CRITICAL — Correctness

### Evidence

```typescript
// packages/runtime/src/detection.ts#L59-L75
// Vercel check runs BEFORE Node check
if (process.env.VERCEL_REGION !== undefined) return 'vercel-edge';
// Node check runs after
if (process.versions.node) return 'node';
```

### Impact

- Any Node.js process on Vercel (serverless functions, not Edge) is misidentified as `'vercel-edge'`
- `getRuntimeCapabilities()` returns `{ fileSystem: false }` for actual Node.js
- Feature gating, conditional behavior, and telemetry are all wrong

### Fix

Reorder: check `process.versions.node` (Node-specific) before `VERCEL_REGION` (environment variable).

---

## CRIT-12: Body Size Limit Enforced AFTER Full Buffering (Web/Edge)

**Package**: `@nextrush/runtime`
**Severity**: CRITICAL — Security (DoS)

### Evidence

```typescript
// packages/runtime/src/body-source.ts#L191-L194
const arrayBuffer = await this.request.arrayBuffer();  // Buffers ENTIRE body first
const buffer = new Uint8Array(arrayBuffer);
if (buffer.length > this.options.limit) throw new BodyTooLargeError(...);  // Checks AFTER
```

### Impact

- When `Content-Length` header is missing/incorrect, entire payload is buffered before size check
- Attacker can send multi-GB payloads, causing OOM
- At 35K RPS, even rare large bodies can destabilize the process

### Fix

Stream-based size checking: count bytes during read, abort on limit exceeded. Or enforce `Content-Length` header requirement.

---

## CRIT-13: Error Serialization Inconsistency Across Packages

**Packages**: `@nextrush/errors`, `@nextrush/core`, adapters
**Severity**: CRITICAL — DX + Correctness

### Evidence

- `@nextrush/errors`: `toJSON()` returns `{ error: name, message, code, status, details }`
- `@nextrush/core`: `toJSON()` returns `{ error: expose ? message : 'ISE', code, status }`
- Adapters: `HttpError` has NO `toJSON()`
- Core's default handler duck-types `status` and responds `{ error: message }`

### Impact

- Users see 4 different error response shapes depending on error origin
- Client-side error handling becomes unreliable
- Documentation cannot describe a single error format

### Fix

Unify on `@nextrush/errors` as the single serialization source. All error responses should follow one schema.

---

## CRIT-14: `RangeError` Class Name Shadows Global JavaScript `RangeError`

**Package**: `@nextrush/errors`
**Severity**: CRITICAL — DX + Correctness

### Evidence

```typescript
// packages/errors/src/validation.ts#L131-L147
export class RangeError extends ValidationError { ... }
```

### Impact

- `import { RangeError } from '@nextrush/errors'` silently shadows the built-in `RangeError`
- Users may accidentally catch/throw the wrong type
- IDE auto-imports can introduce subtle bugs

### Fix

Rename to `RangeValidationError` or `ValueRangeError` to avoid shadowing.
