# Improvement Plan — Prioritized TODO

## Phase 1: Critical Security Fixes (P0 — Do First)

These must be fixed before any deployment. All are security or correctness showstoppers.

### Task 1.1: Fix Prototype Pollution in Query Parser

- **File**: `packages/adapters/node/src/utils.ts`
- **Change**: Replace `{}` with `Object.create(null)`, add key sanitization
- **Why**: Attacker can mutate `Object.prototype` via query parameters → privilege escalation, auth bypass
- **Effort**: 30 min
- **Tests needed**: Prototype pollution attempt, `__proto__` key, `constructor` key

### Task 1.2: Wire Proxy Option to IP Extraction

- **Files**: `packages/adapters/node/src/context.ts`, `packages/adapters/node/src/adapter.ts`
- **Change**: Pass `app.options.proxy` to context, gate `X-Forwarded-For` parsing
- **Why**: Any client can spoof IP → bypass rate limiting, poison audit logs
- **Effort**: 1 hr
- **Tests needed**: IP with/without proxy, X-Forwarded-For spoofing attempt

### Task 1.3: Fix `ctx.send(object)` Hung Connection Bug

- **File**: `packages/adapters/node/src/context.ts`
- **Change**: Move `_responded = true` after actual response write, or restructure `send()` flow
- **Why**: `send({})` hangs forever under DoS amplification
- **Effort**: 30 min
- **Tests needed**: `ctx.send(object)`, `ctx.send(buffer)`, `ctx.send(string)` all produce responses

### Task 1.4: Replace `require()` with ESM Import

- **File**: `packages/adapters/node/src/body-source.ts`
- **Change**: Top-level `import { Readable } from 'node:stream'` or `await import()`
- **Why**: Hard crash on any GET/HEAD/OPTIONS/DELETE with `EmptyBodySource.stream()`
- **Effort**: 15 min

### Task 1.5: Add try/catch Around JSON.parse at Body Boundary

- **Files**: `packages/runtime/src/body-source.ts`, `packages/adapters/node/src/body-source.ts`
- **Change**: Wrap `JSON.parse` with try/catch, throw `BadRequestError` (400)
- **Why**: Malformed JSON → unclassified 500 instead of 400
- **Effort**: 30 min

### Task 1.6: Remove `process.env` from Core Application

- **File**: `packages/core/src/application.ts`
- **Change**: Remove `process.env['NODE_ENV']` access, default to `'development'`
- **Why**: Crashes in Edge/Deno runtimes where `process` is undefined
- **Effort**: 15 min

### Task 1.7: Fix `route()` Path Leak to Downstream Middleware

- **File**: `packages/core/src/application.ts`
- **Change**: Restore `ctx.path` before calling downstream `next()`
- **Why**: Downstream middleware sees stripped path, breaking logging/auth/routing
- **Effort**: 1 hr

---

## Phase 2: Error Architecture Unification (P0-P1)

The error system is the largest architectural debt in the framework.

### Task 2.1: Delete Error Classes from `@nextrush/core`

- **File**: `packages/core/src/errors.ts`
- **Change**: Remove duplicate `HttpError`, `NotFoundError`, etc. — core should import from `@nextrush/errors`
- **Why**: `instanceof` fails across packages → wrong HTTP status codes in production
- **Impact**: All code importing from `@nextrush/core/errors` needs update
- **Effort**: 2 hr

### Task 2.2: Delete `HttpError` from All Adapter Contexts

- **Files**: All `packages/adapters/*/src/context.ts`
- **Change**: Import `HttpError` from `@nextrush/errors` for `ctx.throw()`
- **Why**: Same `instanceof` failure as 2.1
- **Effort**: 2 hr

### Task 2.3: Unify Error Serialization Format

- **Change**: All error responses follow one schema: `{ error, message, code, status, details? }`
- **Why**: Currently 4 different formats depending on error origin → brittle client handling
- **Effort**: 2 hr

### Task 2.4: Rename `RangeError` to `RangeValidationError`

- **File**: `packages/errors/src/validation.ts`
- **Why**: Shadows built-in JavaScript `RangeError`
- **Effort**: 30 min (+ find/replace across imports)

### Task 2.5: Complete ERROR_MAP Coverage

