# GP — Architectural gaps plan (items that need design, not just a patch)

These are the gaps found in the 2026-10 validation that are **not** single bugs. Each entry says what
is missing, why it matters against Hono v5 / Elysia 2 / Bun / Node 26, the approach, and the RFC it
needs. Bugs are in `FB-01 … FB-07`; this file is the plan for everything else.

Legend: **P1** next quarter · **P2** before 1.0 · **P3** when demand appears.

| Id | Gap | Priority | RFC | Depends on |
| --- | --- | --- | --- | --- |
| GP-01 | Recorded response model (post-handler interception) | P1 | **RFC-041** (reserved) | FB-01 · see FB-03 |
| GP-02 | End-to-end typed routes and client | P1 | **RFC-042** (reserved) | validate()/endpoint() metadata |
| GP-03 | RFC 9457 errors, stable codes, `defer` | P2 | RFC-043 (reserved) | GP-01, FB-05 |
| GP-04 | Test architecture: middleware × adapter over real sockets | **P1 (start now)** | none (process + tests) | `dev-check` |
| GP-05 | Runtime parity: `static`, `websocket`, `compression` | P2 | RFC-044 (reserved) for WS | GP-01 |
| GP-06 | Governance drift (size policy, versions, docs, engines) | P2 | none | — |
| GP-07 | Audit and RFC corrections already applied / still open | P1 (small) | — | — |
| GP-08 | Measurements still missing | P1 | RFC-040 P3 | `dev-check` |
| GP-09 | Suspected issues to verify (not yet claims) | P2 | — | `dev-check` |

---

## GP-01 — Recorded response model

**Gap.** Node commits inside `ctx.json()`; Web adapters record then materialise. Middleware that acts after `await next()` works on one and not the other, and compression cannot work at all. Hono (`c.res`), Elysia (`mapResponse`, `afterHandle`) and Hono v5's new response validation all rely on an interception point NextRush lacks.

**Approach.** Written out as Stage 1 of [FB-03](fb-03-response-commit-model-and-compression.md): record on every adapter, commit once after the chain, streams commit immediately, minimal interception API, unify `NodeContext` with `WebContextBase`.

**Done when.** RFC-041 accepted; compression, timer, ETag and response validation implemented on top; the three FB-03 probes pass on Node and Bun; perf gate (`inproc` ≤ 3 % regression) met.

---

## GP-02 — End-to-end typed routes and client

**Gap.** `ctx.body: unknown`, `ctx.params: RouteParams` (string map), no route-type registry, no typed client. Hono ships `hc<typeof app>()` and Elysia ships Eden Treaty; a code search of this repo for a typed client or route-type inference returns nothing. For a TypeScript-first framework this is the largest developer-experience gap.

**What already exists to build on.** `validate()` and `endpoint()` attach Standard-Schema metadata to routes at registration (`router/src/route-metadata.ts`, `validation/src/validate.ts:73`), and `@nextrush/openapi` already reads it. The same metadata can drive types.

**Approach (for the RFC).**
1. Type-level route registry: `app.get('/users/:id', { params, query, body, response }, handler)` infers `ctx.params`, `ctx.query`, `ctx.body` inside the handler and accumulates `Routes` in the app type (chainable, like Hono/Elysia). Keep the existing functional style working (inference is additive).
2. `@nextrush/client`: `createClient<typeof app>(baseUrl)` returning a typed `fetch` wrapper (`client.users[':id'].$get({ param: { id } })`). Zero runtime dependency; types only plus a tiny proxy.
3. Path-param typing from the path literal (template literal types), merged with `params` schema output.
4. Decide: schema libraries via Standard Schema only (no TypeBox lock-in).
5. Budget: type-instantiation cost per route (measure with `tsc --extendedDiagnostics` at 100 / 1,000 routes — Hono/Elysia both hit TS limits; set a budget up front).
6. Interop with decorators/class API: out of scope for v1 of the RFC (state it).

**Done when.** A sample app's client call is fully typed from the server definition, a type-level test suite (`expectTypeOf`) covers params/query/body/response/errors, and the 1,000-route type-check budget is met.

---

## GP-03 — RFC 9457 error bodies, stable codes, `defer`

**Gap.** Errors are `{ error, message, code, status }` JSON; Elysia 2 now returns `application/problem+json`. No post-response `defer` queue exists.

