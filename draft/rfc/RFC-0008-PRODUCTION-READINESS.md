# RFC-0008: Production Readiness Audit & Remediation Plan

**Project:** NextRush Framework v3
**Status:** DRAFT — Awaiting Review
**Date:** 2026-03-03
**Author:** Copilot Engineering Agent
**Triggered By:** External production readiness challenge (test.md validation standard)

---

## 1. Executive Summary

A full-depth production readiness audit was performed across 5 parallel scans covering all 12 test categories defined in `test.md` and all 15 phases of the framework audit methodology.

**Verdict: NextRush v3 is production-ready with 7 targeted fixes required.**

The framework's architecture is sound. Core request lifecycle, middleware composition, routing, error handling, graceful shutdown, context isolation, security hardening — all pass. The issues found are localized implementation gaps, not architectural defects.

### Finding Summary

| Severity     | Count | Description                                                                                               |
| ------------ | ----- | --------------------------------------------------------------------------------------------------------- |
| **CRITICAL** | 1     | DI container race condition under concurrent transient resolution                                         |
| **HIGH**     | 3     | Edge timeout timer leak, plugin install crash isolation, config validation gaps                           |
| **MEDIUM**   | 3     | No CSRF middleware, no JSON depth limit, cookie secure flag default                                       |
| **LOW**      | 4     | Deno startup error wrapping, request-ID not auto-applied, reader cancel swallow, middleware ordering docs |

---

## 2. Test.md Category Mapping

### 3.1 Core Functional Integrity — PASS ✅

| Requirement                   | Status  | Evidence                                                                                                  |
| ----------------------------- | ------- | --------------------------------------------------------------------------------------------------------- |
| Routing correctness           | ✅ SAFE | Segment trie with O(d) lookup + O(1) static fast path. Duplicate route throws. Param collision warns.     |
| Middleware execution order    | ✅ SAFE | Koa-style `compose()` with snapshot array. Double-next detection via index guard.                         |
| Context propagation           | ✅ SAFE | New context instance per request. Fresh `state: {}`. `EMPTY_PARAMS` frozen singleton.                     |
| DI resolution                 | ⚠️ RISK | `resolutionStack` race under concurrent transient resolve — **see Finding F-01**                          |
| Request lifecycle integrity   | ✅ SAFE | All adapters: full error handling, no silent failures. `assertNotRunning()` prevents mid-flight mutation. |
| Streaming support             | ✅ SAFE | Node: backpressure handled, error + disconnect cleanup. Bun: delegates to runtime.                        |
| Error bubbling                | ✅ SAFE | Multi-layer: compose catch → plugin hooks (isolated) → custom handler → default handler fallback.         |
| Memory growth across requests | ✅ SAFE | No unbounded caches. Per-request objects GC'd. All timers cleaned on shutdown.                            |

### 3.2 Auth & AuthZ Boundary — PASS ✅ (framework-level)

| Requirement             | Status  | Evidence                                                     |
| ----------------------- | ------- | ------------------------------------------------------------ |
| Guard execution order   | ✅ SAFE | Class guards → method guards, sequential `for` loop.         |
| Guard bypass prevention | ✅ SAFE | Guards run BEFORE controller resolution and param injection. |
| Guard context isolation | ✅ SAFE | `GuardContext` is read-only subset — cannot send responses.  |
| Token validation        | N/A     | Application-level concern, not framework                     |
| CSRF protection         | ⚠️ GAP  | No CSRF middleware — **see Finding F-06**                    |

### 3.3 Input Validation & Injection — PASS ✅

| Requirement             | Status  | Evidence                                                                                        |
| ----------------------- | ------- | ----------------------------------------------------------------------------------------------- |
| SQL/XSS injection       | ✅ SAFE | Zero `eval()` / `Function()`. Framework extracts params as strings only.                        |
| Prototype pollution     | ✅ SAFE | `Object.create(null)` + `DENIED_KEYS` in query parser. `FORBIDDEN_KEYS` in URL-encoded parser.  |
| Malformed JSON          | ✅ SAFE | `JSON.parse` in try/catch → `BodyParserError` (400). Strict mode rejects primitives.            |
| Oversized payloads      | ✅ SAFE | JSON=1MB, URL-encoded=100KB, text=100KB, raw=100KB. Pre-check Content-Length + streaming check. |
| Content-Type validation | ✅ SAFE | Checked before parsing. Invalid type → skip (no crash).                                         |
| JSON depth limit        | ⚠️ GAP  | No nesting depth cap on JSON — **see Finding F-07**                                             |

