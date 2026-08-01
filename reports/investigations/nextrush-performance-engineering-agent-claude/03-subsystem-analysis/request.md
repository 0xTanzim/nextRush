# Subsystem — Request

**Playbook phase:** Part 4 §4.15, analysed with the §4.1–4.10 methodology
**Package:** `@nextrush/adapter-node` — `packages/adapters/node/src/context.ts`
**Verdict:** **No optimisation recommended.** This subsystem is at competitive parity and is
documented here to record that conclusion with evidence, so that future work is not spent on it.

---

## 1. Purpose (§4.1)

Expose the incoming request — method, URL, path, query, headers, client IP, body source — as plain
properties on `Context`, so that handlers and middleware never touch `IncomingMessage`. Request
wrapping is what makes the adapter abstraction real rather than nominal.

## 2. Architecture (§4.2)

There is no separate `Request` object. Request state is assigned as direct properties on
`NodeContext` during construction, with expensive or rarely-used values behind lazy getters:

| Surface | Strategy | Cost model |
| ------- | -------- | ---------- |
| `ctx.method` | Eager — `req.method?.toUpperCase() ?? 'GET'` | O(1), no allocation for uppercase input |
| `ctx.url` | Eager — `req.url ?? '/'` | Reference copy |
| `ctx.path` | Eager — `url` up to `?`, else `url` itself | One `slice()` only when a query exists |
| `ctx.query` | Eager when present, shared frozen `EMPTY_QUERY` when absent | **Zero allocation for query-less requests** |
| `ctx.headers` | Eager reference to `req.headers` | Reference copy — Node's own parsed object, no clone |
| `ctx.ip` | **Eager** — see P-04 | One socket getter + string retain |
| `ctx.raw` | **Lazy getter** (HP-5) | 47.6 → 8.1 B/req when unread, per the team's own measurement |
| `ctx.state` | **Lazy getter** (NF-2) | Zero when unread |
| `ctx.signal` | Lazy `AbortController` | Zero unless used |
| `ctx.bodySource` | Singleton empty source when no body | Zero for GET |

## 3. Request lifecycle participation (§4.3)

Property assignment happens once per request in the constructor. Lazy surfaces are materialised only
on first read, and never for the eight GET scenarios in the benchmark.

## 4. Performance characteristics (§4.4)

Query parsing is the only request-side operation the benchmark isolates. Marginal cost
(`query-string µs/req − that framework's own hello-world`):

| | NextRush | Fastify | Raw Node.js | Hono |
| --- | --- | --- | --- | --- |
| Query parsing marginal cost | **9.40 µs** | 8.68 µs | 8.23 µs | 9.78 µs |
| vs Fastify | **+0.72 µs** | — | −0.45 µs | +1.10 µs |

NextRush is **0.72 µs behind Fastify and ahead of Hono.** Note that raw Node's figure uses
`new URLSearchParams()`, a comparatively expensive Web-standard API, and NextRush is within 1.2 µs of
it — so the entire industry, including the zero-framework baseline, pays roughly 8–10 µs for
query-string handling on this payload. There is no meaningful gap here.

Header access is not isolated by any scenario, but the design forecloses the usual cost: `ctx.headers`
is a **reference** to Node's already-parsed `req.headers`, not a copy or a lowercasing pass. Nothing
is normalised eagerly.

## 5. Runtime behaviour (§4.5)

For a `hello-world` request (no query): one `indexOf('?')` scan returning `-1`, `this.path = this.url`
(reference copy), `this.query = EMPTY_QUERY` (shared frozen object), `this.headers = req.headers`
(reference). **Zero allocations attributable to request wrapping.**

For a `query-string` request: one `slice()` for the path, one `slice()` for the query string, then
`parseQueryString()` which allocates the result object and its value strings — unavoidable, and
measured at parity.

## 6. Bottleneck analysis (§4.6)

One item only, and it belongs to the Context floor rather than to request parsing:

| Observation | Category | Owner |
| ----------- | -------- | ----- |
| `ctx.ip` resolved eagerly in the constructor for a property most handlers never read | Unnecessary per-request work | **P-04**, analysed in `context.md` §5.1 |