- **File**: `packages/errors/src/factory.ts`
- **Change**: Add 405, 406, 408, 413, 415, 429, 501, 503 to `ERROR_MAP`
- **Why**: `createError(429)` falls back to generic `HttpError` despite having a specialized class
- **Effort**: 30 min

### Task 2.6: Unify Body Source Error Classes

- **Files**: `packages/runtime/src/body-source.ts`, `packages/adapters/node/src/body-source.ts`
- **Change**: Single canonical definition in `@nextrush/errors` or `@nextrush/runtime`, import everywhere
- **Effort**: 1 hr

---

## Phase 3: Type System Fixes (P0-P1)

### Task 3.1: Remove Node.js Types from `@nextrush/types`

- **File**: `packages/types/src/http.ts`, `packages/types/src/runtime.ts`, `packages/types/tsconfig.json`
- **Changes**:
  - Replace `Readable` → `ReadableStream<Uint8Array>`
  - Replace `Buffer` → `Uint8Array`
  - Replace `NodeJS.ReadableStream` → `ReadableStream<Uint8Array>`
  - Replace `BufferEncoding` → `string`
  - Remove `"types": ["node"]` from tsconfig
- **Why**: Foundation package couples entire framework to Node.js
- **Impact**: All adapters need to handle type widening for Node-specific APIs
- **Effort**: 3 hr

### Task 3.2: Add `setNext()` to Context Interface

- **File**: `packages/types/src/context.ts`
- **Change**: Add `setNext(fn: Next): void` (marked `@internal`)
- **Why**: Eliminates `any` cast in compose hot path, removes per-hop typeof check
- **Effort**: 30 min

### Task 3.3: Add `responded` to Context Interface

- **File**: `packages/types/src/context.ts`
- **Change**: `readonly responded: boolean` property
- **Why**: Consistent response-state checking across error middleware and fallbacks
- **Effort**: 30 min

### Task 3.4: Fix `ApplicationLike.use()` Type

- **File**: `packages/types/src/plugin.ts`
- **Change**: `use(mw: Middleware): this;` instead of current narrower type
- **Why**: Plugin authors can't pass sync middleware without cast
- **Effort**: 15 min

---

## Phase 4: Performance Optimizations (P1-P2)

### Task 4.1: Singleton EmptyBodySource

- **File**: `packages/adapters/node/src/body-source.ts`
- **Change**: Return shared instance from `createEmptyBodySource()`
- **Impact**: -1 allocation/req
- **Effort**: 15 min

### Task 4.2: Remove Unused Middleware Array from match()

- **File**: `packages/router/src/router.ts`
- **Change**: Internal matcher returns `{ params, executor }` only; keep `middleware` in public API
- **Impact**: -1 array + spread/req
- **Effort**: 1 hr

### Task 4.3: Fast-Path Regex Replace

- **File**: `packages/router/src/router.ts`
- **Change**: `if (normalized.includes('//')) normalized = normalized.replace(...)`
- **Impact**: Skip regex on 99%+ of normal requests
- **Effort**: 15 min

### Task 4.4: Remove Redundant Per-Segment toLowerCase

- **File**: `packages/router/src/router.ts`
- **Change**: When path already lowercased, skip per-segment lowercasing in static lookup
- **Impact**: -N string allocations per request (multi-segment paths)
- **Effort**: 15 min

### Task 4.5: Replace `delete` with `undefined` in Backtracking

- **File**: `packages/router/src/router.ts`
- **Change**: `params[key] = undefined` + clean-up on match vs `delete params[key]`
- **Impact**: ~32× faster backtracking operations, avoids V8 hidden class deopt
- **Effort**: 30 min

### Task 4.6: Single Promise Chain in Adapter

- **File**: `packages/adapters/node/src/adapter.ts`
- **Change**: `.then(onFulfilled, onRejected)` instead of `.then().catch()`
- **Impact**: -1 Promise/req
- **Effort**: 15 min

### Task 4.7: Avoid Double params Allocation

- **File**: `packages/adapters/node/src/context.ts`, `packages/router/src/router.ts`
- **Change**: Lazy-init params in context OR reuse existing params object in router
- **Impact**: -1 object/req
- **Effort**: 30 min

### Task 4.8: Pre-Compile Router Middleware Composition

- **File**: `packages/router/src/router.ts`
- **Change**: Compose router middleware once at registration, not per-request closure
- **Impact**: -1 closure/req (conditional)
- **Effort**: 1 hr

