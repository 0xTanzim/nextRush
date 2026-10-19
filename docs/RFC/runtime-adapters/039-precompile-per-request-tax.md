# RFC-039: Precompile the per-request tax — registration-time work vs request-time work

| Field                | Value                                                                 |
| -------------------- | --------------------------------------------------------------------- |
| **Status**           | `Approved` — Part A shipped (`db9bbda9`, `64ca11de`, `836dd6a5`, gate in `d41af71a`); P0 profile coverage in progress |
| **RFC number**       | `039`                                                                 |
| **Date**             | `2026-09-29`                                                          |
| **Author(s)**        | `Tanzim Hossain (NextRush maintainers) + explore session`             |
| **Group**            | `runtime-adapters`                                                    |
| **Packages touched** | `@nextrush/runtime`, `@nextrush/router`, `@nextrush/body-parser`, `@nextrush/validation`, `@nextrush/openapi`, `packages/adapters/*` (bun, node, deno, edge), benchmark harness (measure only) |
| **Framework impact** | `Additive, non-breaking (study)` — fast paths are opt-in with generic fallback; timeout default change (if pursued) is breaking-adjacent and decided separately |
| **Supersedes**       | `—`                                                                   |
| **Superseded by**    | `—`                                                                   |
| **Related**          | `RFC-015` (router-radix, deferred evidence-negative), `RFC-030` (typed proxy trust), `RFC-040` (resource budgets + `dev-check` gate), `ADR-0021` (fast-property request containers), `performance-gate` + `runtime-adapter-contract` + `runtime-capability-negotiation` specs |

---

## Progress Tracker

**Overall:** `[████░░░░░░░░░░░░░░░░]` 20% — 1 / 5 phases complete · Doc status: `Approved`

| Phase | Part / deliverable                                              | Status       |
| ----- | --------------------------------------------------------------- | ------------ |
| P0    | Profiles: Bun hello-world done (§3.7, `dev-check profile`); Node + POST + middleware-stack still open | in progress — P0 completion is the first deliverable of the profile baseline change |
| P1    | Lazy context fill + const-header skip (no API change)           | ✅ shipped — lazy incoming headers `db9bbda9`, lazy client IP `64ca11de`, shared settled-handler runner `836dd6a5`; parity `7c36e897` |
| P2    | Compiled request validator (Tier 2+) from existing metadata     | not started  |
| P3    | Compiled response serializer (Tier 3) + docs incentive          | not started — gated on a POST/large-payload profile |
| P4    | Scoped middleware DX; Rust only if profile names it             | not started  |

---

## 0. Revision History

* 2026-09-29 — Draft created from explore session (bun-focus, bottlenecks, rust-play threads). All claims anchored to source files read that day, not guesses. No code changed. Awaiting study + decisions before any `/opsx-propose` change.
* 2026-10-18 (v2) — Corrected after a measured validation session (see §3.7 and `report/architecture/architecture-audit-validation-followup.md`): (a) the Elysia #466 citation in §2a/§9 was wrong (it is an AOT-codegen context-leak, closed in 1.0.0, not a Sucrose/source-inference defect); (b) P2/P3 "compiled" paths are now constrained to **no runtime `new Function` / `eval`** (aligned with RFC-040's invariant); (c) P3 is gated on a profile because JSON serialization measured ≈ 3.5 % of request CPU on Bun; (d) added measured attribution and re-ordered Part A by measured value; (e) Q1 answered with a proposal (lazy-arm, non-breaking); (f) added lazy client-IP (`server.requestIP`) to Part A. P0 is partly done.
* 2026-10-19 — **Approved for implementation.** Basis: the measured validation session above plus the deterministic gates built under RFC-040 (bundle / cold / inproc / probe with committed budgets). Part A (lazy incoming-header record, lazy client address, one shared Web runner, no per-request `URL`) is executed and measured by change `fix-request-path-and-response-contract`, task group 8; the §3.7 attribution and the gate results are the acceptance evidence. P1–P4 keep their gates: each still lands only on a measured improvement.

## 1. Summary