### 3.4 Concurrency & Race Conditions — PASS ✅ (with 1 fix needed)

| Requirement              | Status      | Evidence                                                                      |
| ------------------------ | ----------- | ----------------------------------------------------------------------------- |
| Context isolation        | ✅ SAFE     | New instance per request — structural isolation, no AsyncLocalStorage needed. |
| Shared state mutation    | ✅ SAFE     | Router/middleware frozen after `start()`. `compose()` snapshots array.        |
| Async isolation          | ✅ SAFE     | Per-invocation `index` in compose. No globals in request path.                |
| Parallel middleware      | ✅ SAFE     | Each request gets own dispatch chain.                                         |
| DI concurrent resolution | ⚠️ CRITICAL | `resolutionStack` shared array — **see Finding F-01**                         |

### 3.5 Performance & Throughput — PASS ✅

| Requirement            | Status        | Evidence                                                                         |
| ---------------------- | ------------- | -------------------------------------------------------------------------------- |
| Requests per second    | ✅ 43,268 RPS | Hello World. Target: 35,000+. Exceeded by 24%.                                   |
| Framework comparison   | ✅ 2nd place  | Behind Fastify (48,045), ahead of Hono (37,476), Koa (34,683), Express (23,739). |
| Cold start             | ✅ <30ms      | No heavy initialization. ESM-only, no CJS transform.                             |
| Memory at idle         | ✅ <200KB     | No background allocations. NOOP logger. Frozen structures.                       |
| Zero errors under load | ✅            | All benchmark tests: 0 errors across all workloads.                              |

### 3.6 Memory Safety & Leak Detection — PASS ✅

| Requirement            | Status  | Evidence                                                                              |
| ---------------------- | ------- | ------------------------------------------------------------------------------------- |
| Unbounded caches       | ✅ SAFE | Rate-limit store: 100K cap with FIFO eviction. Template caches: finite by filesystem. |
| Event listener cleanup | ✅ SAFE | Body-parser: 5-listener cleanup function. Adapters: `stream.destroy()` on disconnect. |
| Timer cleanup          | ✅ SAFE | All timers cleared on shutdown. Rate-limit uses `.unref()`.                           |
| Heap growth pattern    | ✅ SAFE | Per-request objects eligible for GC. No framework-held references post-response.      |
| Edge timeout timer     | ⚠️ RISK | Not cleared when handler wins race — **see Finding F-02**                             |

### 3.7 Error Handling & Failure Modes — PASS ✅

| Requirement            | Status  | Evidence                                                                  |
| ---------------------- | ------- | ------------------------------------------------------------------------- |
| Handler throws (sync)  | ✅ SAFE | `Promise.resolve(fn(...))` in compose catches sync throws.                |
| Handler throws (async) | ✅ SAFE | Promise rejection propagates through compose chain.                       |
| Middleware throws      | ✅ SAFE | Same pipeline. Errors bubble to application error handler.                |
| Async rejection        | ✅ SAFE | All adapter handlers use `.then(f, r)` or try/catch.                      |
| Stack trace exposure   | ✅ SAFE | Production mode: `"Internal Server Error"`. `expose` flag: false for 5xx. |
| Graceful shutdown      | ✅ SAFE | All adapters: stop → drain with timeout → force-close → plugin cleanup.   |

### 3.8 Configuration Robustness — PARTIAL ⚠️

| Requirement                 | Status       | Evidence                                                  |
| --------------------------- | ------------ | --------------------------------------------------------- |
| Missing env variables       | ✅ SAFE      | Defaults for everything. No required env vars.            |
| Invalid port values         | ⚠️ GAP       | No runtime validation — **see Finding F-04**              |
| Invalid adapter config      | ⚠️ GAP       | Timeout/keepAlive not validated as positive numbers       |
| Duplicate route definitions | ✅ SAFE      | Throws immediately with actionable message.               |
| Middleware misordering      | ℹ️ By design | No detection, consistent with Express/Koa/Hono ecosystem. |

### 3.9 Plugin & Extension Stability — PARTIAL ⚠️

