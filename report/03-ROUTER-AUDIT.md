# Router Package Audit (`@nextrush/router`)

## Package Overview

- **Files**: `router.ts`, `radix-tree.ts`
- **Performance Score**: 5/10
- **Correctness Score**: 4/10

---

## CRITICAL Issues

### 1. Case-Insensitive Matching Lowercases Parameter Values

- **Location**: `packages/router/src/router.ts#L346-L371`
- **Evidence**:
  ```typescript
  let normalized = this.opts.caseSensitive ? path : path.toLowerCase();
  // segments extracted from lowercased path → params get lowercased too
  params[paramName] = segment; // segment is already lowercase!
  ```
- **Impact**: For route `/users/:id` with `caseSensitive=false`, request `GET /users/ABC-123` yields `ctx.params.id === "abc-123"` instead of `"ABC-123"`. This breaks:
  - Case-sensitive database lookups
  - UUID/GUID matching
  - Token validation
  - Any auth flow using URL params
- **Fix**: Preserve original segments for params; only lowercase for static segment comparison.

### 2. "No Match" Falls Through as 200 Empty Response

- **Location**: `packages/router/src/router.ts#L435-L444`
- **Evidence**:
  ```typescript
  if (!match) {
    if (next) await next();
    return;
  }
  ```
  Combined with `NodeContext` defaulting `status = 200`.
- **Impact**: If router is last middleware (or downstream sets nothing), client receives 200 with empty body instead of 404. This also makes `allowedMethods()` ineffective since it only runs when `ctx.status === 404`.
- **Fix**: Ensure explicit 404 in the pipeline (router, core, or adapter) when nothing handles the request.

---

## HIGH Issues

### 3. `allowedMethods()` is O(M × K): 7× Full Match on 404

- **Location**: `packages/router/src/router.ts#L483-L517`
- **Evidence**:
  ```typescript
  for (const method of HTTP_METHODS) {
    if (this.match(method, ctx.path)) allowed.push(method);
  }
  ```
- **Impact**: On 404, does 7 full `match()` traversals including normalization:
  - 7 × toLowerCase + replace + split + filter + tree traversal
  - ~$3.9-5.3\mu s$ per 404 just for normalization (before tree walk)
  - 404-heavy traffic (scans/bots) becomes measurable CPU tax
- **Fix**: Walk tree once (path-only) and read `node.handlers.keys()` to build `Allow` header. Or store allowed-methods bitmask on nodes at registration time.

### 4. `match()` Allocates Middleware Arrays That `routes()` Never Uses

- **Location**: `packages/router/src/router.ts#L364-L371`
- **Evidence**: `middleware: [...this.routerMiddleware, ...result.middleware]`
- **Impact**: Per successful match: allocates + copies array of middleware references. `routes()` uses executor and `routerMiddleware` directly, ignoring `match.middleware`.
- **Fix**: Internal hot path should return `{ params, executor }` without middleware array.

### 5. `delete` in Backtracking Causes V8 Deopt

- **Location**: `packages/router/src/router.ts#L399-L404`
- **Evidence**: `delete params[paramName];`
- **Impact**: V8 `delete` tends to deopt objects (hidden class churn). Benchmark: ~225 ns/op for set+delete vs ~7 ns/op for set+undefined (~32× slower).
- **Fix**: Use param stack/array, commit only on successful match; or set to `undefined` and clean at end.

---

## MEDIUM Issues

### 6. Redundant Per-Segment toLowerCase

- **Location**: `packages/router/src/router.ts#L389-L395`
- **Evidence**: When `caseSensitive=false`, `match()` already lowercased the entire path, but each segment gets lowercased again in static lookup.
- **Fix**: Remove per-segment lowercasing when path-wide lowercasing is active.

### 7. Wildcard Capture Allocates via `slice().join('/')`

- **Location**: `packages/router/src/router.ts#L406-L410`
- **Evidence**: `params['*'] = segments.slice(index).join('/')`
- **Impact**: Allocates new array + string; cost grows with remaining segments.
- **Fix**: Track string offsets during segmentation; use `cleanPath.slice(offset)` for remainder.

### 8. Per-Request Dispatch Closure for Router Middleware

- **Location**: `packages/router/src/router.ts#L452-L476`
- **Evidence**: `const dispatchRouterMw = async (): Promise<void> => { ... }`
- **Fix**: Compose router middleware once at registration time.

---

## LOW Issues

### 9. Redirect Param Interpolation is Naive

- **Location**: `packages/router/src/router.ts#L220-L257`
- **Evidence**: `targetPath.replace(\`:${key}\`, value)`— only replaces first occurrence;`:id`matches inside`:id2` (substring).
- **Fix**: Tokenize `to` once at registration; use exact-match substitution at runtime.

### 10. Redirect Only Registers GET/HEAD

- **Location**: `packages/router/src/router.ts#L251-L255`
- **Impact**: POST/PUT/etc with 307/308 won't be redirected.

---

## Per-Request Cost Breakdown

| Operation                    | Cost         | Allocations                         |
| ---------------------------- | ------------ | ----------------------------------- |
| `path.toLowerCase()`         | ~21 ns/op    | 1 string                            |
| `replace(/\/+/g, '/')`       | ~159 ns/op   | 0–1 string                          |
| `split('/').filter(Boolean)` | ~185 ns/op   | 2 arrays + N strings                |
| Full normalize+split         | ~764 ns/op   | multiple                            |
| `params: {}`                 | -            | 1 object (always, even zero params) |
| `matchNode()` recursion      | O(segments)  | stack frames                        |
| `delete params[k]` backtrack | ~225 ns/op   | hidden-class deopt risk             |
| Wildcard `slice().join('/')` | O(remaining) | 1 array + 1 string                  |
| `middleware: [...a, ...b]`   | O(mw count)  | 1 array                             |
| `dispatchRouterMw` closure   | per request  | 1 closure                           |

---

## Bottleneck Ranking (Most Wasteful)

1. **`split('/').filter(Boolean)`** + segment string creation
2. **Unconditional `replace(/\/+/g, '/')`** even when no `//`
3. **Path-wide `toLowerCase()`** + redundant per-segment lowercasing
4. **Per-match middleware array copying** (unused by `routes()`)
5. **`allowedMethods()` 7× `match()` on 404**
6. **`delete` backtracking** on param mismatch paths

---

## Radix Tree (`radix-tree.ts`)

### `compileExecutor` hidden per-request cost

- **Location**: `packages/router/src/radix-tree.ts#L102-L117`
- **Evidence**: "General case" (>2 middleware) creates a per-request `dispatch` closure despite comment claiming otherwise
- **Fix**: Pre-build a composed function at registration time so per-request executor is a single call

### Optimized specializations (len=0,1,2) are good

- `packages/router/src/radix-tree.ts#L72-L100`
- These avoid the general-case allocation for common routes ✅