The NextRush router is already fast: segment trie, O(1) static fast path, O(k) param walk, executors compiled once at registration, pooled walk frames. The T017 evidence gate (recorded in RFC-015 section 7) found the matcher at about 4% of CPU, the per-segment Map walk at about 1.44%, response writev at about 33%, JSON serialization at about 4.8%, with a directional (not publishable) gap of about -7.4% vs Fastify.

The bottleneck is the framework tax around the router, paid per request:

* context shell fill (URL parse, headers record copy, query parse, body source + response builder construction)
* Koa-style onion compose (closures + Promise wraps + microtask hops per layer)
* default timeout race (one Promise + one timer + one clear per request on the Bun path)
* generic JSON.stringify per response and generic buffer/decode/parse/validate per POST
* header grammar validation per set() plus full incoming-header copy on Web adapters

Fastify wins by compiling schemas once (Ajv for requests, fast-json-stringify for responses) and scoping hooks to routes. Elysia wins with Sucrose AoT per-route codegen (infer what the handler touches, generate a closed function touching only that) plus TypeBox compiled checks (Exact Mirror) plus Bun-native primitives, with no onion hop when unneeded. Both skip work the route does not need. NextRush today runs the generic full path even when the handler uses nothing.

Direction of this RFC: move registration-knowable work left (once) from the request path (millions of times). Keep no-schema routes fast with a lazy generic path requiring zero author work. Add opt-in compiled paths where schemas already exist at boot. Preserve cross-runtime parity and security checks.

## 1a. Terminology

* Precompile: work done once at route registration or server boot and reused per request. Shipped examples: compileExecutor, staticRoutes Map, parseSegments.
* Hot path: code running per request under load (dispatch, match-route, middleware compose, context construction, response builder, body parsers).
* Tier 1: route with no validate() and no endpoint() metadata. mergeContributions([]) returns undefined. The majority in real apps.
* Tier 2: route with validate() request schemas known at boot.
* Tier 3: route with validate() plus endpoint() response schemas known at boot. Only tier where a compiled serializer can be built from existing data.
* Sucrose: Elysia static analysis that reads handler source and generates a per-route optimized closure.
* Exact Mirror: Elysia 1.3+ compiled coerce replacing dynamic Value.Clean; they report under 2% difference vs no-schema.
* AOT: Elysia ahead-of-time compilation of all routes before listen (precompile flag). Dynamic mode was removed in v2.

## 2. Decision Summary

No decision taken in this draft. The lean, pending your call:

1. Measure first: Node + Bun 1.4.2 profiles on post-json, large-post, and middleware-stack scenarios (not hello-world alone).
2. Then lazy context fill (all tiers) + framework-const header skip (no API change).
3. Then compiled request validator (Tier 2+) reusing metadata that already exists.
4. Then compiled response serializer (Tier 3) with a docs incentive to declare response shapes.
5. Scoped middleware DX after. Rust only if a profile names a native-shaped hotspot.

No source-reading inference engine. No full rewrite. No per-runtime behavioral fork.

## 2a. Decision Drivers

1. Real-application speed (POST JSON, auth chains, large payloads), not a hello-world crown alone.
2. The parity contract: runtime-adapter-contract plus capability negotiation plus security parity (header grammar, canonical path, dot-segment rejection, proxy-trust chain walk). Speed work must not fork observable behavior.
3. Single-maintainer cost: every new engine or special path must justify its upkeep.
4. Explicit over magic: declared schemas beat inferred source reading. The real documented Sucrose limitation is a *silent inference miss* (Elysia 2 fixed "handlers using optional chaining on the context did not infer the field"). Elysia issue #466 (async derive leaking request context under `aot:true`, closed in 1.0.0) is an AOT-**codegen** bug in the compiled handler path, not a source-inference defect, and is not cited as evidence against inference.
5. Measure before optimizing (repo engineering rules).

## 3. Problem and Motivation

### 3.1 What is already precompiled (keep)

