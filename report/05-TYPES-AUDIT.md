# Types Package Audit (`@nextrush/types`)

## Package Overview

- **Files**: `context.ts`, `http.ts`, `runtime.ts`, `router.ts`, `plugin.ts`, `index.ts`
- **Type Ergonomics Score**: 6/10
- **Runtime Agnosticism Score**: 2/10
- **Completeness Score**: 5/10

---

## CRITICAL Issues

### 1. Node.js Import in Foundation Package

- **Location**: `packages/types/src/http.ts#L11`
- **Evidence**: `import type { Readable } from 'node:stream';`
- **Impact**: Every package in the hierarchy depends on `@nextrush/types`. This import forces all consumers to have Node.js type definitions available, even in Deno/Edge environments where they're absent.
- **Fix**: Use `ReadableStream<Uint8Array>` (Web standard) for shared types; keep `Readable` only in Node adapter.

### 2. Node-Only Globals Exported from Shared Types

- **Locations**:
  - `Buffer` in `packages/types/src/http.ts#L114-L139`
  - `NodeJS.ReadableStream` + `BufferEncoding` in `packages/types/src/runtime.ts#L125-L161`
- **Impact**: Consumers without Node types get TS errors like "Cannot find name 'Buffer'"
- **Fix**:
  - Replace `Buffer` → `Uint8Array` (Node `Buffer` extends `Uint8Array` so assignment stays compatible)
  - Replace `NodeJS.ReadableStream` → `ReadableStream<Uint8Array>`
  - Replace `BufferEncoding` → string union or `string`

### 3. tsconfig Includes Node Types Globally

- **Location**: `packages/types/tsconfig.json#L26`
- **Evidence**: `"types": ["node"]`
- **Impact**: Even removing explicit Node imports won't help — emitted `.d.ts` and authoring environment are anchored to Node globals.
- **Fix**: Remove `"types": ["node"]` and add appropriate web lib types instead.

---

## HIGH Issues

### 4. `Context` Missing `setNext()` Internal Contract

- **Location**: Core usage: `packages/core/src/middleware.ts#L95-L103`
- **Evidence**: `(ctx as any).setNext` — all adapters implement `setNext()` but `Context` doesn't declare it
- **Impact**: Core is forced to use `any` to call a method every adapter defines. Foundational type integrity gap.
- **Fix**: Add `setNext(fn: Next): void` to `Context` interface (mark `@internal` via JSDoc).

### 5. `ResponseBody` Promise vs Adapter Reality

- **Type**: `packages/types/src/http.ts#L129-L139` — allows `Uint8Array | ArrayBuffer | ReadableStream`
- **Node adapter**: `packages/adapters/node/src/context.ts#L154-L204` — treats `Uint8Array`/`ArrayBuffer` as `object` → JSON-serializes them instead of sending binary
- **Impact**: Type contract says binary/stream types are valid response bodies, but Node adapter doesn't honor it.
- **Fix**: Either narrow `ResponseBody` to guaranteed behaviors, or fix Node adapter to handle all declared types.

---

## MEDIUM Issues

### 6. `HttpMethod` Includes TRACE/CONNECT but `HTTP_METHODS` Omits Them

- **Location**: `packages/types/src/http.ts#L20-L47`
- **Evidence**:
  ```typescript
  export type HttpMethod = ... | 'TRACE' | 'CONNECT';
  export const HTTP_METHODS = ['GET','POST','PUT','DELETE','PATCH','HEAD','OPTIONS'] as const;
  ```
- **Impact**: `router.all()` uses `HTTP_METHODS` → never registers TRACE/CONNECT. May be intentional (security) but undocumented.

### 7. `ApplicationLike.use()` Narrower Than `Middleware` Type

- **Locations**: `Middleware` in `packages/types/src/context.ts#L393-L414`, `ApplicationLike.use` in `packages/types/src/plugin.ts#L20-L30`
- **Evidence**: `ApplicationLike.use` requires `Promise<void>` return, but `Middleware` allows `void | Promise<void>`
- **Impact**: Plugin authors can't pass sync middleware without a cast.
- **Fix**: Type as `use(mw: Middleware): this;`

### 8. `Plugin.install()` vs `instanceof Promise` Enforcement

- **Location**: `packages/core/src/application.ts#L277-L288`
- **Impact**: Thenables (non-Promise) can slip through sync install check.

---

## Node.js Coupling Map

| File                | Import/Type                | Node.js Dependency | Alternative                  |
| ------------------- | -------------------------- | ------------------ | ---------------------------- |
| `http.ts#L11`       | `import type { Readable }` | `node:stream`      | `ReadableStream<Uint8Array>` |
| `http.ts#L114-L139` | `Buffer`                   | global             | `Uint8Array`                 |
| `runtime.ts#L125`   | `NodeJS.ReadableStream`    | global             | `ReadableStream<Uint8Array>` |
| `runtime.ts#L160`   | `BufferEncoding`           | global             | `string` or union            |
| `tsconfig.json#L26` | `"types": ["node"]`        | config             | Remove, add web libs         |

---

## Context Interface Gap Analysis

| Property/Method   | In Interface? | In Adapters? |                     Gap?                      |
| ----------------- | :-----------: | :----------: | :-------------------------------------------: |
| `runtime`         |      ✅       |      ✅      |                      No                       |
| `bodySource`      |      ✅       |      ✅      |                      No                       |
| `raw`             |      ✅       |      ✅      |                      No                       |
| `responded`       |      ❌       |  ✅ (Node)   | **Yes** — no standard "response sent" concept |
| `setNext(fn)`     |      ❌       |   ✅ (all)   |        **Yes** — core uses `any` cast         |
| `markResponded()` |      ❌       |  ✅ (Node)   |                    **Yes**                    |

---

## Recommendations

1. **P0**: Remove all Node.js types from `@nextrush/types` — use Web standard equivalents
2. **P0**: Add `setNext()` to `Context` interface
3. **P1**: Add `responded` read-only property to `Context` for consistent response-state checking
4. **P1**: Fix `ApplicationLike.use()` type to accept `Middleware`
5. **P2**: Document TRACE/CONNECT omission from `HTTP_METHODS` or include them
6. **P2**: Add `Buffer.from(...)` examples only in Node adapter docs, use `Uint8Array` in shared docs
