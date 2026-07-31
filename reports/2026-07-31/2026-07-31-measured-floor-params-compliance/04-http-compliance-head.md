# 04 — `HEAD` returns 404 on every `GET` route (RFC 9110 compliance)

> ### ✅ FIXED (2026-07-31) — shipped alone, ahead of every performance change
>
> `HEAD` is now derived from every `GET` registration at **registration time**, so the request path is
> unchanged. Implemented in `packages/router/src`: `HandlerEntry.autoHead` (`segment-trie.ts`),
> derivation + an overwritable duplicate check (`registration.ts`), and derived-entry skipping in
> `copyRoutes` (`composition.ts`).
>
> Four things made it more than a one-liner, each caught by a test:
> 1. the duplicate-route check would have thrown on `router.head()` after `router.get()`, breaking
>    `router.all()` and `redirect()` (both register `HEAD` themselves) — a derived entry is now
>    replaceable in either registration order, while a genuine duplicate still throws;
> 2. the static-route fast-path map needed the derived entry too, or static routes would still 404;
> 3. `getRoutes()` must not gain a phantom `HEAD` row per `GET` route (OpenAPI emits from it);
> 4. sub-router mounts would have double-registered.
>
> **Verified [M]:** `GET` and `HEAD` both 200 on `/`, `/json`, `/users/1` and `/static/bench.txt` on a
> live server, with `Content-Length` present and no body. 17 new tests in
> `packages/router/src/__tests__/head-auto-registration.test.ts`; router 357, core 189,
> adapters/node 251, conformance 290, class 316, openapi 25 all green.
>
> **One intended behaviour change:** `allowedMethods()` now reports `Allow: GET, HEAD` instead of
> `Allow: GET` for a GET-only route — more correct per RFC 9110 §10.2.1. Four pre-existing assertions
> were updated; their original intent (precedence, deep-path stack safety, `findNode` branches) is
> preserved.
>
> **Gap that let this ship:** `apps/benchmark/scripts/validate-parity.js` never probed `HEAD`. Adding
> that probe is still open — see `06` §4 (G-1).


**Severity: Critical.** This is not a performance finding. PERF-001 §1.4 states correctness is
non-negotiable and §3.13 makes HTTP compliance an investigation domain, so it is reported here and it
outranks every optimization in this report set.

It was found incidentally: a `curl -I` against the static-file benchmark route while measuring
syscalls returned 404 where `curl` returned 200.

---

## 1. Measured behaviour

Every server in `apps/benchmark/servers/`, same route (`/json`), `GET` vs `HEAD` **[M]**:

| Framework | GET | HEAD |
| --------- | --- | ---- |
| Fastify | 200 | **200** |
| Express | 200 | **200** |
| Koa | 200 | **200** |
| Hono | 200 | **200** |
| Raw Node (hand-written, no router) | 200 | 404 |
| **NextRush v3** | 200 | **404** |

Reproduced across three route shapes on the benchmark server **[M]**:

```
  GET  /          -> 200      HEAD /          -> 404
  GET  /json      -> 200      HEAD /json      -> 404
  GET  /users/1   -> 200      HEAD /users/1   -> 404
  GET  /static/bench.txt -> 200   HEAD /static/bench.txt -> 404
```

NextRush matches only the raw-Node baseline — a hand-written `if (method === 'GET')` script with no
router at all, included in the suite as a floor, not as a framework to emulate.

---

## 2. Why

`Router.get()` registers exactly one method:

```ts
// packages/router/src/router.ts
get(path: string, ...entries: RouteEntry[]): this {
  this.addRoute('GET', path, entries);
  return this;
}
```

and matching is a per-method map probe — `matchRoute` → `node.handlers.get(method)`
(`matching.ts`/`walk-pool.ts`), plus the static fast path's `staticRoutes.get(method)`. With no `HEAD`
entry there is no handler, the match misses, and `createRoutesMiddleware` sets `ctx.status = 404`.

`router.head(path)` exists (`router.ts:141`), so a user *can* register HEAD — for every route, by hand.

### Three pieces of evidence that this is an oversight, not a decision

1. **Redirects already auto-register HEAD.** `packages/router/src/registration.ts:272`:
   ```ts
   addRoute('HEAD', from, [redirectHandler]);
   ```
   and `group-router.ts:144` does the same. So the codebase already encodes the rule "HEAD should
   follow GET" — but only for redirects.
2. **The response layer is already HEAD-ready.** `isBodylessResponse(method, status)`
   (`runtime/src/response-builder.ts:86`), `METHODS_WITHOUT_BODY` (`runtime/src/constants.ts:15`) and
   `NodeContext.shouldSuppressBody()` all exist specifically so a HEAD response emits headers and no
   body. That machinery is currently unreachable for any ordinary GET route.
3. **No opt-in exists.** There is no `exposeHeadRoutes`-style option anywhere in `packages/router` or
   `packages/types` — so this is not a default that can be flipped, it is simply absent.

The gap is precisely between "the router knows how to store a HEAD handler" and "the router never
creates one from a GET registration."

---

## 3. Impact