* `packages/router/src/segment-trie.ts:93` — compileExecutor(handler, middleware) builds the route executor once at registration, not per request.
* `packages/router/src/segment-trie.ts:78` — StaticRouteMap is method-nested, so matching selects the inner map by method and probes by path with no per-request key-string concatenation.
* `packages/router/src/registration.ts:217` — executor attached to HandlerEntry at registration.
* `packages/router/src/dispatch.ts:93` — dispatch calls routeMatch.executor(ctx) directly (NF-1 avoids an extra async frame).
* `packages/middleware/body-parser/src/parsers/combined.ts:112` — sub-parsers pre-created; single content-type detection per request (BP-E).
* `packages/adapters/node/src/body-source.ts:167` — event-listener accumulation avoids the for-await per-chunk promise allocation.

### 3.2 Schema knowledge exists at boot but is unused for serialization

* `packages/middleware/validation/src/validate.ts:30` — validate(schema | { body, query, params }) is the single request-validation entry.
* `validate.ts:33-68` — per-request path is generic: check() each target through runSchema (the Standard Schema `~standard.validate()` call), accumulate into an issues array, throw ValidationError on failure, else replace ctx.body and await next().
* `validate.ts:73-76` — the same call attaches a non-enumerable ROUTE_METADATA marker `{ request: schemas }`. Public API unchanged.
* `packages/router/src/registration.ts:190-200` — registration partitions entries into functions (behavior) and contributions (metadata), merges contributions once into a frozen object stored on the trie entry and in the introspection registry. Code comment: dispatch never reads it.
* `packages/router/src/route-metadata.ts:50` — zero contributions yields undefined (Tier 1, undocumented route).
* `packages/router/src/segment-trie.ts:66` and `registration.ts:199` — HandlerEntry.metadata is retained for copyRoutes remounts and getRoutes(), never read at dispatch.
* `packages/middleware/openapi/src/middleware.ts:39` — generateDocument runs lazily on the first GET of the spec path only, never during normal handling.
* `packages/middleware/openapi/src/json-schema.ts:32` — Standard Schema to JSON Schema conversion dispatches per vendor with an untyped {} fallback and is async.
* `packages/runtime/src/response-builder.ts:192` — json(data) always runs JSON.stringify(data). No schema branch exists anywhere on the response path.

Consequence: request schemas are knowable at boot (Tier 2+), response schemas are knowable at boot when endpoint() declares them (Tier 3), but serialization never consults either.

### 3.3 Context fill is eager on Web, partly lazy on Node

Web (`packages/runtime/src/web-context-base.ts:163-185`, constructor):

* new URL(request.url), pathname + search strings, parseQueryString, headersToRecord copy, new WebBodySource, new WebResponseBuilder — every request, even when the handler reads none of them.
* state is an eager `{}` field (`web-context-base.ts:125`).

Node (`packages/adapters/node/src/context.ts`):

* URL slice + parseQueryString eager (`context.ts:211-217`); headers reused by reference, no copy (`context.ts:220`); ip returned directly from the socket when proxy is false (`context.ts:254-258`).
* bodySource lazy getter with EmptyBodySource singleton for bodyless methods (`context.ts:235`); state lazy (`context.ts:295`); raw lazy (`context.ts:278`).

Gap: a Web GET still constructs a body source and copies all headers; a Node GET still parses the query string eagerly.

### 3.4 Header cost, both directions

Outgoing per `set(field, value)` (`packages/runtime/src/response-builder.ts:145` assertHeaderSafe):

* field tested against FIELD_NAME_TOKEN regex; string values run assertValueGrammar (CR/LF includes scans, leading space/tab checks, trailing whitespace regex, full-value character regex). Array values validated element-wise. Framework-generated sets (Content-Type, Allow, Location) pay the same checks as user input today, except a cheap set-cookie precheck by length + first character (`response-builder.ts:318`).

Incoming on Web (`packages/runtime/src/headers.ts:36` headersToRecord): forEach copy of every header into a NULL_PROTO bag plus a getSetCookie branch per request. Node pays nothing here (header reference reuse).

Response materialization (`response-builder.ts:372`) builds a new Response over a fresh native Headers each request.

### 3.5 Body POST is 3+ passes

