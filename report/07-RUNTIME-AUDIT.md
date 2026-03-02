# Runtime Package Audit (`@nextrush/runtime`)

## Package Overview

- **Files**: `detection.ts`, `body-source.ts`, `types.ts`, `index.ts`
- **Architecture Score**: 6/10
- **Correctness Score**: 5/10
- **Cross-Runtime Score**: 5/10

---

## CRITICAL Issues

### 1. CJS `require()` in ESM Adapter (Runtime Crash Path)

See [01-CRITICAL-ISSUES.md → CRIT-07](01-CRITICAL-ISSUES.md)

### 2. Body Size Limit After Full Buffering (DoS)

See [01-CRITICAL-ISSUES.md → CRIT-12](01-CRITICAL-ISSUES.md)

---

## HIGH Issues

### 3. Vercel "Edge" Detection Misclassifies Node on Vercel

- **Location**: `packages/runtime/src/detection.ts#L59-L75`
- **Evidence**:
  ```typescript
  // Runs BEFORE Node detection
  if (process.env.VERCEL_REGION !== undefined) return 'vercel-edge';
  // Node detection below
  if (process.versions.node) return 'node';
  ```
- **Impact**: Any Node.js runtime on Vercel (serverless functions) is misidentified as `'vercel-edge'`. `getRuntimeCapabilities()` returns `{ fileSystem: false }` for actual Node.js.
- **Fix**: Reorder — check `process.versions.node` before `VERCEL_REGION`.

### 4. `JSON.parse` Without try/catch at Body Boundary

See [01-CRITICAL-ISSUES.md → CRIT-08](01-CRITICAL-ISSUES.md)

### 5. Duplicate Error Classes Break `instanceof`

- **Runtime defines**: `packages/runtime/src/body-source.ts#L19-L39`
- **Node adapter defines**: `packages/adapters/node/src/body-source.ts#L17-L40`
- **Impact**: `instanceof BodyTooLargeError` from runtime won't match adapter-node's version

---

## MEDIUM Issues

### 6. `AbstractBodySource` Documented as Base, but Adapters Don't Extend It

- **Doc claim**: `packages/runtime/src/body-source.ts#L41-L69`
- **Reality**: Node adapter implements independent `NodeBodySource` with duplicated logic
- **Impact**: Fixes to consumption/caching/limits must be replicated across packages; easy drift

### 7. `getRuntimeCapabilities()` Hardcoded by Runtime Name

- **Location**: `packages/runtime/src/detection.ts#L178-L240`
- **Impact**: Capabilities depend on runtime version/build; hardcoding is fragile. Currently low blast radius but a future trap.

### 8. Content-Length `0` Parsed as `undefined`

- **Location**: `packages/runtime/src/body-source.ts#L84-L87`
- **Evidence**: `parseInt(contentLength, 10) || undefined` — falsy `0` becomes `undefined`
- **Impact**: Usually benign but incorrect metadata; weakens pre-check logic.
- **Fix**: Use ternary: `const len = parseInt(..., 10); return Number.isNaN(len) ? undefined : len;`

### 9. `resetRuntimeCache()` Publicly Exported Despite `@internal`

- **Location**: Definition: `packages/runtime/src/detection.ts#L321-L326`, Export: `packages/runtime/src/index.ts#L29-L41`
- **Impact**: Users may depend on it; future removal becomes breaking change.

---

## Detection Accuracy Matrix

| Runtime            | Detection Method                                     | Reliability | Edge Cases                              |
| ------------------ | ---------------------------------------------------- | :---------: | --------------------------------------- |
| bun                | `'Bun' in globalThis`                                |  ⚠️ Medium  | Spoofable by setting `globalThis.Bun`   |
| deno               | `'Deno' in globalThis`                               |  ⚠️ Medium  | Same spoofability                       |
| cloudflare-workers | `navigator.userAgent.includes('Cloudflare-Workers')` |  ⚠️ Medium  | `navigator.userAgent` mutable           |
| vercel-edge        | `process.env.VERCEL_REGION`                          |   ❌ Low    | **Misclassifies Node on Vercel**        |
| node               | `process.versions.node`                              |   ✅ High   | Correct; should run before Vercel check |
| edge (generic)     | `globalThis.Request` + `globalThis.Response`         |  ⚠️ Medium  | Node 18+ has these too                  |

---

## Body Source Duplication Map

| Class/Constant       | `@nextrush/runtime` | `@nextrush/adapter-node` |                      Compatible?                       |
| -------------------- | :-----------------: | :----------------------: | :----------------------------------------------------: |
| `BodyConsumedError`  |         ✅          |      ✅ (duplicate)      |                 ❌ `instanceof` fails                  |
| `BodyTooLargeError`  |         ✅          |      ✅ (duplicate)      |                 ❌ `instanceof` fails                  |
| `DEFAULT_BODY_LIMIT` |         ✅          |      ✅ (duplicate)      |                          N/A                           |
| `EmptyBodySource`    |         ✅          |      ✅ (duplicate)      | Behavior differs; Node version has ESM `require` crash |

---

## Global State Analysis

- **Mutable state**: `let cachedRuntime: Runtime | undefined` in `detection.ts#L89-L117`
- **Mutation points**: Set in `getRuntime()`, cleared by `resetRuntimeCache()`
- **Risk**: Not data-race (single-threaded), but test determinism risk if env stubs change mid-run
- **Current mitigation**: Tests reset cache before each test ✅

---

## Recommendations

1. **P0**: Fix Vercel detection order (check `process.versions.node` first)
2. **P0**: Replace `require()` with ESM `import` in EmptyBodySource
3. **P0**: Add try/catch around `JSON.parse` in body source
4. **P1**: Implement streaming size checking (abort on limit exceeded during read)
5. **P1**: Unify error classes with canonical package (either errors or runtime — pick one)
6. **P2**: Have adapters extend `AbstractBodySource` to reduce duplication
7. **P2**: Fix `parseInt || undefined` to handle `0` correctly