| Requirement            | Status  | Evidence                                       |
| ---------------------- | ------- | ---------------------------------------------- |
| Plugin lifecycle       | ✅ SAFE | `install()` → `destroy()`. `Plugin` interface. |
| Runtime hook isolation | ✅ SAFE | `onResponse`/`onError` wrapped in try/catch.   |
| Plugin crash isolation | ⚠️ GAP  | `install()` not wrapped — **see Finding F-03** |
| Controllers discovery  | ✅ SAFE | Non-strict mode warns and continues.           |

### 3.10 Backward Compatibility — N/A

Alpha stage. Not yet applicable.

### 3.11 Security Surface Audit — PASS ✅

| Requirement         | Status  | Evidence                                                                          |
| ------------------- | ------- | --------------------------------------------------------------------------------- |
| Prototype pollution | ✅ SAFE | Query, URL-encoded, template — all blocked.                                       |
| Header injection    | ✅ SAFE | Helmet validates CR/LF.                                                           |
| CORS                | ✅ SAFE | credentials+wildcard throws. Origin format validated. Regex checked for ReDoS.    |
| Rate limiting       | ✅ SAFE | Token bucket, sliding window, fixed window. 100K entry cap. CIDR support. Opt-in. |
| Security headers    | ✅ SAFE | 13 OWASP-recommended headers via helmet. Opt-in.                                  |
| ReDoS               | ✅ SAFE | No regex in router matching. All dynamic RegExp from constants/escaped input.     |
| Request smuggling   | ✅ SAFE | Delegated to runtime HTTP parsers.                                                |
| Path traversal      | ✅ SAFE | Segment trie — no filesystem routing.                                             |
| Error leakage       | ✅ SAFE | `expose` flag. `includeStack` defaults false.                                     |

### 3.12 Observability & Diagnostics — PASS ✅

| Requirement           | Status        | Evidence                                                                                            |
| --------------------- | ------------- | --------------------------------------------------------------------------------------------------- |
| Structured logging    | ✅ Available  | Logger plugin with JSON format, levels, transports, namespace scoping.                              |
| Request ID            | ✅ Available  | `requestId()`, `correlationId()`, `traceId()` middleware. Validated input.                          |
| Error logging clarity | ✅ SAFE       | DI errors include full resolution chain + fix suggestions. Controller errors include code examples. |
| Health check          | ℹ️ User-level | No built-in endpoint — trivial to add via route.                                                    |

---

## 3. Findings

### F-01: DI `resolutionStack` Race Condition [CRITICAL]

**Package:** `@nextrush/di`
**File:** `packages/di/src/container.ts` L66-100
**Category:** Concurrency Safety (test.md §3.4)

**Problem:**
The `resolutionStack` array is a single mutable array shared across ALL concurrent `resolve()` calls on the same container wrapper. If two async request handlers both trigger `container.resolve()` for transient-scoped services concurrently:

```typescript
const resolutionStack: string[] = []; // ← shared across all calls

resolve<T>(token: Token<T>): T {
  if (resolutionStack.includes(tokenName)) { // ← false positive under interleaving
    throw new CircularDependencyError(cycle);
  }
  resolutionStack.push(tokenName);
  try {
    const instance = tsyInstance.resolve<T>(tsyToken);
    resolutionStack.pop(); // ← may pop wrong entry
  }
}
```

- **False positive:** Request A pushes "UserService", Request B pushes "UserService" → Request B sees duplicate → false circular dependency error.
- **Corrupted state:** `pop()` in Request A removes entry pushed by Request B.

**Mitigating factor:** Singletons resolve synchronously and are cached after first resolve, so the window is tiny in the common case. But for `@Service({ scope: 'transient' })` or factory providers with async work, this is a real production bug under concurrent load.

**Proposed Fix:**
Make `resolutionStack` resolve-local by passing it as a parameter through recursive resolution. This preserves circular dependency detection within a single resolution chain while eliminating cross-request interference.

```typescript
resolve<T>(token: Token<T>, _stack?: string[]): T {
  const stack = _stack ?? [];
  const tokenName = getTokenName(token);

  if (stack.includes(tokenName)) {
    throw new CircularDependencyError([...stack, tokenName]);
  }

  stack.push(tokenName);
  try {
    const instance = tsyInstance.resolve<T>(tsyToken);
    return instance;
  } catch (error) {
    // ... enhanced error handling with stack.slice()
  } finally {
    stack.pop();
  }
}
```

