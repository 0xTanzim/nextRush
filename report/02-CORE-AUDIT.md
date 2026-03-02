# Core Package Audit (`@nextrush/core`)

## Package Overview

- **Files**: `application.ts`, `middleware.ts`, `errors.ts`, `index.ts`
- **Architecture Score**: 6/10
- **Security Score**: 4/10
- **Performance Score**: 7/10
- **Correctness Score**: 8/10
- **DX Score**: 6/10

---

## Application Class (`application.ts`)

### CRITICAL Issues

#### 1. Node.js coupling via `process.env`

- **Location**: `packages/core/src/application.ts#L89-L94`
- **Evidence**: `env: options.env ?? (process.env['NODE_ENV'] as ...) ?? 'development'`
- **Why it matters**: In Edge/Deno/Bun Web APIs, `process` can be undefined → crash during construction. This undermines the multi-runtime adapter story.
- **Fix**: Remove `process.env` access. Default to `'development'` when `options.env` is not provided.

#### 2. `route()` leaks stripped path into downstream middleware

- **Location**: `packages/core/src/application.ts#L194-L224`
- **Evidence**: Path rewrite happens before router invocation; restore happens AFTER.
- **Why it matters**: If the router doesn't match and calls `next()`, downstream middleware sees the prefix-stripped path (e.g., `/users` instead of `/api/users`), breaking logging, auth, and fallthrough routing.
- **Fix**: Restore `ctx.path` before calling downstream `next()`.

#### 3. Unconditional X-Forwarded-For trust (cross-ref: `proxy` defined but unused)

- **Location**: `packages/core/src/application.ts#L21-L33` (definition), `packages/adapters/node/src/context.ts#L117-L127` (usage)
- **Why it matters**: `ApplicationOptions.proxy` exists but is never wired into context creation. IP is always spoofable.

### HIGH Issues

#### 4. `env` type casting allows info leak in staging/custom environments

- **Location**: `packages/core/src/application.ts#L89-L94`, `packages/core/src/application.ts#L380-L396`
- **Evidence**: `NODE_ENV='staging'` → `isProduction = false` → error messages exposed to clients
- **Fix**: Treat anything except `'development'`/`'test'` as production.

#### 5. `instanceof Promise` for async plugin detection is unreliable

- **Location**: `packages/core/src/application.ts#L277-L292`
- **Why it matters**: Thenables (cross-realm Promises) won't be detected → async installs run un-awaited.
- **Fix**: Check thenables structurally: `result && typeof result.then === 'function'`.

#### 6. `close()` stops destroying plugins on first failure

- **Location**: `packages/core/src/application.ts#L415-L428`
- **Why it matters**: Plugin destroy errors skip subsequent cleanup → resource leaks (sockets, timers).
- **Fix**: Use `Promise.allSettled()` pattern — catch per-plugin errors, destroy all, return aggregated error.

#### 7. Production `console.error` in error handler failure

- **Location**: `packages/core/src/application.ts#L359-L375`
- **Why it matters**: Forbidden by project rules. No structured logging, potential sensitive data exposure.

### MEDIUM Issues

#### 8. Late `use()` after `callback()` has no effect

- **Location**: `packages/core/src/application.ts#L344-L353`
- **Why it matters**: `callback()` snapshots middleware. Users calling `app.use()` after server starts get silent no-ops.
- **Fix**: Either throw on `use/plugin/route` when running, or document lifecycle clearly.

#### 9. `route()` pollutes user state namespace

- **Location**: `packages/core/src/application.ts#L213-L216`
- **Evidence**: Writes `_originalPath` and `_routePrefix` to `ctx.state` without cleanup.
- **Fix**: Store under reserved key (e.g., `ctx.state.__nextrush`) and clean in `finally`.

#### 10. Plugin hooks defined in types but never wired

- **Location**: Types: `packages/types/src/plugin.ts#L96-L117`, Core: `packages/core/src/application.ts#L266-L331`
- **Why it matters**: `PluginWithHooks` advertises `onRequest/onResponse/onError`, but core only calls `install/destroy`. Plugin authors may rely on unimplemented hooks.

---

## Middleware Composition (`middleware.ts`)

### CRITICAL Issues

#### 11. Forbidden `any` cast in hot path

- **Location**: `packages/core/src/middleware.ts#L93-L100`
- **Evidence**: `(ctx as any).setNext`, `(ctx as any).setNext(nextFn)`
- **Why it matters**: Violates zero-`any` rule, runs N+1 times per request, hides real contract mismatch.
- **Fix**: Add `setNext(fn: Next): void` to `Context` interface in `@nextrush/types`.

### HIGH Issues

#### 12. Per-request allocation pattern: N+1 closures + N+1 Promises

- **Location**: `packages/core/src/middleware.ts#L63-L106`
- **Evidence**: `dispatch` function created per request, `nextFn` closure per hop, Promises from async dispatch.
- **Quantified**: With N=10 middleware at 35K RPS: ~385K closures/sec + ~385K Promises/sec just for composer mechanics.
- **Mitigation**: Remove extra checks (CRITICAL fix), consider non-async dispatch with `Promise.resolve()` pattern.

### MEDIUM Issues

#### 13. `flattenMiddleware()` uses `flat(Infinity)` + unsafe cast

- **Location**: `packages/core/src/middleware.ts#L119-L121`
- **Evidence**: `as Middleware[]` suppresses validation; `Infinity` depth allows pathologically deep structures.
- **Note**: Only used in tests currently. Severity rises if wired into request handling later.

### Correctness Matrix

| Scenario                                   | Handled?                   |
| ------------------------------------------ | -------------------------- |
| Middleware throws synchronously            | ✅ (`async` catches)       |
| Middleware rejects asynchronously          | ✅ (`await` propagates)    |
| `next()` called multiple times             | ✅ (`i <= index` guard)    |
| `next()` called after middleware returned  | ❌ (not detected)          |
| Double-response detection                  | ❌ (not in compose)        |
| 0 middleware                               | ✅ (tested)                |
| Middleware neither calls next nor responds | ⚠️ (partial — stops early) |

---

## Errors Module (`errors.ts`)

### CRITICAL Issues

- Full error class duplication with `@nextrush/errors` — see CRIT-01 in [01-CRITICAL-ISSUES.md](01-CRITICAL-ISSUES.md)
- Inconsistent serialization between core `toJSON()` and `@nextrush/errors` `toJSON()`
- Unguarded `Error.captureStackTrace` (will throw in non-V8 runtimes)

---

## DX Observations

1. **`plugin()` vs `pluginAsync()`** split is user-facing friction — easy to misuse when a plugin becomes async later
2. **`start()`** is public API but its lifecycle implications (frozen middleware registration) aren't documented
3. **`route()` type assertion** to mutate `ctx.path` (readonly in contract) makes alternate context implementations brittle
4. **`onError()` naming** implies event subscription, not setter — could be `setErrorHandler()` for clarity

---

## Performance Profile

- `compose()` compilation is NOT per-request in typical adapter usage: `callback()` composes once ✅
- Per-request costs in `compose()`:
  - 1 `dispatch` function allocation
  - N+1 `nextFn` closures
  - N+1 Promises (from async dispatch)
  - 1 `typeof setNext` check per hop (eliminable)
- Per-request costs in mounted `route()`:
  - `startsWith`, `charCodeAt`, `slice` string operations
  - 2 property writes to `ctx.state` + 2 `ctx.path` writes
  - 1 async wrapper closure per match