### Task 4.9: Optimize allowedMethods() to Single Tree Walk

- **File**: `packages/router/src/router.ts`
- **Change**: Walk tree once, read `node.handlers.keys()` instead of 7× `match()`
- **Impact**: 7× reduction in 404 processing time
- **Effort**: 2 hr

---

## Phase 5: Runtime & Detection Fixes (P1)

### Task 5.1: Fix Vercel Edge Detection Order

- **File**: `packages/runtime/src/detection.ts`
- **Change**: Check `process.versions.node` before `VERCEL_REGION`
- **Why**: Node on Vercel misclassified as edge runtime
- **Effort**: 15 min

### Task 5.2: Implement Streaming Body Size Check

- **File**: `packages/runtime/src/body-source.ts`
- **Change**: Count bytes during read, abort on limit exceeded
- **Why**: Current check-after-buffer allows memory DoS
- **Effort**: 2 hr

### Task 5.3: Fix Content-Length 0 Parsing

- **Files**: `packages/runtime/src/body-source.ts`, `packages/adapters/node/src/body-source.ts`
- **Change**: `const len = parseInt(cl, 10); return Number.isNaN(len) ? undefined : len;`
- **Effort**: 15 min

---

## Phase 6: DX & Quality of Life (P2)

### Task 6.1: Fix `errorHandler()` Type Signature

- **File**: `packages/errors/src/middleware.ts`
- **Change**: Use `Middleware` from `@nextrush/types` instead of custom `ErrorContext`
- **Effort**: 30 min

### Task 6.2: Make `close()` Resilient to Plugin Failures

- **File**: `packages/core/src/application.ts`
- **Change**: `Promise.allSettled()` pattern for plugin destroy
- **Effort**: 30 min

### Task 6.3: Replace `console.*` with Pluggable Logger

- **Files**: `packages/core/src/application.ts`, `packages/adapters/node/src/adapter.ts`, `packages/errors/src/middleware.ts`
- **Change**: No-op default logger, accept custom logger function
- **Effort**: 1 hr

### Task 6.4: Guard Mutations After `start()`

- **File**: `packages/core/src/application.ts`
- **Change**: Throw on `use/plugin/route` when `_started` is true
- **Effort**: 30 min

### Task 6.5: Add Query Parameter Limits

- **File**: `packages/adapters/node/src/utils.ts`
- **Change**: Max query length, max pairs, max key/value length
- **Effort**: 1 hr

### Task 6.6: Fix Graceful Shutdown Order

- **File**: `packages/adapters/node/src/adapter.ts`
- **Change**: Stop server → drain connections → destroy plugins → close
- **Effort**: 1 hr

### Task 6.7: Wire Plugin Hooks (or Remove from Types)

- **Files**: `packages/types/src/plugin.ts`, `packages/core/src/application.ts`
- **Change**: Either implement `onRequest/onResponse/onError` hooks or remove from type definitions
- **Effort**: 2 hr (implement) or 15 min (remove)

---

## Priority Summary

```
PHASE 1 (Security)     ████████████████████  ~4 hr   — MUST DO FIRST
PHASE 2 (Errors)       ████████████████      ~8 hr   — Architectural debt
PHASE 3 (Types)        ████████              ~4 hr   — Runtime agnosticism
PHASE 4 (Performance)  ████████████████      ~6 hr   — ~15-20% RPS improvement
PHASE 5 (Runtime)      ████                  ~2.5 hr — Detection + body DoS
PHASE 6 (DX)           ████████████          ~7 hr   — Quality of life
                                              ─────
                                        Total ~31.5 hr
```

---

## Expected Outcomes

| Metric                     | Current         | After All Phases      |
| -------------------------- | --------------- | --------------------- |
| Security Score             | 2-4/10          | 8/10                  |
| Correctness Score          | 3-4/10          | 8/10                  |
| Performance (allocs/req)   | ~34             | ~20-22                |
| RPS Improvement            | baseline        | +15-20%               |
| `instanceof` reliability   | ❌ Broken       | ✅ Single source      |
| Runtime agnosticism        | ❌ Node-coupled | ✅ Web-standard types |
| Error response consistency | 4 formats       | 1 format              |
| Type safety (`any` count)  | ≥2 hot path     | 0                     |
