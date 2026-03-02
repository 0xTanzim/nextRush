# Cross-Cutting Performance Audit

## Aggregate Per-Request Allocation Trace

Baseline: Node adapter → Application with 1 router middleware → route handler calls `ctx.json({...})` on path `/`, no query string, no router-level middleware.

### Phase-by-Phase Allocation Count

| Phase              |                Allocations                 | Description                                                                                                   |
| ------------------ | :----------------------------------------: | ------------------------------------------------------------------------------------------------------------- |
| Context creation   |           ~6 objects + 1 string            | `new NodeContext` + `{ req, res }` + `query = {}` + `params = {}` + `state = {}` + `new EmptyBodySource()`    |
| Routing            | ~1 object + 1 match + 3 arrays + 2 strings | `toLowerCase()` + regex replace + `split().filter()` + `params = {}` + `middleware: [...a, ...b]` + match obj |
| Middleware compose |         ~2 functions + ~2 promises         | `dispatch` function + `nextFn` closure; async Promises                                                        |
| Response           |            1 object + 1 string             | User payload + `JSON.stringify()` result                                                                      |
| **TOTAL**          |           **~25-27 allocations**           | Plus hidden async control-flow promises/closures                                                              |

### Hidden Async Allocations (Success Path)

| Source                          | Promises | Closures |
| ------------------------------- | :------: | :------: |
| Adapter `.then().catch()` chain |    3     |    2     |
| Compose `dispatch(0)`           |    1     |    1     |
| Router middleware (async)       |    1     |    0     |
| Compiled executor (async)       |    1     |   0-1    |
| **Subtotal**                    |  **~6**  |  **~3**  |

**Grand Total: ~34+ allocations for a minimal "Hello World" JSON GET**

---

## Removable Allocations (Concrete Fixes)

| Allocation                                  | Location                            | Fix                                                         | Savings                |
| ------------------------------------------- | ----------------------------------- | ----------------------------------------------------------- | ---------------------- |
| `middleware: [...routerMw, ...routeMw]`     | `router.ts#L364-L369`               | Internal fast matcher returning only `{ params, executor }` | 1 array + spread       |
| `new EmptyBodySource()` per GET/HEAD        | `body-source.ts#L202-L207`          | Singleton (class is stateless)                              | 1 object/req           |
| Double `params = {}`                        | `context.ts#L81` + `router.ts#L358` | Reuse ctx.params or lazy init                               | 1 object/req           |
| Unconditional `replace(/\/+/g, '/')`        | `router.ts#L349-L351`               | Guard: `if (normalized.includes('//'))`                     | 1 string (common case) |
| Redundant `segment.toLowerCase()`           | `router.ts#L390-L394`               | Remove when path already lowercased                         | N strings/req          |
| `.then().catch()` → single `.then(ok, err)` | `adapter.ts#L84-L107`               | Single chained promise                                      | 1 Promise/req          |

**Total removable: ~5-8 allocations per request (15-25% reduction)**

---

## V8 Optimization Issues

| Issue                                                | Location                  | Impact                                                                       | Fix                                           |
| ---------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------- |
| `delete params[key]` backtracking                    | `router.ts#L397-L404`     | Hidden class churn → dictionary mode. 225 ns vs 7 ns for set+undefined (32×) | Param stack / set undefined                   |
| Wildcard `slice().join('/')`                         | `router.ts#L406-L410`     | O(segments) array + string per wildcard                                      | Track string offsets, use `cleanPath.slice()` |
| General-case executor creates per-request `dispatch` | `radix-tree.ts#L102-L117` | Closure per request despite comment                                          | Pre-build composed function at registration   |
| Repeated lowercasing                                 | `router.ts#L346,L390`     | Extra allocations + work in hottest loop                                     | Remove redundant per-segment pass             |

---

## Async Overhead Analysis

| Await Point                               |       Necessary?        | Alternative                                           |
| ----------------------------------------- | :---------------------: | ----------------------------------------------------- |
| `compose()` async dispatch + `await fn()` | Yes (supports async MW) | Promise-threading compose without async state machine |
| `routes()` awaits `match.executor(ctx)`   |       Conditional       | Fast path for sync handlers                           |
| `compileExecutor` always `await`          |  Not for sync handlers  | Separate sync executor path                           |
| Adapter `.then().catch()`                 |           No            | Single `.then(ok, err)` or async handler              |

**Await count for minimal successful request: 4-5 await points** minimum, each creating microtask queue pressure.

---

## Closure Count Per Request

| Closure                            | Per-Request? | Source                    |
| ---------------------------------- | :----------: | ------------------------- |
| `dispatch(i)` inside compose       |     Yes      | `middleware.ts#L63-L106`  |
| `nextFn = () => dispatch(i+1)`     |    Yes ×N    | `middleware.ts#L93-L103`  |
| Adapter `.then(() => {...})`       |     Yes      | `adapter.ts#L84-L107`     |
| Adapter `.catch((e) => {...})`     |     Yes      | `adapter.ts#L84-L107`     |
| Router `dispatchRouterMw`          | Conditional  | `router.ts#L452-L471`     |
| Executor `dispatch` (general case) | Yes (>2 MW)  | `radix-tree.ts#L102-L117` |

---

## Hot Path Rankings (Most Expensive → Least)

1. **Promise/async control-flow churn** — multiple Promises + closures across adapter → app → compose → routes → executor
2. **Router path normalization + segmentation** — `replace` + `split/filter` allocations
3. **Redundant lowercasing** in `matchNode` per segment
4. **Unused middleware array** construction inside `match()`
5. **EmptyBodySource + double params** allocation in context
6. **`delete` backtracking + wildcard `slice/join`** on match failures

---

## RPS Impact Estimation

### Microbenchmark Data (Node 25.x, this machine)

| Operation                         | Time          |
| --------------------------------- | ------------- |
| `toLowerCase`                     | ~21 ns/op     |
| Regex `replace(/\/+/g, '/')`      | ~159 ns/op    |
| `split('/').filter(Boolean)`      | ~249 ns/op    |
| `includes('//') ? replace : path` | ~68 ns/op avg |

### Allocation Rate at Target 35K RPS

- ~34 allocations/req × ~48 bytes avg → **~1.6 KB transient/req**
- At 35K RPS: **~56 MB/s allocation rate**
- Forces frequent GC cycles, capping throughput well before 35K on realistic workloads

### Estimated Improvement from Easy Fixes

| Fix                            | Est. RPS Gain |
| ------------------------------ | :-----------: |
| Remove setNext typeof check    |      ~5%      |
| Singleton EmptyBodySource      |      ~2%      |
| Fast-path `includes('//')`     |      ~3%      |
| Remove redundant toLowerCase   |      ~2%      |
| Remove unused middleware array |      ~3%      |
| Single `.then(ok, err)`        |      ~2%      |
| **Combined**                   |  **~15-20%**  |

---

## Competitor Context

NextRush in current hot path: **~34+ allocations** for minimal JSON route.

Frameworks designed around single-promise dispatch + minimal path parsing typically achieve **single-digit allocations** for the same workload. The allocation gap is the primary performance bottleneck, not CPU computation.
