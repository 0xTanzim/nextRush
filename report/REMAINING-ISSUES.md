# NextRush v3 — Remaining Audit Issues

> Generated after completing Phases 1–6 (29 security, architecture, performance, and DX fixes).
> 39 issues remain across 5 severity tiers.

---

## Critical (8)

| ID      | Package               | Issue                                                                                                                                                                                                                              | Impact                               |
| ------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| CRIT-02 | adapter-node          | **IP Spoofing — Unconditional X-Forwarded-For Trust.** `getClientIp()` always reads `X-Forwarded-For` regardless of `proxy` option. Any client can spoof IP, bypassing rate limiting, audit logging, geo-fencing.                  | Security — auth/rate-limit bypass    |
| CRIT-04 | adapter-node          | **`ctx.send(object)` produces hung connections.** Sets `_responded = true` before routing to `json()`, which then returns immediately. Response never sends; connection hangs until timeout.                                       | Reliability — hung connections       |
| CRIT-06 | types                 | **Node.js coupling in @nextrush/types.** Foundation package imports `Readable` from `node:stream`, uses `Buffer`, `NodeJS.ReadableStream`, `BufferEncoding`, and has `"types": ["node"]` in tsconfig. Breaks Deno/Edge/Bun builds. | Portability — cross-runtime broken   |
| CRIT-07 | adapter-node          | **`require()` in ESM module.** `EmptyBodySource.stream()` uses CJS `require('node:stream')` — hard crash in ESM for any GET/HEAD/OPTIONS/DELETE triggering `bodySource.stream()`.                                                  | Reliability — crash on stream access |
| CRIT-08 | runtime, adapter-node | **`JSON.parse` without try/catch at body boundary.** Malformed JSON → raw `SyntaxError` / 500 instead of 400.                                                                                                                      | Reliability — wrong status code      |
| CRIT-09 | core                  | **`route()` leaks stripped path to downstream middleware.** If mounted router doesn't match and calls `next()`, downstream sees `/users` instead of `/api/users`. Breaks logging, auth, routing.                                   | Correctness — wrong path propagation |
| CRIT-10 | core                  | **Core Application coupled to Node.js via `process.env`.** `process.env['NODE_ENV']` access in constructor crashes in Edge/Deno runtimes where `process` is undefined.                                                             | Portability — crash on Edge/Deno     |
| CRIT-14 | errors                | **`RangeError` class shadows global JavaScript `RangeError`.** `export class RangeError extends ValidationError` silently overrides the built-in. IDE auto-imports can introduce subtle bugs.                                      | DX — name collision                  |

---

## High (7)

| ID         | Package      | Issue                                                                                                                                                                                                       | Impact                         |
| ---------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Router-1   | router       | **Case-insensitive matching lowercases parameter values.** `path.toLowerCase()` runs before segment extraction → `ctx.params.id` gets `"abc-123"` instead of `"ABC-123"`. Breaks DB lookups, UUID matching. | Correctness — data corruption  |
| Router-2   | router       | **"No Match" falls through as 200 empty response.** If router is last middleware and nothing matches, client gets 200 with empty body instead of 404.                                                       | Correctness — wrong status     |
| Router-3   | router       | **`allowedMethods()` is O(M×K).** Runs 7 complete `match()` traversals for every 404. Measurable CPU tax on 404-heavy traffic.                                                                              | Performance — 7× cost on 404   |
| Core-5     | core         | **`instanceof Promise` for async plugin detection is unreliable.** Cross-realm Promises (thenables) not detected → async installs run un-awaited.                                                           | Reliability — silent async bug |
| Adapter-8  | adapter-node | **Double error listener on server.** Two error handlers registered on same emitter → duplicate logging/handling.                                                                                            | Reliability — duplicate errors |
| Adapter-10 | adapter-node | **Stream response path lacks error handling.** `.pipe()` without `error`/`close` handler. Stream error after `_responded=true` → hung socket/leaked connection.                                             | Reliability — resource leak    |
| Errors-7   | errors       | **Response always exposes `err.name` (internal class names).** Even when `expose: false`, response includes `error: err.name` (e.g., `TypeError`, `DomainSpecificError`). Info disclosure.                  | Security — info leak           |

---

## Medium (12)