`RFC 9110 §9.3.2`: HEAD is *identical* to GET except the server MUST NOT send content, and the header
fields SHOULD be the same as GET would have returned. A 404 is a different resource state, so the
current behaviour is a spec violation, not merely a missing convenience.

Real consumers that break:

| Consumer | Effect |
| -------- | ------ |
| CDNs / reverse proxies revalidating with HEAD | cache treated as missing/invalid |
| Load balancer + orchestrator health probes configured for HEAD | endpoint reported down |
| Uptime monitors (HEAD is the common default) | false alerts |
| Link checkers, crawlers, `curl -I` | resources reported missing |
| `@nextrush/static` consumers | ETag/`Last-Modified` revalidation via HEAD unusable — and `send-file.ts` contains explicit `ctx.method === 'HEAD'` branches that can never execute through a `router.get()` route |

The last row is the sharpest: the static middleware has HEAD handling written, tested-looking, and
dead.

---

## 4. Proposals

| | **A. Auto-register HEAD alongside GET** *(recommended)* | **B. Fall back to GET at match time** | **C. Document `router.head()` and leave behaviour** |
| --- | --- | --- | --- |
| Design | In `addRoute`, when method is `GET` and no explicit HEAD exists for that path, insert the same `HandlerEntry` under `HEAD` | On a HEAD miss, retry the lookup as GET | Docs-only |
| Request-time cost | **Zero** — registration-time work only (PERF-001 §5.1) | One extra failed lookup per HEAD request | Zero |
| Explicit `router.head()` override | Must win. Order-independence required (`head()` before or after `get()`) | Naturally wins | n/a |
| Body suppression | Already handled by `isBodylessResponse` | Already handled | n/a |
| Ecosystem alignment | Matches Fastify/Express/Koa/Hono | Matches | **Diverges** |
| Memory | +1 map entry per GET route | none | none |
| Risk | Low. Changes `allowedMethods()` output (HEAD now appears in `Allow`) — which is *more* correct per RFC 9110 §10.2.1 | Medium — adds a branch to the hot miss path, and `matchRoute` is shared by `findAllowedMethods` | None, but leaves a spec violation |
| Verdict | **Recommended** | Fallback | Rejected |

**Why A.** It is registration-time, which PERF-001 §5.1 prefers over request-time; it costs the hot
path nothing; it matches the four real frameworks in the comparison set; and it reuses the exact
mechanism the redirect path already uses, so it makes the codebase internally consistent rather than
adding a second concept.

**Sketch** (illustrative — `addRoute` is in `packages/router/src/registration.ts`):

```ts
// after inserting the GET entry, and only when the caller did not register HEAD explicitly
if (method === 'GET' && !node.handlers.has('HEAD')) {
  node.handlers.set('HEAD', getEntry);          // same handler, same middleware, same executor
}
```
plus the mirror-image guard in `head()` so an explicit `router.head()` overwrites the auto-entry
regardless of registration order, and the same treatment for the `staticRoutes` fast-path map.

---

## 5. Risk assessment

| Dimension | Assessment |
| --------- | ---------- |
| API compatibility | Additive. No signature changes. A route that previously 404'd on HEAD now 200s — **technically a behaviour change**, but toward spec compliance, and no reasonable consumer depends on the 404 |
| HTTP compliance | **Fixes** an RFC 9110 §9.3.2 violation |
| Security | Neutral. HEAD exposes only what GET already exposes. One thing to verify: a guard/auth middleware attached to a GET route must run identically for the auto-registered HEAD — since the entry shares the same compiled executor, it does. **Needs an explicit test** |
| `allowedMethods()` / `Allow` header | HEAD now appears. More correct; may change existing test expectations |
| OpenAPI generation | `getRoutes()` introspection must **not** emit a duplicate HEAD operation per GET path — the auto-entry must be excluded from `routeDefinitions`, exactly as `all()` already does with `recordIntrospection = false` |
| Regression risk | Low-medium, concentrated in `allowedMethods()` and OpenAPI output |
| Performance | Zero request-time cost; +1 map entry per GET route at registration |

---

## 6. Validation plan

**Functional:**
- New tests: HEAD returns the same status and headers as GET, with no body, for static, param and
  wildcard routes; explicit `router.head()` wins in both registration orders; guards/middleware on a
  GET route also run for HEAD; `Content-Length` behaviour on HEAD matches GET (the existing
  `shouldSuppressBody` path already writes the header and omits the body).
- `packages/adapters/conformance`: HEAD behaviour identical across node/bun/deno/edge.
- `@nextrush/openapi`: no duplicated HEAD operations in generated output.
- `@nextrush/static`: the `ctx.method === 'HEAD'` branches in `send-file.ts` become reachable — add
  coverage for them, including the range-request HEAD path.

**Benchmark:** add a `head-request` scenario to `apps/benchmark`. It is currently impossible to
measure NextRush against Fastify/Express/Koa/Hono on HEAD because NextRush 404s — which is also why
no existing scenario caught this. `validate-parity.js` compares status codes across servers, so a HEAD
probe there would have failed loudly; **it does not probe HEAD**, and that is the gap to close so this
cannot regress.

**Confidence: HIGH.** Behaviour measured directly on five frameworks; mechanism read in source; the
redirect path proves the intended rule.