**Verified non-issues:**
- `req.method.toUpperCase()` — the prior review measured 0 B/iter for already-uppercase input (V8
  fast-paths it) and I found no evidence to overturn that. Node's HTTP parser emits uppercase for all
  standard methods. **Rejected as a finding.**
- Header normalisation — none performed; `req.headers` is used by reference.
- `EMPTY_QUERY` — already a shared frozen sentinel. Correct.
- URL parsing — hand-rolled `indexOf`/`slice`, not `new URL()`. Correct: constructing a WHATWG `URL`
  per request would be an order of magnitude more expensive and is a common framework mistake that
  NextRush avoids.

## 7. Root cause candidates (§4.7)

Not applicable — no performance defect identified in this subsystem beyond P-04, whose root cause
(eager materialisation of a rarely-read property) is analysed in `context.md` §7.

## 8. Optimisation opportunities (§4.8)

**None recommended for request parsing.** Applying the lazy-getter pattern to `ctx.ip` (P-04) is the
only change, and it is tracked under the Context subsystem because it is a constructor concern.

Explicitly **rejected** as speculative — each would add complexity for no measured gain, which the
playbook's §1.6 trade-off principle forbids:

| Rejected idea | Why rejected |
| ------------- | ------------ |
| Lazy `ctx.query` behind a getter | Would help only requests *with* a query string that never read it. The measured gap is 0.72 µs total, so the ceiling on this optimisation is a fraction of that. Adds a getter to a hot property read by most handlers that do have a query. |
| Cached/interned query keys | Requires a per-router key cache with unbounded growth from attacker-controlled key names — a DoS vector traded for sub-microsecond gain. |
| Lazy `ctx.path` | `path` is read by the router on 100% of requests. A getter would be pure overhead. |
| Lazy `ctx.method` | Same — read by the router on every request. |

## 9. Edge cases reviewed (§4.9)

| Case | Behaviour |
| ---- | --------- |
| Missing `req.method` | Defaults to `'GET'` |
| Missing `req.url` | Defaults to `'/'` |
| `?` present with empty query (`/x?`) | `slice` yields `''`; `parseQueryString('')` handles it |
| Repeated query keys | Handled by `parseQueryString` semantics |
| Query key named `__proto__` | Must not mutate a prototype — the router's param path uses `Object.create(null)` for the analogous case; the query parser's guarantee is asserted by its own tests and is out of this investigation's scope but noted as worth confirming |
| Header array values (e.g. `set-cookie`) | `getClientIp` takes `value[0]` when an array; `ctx.headers` preserves Node's shape |
| `proxy` configured | `ctx.ip` routes through the shared `resolveClientIp` policy so precedence and validation match Bun/Deno/Edge |

## 10. Investigation summary (§4.10)

| | |
| --- | --- |
| **Finding** | No performance defect. Query parsing is within 0.72 µs of Fastify and ahead of Hono; header access is zero-copy; URL parsing avoids the `new URL()` trap; `EMPTY_QUERY` eliminates allocation for query-less requests. The only residual is P-04 (eager `ctx.ip`), owned by `context.md`. |
| **Evidence** | Query Strings marginal cost 9.40 µs vs Fastify 8.68 / raw Node 8.23 / Hono 9.78; constructor read at HEAD showing reference-copy headers, shared frozen `EMPTY_QUERY`, and lazy `raw`/`state`/`signal`/`bodySource` |
| **Root cause** | n/a |
| **Runtime impact** | Negligible |
| **Recommendation** | **Do not optimise.** Record as parity-achieved. Effort directed here would produce no measurable benchmark movement — see `01-benchmark-analysis.md` §5. |
| **Trade-offs** | n/a |
| **Priority** | None |
| **Confidence** | Confirmed (measured parity + source read) |
| **Validation** | Covered incidentally by V-01's regression sweep; no dedicated gate needed |

**Cross-references:** `context.md` (construction and P-04), `body-parser.md` (`ctx.bodySource`
consumption), `01-benchmark-analysis.md` §5 (negative findings).