| ID         | Package      | Issue                                                                                                                                                  |
| ---------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Core-9     | core         | `route()` pollutes user state namespace — writes `_originalPath` and `_routePrefix` to `ctx.state` without cleanup or isolation.                       |
| Core-13    | core         | `flattenMiddleware()` uses `flat(Infinity)` + unsafe `as Middleware[]` cast. Allows pathologically deep structures; suppresses validation.             |
| Types-5    | types        | `ResponseBody` type allows `Uint8Array`/`ArrayBuffer`/`ReadableStream` but Node adapter JSON-serializes them. Contract mismatch.                       |
| Types-6    | types        | `HttpMethod` includes TRACE/CONNECT but `HTTP_METHODS` constant omits them. `router.all()` never registers these. May be intentional but undocumented. |
| Adapter-13 | adapter-node | Cached body buffer never cleared — full request body retained in `_cachedBuffer` for context lifetime. Memory leak if context references leak.         |
| Adapter-14 | adapter-node | Response methods don't consult `res.headersSent`. Edge cases where raw `res` used directly → `ctx.*` methods can still attempt writes.                 |
| Adapter-15 | adapter-node | `serve()` reports requested port not actual port. When using port 0 (auto-assign), logged port is 0 instead of actual.                                 |
| Adapter-16 | adapter-node | DELETE included in METHODS_WITHOUT_BODY. RFC 9110 doesn't forbid DELETE body — prevents body parsing for DELETE requests.                              |
| Adapter-17 | adapter-node | No shutdown drain timeout. Keep-alive sockets can block shutdown indefinitely.                                                                         |
| Runtime-8  | runtime      | Content-Length `0` parsed as `undefined` — `parseInt(cl, 10) \|\| undefined` treats falsy 0 as undefined.                                              |
| Runtime-9  | runtime      | `resetRuntimeCache()` publicly exported despite `@internal`. Users may depend on it; removal becomes breaking change.                                  |
| Errors-9   | errors       | `notFoundHandler()` infers "response not sent" from status code — only runs when `ctx.status === 200 \|\| ctx.status === 404`. Unreliable proxy.       |

---

## Low (8)

| ID         | Package      | Issue                                                                                                             |
| ---------- | ------------ | ----------------------------------------------------------------------------------------------------------------- |
| Router-7   | router       | Wildcard capture allocates via `segments.slice(index).join('/')`. O(remaining) array + string per wildcard match. |
| Router-9   | router       | Redirect param interpolation is naive — only replaces first occurrence; `:id` matches inside `:id2`.              |
| Router-10  | router       | Redirect only registers GET/HEAD. POST/PUT with 307/308 won't redirect.                                           |
| Errors-10  | errors       | `catchAsync()` is redundant — try/catch that rethrows unchanged adds overhead, no behavior change.                |
| Adapter-18 | adapter-node | Fallback responses hardcode JSON without charset/length — missing `Content-Type` charset and `Content-Length`.    |
| Adapter-20 | adapter-node | `redirect()` sends no body — missing redirect body per HTTP spec recommendations.                                 |
| Adapter-21 | adapter-node | Minor perf: Regex in decode for `+` → space.                                                                      |
| SEC-14     | errors       | 404 returns request path in response body — path enumeration / info disclosure vector.                            |

---

## Info / DX (4)

| ID   | Package | Issue                                                                                                                   |
| ---- | ------- | ----------------------------------------------------------------------------------------------------------------------- |
| DX-1 | core    | `plugin()` vs `pluginAsync()` split — user-facing friction, easy to misuse when plugin becomes async later.             |
| DX-2 | core    | `start()` lifecycle implications (frozen middleware) not documented.                                                    |
| DX-3 | core    | `route()` type assertion to mutate `ctx.path` (readonly in contract) — makes alternate context implementations brittle. |
| DX-4 | core    | `onError()` naming implies event subscription, not setter.                                                              |

---

## Recommended Next Phases

### Phase 7: Critical Fixes (CRIT-02, 04, 06, 07, 08, 09, 10, 14)

Production blockers. IP spoofing, hung connections, cross-runtime compatibility, ESM crashes, JSON parse safety, path leaking, process.env coupling, name collision.

### Phase 8: High-Priority Fixes (Router-1, 2, 3, Core-5, Adapter-8, 10, Errors-7)

Correctness and reliability. Case-insensitive param corruption, missing 404s, O(M×K) allowed methods, async plugin detection, stream error handling, error name leaking.

### Phase 9: Medium Hardening

State isolation, type contract alignment, shutdown drain timeout, DELETE body support, Content-Length `0` fix.

### Phase 10: Polish

Redirect improvements, `catchAsync()` removal, DX naming, documentation gaps.