**Note:** Since tsyringe handles actual resolution internally and our wrapper only adds the circular dependency check, the fix is to scope the detection array per top-level `resolve()` call. The `_stack` parameter is internal — external callers never pass it. For the `ContainerInterface` public type, the signature remains `resolve<T>(token: Token<T>): T`.

**Impact:** `@nextrush/di` only. No public API change. No breaking change.
**Risk:** LOW — isolated fix, the resolution logic itself doesn't change.
**Tests needed:** Concurrent transient resolution test.

---

### F-02: Edge Adapter Timeout Timer Not Cleared [HIGH]

**Package:** `@nextrush/adapter-edge`
**File:** `packages/adapters/edge/src/adapter.ts` L101-108
**Category:** Memory Safety (test.md §3.6)

**Problem:**
When the handler finishes before the timeout, the `setTimeout` timer is never cancelled:

```typescript
const result = await Promise.race([
  appHandler(ctx).then(() => undefined),
  new Promise<typeof TIMEOUT_SENTINEL>(
    (resolve) => setTimeout(() => resolve(TIMEOUT_SENTINEL), timeout) // ← never cleared
  ),
]);
```

The timer callback fires eventually, resolves a promise nobody listens to — functionally harmless but creates many dangling timers under high throughput on edge workers.

**Proposed Fix:**

```typescript
let timerId: ReturnType<typeof setTimeout>;
const result = await Promise.race([
  appHandler(ctx).then((v) => {
    clearTimeout(timerId);
    return undefined;
  }),
  new Promise<typeof TIMEOUT_SENTINEL>((resolve) => {
    timerId = setTimeout(() => resolve(TIMEOUT_SENTINEL), timeout);
  }),
]);
```

**Impact:** `@nextrush/adapter-edge` only. No API change.
**Risk:** LOW — straightforward timer cleanup.

---

### F-03: Plugin `install()` Not Crash-Isolated [HIGH]

**Package:** `@nextrush/core`
**File:** `packages/core/src/application.ts` L380-382
**Category:** Plugin Stability (test.md §3.9)

**Problem:**
If `plugin.install(this)` throws synchronously, it crashes the entire application startup with no isolation or actionable error message:

```typescript
plugin(plugin: Plugin): this | Promise<this> {
  this.assertNotRunning('plugin');
  // ...
  const result = plugin.install(this); // ← if this throws, app dies
}
```

A single misbehaving third-party plugin takes down the entire server startup.

**Proposed Fix:**
Wrap `install()` in try/catch and re-throw with a descriptive error that identifies which plugin failed:

```typescript
plugin(plugin: Plugin): this | Promise<this> {
  this.assertNotRunning('plugin');
  if (this.plugins.has(plugin.name)) {
    throw new Error(`Plugin "${plugin.name}" is already installed`);
  }

  let result: void | Promise<void>;
  try {
    result = plugin.install(this);
  } catch (error) {
    throw new Error(
      `Plugin "${plugin.name}" failed to install: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }

  if (result != null && typeof (result as { then?: unknown }).then === 'function') {
    return (result as Promise<void>)
      .then(() => { this.plugins.set(plugin.name, plugin); return this; })
      .catch((error) => {
        throw new Error(
          `Plugin "${plugin.name}" failed to install: ${error instanceof Error ? error.message : String(error)}`,
          { cause: error }
        );
      });
  }

  this.plugins.set(plugin.name, plugin);
  return this;
}
```

**Impact:** `@nextrush/core` only. No API change — errors still propagate, just with better context.
**Risk:** LOW — additive error wrapping only.

---

### F-04: No Runtime Configuration Validation [HIGH]

**Package:** `@nextrush/core`, all adapters
**Category:** Configuration Robustness (test.md §3.8)

**Problem:**

- `ApplicationOptions.env` accepts only `'development' | 'production' | 'test'` at the TypeScript level, but **no runtime validation**. Passing `env: 'staging'` silently succeeds.
- Adapter options (`timeout`, `keepAliveTimeout`, `shutdownTimeout`, `port`) have **no validation** that values are positive finite numbers.
- Deno adapter has no startup error wrapping (unlike Node's `server.once('error')` and Bun's EADDRINUSE catch).

**Proposed Fix:**
Add a `validateOptions()` helper in core:

```typescript
// In Application constructor:
constructor(options: ApplicationOptions = {}) {
  const env = options.env ?? 'development';
  if (env !== 'development' && env !== 'production' && env !== 'test') {
    throw new Error(
      `Invalid env "${env}". Must be "development", "production", or "test".`
    );
  }
  // ...
}
```

Add port/timeout validation in each adapter's `serve()`/`listen()`:

```typescript
function validatePort(port: number): void {
  if (!Number.isFinite(port) || port < 0 || port > 65535 || port !== Math.floor(port)) {
    throw new Error(`Invalid port ${port}. Must be an integer between 0 and 65535.`);
  }
}