**Approach.**
1. Land FB-05 first (correct `code`, no engine text) so the contract is stable.
2. RFC-043: switch default error bodies to RFC 9457 (`type`, `title`, `status`, `detail`, `instance`, plus `code` as an extension member), `Content-Type: application/problem+json`; provide `problem(status, init)` helper; keep `errors().toJSON()` mapping in one place (`@nextrush/errors`) and have `core/error-handler.ts` call it so there is **one** serializer.
3. Breaking wire change — sanctioned pre-1.0; ship behind `errorFormat: 'legacy' | 'problem'` for one minor, default flips at the next major; document the client impact.
4. `defer(fn)`: queue run after the response is committed (needs GP-01's `committed` notion); errors in deferred work are logged, never thrown into the request.
5. Production masking rules (5xx → generic detail; no `cause`) stay as in FB-05.

**Done when.** One serializer, conformance asserts identical bytes on every adapter, docs show the migration.

---

## GP-04 — Test architecture: middleware × adapter over real sockets

**Gap.** Why six behavioural bugs shipped: package tests use mock contexts (e.g. compression tests fake an outgoing `ctx.body`), router tests call `router.match()` rather than the dispatch path (FB-06), and the 1,854-line conformance suite checks adapter parity for core behaviour **in-process**, so it cannot see raw-target behaviour (FB-04) or response commit order (FB-03).

**Approach (can start immediately; no RFC).**
1. Treat `apps/benchmark/scripts/dev-check` probes as the seed of a **black-box suite**: every probe is a real socket, byte-exact request.
2. Rule for contributors: every middleware that reads or writes the **response** (compression, timer, cors, helmet, cookies, csrf, rate-limit, static, request-id, logger, health, openapi) has ≥ 1 test through `serve()` on port 0 on Node and through `createHandler` on a Web adapter.
3. Router: add dispatch-level tests (`router.routes()` via a mock context) for params, case, mounts, trailing slashes; add a small property/fuzz test: for random mixed-case paths, `ctx.params` values equal the original substrings.
4. Move the generic probes into `packages/adapters/conformance` (real-socket driver) so every adapter package gets them without `dev-check`.
5. Keep `knownFailures` honest: every id must map to a brief; review it at each release.
6. CI: run `check.mjs bundle cold inproc probe` (≈ 15–40 s) on every PR (RFC-040 P1).

**Done when.** Re-introducing FB-01…FB-06 individually turns a test red in CI.

---

## GP-05 — Runtime parity: `static`, `websocket`, `compression`

**Gap.** `@nextrush/static` is documented Node-only (it writes through `ctx.raw.res`); `@nextrush/websocket` is Node-only (built on `ws`; Bun, Deno and Workers have first-class server WebSockets and Elysia 2 / Hono both support them); `compression` has no Web path. NextRush's identity is runtime independence, so these are visible holes.

**Approach.**
1. `static`: a Web-standard implementation (resolve + `Response(stream)`) behind a runtime file capability; on Bun use `Bun.file()`; on Node keep the current streamed path. Same options, same security rules (traversal, dotfiles, symlink policy). Also fix `static/src/index.ts:235-240` to use the context API instead of `ctx.raw.res.end()` so the redirect honours the response model.
2. `websocket`: RFC-044 defining an adapter capability (`upgrade`) with per-runtime implementations (Node `ws`, `Bun.serve({ websocket })`, `Deno.upgradeWebSocket`, Workers `WebSocketPair`); keep rooms/broadcast API unchanged. Node 26.12 adds `http.websocketMask()` — check whether a dependency-free Node path is now feasible.
3. `compression`: after GP-01; use `CompressionStream` on Web, `zlib` streams on Node, brotli where available; respect `Cache-Control: no-transform`, `Vary`, thresholds, ranges.
4. Until done, state "Node-only" prominently in each README and in the runtime support matrix.

**Done when.** The same feature test passes on Node and Bun (and Deno where the runtime supports it).

---

## GP-06 — Governance drift

| Item | Evidence | Action |
| --- | --- | --- |
| Package LOC policy table | `.github/copilot-instructions.md`: types ≤ 500, errors ≤ 600, core ≤ 1,500, router ≤ 1,000, adapters ≤ 500, middleware ≤ 300. Actual (src, no tests): types 2,471; errors 1,660; core 1,336; router 2,731; runtime 2,811; adapter-node 1,930; adapter-bun 708; adapter-edge 716; adapter-deno 697; middleware up to 4,510 (`template`) | Either update the table to measured reality with new ceilings, or enforce it. A policy that is 3–5× violated is noise. |
| Version in instructions | Says 3.1.0 / "v3"; `packages/nextrush/package.json` is `4.0.2` | Update (the working tree already modifies that file — reconcile, do not overwrite). |
| 300-line file cap | `application.ts` 874, `template/compiler.ts` 845, `template/helpers.ts` 809, `node/context.ts` 746, `node/adapter.ts` 677, `template/parser.ts` 651 | Split test-first (audit F-07); `node/context.ts` shrinks naturally with GP-01. |
| Docs examples | `createHandler(app)` on Bun shown without `ready()` (README:135, `bun.mdx:185`) | Fixed by FB-02; keep the docs example under test. |
| `engines.node >=22` | Node 26 enters LTS Oct 2026; Node 22 maintenance ends around Apr 2027 (verify on nodejs.org/en/about/previous-releases) | CI matrix 22/24/26 now; decide the floor at the next major. |
| Existing registration benchmark | `apps/benchmark/scripts/registration-cost.js` already measures `registerControllers` boot at 1/10/100/1000 | Cite it; the audit said no startup measurement existed. |

---

## GP-07 — Corrections to the audit (state of the record)

| Audit item | Verdict | Where recorded |
| --- | --- | --- |
| F-01 no AOT stage = largest gap | **Not supported**: registration ≈ 2.5 µs/route; cold start ≤ Hono | RFC-040 v2 §3.2, §9.1 |
| F-02 startup/memory/bundle unmeasured | True it was unmeasured; measured now and healthy; gates still wanted | RFC-040 §14 |
| F-03 default entry drags the Node adapter | **False as a size claim** (tree-shaken, 27.7 KB) | RFC-040 §10 |
| F-04 forked runners, timeout race | **True**; per-request cost real but not the largest item | FB-07, RFC-039 §3.7 |
| F-08 eager header copy / eager `ip` | **True and the biggest Bun items** | FB-07 |
| §5/§10 "request path correct, no correctness bugs" | **False** — FB-01…FB-06 | validation follow-up |
| Rec 6 unify `compose` + `compileExecutor` | Not re-measured; keep as an RFC-gated item after GP-01 | — |

Action: add a banner to the top of `architecture-modernization-audit.md` linking the validation follow-up (done in this change set).

---

## GP-08 — Measurements still missing

Add as `dev-check` stages/entries (RFC-040 P3), each with a budget:

1. POST JSON and middleware-stack profiles on Node and Bun (RFC-039 P0 still open) — needed before RFC-039 Parts C/D.
2. 12-header requests (`HEADERS=12`) — header-copy cost grows with count.
3. RSS **after** a load test (Elysia's headline memory metric); only cold RSS is measured today.
4. Deno and Edge probes + entries; a `--built` mode that measures `dist/` bundles instead of source.
5. Unbundled import-graph time of the root entry on Node/Bun/Deno (the real remaining question behind "default entry pulls the Node adapter").
6. Elysia 2 arm (`bun add elysia@next` in `apps/benchmark`; needs network) — until then, no claim about Elysia is made from this repo's numbers.
7. Controlled A/B for `server.requestIP()` cost on raw `Bun.serve` (single variable, ≥ 10 runs).

---

## GP-09 — Suspected issues to verify (not yet claims)

Each is a candidate worth a 10-minute probe in `dev-check` before it is called a bug:

- `@nextrush/rate-limit`: store growth and eviction under many distinct keys.
- Body size limits on Web adapters for chunked requests without `Content-Length` (Elysia 2 fixed a related `Transfer-Encoding` case).
- `ctx.send(Symbol())` / `String(data)` default branch sets `_responded` before a throwing call (same class as FB-01).
- Percent-encoded slash `%2f` and backslash `%5c` in paths (FB-04 leaves them out of scope).
- Query parser limits (key count, depth, array growth) and `__proto__[x]` literal key handling (Node probe showed the literal key `__proto__[x]` preserved as a plain key — confirm it is harmless downstream).
- `serveStatic` 301 redirect uses `ctx.path + '/'` (`static/src/index.ts:236`) — confirm it cannot produce a protocol-relative `//host` Location.
- Cookie value decoding happens once in the parser; confirm no second decode downstream (Elysia 2 fixed a double-decode).
- HMAC compare path in `@nextrush/cookies` uses constant-time `timingSafeEqual` helper — confirm every verification site uses it.
- `Content-Length` vs actual bytes for `ctx.send(string)` with multi-byte characters across adapters.