`packages/middleware/body-parser/src/parsers/json.ts:135-180`: readBody buffer, bufferToString, JSON.parse with optional reviver, strict object/array check, then a depth walk with two working arrays when the buffer is large enough to possibly exceed maxDepth. Combined parser routes once (`combined.ts:127`). Node accumulates via events (`adapters/node/body-source.ts:167`); Web loops a reader and concatenates (`runtime/body-source.ts:288`).

### 3.6 Compose + timeout per-request tax

* `packages/core/src/middleware.ts:173` — index dispatch allocates a next closure per layer and wraps returns in Promise.resolve.
* `packages/core/src/application.ts:706-711` — callback() composes the stack snapshot, then adds a .then(undefined, handleError) hop per request.
* `packages/adapters/bun/src/adapter.ts:214` — with the default 30 s timeout, every request builds a Promise.race between the handler and a setTimeout, then clears it.

Net: roughly 10-15 small allocations plus 4-6 promise hops plus one timer per hello-world GET; POST adds buffer concat, decode, parse, depth walk, and stringify.

* `packages/adapters/bun/src/adapter.ts:207` — `const clientIp = server.requestIP(request)?.address ?? ''` runs on **every** request before any handler, then `createBunContext(request, clientIp, proxy)`. This eager native call was missing from the original inventory.

### 3.7 Measured attribution (added 2026-10-18, Bun 1.4.3, `dev-check`)

Reproduce: `node apps/benchmark/scripts/dev-check/check.mjs inproc wire profile`.

| Measurement | NextRush | Hono | Raw floor |
| --- | --- | --- | --- |
| In-process µs/request, 4 request headers | 5.17 | 2.41 | 1.76 |
| Wire throughput, hello-world (wrk, 64 conns) | 42.4k rps | 75.7k rps | 96.2k rps |

Profile of the NextRush in-process loop (self/total, Bun `--cpu-prof-md`): `Headers.forEach` (the `headersToRecord` copy) ≈ 18 % total; `setTimeout` + `Promise.race` + `clearTimeout` ≈ 10 %; `new URL` ≈ 5 %; `JSON.stringify` ≈ 3.5 %; `Request`/`Response` construction is platform/harness. Isolated, `headersToRecord` ≈ 1.05 µs at 4 headers vs ≈ 0.07 µs for a lazy `headers.get`; it grows with header count (browsers send 10–15).

What this changes in this RFC: (1) the **header record** and the **eager `requestIP`** are the largest per-request items on Bun, ahead of the timeout race; (2) serialization (Part C) is not a top cost on the hello-world profile, so it is gated; (3) router matching does not appear in the top rows, consistent with RFC-015's ≈ 4 %.

## 4. Goals and Non-Goals

Goals:

* Inventory every precompile-able item with its source anchor and tier.
* Make Tier 1 fast with zero author work (lazy generic path).
* Enable compiled validation/serialization where schemas exist (Tiers 2/3).
* Preserve parity and security behavior, or scope any skip explicitly with tests.
* Gate any hot-path rewrite on profiles, not hypotheses.

Non-goals:

* No router replacement (radix stays deferred per RFC-015 evidence).
* No source-reading inference engine (no Sucrose clone).
* No full Rust rewrite.
* No per-runtime behavioral fork (capability negotiation stays the decider).

## 5. Impact

Packages touched if pursued: @nextrush/runtime, @nextrush/router, @nextrush/body-parser, @nextrush/validation, @nextrush/openapi, adapters (bun, node, deno, edge), plus benchmark harness for measurement only.

Framework impact: additive and non-breaking when done as opt-in fast paths with generic fallbacks plus lazy fills with identical observables. A timeout-default change is the one breaking-adjacent item and is decided separately with a migration note.

## 6. Proposed Solution

Precompile map:

```
+------------------------------------------+
| Already left  | Can move left | Stay right|
| segments      | req validator | URL string|
| executor      | res serializer| body bytes|
| static Map    | const headers | new Resp  |
| HEAD derive   | query keys*   | timer call|
| type matchers | err shape fn  | ip live*  |
+------------------------------------------+
* small or conditional; see section 8.
```