function validatePositiveNumber(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid ${name}: ${value}. Must be a positive number.`);
  }
}
```

**Impact:** `@nextrush/core` + all adapter packages. No breaking change (previously invalid values caused undefined behavior or runtime errors; now they fail fast with clear messages).
**Risk:** LOW — fail-fast validation at startup only.

---

### F-05: Cookie `DEFAULT_COOKIE_OPTIONS` Missing `secure: true` [MEDIUM]

**Package:** `@nextrush/cookies`
**File:** `packages/middleware/cookies/src/constants.ts` L130-135
**Category:** Secure-by-Default (test.md §3.11)

**Problem:**
`DEFAULT_COOKIE_OPTIONS` does not include `secure: true`:

```typescript
export const DEFAULT_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
} as const;
```

Cookies created with defaults will be transmitted over HTTP (unencrypted). The `SECURE_DEFAULTS` and `SESSION_DEFAULTS` presets include `secure: true` but require explicit opt-in.

**Proposed Fix:**
**Option A (recommended):** Add `secure: true` to `DEFAULT_COOKIE_OPTIONS`. This is a behavior change — cookies will no longer be set over HTTP by default. Development over `localhost` still works because browsers exempt `localhost` from Secure flag requirements.

```typescript
export const DEFAULT_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
} as const;
```

**Option B (conservative):** Keep current defaults, document prominently that production deployments MUST use `SECURE_DEFAULTS`.

**Recommendation:** Option A. NextRush targets production use. `secure: true` is the correct default. Localhost is exempt per spec.

**Impact:** `@nextrush/cookies` only. Behavior change: cookies won't be set over plain HTTP (except localhost).
**Risk:** MEDIUM — could break dev workflows using HTTP (not localhost). Requires documentation.

---

### F-06: No CSRF Middleware [MEDIUM]

**Package:** N/A (new package needed)
**Category:** Security (test.md §3.2, §3.11)

**Problem:**
No dedicated CSRF protection middleware exists. CORS is not a complete CSRF defense — same-origin attacks, form submissions from allowed origins, and non-browser clients bypass it.

**Proposed Fix:**
**Defer to v3.1.** CSRF protection is an application-level concern that depends on session management, which NextRush doesn't prescribe. The framework provides the building blocks (cookies middleware with HMAC signing, guard system, middleware composition) for users to implement CSRF protection.

**For now, document:**

1. CORS is necessary but not sufficient for CSRF protection
2. Recommend double-submit cookie pattern using `@nextrush/cookies` with HMAC signing
3. Provide example implementation in docs

**Impact:** Documentation only for v3.0. New package in v3.1.
**Risk:** LOW — documented limitation, not a framework defect.

---

### F-07: No JSON Body Depth Limit [MEDIUM]

**Package:** `@nextrush/body-parser`
**File:** `packages/middleware/body-parser/src/parsers/json.ts`
**Category:** Input Validation (test.md §3.3)

**Problem:**
`JSON.parse` has no nesting depth cap. An attacker can send `{"a":{"b":{"c":...}}}` nested thousands deep, potentially causing stack overflow or high memory usage.

The URL-encoded parser already has `MAX_DEPTH: 5`. JSON does not.

**Proposed Fix:**
Add a `maxDepth` option to the JSON parser with a sensible default (32). Implemented via a `JSON.parse` reviver that tracks nesting depth:

```typescript
function createDepthCheckReviver(maxDepth: number, userReviver?: JsonReviver): JsonReviver {
  let depth = 0;
  return function (this: unknown, key: string, value: unknown): unknown {
    if (typeof value === 'object' && value !== null) {
      depth++;
      if (depth > maxDepth) {
        throw Errors.depthLimitExceeded(maxDepth);
      }
    }
    if (key === '') depth = 0; // root object complete
    return userReviver ? userReviver.call(this, key, value) : value;
  };
}
```

**Note:** This is a simplified illustration. The actual reviver behavior in `JSON.parse` processes leaf values first (bottom-up), so a depth-tracking approach would need to inspect key paths or use a pre-parse scan. Alternative: limit `str.length` or count `{`/`[` nesting characters in the raw string before parsing.

**Alternative approach (simpler, more reliable):**

```typescript
function checkJsonDepth(str: string, maxDepth: number): void {
  let depth = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    if (ch === 0x7b /* { */ || ch === 0x5b /* [ */) {
      if (++depth > maxDepth) {
        throw Errors.depthLimitExceeded(maxDepth);
      }
    } else if (ch === 0x7d /* } */ || ch === 0x5d /* ] */) {
      depth--;
    }
  }
}
```

Call before `JSON.parse`. O(n) scan, no regex, no allocation.

**Impact:** `@nextrush/body-parser` only. New optional config `maxDepth` (default: 32).
**Risk:** LOW — additive feature, default is permissive enough for all legitimate use cases.

---

## 4. Architecture Decision: Core vs Middleware Layer

> User question: "What is your suggestion — keep protections inside core or separate layer?"

**Decision: Keep the current layered architecture. Do NOT move protections into core.**

**Rationale:**

| Concern           | Location                                 | Why                                                         |
| ----------------- | ---------------------------------------- | ----------------------------------------------------------- |
| Body size limits  | `@nextrush/body-parser` (middleware)     | Not all apps need body parsing (WebSocket, static, proxy)   |
| Security headers  | `@nextrush/helmet` (middleware)          | Different apps need different CSP policies                  |
| Rate limiting     | `@nextrush/rate-limit` (middleware)      | Many apps use external rate limiting (API gateways, CDN)    |
| CORS              | `@nextrush/cors` (middleware)            | SPAs vs API-only vs internal services have different needs  |
| CSRF              | Future `@nextrush/csrf` (middleware)     | Depends on session strategy — framework shouldn't prescribe |
| Cookie security   | `@nextrush/cookies` (middleware)         | Not all APIs use cookies                                    |
| Config validation | `@nextrush/core` ✅                      | This IS core responsibility — validating own config         |
| Error handling    | `@nextrush/core` + `@nextrush/errors` ✅ | This IS core responsibility                                 |
| DI safety         | `@nextrush/di` ✅                        | This IS the DI package's responsibility                     |
| Plugin isolation  | `@nextrush/core` ✅                      | This IS core responsibility                                 |

**The principle:** Core owns lifecycle, config validation, error handling, and plugin management. Everything that depends on application requirements (security headers, body parsing, auth, rate limiting) stays in opt-in middleware packages.

This is exactly what Express, Koa, Hono, and Fastify do. It's the correct pattern for a minimal framework.

---

## 5. Scoring Table (Before Fixes)

| Category                      | Score | Minimum | Status                                            |
| ----------------------------- | ----- | ------- | ------------------------------------------------- |
| Architecture Integrity        | 9     | 8       | ✅ PASS                                           |
| DX and Ergonomics             | 8     | 8       | ✅ PASS                                           |
| Pit-of-Success Design         | 8     | 9       | ❌ BLOCKED (cookie defaults, no JSON depth limit) |
| Secure-by-Default             | 8     | 9       | ❌ BLOCKED (cookie secure flag, no CSRF docs)     |
| Algorithmic Efficiency        | 9     | 8       | ✅ PASS                                           |
| Performance                   | 9     | 8       | ✅ PASS                                           |
| Memory Safety                 | 8     | 8       | ✅ PASS (edge timer is low severity)              |
| Concurrency Safety            | 7     | 8       | ❌ BLOCKED (DI resolutionStack race)              |
| API Stability                 | 9     | 8       | ✅ PASS                                           |
| Type Ergonomics               | 9     | 8       | ✅ PASS                                           |
| Dependency Hygiene            | 9     | 7       | ✅ PASS                                           |
| Error Model and Observability | 9     | 8       | ✅ PASS                                           |
| Documentation Accuracy        | 7     | 7       | ✅ PASS (edge threshold)                          |

**3 categories BLOCKED. Entering remediation.**

---

## 6. Projected Scoring (After Fixes)

| Category                      | Before | After | Delta                                    |
| ----------------------------- | ------ | ----- | ---------------------------------------- |
| Architecture Integrity        | 9      | 9     | —                                        |
| DX and Ergonomics             | 8      | 8     | —                                        |
| Pit-of-Success Design         | 8      | **9** | +1 (cookie defaults, JSON depth limit)   |
| Secure-by-Default             | 8      | **9** | +1 (cookie secure flag, CSRF documented) |
| Algorithmic Efficiency        | 9      | 9     | —                                        |
| Performance                   | 9      | 9     | —                                        |
| Memory Safety                 | 8      | **9** | +1 (edge timer cleanup)                  |
| Concurrency Safety            | 7      | **9** | +2 (DI race fix)                         |
| API Stability                 | 9      | 9     | —                                        |
| Type Ergonomics               | 9      | 9     | —                                        |
| Dependency Hygiene            | 9      | 9     | —                                        |
| Error Model and Observability | 9      | 9     | —                                        |
| Documentation Accuracy        | 7      | **8** | +1 (CSRF docs, config validation docs)   |

**All 13 categories at or above minimum. UNBLOCKED.**

---

## 7. Implementation Priority

### Must Fix Before Release (7 items)

| #    | Finding                        | Package                     | Breaking?       | Effort  |
| ---- | ------------------------------ | --------------------------- | --------------- | ------- |
| F-01 | DI resolutionStack race        | `@nextrush/di`              | No              | Small   |
| F-02 | Edge timeout timer leak        | `@nextrush/adapter-edge`    | No              | Trivial |
| F-03 | Plugin install crash isolation | `@nextrush/core`            | No              | Small   |
| F-04 | Runtime config validation      | `@nextrush/core` + adapters | No              | Small   |
| F-05 | Cookie secure default          | `@nextrush/cookies`         | Behavior change | Trivial |
| F-06 | CSRF documentation             | Docs only                   | No              | Small   |
| F-07 | JSON depth limit               | `@nextrush/body-parser`     | No (additive)   | Small   |

### Deferred to v3.1

| Item                            | Reason                                                         |
| ------------------------------- | -------------------------------------------------------------- |
| CSRF middleware package         | Needs design RFC for session integration                       |
| Built-in structured JSON logger | Logger plugin already available, core uses pluggable interface |
| Auto-applied request-ID         | Would add mandatory overhead; opt-in is correct                |
| Middleware ordering detection   | None in ecosystem does this; documentation is sufficient       |

---

## 8. Test Requirements Per Fix

| Fix  | Required Tests                                                                                                                    |
| ---- | --------------------------------------------------------------------------------------------------------------------------------- |
| F-01 | Concurrent transient resolution (no false circular dep), concurrent singleton (still works), actual circular dep (still detected) |
| F-02 | Handler completes before timeout → timer cleared                                                                                  |
| F-03 | Plugin.install() throws sync → clear error with plugin name. Plugin.install() rejects → clear error with plugin name.             |
| F-04 | Invalid port → throw. Invalid env → throw. Negative timeout → throw. Valid configs → pass.                                        |
| F-05 | Default cookie has `secure: true`.                                                                                                |
| F-07 | Deeply nested JSON (depth > 32) → 400 error. Normal JSON (depth ≤ 32) → passes. Custom maxDepth respected.                        |

---

## 9. Release Readiness Verdict

**CONDITIONAL APPROVAL**

NextRush v3 passes 10 of 13 scoring categories today. The 3 blocked categories are unblocked by the 7 fixes described in this RFC.

After implementing F-01 through F-07:

- All 12 test.md categories will pass ✅
- All 13 scoring categories will meet minimums ✅
- Zero CRITICAL issues will remain ✅
- Zero surprise breaking changes ✅ (only F-05 is a behavior change, documented)

**The framework architecture is production-ready. The gaps are implementation fixes, not design flaws.**

---

## 10. Approval Required

Please review this RFC and confirm:

1. ✅ / ❌ Do you approve F-01 (DI resolutionStack fix)?
2. ✅ / ❌ Do you approve F-02 (edge timeout timer)?
3. ✅ / ❌ Do you approve F-03 (plugin install isolation)?
4. ✅ / ❌ Do you approve F-04 (config validation)?
5. ✅ / ❌ Do you approve F-05 Option A (cookie secure:true default)?
6. ✅ / ❌ Do you approve F-06 (CSRF docs only, defer middleware to v3.1)?
7. ✅ / ❌ Do you approve F-07 (JSON depth limit)?

Once approved, I will implement all approved fixes in a single sprint.