A. Lazy context fill (all tiers, all runtimes). Defer Web headers record, query parse, body source, and builder to first read; defer Node query parse to first read. Values identical, only timing moves. Hello-world with a bare handler skips 3+ allocations. Keep declared slots and ??= memo identity so hidden classes stay stable.

   **Order by measured value (§3.7, Bun):** (1) lazy incoming-header record — `headersToRecord` ≈ 1.05 µs at 4 headers, ≈ 18 % of total request CPU, grows with header count; (2) lazy client IP — the Bun runner calls `server.requestIP(request)` (a native call plus an object) on every request even when no handler reads `ctx.ip`; make it a memoized getter closing over `server`/`request` (observed ≈ 15 % throughput on raw `Bun.serve`; confirm with an A/B before claiming a number); (3) lazy query parse; (4) lazy body source/builder.

B. Timeout race opt-out or lazy-arm. Options: default off, arm only after N ms of handler runtime, or per-route override. Saves one timer plus two promises per request. **Proposed (Q1):** lazy-arm — port the Node adapter's existing settled-flag fast path (`packages/adapters/node/src/adapter.ts`, "arm no timer when the handler already responded synchronously") into one shared Web runner used by Bun/Deno/Edge. Observable behaviour (30 s default, 504 shape, `ctx.signal` abort) is unchanged, so this is non-breaking. Measured on Bun: ≈ 10 % of request CPU in the profile; the in-process delta between race and no race varied 0.15–0.75 µs across runs, so judge it with `dev-check inproc` best-of-N.

C. Schema-compile serializer — Tier 3 only, **gated on a profile**. From HandlerEntry.metadata.responses at registration, build a per-status serialize function once, store it beside executor, call it from getResponse when present, else JSON.stringify. Fixed key order, known types, minimal escaping. Falls back to generic when the schema is absent or the converter returns untyped. **Constraint (RFC-040 invariant): built from composed closures, never `new Function` / `eval`** — Cloudflare Workers forbids them and Bun 1.4.3 can disable them with `--disallow-code-generation-from-strings`. Evidence for the gate: `JSON.stringify` is ≈ 3.5 % of request CPU on the Bun hello-world profile; do not build C until a POST/large-payload profile names serialization as a top cost.

D. Compiled request validator — Tier 2+. From HandlerEntry.metadata.request at registration, build per-target check functions. Preserve atomicity (validate all targets before mutating ctx.body) and aggregated ValidationError issues. Fall back to generic runSchema when no schema. **Constraint: closure composition only, no `new Function` / `eval`.** Note the user's schema library (zod / valibot / arktype) already owns its own compilation behind `~standard.validate()`; this part only removes NextRush's wrapper overhead, so measure that wrapper first.

E. Framework-const header skip — all tiers. Internally generated sets (JSON Content-Type, Allow join) skip the grammar regex; user ctx.set() keeps full validation. Small and safe.

F. Scoped middleware (Fastify lesson). Attach bodyParser/cors/auth where needed instead of globally, keeping compose() for compatibility. Wins the middleware-stack scenario without changing handler semantics.

G. Body single-pass (POST). Fuse decode plus parse (plus depth accounting when the schema bounds it) to cut passes on large-post. Micro-optimization, after C.

H. Rust last and narrow. Only if a profile names the header scan or query scan as dominant. NAPI addon, capability-gated, never the default path.

## 6a. Trade-offs

* Lazy adds getters and branches; done naively it can add polymorphism. Mitigation: keep declarations, sentinels, and memo identity exactly as the codebase already does for raw/state/bodySource.
* Compiled paths add a surface that must track zod/valibot/arktype drift plus an async converter with an untyped fallback. Mitigation: closures only (no `new Function`), schemas are app code, generic fallback always works.
* Scoped middleware changes developer experience (where to attach) and needs scaffolder plus docs updates.
* Timeout default change risks compat expectations; it gets its own decision and migration note, not a silent flip.

## 7. Architecture

Registration (once):

```
+------------------------------------------+
| entries --> partition                    |
|  functions --> compileExecutor --> entry |
|  markers   --> mergeContributions        |
|            --> metadata (frozen)         |
| validate() adds request schemas          |
| endpoint() adds response schemas         |
| getRoutes() exposes both for openapi     |
+------------------------------------------+
```

Dispatch (per request):

```
+------------------------------------------+
| canonicalize --> match --> entry.executor|
| executor runs inline middleware + handler|
| context fields fill on first read        |
| validator uses compiled fn or generic    |
| json/send uses serialize fn or stringify |
| getResponse builds the Response          |
+------------------------------------------+
```

No new package in this study. If compiled validation and serialization both land, a later change may extract one shared schema-compile helper owned by runtime so router, validation, and openapi do not grow three parallel codegen copies.

## 7a. Architecture Invariants

* Dispatch never reads metadata directly except through functions attached at registration (the executor pattern).
* Capability decisions use getRuntimeCapabilities(); runtime-identity branching stays forbidden except annotated platform optimizations.
* Security parity holds across adapters: header grammar, canonical path, dot-segment rejection, proxy-trust chain walk. Any scoped skip is explicit and tested.
* Observable errors stay identical (ValidationError aggregation, 400/405/413 paths, timeout 504 shape).

## 8. Detailed Design (study level)

C1. Serializer slot: optional per-status serialize function stored alongside HandlerEntry.executor, resolved at registration from metadata.responses. getResponse prefers it, else JSON.stringify. Status-specific because 201 and 400 shapes differ.

C2. Validator slot: optional per-target compiled checks resolved from metadata.request. Atomicity and issue aggregation preserved from validate.ts. Generic runSchema remains the fallback.

C3. Const headers: bypass list limited to framework-generated values with fixed strings. Location keeps validation on the user-supplied URL portion.

C4. Lazy fields: Web headers/query/bodySource/builder and Node query move behind memoized getters reusing EMPTY_PARAMS/EMPTY_QUERY sentinels and NULL_PROTO bags. No behavior change for readers.

C5. Timeout: no code sketched until Q1 is decided.

## 9. Alternatives

* Sucrose-style source inference: rejected for now. Magic analysis fails silently when it misses a pattern (Elysia 2's own fix list includes an optional-chaining miss), carries a large footprint (Elysia reports Sucrose + AOT compiler as ~50 % of its 141 KB bundle), and conflicts with the explicit metadata architecture already shipped. (Elysia #466 is a separate AOT-codegen context-leak bug and is deliberately not cited here.)
* Fastify-style codegen over any schema including user input: rejected. Codegen applies to app-authored schemas only; everything else takes the generic safe path.
* Full Rust service or router rewrite: rejected. T017 shows routing is not the dominant cost; the maintenance-to-gain ratio fails for a single maintainer.
* Bun-only natives as the primary lever (Bun.file, static routes, SO_REUSEPORT multiprocess): useful but runtime-specific. Generic-tax fixes help all runtimes first; natives follow behind capability flags.

## 10. Rejected Ideas

* Radix router to fix route-params RPS (RFC-015, deferred evidence-negative).
* Removing security checks (header grammar, JSON depth bound, dot-segment rejection) for speed. The correctness moat stays.
* Unbounded first-hit codegen without a cache bound (memory and deopt risk).

## 11. Risks

* Schema-library drift and absent converters ({} fallback must always resolve to the generic path, never crash boot).
* Async conversion complicating server-start ordering.
* Getter polymorphism regressing hidden-class stability if declarations are not preserved.
* Hello-only tuning hiding POST regressions. The gate must require post-json, large-post, and middleware-stack scenarios with rotated positions and saturation stated.

## 12. Backward Compatibility

Lazy fills and opt-in compiled paths with generic fallbacks are non-breaking. A timeout-default change is the exception: it needs its own approval, migration note, and (if shipped) major-version gating.

## 13. Cross-Cutting Concerns

* Observability: error shapes, log points, and timeout/drain semantics stay identical.
* Security: a missing schema can never mean skipped validation; it means the generic safe path.
* Developer experience: scaffolder and docs should present response declaration once as gaining both OpenAPI docs and serialization speed (the Fastify incentive playbook, without its user-schema codegen risk).

## 14. Success Metrics

* `node apps/benchmark/scripts/dev-check/check.mjs` (RFC-040): no new FAIL, no `inproc`/`cold`/`bundle` ratio regression > 5 %, and `inproc.nextrush.vs_hono` moving toward its `target` (≤ 1.3) on Bun; probes stay green on Bun **and** Node.
* Conformance suite green on every adapter; no new lint or type errors; no coverage decrease on touched files.
* Benchmarks report mean +- stddev from rotated, multi-run profiles with saturation stated, per the performance-gate spec. Required scenarios: hello-world, post-json, large-post, middleware-stack, route-params, query-string.
* A result is publishable only through the harness publishable verdict, never from a single unpinned run.

## 15. Phased Implementation (study order, no code in this RFC)

* P0 — Profiles on Node and Bun 1.4.2 (cpu-prof plus heap-prof) for post-json and middleware-stack. Names the true costs.
* P1 — Lazy context plus const-header skip. No API change.
* P2 — Compiled request validator for Tier 2+ from metadata that already exists.
* P3 — Compiled response serializer for Tier 3 plus the docs incentive.
* P4 — Scoped middleware DX. Revisit Rust only if a profile names a native-shaped hotspot.

## 16. Rollback Plan

Every fast path keeps its generic fallback: rollback is a flag off or an absent function field, with identical behavior. No data migration. Docs changes revert independently.

## 17. Future Work

* One shared schema-compile helper if validation and serialization both land.
* Query known-keys extractor if the query-string scenario proves it material.
* Static-file zero-copy behind capability flags (Bun.file on Bun, sendfile-class paths on Node).
* Streaming JSON parse only if the large-post profile demands it.

## 18. Open Questions

* Q1 — Timeout default: keep the 30 s race, lazy-arm it, or default off? Compatibility versus per-request savings. **Proposal (2026-10-18): lazy-arm, keep the 30 s default** — Node already ships this (adapters/node/src/adapter.ts) and its test `handler-timeout-fast-path.test.ts`; porting it is behaviour-identical. Awaiting maintainer confirmation.
* Q2 — Tier-1 strategy: lazy generic only, or add the declare-responses incentive to migrate authors toward Tier 3 over time? No inference magic either way — correct?
* Q3 — First profile target: POST JSON APIs, auth middleware chains, or large payloads? This sets Phase 0 scenario weights.
* Q4 — Smallest first cut if any: lazy only (P1), lazy plus const headers, or lazy plus compiled validator? What is reviewable in one change?

## 19. Decisions Log

* None accepted yet. Proposals recorded 2026-10-18 (pending maintainer decision): Q1 → lazy-arm; Part A order → headers, client IP, query, body/builder; Parts C/D → closures only, C gated on a profile; Part H (Rust) stays out (profile names no native-shaped hotspot).

## 20. References

* Router compile and dispatch: packages/router/src/segment-trie.ts, packages/router/src/registration.ts, packages/router/src/dispatch.ts, packages/router/src/route-metadata.ts
* Validation and schema contract: packages/middleware/validation/src/validate.ts, packages/types/src/standard-schema.ts
* Docs generation only: packages/middleware/openapi/src/middleware.ts, packages/middleware/openapi/src/generate.ts, packages/middleware/openapi/src/json-schema.ts
* Response and headers: packages/runtime/src/response-builder.ts, packages/runtime/src/headers.ts, packages/runtime/src/query.ts, packages/runtime/src/body-source.ts
* Context eager vs lazy: packages/runtime/src/web-context-base.ts, packages/adapters/node/src/context.ts
* Compose and application: packages/core/src/middleware.ts, packages/core/src/application.ts
* Bun timeout race: packages/adapters/bun/src/adapter.ts
* Body POST path: packages/middleware/body-parser/src/parsers/json.ts, packages/middleware/body-parser/src/parsers/combined.ts, packages/adapters/node/src/body-source.ts
* Specs: openspec/specs/performance-gate/spec.md, openspec/specs/runtime-adapter-contract/spec.md, openspec/specs/runtime-capability-negotiation/spec.md
* Prior art: docs/RFC/runtime-adapters/015-router-radix.md; Elysia 1.0 Sucrose post; Elysia 1.3 Exact Mirror post; Elysia aot/precompile configuration docs; Fastify validation and serialization docs; fast-json-stringify repository.
