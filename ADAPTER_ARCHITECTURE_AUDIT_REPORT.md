# NextRush Adapter Architecture — Audit Report

**Scope:** `packages/adapters/{node,bun,deno,edge}` and their shared foundations (`@nextrush/runtime`, `@nextrush/types`, `@nextrush/core`, `@nextrush/stream`).
**Method:** Source-level audit. Every claim below is grounded in the implementation, not documentation. Documentation was read only to contrast intent against reality.
**Auditor stance:** Adversarial. The goal is to find what breaks at scale, not to validate that it compiles.
**Date:** 2026-07-08
**Revision:** v2 (2026-07-09) — incorporates peer-review feedback: reframed the conformance finding (F-01), moved the context de-duplication recommendation from inheritance to composition (F-04), added a dedicated **Performance & Hot-Path Analysis** section plus finding F-18, a **Package Dependency Review**, a **Public API & Stability Review**, and an **Adapter Conformance Specification**, and added Performance and API-Stability scores.

---

## Executive Summary

The NextRush adapter layer is built on a **genuinely good foundation** — a clean, acyclic dependency graph; a runtime-neutral `Context` contract; a shared `@nextrush/runtime` package with a hardened query parser, prototype-pollution-safe header handling, and incremental body-size DoS protection applied uniformly. The Edge adapter, in isolation, is a legitimately runtime-agnostic Web-API implementation. Individual adapter files are small, typed, and well-commented.

But the **architecture is not production-ready for a v1.0 that promises "runtime-agnostic" use by thousands of developers**, for four structural reasons:

1. **There is no adapter contract.** No `Adapter`/`HttpAdapter` interface exists. Every adapter is an independently-authored set of free functions (`serve`, `listen`, `createHandler`) that happen to share names. Consistency is enforced by discipline alone — and it has already drifted (`host` vs `hostname`, divergent `createHandler` signatures, divergent timeout semantics, divergent export barrels). This is the root cause of most findings below.

2. **The one shared abstraction that exists is dead code, and the adapters duplicate it instead.** `@nextrush/runtime` ships `AbstractBodySource` + `WebBodySource` explicitly documented "for Bun, Deno, Cloudflare Workers, Vercel Edge." It has **zero consumers** (verified: `createWebBodySource` inbound callers = `[]`). Instead, `BunBodySource`, `DenoBodySource`, and `EdgeBodySource` are near-identical hand-copies, and `BunContext`/`DenoContext`/`EdgeContext` are ~400-line, ~95%-identical copies of each other. Any fix must be applied 3–4 times.

3. **There is a real cross-adapter correctness divergence.** On the Web adapters (Bun/Deno/Edge), response headers set via `ctx.set()` are **silently dropped** whenever a handler sets a status but does not call a body method — because the adapter returns `new Response(null, { status })` without calling `ctx.getResponse()`. Node does not have this bug. This breaks CORS, security-header, and `Set-Cookie` middleware on empty/204 responses, differently per runtime. "Adapter consistency" (an explicit project TDD rule: *"Every adapter must behave identically"*) is violated.

4. **The flagship edge target is functionally crippled.** `createCloudflareHandler` discards the Cloudflare `env` argument, so KV, D1, R2, Durable Objects, and secrets are unreachable through the framework. A real Cloudflare Worker cannot be built on this adapter without bypassing it.

None of these are fatal to the *design* — they are fixable in a focused 2–4 week effort — but shipping them as **1.0** would burn the "swap the import, run anywhere" promise the moment a second runtime is used in anger.

**Verdict: NO** (justified in full at the end).

---

## Scorecard

| Dimension | Score | One-line justification |
|---|---:|---|
| **Architecture** | **5 / 10** | Clean layering and a shared runtime package, but no adapter contract (no IoC seam) and the one shared abstraction is bypassed/dead. |
| **Runtime Agnostic** | **6 / 10** | `Context` contract and Edge adapter are genuinely neutral; but "agnostic" is achieved by per-runtime copy-paste, CF bindings are dropped, Lambda is unsupported, Netlify detection is broken. |
| **Production Readiness** | **5 / 10** | Strong DoS/CRLF/shutdown hardening, but a header-drop correctness bug, no adapter-level observability, timeouts that don't cancel work, and inconsistent startup error handling. |
| **Consistency** | **4 / 10** | The weakest axis: naming, signatures, defaults, error `Content-Type`, IP extraction, and export barrels all diverge across adapters. |
| **Maintainability** | **4 / 10** | 3–4× duplicated contexts/body-sources plus dead shared code = every bug fixed N times. Files are individually clean, which masks the systemic cost. |
| **Scalability (of the architecture)** | **4 / 10** | Adding a runtime = copy ~800 lines and hope you match undocumented conventions; nothing validates a new adapter against a contract. |
| **Developer Experience** | **6 / 10** | Excellent for a single pinned runtime (clean API, good docs/examples, typed errors); rough across runtimes (host/hostname, CF `env`, doc default typos). |
| **Performance (hot path)** | **6 / 10** | Good instincts (shared encoders, frozen singletons, single-pass query scanner, single-chunk body fast path), but the Web adapters double-encode every response body to set a redundant `Content-Length` (F-18), and allocate a full header-record copy + `new URL()` + `new Headers()` per request. No benchmarks gate the adapters. |
| **API Stability / Freeze-readiness** | **7 / 10** | `sideEffects:false` + clean ESM exports aid tree-shaking, but: ESM-only (no CJS) is undocumented; de-facto-internal methods (`getResponse`/`waitUntil`/`markResponded`) leak into the public surface (F-13); export barrels have drifted (F-10); `workspace:*` vs `workspace:^` is inconsistent across adapters. Not yet safe to freeze. |

---

## Implementation Status — RESOLVED (2026-07-09)

All findings below were implemented and **independently verified** (gates re-run + regression tests read, not self-reported). Repo-wide gates: **lint 55/55 · typecheck 60/60 · test 75/75 · build 38/38** — all green. Adapter/runtime/types tests: node 78 · bun 114 · deno 112 · edge 119 · runtime 86 · types 8 · **conformance 92**.

| Finding | Status | How it was resolved / verified |
|---|---|---|
| F-01 | ✅ | `ServerAdapter`/`FetchAdapter`/`ServerHandle`/`ServerAddress` contract in `@nextrush/types`; adapters `satisfies` it; **92-test cross-adapter conformance suite** (`packages/adapters/conformance`) is the primary guard. |
| F-02 | ✅ | Web adapters finalize via `ctx.getResponse()`; headers survive empty/204/404. Guarded by conformance `#5/#9 (F-02)` + 3 edge adapter tests. |
| F-03 | ✅ | `createCloudflareHandler<Env>` threads `env` → `ctx.env` (`FetchContext.env`). Tested (`ctx.env.MY_SECRET` reachable). |
| F-04 | ✅ | Bun/Deno/Edge reuse shared `WebBodySource` + `WebResponseBuilder` (composition) from `@nextrush/runtime`; duplicate classes kept as deprecated aliases (−~630 LOC). |
| F-05 | ✅ | `host` canonical; `hostname` accepted as deprecated alias; canonical `ServerAddress`. |
| F-06/F-07 | ✅ | Shared `HandlerOptions`; Bun `serve` composes `createHandler` so its timeout is honored. |
| F-08 | ✅ | Timeout aborts a request-scoped controller feeding `ctx.signal`; timer always cleared. |
| F-09 | ✅ | Dead `json()` guard removed (single shared `WebBodySource`). |
| F-10 | ✅ | Barrels reconciled; dead exports removed; deprecated aliases scoped. |
| F-11 | ✅ | Single `resolveClientIp` policy in `@nextrush/runtime`; all adapters delegate (precedence + validation identical). |
| F-12 | ✅ | `nodeStreamToWebStream` adapts Node `Readable` in web `send()`. |
| F-13 | ✅ | `AdapterContext`/`FetchContext` modeled in `@nextrush/types`. |
| F-14 | ✅ | Edge calls `app.start()` after first boot (`isRunning` consistent); no-teardown contract documented. Tested. |
| F-15 | ✅ | Shared typed startup error (`server-error.ts`) normalizes bind failures. |
| F-16 | ✅ | Shared `DEFAULT_TIMEOUT_MS` constant; `80800` typo eliminated. |
| F-17 | ✅ | Deno types pinned in `deno.d.ts`. |
| F-18 | ✅ | Web adapters no longer set `Content-Length` for string bodies (runtime derives it); explicit only for byte bodies. |

**Scope note:** work was confined to `packages/{adapters,runtime,types}` plus the 5 pre-existing `packages/core/src/application.ts` lint fixes needed for a green repo. The separate "reset independent packages to 1.0" initiative already in the tree (version bumps, `pnpm-lock.yaml`, root `packages.json`, `scripts/reset-independent-packages.sh`) was intentionally left untouched. Nothing was committed.

The pre-fix verdict below stands as the record of the audited state; the four disqualifiers (F-01–F-04) and the conformance-suite gap are now addressed.

---

# Findings

Severity legend: **Critical** (blocks 1.0), **High** (must fix before wide adoption), **Medium** (fix soon; causes support load), **Low** (polish / debt).

---

## F-01 — No enforceable adapter conformance mechanism

- **Severity:** Critical (architecture)
- **Impact:** Consistency is unenforceable and has already drifted. A new adapter has nothing to conform to, no compile-time or test-time check, and no way to guarantee identical behavior — directly contradicting the project's own rule *"Every adapter must behave identically … Framework correctness is defined by identical observable behavior."*
- **Reframing (per review):** The flaw is **not** "there is no `interface Adapter`." Fastify, Hono, and Express all ship successful adapter/transport layers without a single exported adapter interface — convention is a legitimate design choice. The real, defensible flaw is that **nothing enforces conformance**: not an interface, not an abstract class, not a `satisfies` contract, and — most importantly — **not a shared behavioral test suite**. A framework can pick any one of those mechanisms; NextRush has picked none, so the adapters have diverged silently (see F-02, F-05, F-06, F-10, F-11, F-15).
- **Root Cause:** Adapters were authored independently as loose collections of exported functions with no conformance gate of any kind. A graph search for an `Adapter`/`HttpAdapter` interface returns nothing, and there is no cross-adapter behavioral test asserting identical observable behavior.
- **Evidence:**
  - `packages/adapters/node/src/adapter.ts`, `bun/src/adapter.ts`, `deno/src/adapter.ts` each define a *separate, structurally different* `ServeOptions` and `ServerInstance`.
  - `packages/adapters/edge/src/adapter.ts` has no `serve`/`listen`/`ServeOptions`/`ServerInstance` at all — a completely different surface (`createFetchHandler`, `createCloudflareHandler`, …).
  - No interface in `@nextrush/types` constrains any of them, and no test file exercises the four adapters against one shared behavior spec.
- **Recommended Fix (in priority order — a behavioral suite matters more than a type):**
  1. **Ship a shared behavioral conformance suite (highest leverage).** A single parameterized test module that every adapter imports and runs against its own `Context`/handler — see the **Adapter Conformance Specification** section below. This guarantees *behavior*, which an interface cannot. Make merging a new/changed adapter conditional on passing it.
  2. **Add a light compile-time contract** (any one of: a `satisfies`-checked shape, a small interface, or an abstract base) so the *shape* (`serve`/`createHandler`/`ServerHandle`) also can't drift silently. A minimal example:
     ```ts
     export interface ServerAdapter<Opts = unknown, Instance = ServerHandle> {
       serve(app: Application, options?: Opts): Promise<Instance>;
       createHandler(app: Application, options?: HandlerOptions): unknown;
     }
     export interface ServerHandle {
       readonly address: { port: number; host: string }; // ONE canonical shape
       close(): Promise<void>;
     }
     export interface FetchAdapter {
       createFetchHandler(app: Application, options?: FetchHandlerOptions): FetchHandler;
     }
     ```
     Each package `satisfies` the relevant shape at export time. The interface is the cheap guard; the suite is the real one.
- **Priority:** P0.

---

## F-02 — Response headers are dropped on implicit/empty responses (Web adapters only)

- **Severity:** High (correctness + cross-adapter divergence)
- **Impact:** On Bun, Deno, and Edge, if a handler/middleware sets response headers via `ctx.set()` but does **not** call `ctx.json/send/html/redirect` (e.g. a 204, a header-only response, an `OPTIONS` preflight handled by CORS middleware that sets headers and returns), **all headers are discarded**. Node keeps them. This silently breaks CORS, Helmet/security headers, and `Set-Cookie` on empty responses — and it breaks them *differently on different runtimes*, which is the worst possible failure mode for a framework whose selling point is portability.
- **Root Cause:** The Web adapters bypass the context's response builder on the not-responded path:
  ```ts
  // bun/deno/edge adapter.ts — request handler
  if (!ctx.responded) {
    if (ctx.status === 404) { return new Response(JSON.stringify({error:'Not Found'}), {status:404, headers:{'Content-Type':'application/json'}}); }
    return new Response(null, { status: ctx.status });   // <-- ctx._responseBuilder.headers NEVER read
  }
  return ctx.getResponse();
  ```
  `ctx.getResponse()` (which carries `_responseBuilder.headers`) is only called when `responded === true`. Node, by contrast, writes headers straight onto `res` via `res.setHeader`, so they survive a bare `res.end()`.
- **Evidence:** `packages/adapters/bun/src/adapter.ts` (`createHandler` and the inner `trackedHandler`), `deno/src/adapter.ts` (`createHandler`), `edge/src/adapter.ts` (`createFetchHandler`); contrast with `node/src/context.ts` where `set()` calls `this.raw.res.setHeader(...)` directly.
- **Recommended Fix:** On the not-responded path, always finalize through the builder: call `ctx.getResponse()` (which already honors status + body suppression) instead of fabricating `new Response(null, …)`. The 404 branch should likewise merge builder headers. Add a cross-adapter behavioral test: *"headers set via ctx.set() with no body method are present on the response"* run against all four adapters.
- **Priority:** P0.

---

## F-03 — Cloudflare Workers `env` bindings are discarded

- **Severity:** High (functional gap on a flagship target)
- **Impact:** Cloudflare Workers deliver KV, D1, R2, Durable Objects, Queues, Vectorize, and secrets through the `env` argument of `fetch(request, env, ctx)`. The adapter throws `env` away, so **none of these are reachable** through NextRush on Cloudflare. A non-trivial Worker is impossible without abandoning the adapter. The README/docstrings actively market Cloudflare Workers as a first-class target, making this a promise/behavior mismatch.
- **Root Cause:**
  ```ts
  // edge/src/adapter.ts
  export function createCloudflareHandler(app, options = {}) {
    const fetchHandler = createFetchHandler(app, options);
    return {
      fetch: (request, _env, ctx) => fetchHandler(request, ctx),  // _env dropped
    };
  }
  ```
  `EdgeContext` has no `env` field, and `EdgeExecutionContext` models only `waitUntil`/`passThroughOnException`.
- **Evidence:** `packages/adapters/edge/src/adapter.ts` (`createCloudflareHandler`), `packages/adapters/edge/src/context.ts` (`EdgeContext`, `EdgeExecutionContext`).
- **Recommended Fix:** Thread `env` into the context (e.g. `ctx.env` on `EdgeContext`, or `ctx.state.env` / a typed `ctx.platform` object). Prefer a typed generic: `createCloudflareHandler<Env>(app): { fetch: (req, env: Env, ctx) => … }` and expose it on the context. This also generalizes to Netlify's context and Vercel's request geo.
- **Priority:** P0.

---

## F-04 — Massive triplicated implementation; the shared abstraction meant to prevent it is dead code

- **Severity:** High (maintainability / architecture smell)
- **Impact:** Every behavioral fix (including F-02) must be made 3–4 times and kept in sync by hand. This is exactly how "small inconsistencies become major framework problems." It already has: the dead-code guard in F-09 and the export drift in F-10 are direct symptoms of copy-paste divergence.
- **Root Cause:** `@nextrush/runtime` provides `AbstractBodySource` (template-method base) and `WebBodySource` (a complete Web-API body source) whose own docstring says it is "for Bun, Deno, Cloudflare Workers, Vercel Edge." **Nothing uses them.** Each adapter reimplements instead of extending/reusing.
- **Evidence:**
  - Verified dead code: inbound callers of `packages/runtime/src/body-source.ts::createWebBodySource` = `[]`; `WebBodySource`/`AbstractBodySource` have no consumers outside the runtime package's own tests.
  - `BunBodySource`, `DenoBodySource`, `EdgeBodySource` (`packages/adapters/*/src/body-source.ts`) are near-identical: same `buffer()` reader loop, same `stream()` `TransformStream` size-limiter, same `EmptyBodySource`, same private `concatUint8Arrays`.
  - `BunContext`, `DenoContext`, `EdgeContext` (`packages/adapters/*/src/context.ts`) are ~400 lines each and ~95% identical (`json`/`send`/`html`/`redirect`/`set`/`get`/`next`/`throw`/`assert`/`getResponse`/streaming are copy-pasted); they differ only in constructor args, IP helper, runtime detection, and the (also-duplicated) body-source class.
  - `NodeBodySource` ignores the documented `AbstractBodySource` design entirely and reimplements `buffer`/`text`/`json`/`consumed` from scratch — the runtime docstring literally shows `NodeBodySource extends AbstractBodySource` as the intended pattern.
- **Recommended Fix (composition-first — avoid a deep base-class hierarchy):**
  1. Make `WebBodySource` the single body source for Bun/Deno/Edge; delete `BunBodySource`/`DenoBodySource`/`EdgeBodySource` and re-export `WebBodySource` + `createWebBodySource` from each adapter's barrel (or drop them entirely). This is dedup-by-reuse of the *one existing* implementation, not a new hierarchy — do it regardless of the inheritance-vs-composition debate.
  2. **Prefer composition over a `WebContext` base class.** A `BaseWebContext → EdgeContext → BunContext → DenoContext` inheritance chain would trade one problem (duplication) for another (a rigid hierarchy that resists per-runtime divergence). Instead, extract the shared behavior into small, injected collaborators that a thin per-runtime context composes:
     - `ResponseBuilder` — owns `_responseBuilder`, `json`/`send`/`html`/`redirect`/`getResponse`, body-suppression, and CRLF-guarded `set()`. **This is where the F-02 fix and the F-18 Content-Length fix live, once.**
     - `IpResolver` — the single client-IP policy (F-11), with per-runtime strategies (socket / `x-real-ip` / `cf-connecting-ip`) passed in.
     - `RequestParser` — URL/path/query/header extraction.
     - `RuntimeFeatures` / `PlatformContext` — the exec-context, `waitUntil`, and CF `env` (F-03).
     A `BunContext`/`DenoContext`/`EdgeContext` then becomes a ~40-line shell wiring these together for its constructor shape. Node composes the same `ResponseBuilder` contract over a Node-response backend. A shallow abstract base is acceptable *only* if it stays a thin holder of these collaborators — not a place logic accretes.
  3. Make `NodeBodySource` extend `AbstractBodySource` (implement `_buffer`/`_stream`), or delete `AbstractBodySource` if the base-class design is being abandoned. Do not keep a documented abstraction that nothing implements.
- **Priority:** P1 (do immediately after F-02, because F-02's fix should land in the shared base, not 3 copies).

---

## F-05 — `host` vs `hostname`: divergent option names and return shapes

- **Severity:** Medium (consistency / DX)
- **Impact:** Breaks the "swap the import, keep the code" portability promise. Code written for Node (`serve(app, { host })`, `instance.address().host`) silently gets `undefined` on Bun/Deno (which use `hostname`), and vice versa. TypeScript catches the option name but the `.address()` return-shape divergence is a runtime footgun.
- **Root Cause:** Independent authoring; no shared `ServeOptions`/`ServerHandle` type (F-01).
- **Evidence:**
  - `node/src/adapter.ts`: `ServeOptions.host`, `onListen({ port, host })`, `ServerInstance.address(): { port, host }`.
  - `bun/src/adapter.ts` & `deno/src/adapter.ts`: `ServeOptions.hostname`, `onListen({ port, hostname })`, `ServerInstance.address(): { port, hostname }`.
- **Recommended Fix:** Pick one canonical key (`host` is more conventional in Node land; `hostname` matches the Web `URL`/Bun/Deno world — choose `host` for the config surface and normalize internally). Ship a single `ServerHandle.address` shape from the F-01 contract. If both must be supported, accept both and normalize, but return one shape.
- **Priority:** P1.

---

## F-06 — `createHandler` is a different function on every adapter

- **Severity:** Medium (consistency)
- **Impact:** The same public name has four different signatures, return types, and feature sets. Users cannot reason about `createHandler` portably, and Bun users get a subtly degraded handler (no timeout — see F-07).
- **Root Cause:** No handler contract (F-01).
- **Evidence:**
  - Node: `createHandler(app, { logger }) => (req: IncomingMessage, res: ServerResponse) => void`.
  - Bun: `createHandler(app) => (req: Request, server) => Promise<Response>` — **no options, no timeout**.
  - Deno: `createHandler(app, { timeout }) => (req, info) => Promise<Response>` — has timeout.
  - Edge: `createFetchHandler(app, { onError, timeout }) => (req, execCtx?) => Promise<Response>`, aliased as `createHandler`.
- **Recommended Fix:** Standardize a `HandlerOptions` type ({ logger?, timeout?, onError? }) honored by all, and document the two return-type families (Node callback vs Web `Response`) explicitly as part of the `ServerAdapter` vs `FetchAdapter` split.
- **Priority:** P1.

---

## F-07 — Bun's exported `createHandler` silently lacks the timeout that `serve` has

- **Severity:** Medium (correctness / least-surprise)
- **Impact:** A Bun user wiring `Bun.serve({ fetch: createHandler(app) })` (the documented pattern in the adapter's own JSDoc example) gets **no request timeout**, while `serve(app, { timeout })` does. Same package, same concept, two behaviors.
- **Root Cause:** `serve` does not reuse `createHandler`; it builds a separate internal `trackedHandler` that adds timeout + in-flight tracking. Node and Deno's `serve` reuse their `createHandler`; Bun forked.
- **Evidence:** `packages/adapters/bun/src/adapter.ts` — `createHandler` (no timeout) vs `serve`'s inner `trackedHandler` (Promise.race timeout + `activeRequests` tracking).
- **Recommended Fix:** Have `serve` compose `createHandler` (add timeout/tracking as wrappers around the shared handler), or give `createHandler` the same `{ timeout }` option so both paths are identical.
- **Priority:** P1.

---

## F-08 — Timeout races return 504 but never cancel the handler; timer/AbortSignal not wired

- **Severity:** Medium (resource safety)
- **Impact:** On Bun/Deno/Edge, when the timeout wins the `Promise.race`, a 504 is returned but the application handler **keeps running** — `ctx.signal` is never aborted on timeout. Long/expensive work continues consuming CPU/memory after the client got 504; on edge with strict CPU limits this can still trip platform kills. The handler may also later attempt to write to an already-returned response (no-op on Web, but wasted work). Node uses socket-level `server.timeout`, which does *not* emit a 504 at all — a third, different behavior.
- **Root Cause:** The race is a wall-clock guard only; it is not connected to the cancellation primitive (`ctx.signal` / an `AbortController`) that the framework already exposes.
- **Evidence:** `bun/deno/edge adapter.ts` `Promise.race([...timer])` blocks; no `abort()` call on `TIMEOUT_SENTINEL`. `node/src/adapter.ts` sets `server.timeout = timeout` (socket close, not 504).
- **Recommended Fix:** On timeout, abort a request-scoped `AbortController` that feeds `ctx.signal`, so cooperative handlers/streams can stop. Document that Node's timeout is transport-level and unify the 504 semantics across Web adapters. Ensure the timer is always cleared (currently only cleared on the handler-wins branch).
- **Priority:** P2.

---

## F-09 — Dead defensive branch in Web `json()`; inconsistent with Node

- **Severity:** Low (code smell / consistency)
- **Impact:** Confusing, unreachable code that differs across adapters — a fingerprint of copy-paste.
- **Root Cause:** `text()` (which can throw `BodyTooLargeError`/`BodyConsumedError`) is awaited **outside** the `try` in `json()`, so the `catch` that re-throws those errors can never see them.
- **Evidence:** `bun/deno/edge src/body-source.ts`:
  ```ts
  const text = await this.text();      // throws BodyTooLarge/Consumed HERE (outside try)
  try { return JSON.parse(text); }
  catch (err) {
    if (err instanceof BodyTooLargeError || err instanceof BodyConsumedError) throw err; // unreachable
    throw new BadRequestError('Invalid JSON…');
  }
  ```
  Node's `json()` has no such guard, so the three Web copies and Node also disagree.
- **Recommended Fix:** Remove the dead guard (collapse into the shared `WebBodySource` per F-04, which already handles this correctly).
- **Priority:** P3.

---

## F-10 — Export barrels are inconsistent; Edge ships dead exports and omits `HttpError`

- **Severity:** Medium (DX / API surface consistency)
- **Impact:** The public API of "an adapter" is unpredictable. Users can't rely on a symbol existing across adapters; some symbols are defined but never exported (dead within the package).
- **Root Cause:** No canonical barrel spec (F-01).
- **Evidence:**
  - `edge/src/index.ts` exports **only** `EdgeBodySource` from `./body-source` — `createEdgeBodySource`, `EmptyBodySource`, and `createEmptyBodySource` are defined in `edge/src/body-source.ts` but **never exported** (dead). Edge also **does not** re-export `HttpError`, while Node/Bun/Deno do.
  - `node/src/index.ts` exports `createEmptyBodySource` but **not** `EmptyBodySource`; Bun/Deno export both.
  - Node re-exports `Context`, `Middleware`, `HttpMethod`; Edge re-exports only `BodySource`, `Runtime`, `RuntimeCapabilities`.
  - `utils.ts` `getContentType`/`getContentLength` are exported from Node/Bun/Deno but not Edge, and appear unused by the contexts themselves (contexts build headers inline) — candidate dead exports.
- **Recommended Fix:** Define a required barrel surface per adapter family and lint it. Remove genuinely dead exports or wire them up. Re-export `HttpError` uniformly (or from `@nextrush/core`/`nextrush` only, and stop re-exporting it from adapters at all — pick one).
- **Priority:** P2.

---

## F-11 — Client-IP extraction differs across adapters (precedence, validation, headers)

- **Severity:** Medium (consistency + security surface)
- **Impact:** `ctx.ip` is computed by different rules per runtime, so IP-based logic (rate limiting, allow/deny lists, audit logs) behaves differently depending on where you deploy — again undermining portability, and with security implications when `trustProxy` is on.
- **Root Cause:** Node cannot use the Web-`Request`-based shared helper, so it forked its own logic, and the two drifted.
- **Evidence:**
  - Node (`node/src/context.ts` `getClientIp`): reads only `x-forwarded-for`, **validates** with `/^[\da-fA-F.:]+$/`, no `x-real-ip` fallback.
  - Web (`runtime/src/headers.ts` `getClientIp`): `x-forwarded-for` **then `x-real-ip`**, **no format validation**.
  - Edge (`getEdgeClientIp`): adds `cf-connecting-ip` first.
- **Recommended Fix:** Centralize IP resolution rules (header precedence + validation) in `@nextrush/runtime` as a single documented policy; give Node a thin `IncomingHeaders` adapter over the same policy so all four share behavior and validation.
- **Priority:** P2.

---

## F-12 — Web `send()` mishandles Node `Readable` streams (which `ResponseBody` permits)

- **Severity:** Medium (latent correctness)
- **Impact:** `ResponseBody` (in `@nextrush/types`) explicitly includes `NodeStreamLike`. On Bun (which supports Node streams) a handler passing a Node `Readable` to `ctx.send()` will not stream — it falls through to the `typeof data === 'object'` branch and gets `JSON.stringify`'d into `{}`. Node handles both stream types; Web adapters handle only `ReadableStream`.
- **Root Cause:** The Web `send()` only branches on `instanceof ReadableStream`; no `.pipe`/duck-typed Node-stream branch.
- **Evidence:** `bun/deno/edge src/context.ts` `send()` — after the `ReadableStream` check, any other object → JSON. `node/src/context.ts` `send()` handles both `pipe`-style and `getReader`-style streams.
- **Recommended Fix:** Either (a) narrow `ResponseBody` per adapter family so Node streams aren't typed as valid on Web adapters, or (b) detect and adapt Node streams to `ReadableStream` on Web adapters. (a) is cleaner and enforced at compile time.
- **Priority:** P2.

---

## F-13 — Adapter-specific context methods are outside the `Context` contract

- **Severity:** Medium (abstraction leak / contract completeness)
- **Impact:** `getResponse()` (Web), `waitUntil()`/`executionContext` (Edge), and `markResponded()` (all) are public but **not** in the `Context` interface. Consumers typed as `Context` cannot call them; `@nextrush/stream` and the adapters themselves must rely on structural/duck access or casts. The contract is therefore incomplete: the thing adapters actually expose is a superset of what the type promises.
- **Root Cause:** These are transport/lifecycle primitives that were never modeled in the shared `Context` type (only `signal` and `sendStream` made it in, marked `@internal`).
- **Evidence:** `packages/types/src/context.ts` (`Context`) vs `getResponse`/`waitUntil`/`markResponded` in `bun|deno|edge|node src/context.ts`.
- **Recommended Fix:** Model an internal `AdapterContext extends Context` interface in `@nextrush/types` capturing `markResponded()`, and a `FetchContext` variant with `getResponse()`/`waitUntil()`/`env`. Have the stream package depend on that interface rather than the concrete classes.
- **Priority:** P2.

---

## F-14 — Edge lifecycle asymmetry: `start()` and `close()`/`destroy()` never run

- **Severity:** Medium (lifecycle consistency + capability gap)
- **Impact:** On Edge, `app.start()` is never called, so `app.isRunning()` reports `false` while the app is serving. More importantly, `app.close()` is never called, so extension `destroy()` hooks never run on Edge — there is **no teardown seam** (flush logs/metrics, close pooled connections, cancel timers). Extensions that assume a symmetric setup/teardown behave differently on Edge than everywhere else.
- **Root Cause:** Edge has no server lifetime, so the adapter only runs `app.ready()` lazily and never wires `start`/`close`. That's defensible for the request/response model, but it's undocumented and untyped as a capability difference.
- **Evidence:** `edge/src/adapter.ts` (`ensureBooted` calls only `app.ready()`); contrast `node/bun/deno serve` which call `app.start()` and `app.close()`; `core/src/application.ts` `start()`/`close()`.
- **Recommended Fix:** At minimum, call `app.start()` after first boot on Edge for `isRunning` consistency, and document the "no destroy on edge" contract explicitly. Consider exposing a `ctx.waitUntil(app.flush())`-style hook, or a per-invocation teardown for edge-safe extensions.
- **Priority:** P2.

---

## F-15 — Inconsistent startup-error handling across server adapters

- **Severity:** Medium (production resilience / DX)
- **Impact:** The same failure (e.g. `EADDRINUSE`) produces three different experiences: Node rejects the `serve` promise via a one-shot `error` listener; Bun catches and rewrites the message into a friendly hint; Deno does neither (relies on `Deno.serve` throwing, with no port-in-use guidance). Operators get different signals per runtime.
- **Root Cause:** No shared startup/bind-error normalization.
- **Evidence:** `node/src/adapter.ts` (`server.once('error', onStartupError)` → `reject`); `bun/src/adapter.ts` (`try { Bun.serve } catch` EADDRINUSE rewrap); `deno/src/adapter.ts` (`Deno.serve(denoOptions)` with no bind-error handling).
- **Recommended Fix:** Normalize startup errors into a shared `ServerStartError` (with `code: 'EADDRINUSE'` etc.) in the F-01 contract layer so all adapters throw the same typed error with the same message.
- **Priority:** P2.

---

## F-16 — `@default 80800 (30 seconds)` documentation defect, repeated across adapters

- **Severity:** Low (docs correctness — but user-facing and copy-pasted)
- **Impact:** `80800` ms is ~80.8 seconds, not 30. The JSDoc misstates the default of `timeout` and `shutdownTimeout`; actual code uses `30000`/`30_000`. Users configuring around the documented value will be wrong. The repetition across files is itself evidence of copy-paste authoring.
- **Root Cause:** A typo propagated by duplication.
- **Evidence:** `node/src/adapter.ts` (`timeout` `@default 80800 (30 seconds)`, `shutdownTimeout` same), `bun/src/adapter.ts` (`timeout`, `shutdownTimeout`), `deno/src/adapter.ts` (`shutdownTimeout`, `timeout`). Code: `timeout = 30000`, `shutdownTimeout = 30_000`.
- **Recommended Fix:** Correct to `@default 30000 (30 seconds)` everywhere; better, derive the doc from a shared `DEFAULT_TIMEOUT_MS` constant so it can't drift.
- **Priority:** P3.

---

## F-17 — Deno adapter hand-rolls `declare const Deno` and runtime interfaces

- **Severity:** Low (type-drift risk)
- **Impact:** The Deno adapter re-declares `Deno.serve`, `DenoServeInit`, `DenoServer`, etc. locally. If Deno's `serve` API evolves, these hand-written types silently rot and can mask a real signature mismatch.
- **Root Cause:** Zero-dependency policy discourages pulling `@types/deno`; the tradeoff is manual typing.
- **Evidence:** `packages/adapters/deno/src/adapter.ts` (`declare const Deno`, `interface DenoServeInit`, `interface DenoServer`).
- **Recommended Fix:** Acceptable given the zero-dep policy, but pin the assumption: add a `deno/src/deno.d.ts` with a dated comment referencing the Deno version the types were verified against, and a smoke test that runs on real Deno in CI.
- **Priority:** P3.

---

## F-18 — Web adapters double-encode every response body to set a redundant `Content-Length`

- **Severity:** Medium (performance — on the hottest path)
- **Impact:** Every `json()`/`send()`/`html()` call on Bun/Deno/Edge encodes the entire body to UTF-8 **purely to measure its length** (`TEXT_ENCODER.encode(body).length`), sets that as `Content-Length`, and then hands the *string* to `new Response(...)`, which encodes it **again** to produce the actual bytes. That is two full-body encodes and an extra `Uint8Array` allocation per response. For a JSON API serving large payloads at high RPS this is measurable GC pressure and CPU for zero benefit — the Web `Response`/runtime already computes `Content-Length` from the body. Manually setting it is redundant at best and a source of mismatch bugs at worst.
- **Root Cause:** A Node-ism (where you *must* compute `Content-Length` for `res.setHeader`) was carried into the Web adapters, where the platform derives it automatically from `BodyInit`.
- **Evidence:** `bun|deno|edge src/context.ts` — `json()`: `headers.set('Content-Length', String(TEXT_ENCODER.encode(body).length)); ... _responseBuilder.body = body;` (same pattern in `send()` string branch and `html()`). `getResponse()` then passes the string body to `new Response(...)`, which re-encodes.
- **Recommended Fix:** On Web adapters, **do not** set `Content-Length` for string bodies — let the runtime compute it from `BodyInit`. Keep the explicit length only for `Uint8Array`/`ArrayBuffer` bodies where it's free (`.length`/`.byteLength`, no encode). This removes one full-body encode + one allocation from every text/JSON/HTML response. (Fixing it in the extracted `ResponseBuilder` from F-04 applies it once across all three adapters.)
- **Priority:** P2.

---

# Missing Capabilities

1. **No adapter contract / IoC seam** (F-01) — the foundational gap.
2. **No AWS Lambda (event) adapter.** Only a fetch-based Edge adapter exists. API Gateway / ALB proxy events (`(event, context)`) and Lambda@Edge (CloudFront event shape) are unsupported — despite `edge/src/body-source.ts` docstring claiming "AWS Lambda@Edge." A `@nextrush/adapter-lambda` (event→`Request` shim) is missing.
3. **No Cloudflare bindings access** (F-03) — `env` unreachable.
4. **No test/mock adapter.** There is no `createMockContext` / in-memory adapter for unit-testing handlers without a live server. `@nextrush/testing` exists for DI modules, but there is no first-class way to drive a `Context` through the middleware stack in a test without a runtime. This is table stakes for a framework "easy to test."
5. **No adapter-level observability hooks.** No `onRequest`/`onResponse`/`onError` lifecycle events, no metrics counters, no tracing span creation, no request-id propagation at the transport boundary. Everything must be reconstructed in middleware, and middleware can't see transport-level events (connection open/close, bind, drain).
6. **No HTTP/2, no server `upgrade`/WebSocket seam in the contract.** WebSockets are a separate extension; how it attaches to each runtime's server is undocumented and unmodeled (Node exposes `.server`; Bun/Deno/Edge have entirely different upgrade models).
7. **No health/readiness or connection-draining telemetry** exposed from `ServerInstance` (active connection count, draining state).
8. **No adapter registry / auto-selection.** The `nextrush` meta package hardwires `@nextrush/adapter-node`; there's no `detectRuntime()`-driven adapter selection for a "write once" entry point.

---

# Architectural Risks

- **Drift compounding (highest risk).** Without F-01, every future change widens the gap between adapters. The audit already found host/hostname, `createHandler`, timeout, IP, error-`Content-Type`, and barrel divergences. At v1.0 these become breaking to fix.
- **N-way fix cost.** F-04's duplication means F-02 (a real bug) currently needs three edits; a contributor will inevitably fix two of three and ship a new inconsistency.
- **Contract erosion via casts.** F-13's out-of-contract methods force `@nextrush/stream` and adapters into structural coupling; refactors to the concrete context classes can silently break stream without a type error.
- **"Runtime-agnostic" as marketing vs. mechanism.** The agnosticism is achieved by copying per runtime, not by a neutral core with thin transport shims. That inverts the usual sustainable design and makes the claim fragile.
- **Fat `Context` contract forces `@nextrush/stream` into every adapter.** Streaming (`stream`/`sse`/`ndjson`/`sendStream`/`signal`) is part of the mandatory `Context` interface, so every adapter hard-depends on `@nextrush/stream` even for edge bundles that never stream. Bundle-size sensitivity is called out in the edge adapter's own header comment, yet stream is non-optional.
- **Deno type rot** (F-17) and **broken Netlify detection** (below) are latent correctness risks that won't surface until a user deploys there.

---

# Runtime Compatibility Issues

| Target | Status | Notes / Evidence |
|---|---|---|
| **Node.js** | ✅ Solid | Correctly uses `node:http`, `node:stream`, `Buffer`. First-class; default in `nextrush` meta. |
| **Bun** | ✅ Works | `Bun.serve`, `server.requestIP`. Caveat: exported `createHandler` lacks timeout (F-07); Node-stream `send()` mishandled (F-12). |
| **Deno** | ✅ Works | Native `Deno.serve`. Caveats: hand-rolled types (F-17); no bind-error handling (F-15). |
| **Cloudflare Workers** | ⚠️ Crippled | Runs, but `env` bindings dropped (F-03) — KV/D1/R2/DO/secrets unreachable. |
| **Vercel Edge** | ✅ Works | Pure Web APIs. `createVercelHandler` = `createFetchHandler`; region/geo not surfaced but reachable via `ctx.raw.req`. |
| **Netlify Edge** | ⚠️ Detection broken | `detectEdgeRuntime` Netlify branch requires **both** `globalThis.Deno` **and** `process.env.NETLIFY === 'true'`. Netlify Edge runs on Deno, where `process` typically does not exist → branch never matches → misdetected as `deno`/generic edge. `createNetlifyHandler` also passes Netlify's context object as `EdgeExecutionContext` (shape mismatch beyond `waitUntil`). Evidence: `runtime/src/detection.ts` `detectEdgeRuntime`. |
| **AWS Lambda (API GW/ALB)** | ❌ Unsupported | No event-based adapter; edge is fetch-only. |
| **AWS Lambda@Edge** | ❌ Unsupported | Claimed in `edge/src/body-source.ts` docstring but uses CloudFront event shape, not fetch. Misleading. |
| **Future JS runtimes** | ⚠️ Conditional | The Web-API `Context` + Edge adapter would likely run on any fetch-compliant runtime — a genuine strength. But onboarding a *new server-style* runtime means copying ~800 lines with no contract to validate against (F-01/F-04). |

**Runtime-coupling scan result (clean where it matters):** `node:*` and `Buffer` appear **only** in the Node adapter. Bun/Deno/Edge use Web standards (`Request`, `Response`, `ReadableStream`, `TextEncoder`, `URL`, `AbortSignal`, `setTimeout`). Runtime globals (`process`, `navigator`, `Deno`, `Bun`) are confined to `@nextrush/runtime` detection code and correctly `typeof`-guarded. No filesystem or `EventEmitter` coupling leaks into the Web adapters. The core `Context` contract is genuinely runtime-neutral. This is the architecture's strongest asset.

---

# Adapter Consistency Review

*Does every adapter feel like it belongs to the same framework? Partially — they share a house style and the `Context` contract, but the transport surface reads as four independent implementations.*

| Axis | Node | Bun | Deno | Edge | Consistent? |
|---|---|---|---|---|---|
| Entry surface | `serve`/`listen`/`createHandler` | same | same | `createFetchHandler`/`createCloudflareHandler`/… (no `serve`) | ❌ (Edge diverges by necessity, but uncodified) |
| Host option | `host` | `hostname` | `hostname` | n/a | ❌ (F-05) |
| `address()` shape | `{port, host}` | `{port, hostname}` | `{port, hostname}` | n/a | ❌ (F-05) |
| `createHandler` sig | `(app,{logger})→(req,res)=>void` | `(app)→Promise<Response>` | `(app,{timeout})→Promise<Response>` | `(app,{onError,timeout})` | ❌ (F-06) |
| Timeout mechanism | socket `server.timeout` (no 504) | race→504 (serve only) | race→504 | race→504 (opt-in) | ❌ (F-07/F-08) |
| Error `Content-Type` | `application/json; charset=utf-8` | `application/json` | `application/json` | `application/json` | ❌ (charset drift) |
| Header drop on empty resp | preserved | dropped | dropped | dropped | ❌ (F-02) |
| IP extraction | XFF + regex validate | XFF + x-real-ip | XFF + x-real-ip | +cf-connecting-ip | ❌ (F-11) |
| Body source | `NodeBodySource` (bespoke) | `BunBodySource` (copy) | `DenoBodySource` (copy) | `EdgeBodySource` (copy) | ❌ (F-04) |
| `EmptyBodySource` export | not exported | exported | exported | not exported | ❌ (F-10) |
| `HttpError` re-export | yes | yes | yes | no | ❌ (F-10) |
| `startup` error UX | reject | friendly rewrap | none | n/a | ❌ (F-15) |
| Lifecycle (`start`/`close`) | both | both | both | neither | ❌ (F-14) |
| Graceful drain shutdown | ✅ | ✅ | ✅ | n/a | ✅ (where applicable) |
| CRLF header guard in `set()` | ✅ | ✅ | ✅ | ✅ | ✅ |
| Body suppression HEAD/204/304/1xx | ✅ | ✅ | ✅ | ✅ | ✅ |
| `trustProxy` default false | ✅ | ✅ | ✅ | ✅ | ✅ |
| Streaming (text/SSE/NDJSON) | ✅ | ✅ | ✅ | ✅ | ✅ |

Net: the **behavioral safety rails are consistent** (a real credit); the **transport API and its edge behaviors are not**.

---

# Production Readiness Checklist

| Concern | State | Notes |
|---|---|---|
| Request body DoS limits | ✅ | Incremental size enforcement + content-length pre-check on all adapters; `BodyTooLargeError` (413). |
| Prototype-pollution safety | ✅ | `parseQueryString` and `headersToRecord` use null-prototype objects; denies `__proto__`/`constructor`/`prototype`. |
| Query flooding / length caps | ✅ | `MAX_QUERY_PARAMS=256`, `MAX_QUERY_LENGTH=2048`. |
| Header injection (CRLF) | ✅ | `set()` rejects `\r`/`\n` on field and value on all adapters. |
| Redirect injection | ✅ | Redirect body is `text/plain` to avoid HTML injection via user URLs. |
| `trustProxy` default | ✅ | Defaults `false`; IP not trusted from headers unless enabled. |
| Graceful shutdown | ✅ (server) / ❌ (edge) | Node/Bun/Deno drain with timeout + force-close; edge has no teardown (F-14). |
| Response correctness | ⚠️ | Header-drop divergence (F-02) is a real bug. |
| Timeout / cancellation | ⚠️ | 504 without handler cancellation (F-08); inconsistent mechanism. |
| Startup error handling | ⚠️ | Inconsistent; Deno unhandled (F-15). |
| Observability (logs/metrics/tracing/req-id) | ❌ | Only `logger.error` on failure; no lifecycle hooks, metrics, spans, or request IDs at the adapter boundary. |
| Diagnostics | ⚠️ | Runtime detection/capabilities exist; no per-request diagnostics surface. |
| Concurrency safety | ✅ | Per-request context; shared singletons (`EMPTY_PARAMS`, empty body source) are frozen/stateless. |
| Memory | ✅ | Shared encoders/empty buffers; lazy `AbortController` on Node. |
| Cloud platform integration | ❌ | CF bindings dropped (F-03). |
| Test harness for handlers | ❌ | No mock/in-memory adapter (Missing Capabilities #4). |
| Secrets / config hygiene | ✅ | No hardcoded secrets; no env coupling in core. |

---

# Technical Debt

- **Structural (high-interest):** triplicated Web contexts + body sources (F-04); dead `AbstractBodySource`/`WebBodySource`/`createWebBodySource` shipped in `@nextrush/runtime`; per-adapter `EmptyBodySource`/`concatUint8Arrays` copies.
- **Contract debt:** no adapter interface (F-01); out-of-contract context methods (F-13); `RuntimeCapabilities` defined twice (in `@nextrush/types` and `middleware/compression/src/types.ts`).
- **Dead code:** Edge's unexported `createEdgeBodySource`/`EmptyBodySource`/`createEmptyBodySource` (F-10); likely-unused `utils.ts` `getContentType`/`getContentLength`; unreachable `json()` guard (F-09).
- **Doc debt:** `@default 80800` typo (F-16); "AWS Lambda@Edge" claim with no implementation; docstrings promising the `AbstractBodySource` template that no adapter follows.
- **Type debt:** hand-rolled Deno types (F-17); `as unknown as BodyInit` / `req.headers as IncomingHeaders` casts (pragmatic but unaudited over time).

---

# Performance & Hot-Path Analysis

*Frameworks live and die on the per-request hot path. This section audits allocations, copies, and backpressure in the request→response cycle. Note: no benchmark gates the adapters today — the observations below are from code inspection, and every one should be confirmed with a profiled benchmark before optimizing.*

**What's done well (keep):**
- **Shared, reused singletons:** one module-level `TEXT_ENCODER` per Web adapter, a frozen `EMPTY_PARAMS`, and a shared `EMPTY_BODY_SOURCE` singleton — no per-request allocation for these.
- **Single-pass query scanner:** `parseQueryString` walks the string with `indexOf('&')` instead of `split('&')`, avoiding an intermediate array (`runtime/src/query.ts`).
- **Single-chunk body fast path:** `buffer()` returns the sole chunk directly when `chunks.length === 1`, skipping a concat/copy (all body sources).
- **Lazy `AbortController` on Node:** `ctx.signal` only allocates the controller + listeners on first access, keeping the non-streaming path allocation-free (`node/src/context.ts`).
- **Incremental body reading:** bounded by limit during read, so a too-large body is aborted before full buffering.

**Hot-path costs / concerns (measure, then address):**
- **F-18 — double body encode for `Content-Length`** (see finding). The standout: every text/JSON/HTML response on Web adapters encodes the body twice + allocates a throwaway `Uint8Array`. Highest-value perf fix.
- **Per-request full header copy:** `headersToRecord()` iterates every header into a new null-prototype object on every request, even though most requests read only a couple of headers via `ctx.get()`. Consider a lazy header view (read-through to the Web `Headers`) for the common case; the eager copy is safe but not free. (`runtime/src/headers.ts`)
- **`new URL(request.url)` per request** on Web adapters (parse + allocation). Node avoids it with a manual `indexOf('?')` split. A manual split on the Web adapters would match Node and shave a `URL` allocation on the hot path — worth benchmarking, since `URL` construction is not cheap at high RPS.
- **`new Headers()` per response** in every Web context constructor (the `_responseBuilder`). Unavoidable if headers are set, but for header-less responses it's a wasted allocation; could be lazily created on first `set()`.
- **Stream backpressure:** Node's `sendStream`/`send` correctly honor backpressure (`res.write` return value + `once('drain')`). Web adapters hand the `ReadableStream` to `Response` and delegate backpressure to the runtime — correct. No backpressure bug found; this is a genuine strength for the AI/streaming use case the framework targets.
- **No object pooling** of context/response-builder. This is the right default (pooling request objects is error-prone), but it means the allocation profile per request is: 1 context + 1 `Headers` + 1 header record + 1 `URL` + 1 body source. Reducing the header-record and `URL` allocations (above) is the realistic win; pooling is not recommended.

**Bottom line:** the instincts are good and there is no catastrophic hot-path bug, but the Web response path carries avoidable per-request encode/allocation overhead (F-18 chief among them), and there is **no benchmark in CI that would catch a regression** — which for a framework that publishes an RPS table in its README is itself a gap.

---

# Package Dependency Review

*Consolidated here (the exec summary and Architectural Risks touch on it; this is the single authoritative view). Direction and cycles were verified against the codebase graph.*

```
types  ─┬────────────────────────────┐
        │                            │
        ▼                            ▼
      errors                       stream ──► types
        │
        ▼
      core ──► errors, types            runtime ──► types, errors
        ▲                                   ▲
        └───────────────┐   ┌───────────────┘
                        │   │
                     adapter-{node,bun,deno,edge}
                        └──► core (type-only), runtime, stream, errors, types
```

| Question | Answer | Evidence |
|---|---|---|
| Is the graph acyclic? | ✅ Yes. | No package imported by a lower one; `core` never imports an adapter. |
| Does `core` import `runtime`? | ❌ No — `core` depends only on `errors` + `types`. | `packages/core/package.json` `dependencies`. Good: keeps core edge-safe (the code comment even notes VERSION isn't exported to avoid `node:fs`). |
| Does `core` import an adapter? | ❌ No (no cycle). | `serve`/`listen` live in adapters, not core. |
| Should the adapter depend on `@nextrush/stream`? | ⚠️ **Questionable — flagged.** Every adapter hard-depends on `@nextrush/stream` because streaming (`stream`/`sse`/`ndjson`/`sendStream`/`signal`) is part of the mandatory `Context` interface. This forces `@nextrush/stream` into every edge bundle even when unused, against the edge adapter's own stated bundle-size sensitivity. | adapter `package.json` deps; `types/src/context.ts` streaming methods; edge adapter header comment on bundle size. |
| Should `runtime` "know" about body source? | ✅ Acceptable. `runtime` owns the *cross-runtime* `AbstractBodySource`/`WebBodySource` — that's its purpose. The issue is not ownership but that the adapters don't *use* it (F-04). | `runtime/src/body-source.ts`. |
| Hidden/implicit dependencies? | ⚠️ One soft one: `@nextrush/stream` and the adapters couple to *concrete context classes* (via `markResponded()`/`getResponse()`) rather than a typed contract (F-13) — a structural dependency the type system doesn't see. | `types/src/context.ts` vs concrete `*/context.ts`. |
| Type-only vs value imports at boundaries? | ✅ Correct. `Application` is imported `import type` (no runtime coupling to core); value imports are limited to `errors`, `runtime`, `stream`. | adapter `*/adapter.ts`/`context.ts` import lines. |
| Version-range consistency | ⚠️ Minor drift: `adapter-node` uses `workspace:*`; `bun`/`deno`/`edge` use `workspace:^`. Harmless in-repo, but inconsistent and worth normalizing before publish. | adapter `package.json` files. |

**Verdict on dependencies:** the direction is clean and cycle-free (a real strength). The two things to act on are the **mandatory `stream` dependency** (make streaming optional, or explicitly accept it as core and document the bundle cost) and the **untyped coupling to concrete context classes** (F-13).

---

# Public API & Stability Review (v1.0 freeze-readiness)

*What a 1.0 freezes forever. Audited: exports, internal leakage, module format, tree-shaking, and types.*

| Concern | State | Notes / Evidence |
|---|---|---|
| **Export barrel consistency** | ❌ | Drifted across adapters (F-10): Edge omits `HttpError` and ships unexported dead symbols; Node omits `EmptyBodySource`. Freezing these barrels as-is locks in the inconsistency. |
| **Internal-symbol leakage** | ⚠️ | `getResponse()`, `waitUntil()`, `markResponded()` are `public` on the context classes but absent from the `Context` type (F-13). They are effectively public API by accident. Decide: promote to a typed `AdapterContext`/`FetchContext`, or make them non-enumerable/`@internal` and stop exporting the classes. |
| **Module format (ESM/CJS)** | ⚠️ | All packages are **ESM-only** (`"type": "module"`, `exports` maps expose only `import`, no `require`). This is a defensible modern choice, but it is **undocumented** and will surprise CJS consumers at 1.0. Either document "ESM-only" prominently as a supported constraint, or add a CJS build. Do not leave it implicit. |
| **Tree-shaking** | ✅ | Every adapter sets `"sideEffects": false`; the `nextrush` meta correctly scopes side effects to `./dist/class.js` (reflect-metadata). Good. |
| **Type declarations** | ✅ (mostly) | `.d.ts` emitted via `tsup`; types re-exported from barrels. Gap: the leaked context methods above aren't in the shared type, so consumers can't type against them. |
| **Subpath exports** | ✅ | Single `.` entry per adapter — simple and stable. |
| **Breaking-change surface** | ⚠️ | The `host`/`hostname` split (F-05) and divergent `createHandler` signatures (F-06) are exactly the kind of thing a 1.0 freeze makes permanent. Reconcile **before** the freeze, not after. |

**Freeze-readiness verdict:** Not yet. The barrels, the leaked methods, the ESM-only stance, and the `host`/`hostname` + `createHandler` divergences must be reconciled and documented before any of this becomes a frozen 1.0 surface.

---

# Adapter Conformance Specification

*The single highest-leverage recommendation in this report (elevated per review). An interface guarantees shape; only a shared behavioral suite guarantees identical behavior — which is the project's own stated definition of correctness. Author this once, parameterize it by adapter, and gate every adapter change on it.*

The suite should construct each adapter's `Context` (and, where applicable, drive its `serve`/handler against a real loopback server) and assert **identical observable behavior** for:

| # | Behavior | Assertion (must be identical across Node/Bun/Deno/Edge) |
|---|---|---|
| 1 | Request line | `method` upper-cased; `path` and `url` split from query correctly. |
| 2 | Query parsing | Same parsed shape; proto-pollution keys rejected; array-valued repeats. |
| 3 | Route params | `params` default empty; router-set values readable. |
| 4 | Headers (in) | `ctx.get()` case-insensitive; multi-value handling identical. |
| 5 | Headers (out) — **F-02 regression guard** | Headers set via `ctx.set()` are present on the response **even when no body method is called** (empty/204/redirect). |
| 6 | `Set-Cookie` | Multiple cookies accumulate; array replaces; survive empty responses. |
| 7 | JSON / send / html | Same `Content-Type` (incl. charset — **F-16/charset guard**), same body, same status. |
| 8 | Redirect | Same status default (302), `Location` set, `text/plain` body. |
| 9 | Empty response | Same status, same (absent) body, headers preserved (ties to #5). |
| 10 | Body suppression | HEAD / 204 / 304 / 1xx never carry a body. |
| 11 | Body reading | `text`/`json`/`buffer` identical; `BodyTooLargeError` (413) at the same limit; `BodyConsumedError` on re-read. |
| 12 | Error propagation | Thrown `HttpError` → same status/exposed message; unknown error → 500 with no internal leak. |
| 13 | Timeout | Same 504 semantics **and** handler cancellation via `ctx.signal` (**F-08 guard**). |
| 14 | Shutdown / drain | In-flight requests drained; force-close after `shutdownTimeout` (server adapters). |
| 15 | Abort | `ctx.signal` fires on client disconnect. |
| 16 | Context `state` | Mutable bag shared across middleware. |
| 17 | Middleware order | Same execution/onion order; `ctx.next()` semantics identical. |
| 18 | Extension lifecycle | `ready()` before handler; `close()`/`destroy()` on shutdown (document Edge's deliberate exception — **F-14**). |
| 19 | Client IP | Same precedence + validation for a given header set under `trustProxy` (**F-11 guard**). |

Wire it as a single `describe.each([nodeAdapter, bunAdapter, denoAdapter, edgeAdapter])(...)` module. A new adapter (including third-party) becomes "supported" only by passing it. This is the mechanism that operationalizes *"every adapter must behave identically"* and prevents the drift catalogued throughout this report from ever recurring.

---

# Suggested Refactoring Roadmap

### Immediate (before any 1.0 tag) — correctness + conformance
1. **Stand up the shared Adapter Conformance Suite** (see the Adapter Conformance Specification). This is the single highest-leverage item and gates everything below — an adapter change is not "done" until it passes. Seed it with the F-02, F-16-charset, and F-08 regression guards.
2. **Fix F-02** (header drop on empty Web responses) — the seed conformance case #5/#9. Shipping-blocker bug.
3. **Fix F-03** (thread Cloudflare `env` into the context; typed generic). Without this the edge adapter can't build real Workers.
4. **Introduce a light compile-time contract (F-01)** in `@nextrush/types` and make each adapter `satisfies` it. Freeze the canonical `address` shape and option names (F-05). The suite (item 1) is the primary guard; this is the cheap secondary one.
5. **Correct the `@default 80800` docs (F-16)** and drop the redundant Web `Content-Length` double-encode (F-18) while you're in the response path.

### Short-term (weeks) — de-duplicate + unify semantics
5. **Collapse the three Web body sources into `WebBodySource`; extract a `WebContext` base** (F-04). Delete or wire up `AbstractBodySource` — do not keep a dead documented abstraction. Land the F-02 fix in the shared base, not three copies.
6. **Unify `createHandler` signature/options and timeout behavior** (F-06/F-07); wire timeout to `ctx.signal` cancellation (F-08).
7. **Centralize client-IP policy** (F-11) and **normalize startup errors** (F-15). Standardize error-response `Content-Type` (charset).
8. **Reconcile export barrels; remove dead exports** (F-10). Decide one place for `HttpError` re-export.

### Medium-term (1–2 months) — capabilities
9. **Ship a test/mock adapter** (`createMockContext` + in-memory request driver) — required for the "easy to test" claim.
10. **Fix Netlify detection** and formally support Netlify context; **add an AWS Lambda (event) adapter** or explicitly drop the Lambda@Edge claim from docs.
11. **Model adapter-specific context surface** (`FetchContext`/`AdapterContext` in `@nextrush/types`) so `@nextrush/stream` and consumers don't couple to concrete classes (F-13).
12. **Make streaming optional** to protect edge bundle size, or accept the stream dependency explicitly as core and document it.

### Long-term (quarters) — platform maturity
13. **Adapter-level observability**: lifecycle hooks (`onRequest`/`onResponse`/`onError`), metrics, tracing spans, request-id propagation, connection/drain telemetry on `ServerHandle`.
14. **Model the WebSocket/upgrade seam** in the contract; unify how the WebSocket extension attaches per runtime.
15. **Adapter auto-selection** driven by `detectRuntime()` for a true "write-once" entry, plus an official conformance test suite every adapter (including third-party) must pass — operationalizing the project's own "every adapter must behave identically" rule.

---

# Final Verdict

## Would you approve this Adapter architecture for a v1.0 production framework used by thousands of developers?

# NO

### Justification

This is a **NO with a clear, short path to YES** — not a condemnation of the design. The foundations are better than most frameworks at this stage: a clean acyclic dependency graph (adapters → core [type-only] / runtime / stream / errors / types; core depends only on errors + types; no cycles, no adapter imported by core), a genuinely runtime-neutral `Context` contract, a shared runtime package with security-conscious primitives (hardened query parser, null-prototype headers, incremental body-size DoS limits, CRLF guards, secure `trustProxy` default), and a Edge adapter that is legitimately Web-standard and portable. Those are the hard things, and they are largely right.

But a **1.0 for thousands of developers** is a promise of stability, uniformity, and correctness across the runtimes it advertises. This architecture fails that bar on four counts, each independently disqualifying:

1. **A correctness bug that is also a portability bug (F-02).** Response headers set by middleware vanish on empty/204 responses on Bun/Deno/Edge but not Node. CORS, security headers, and cookies will behave differently depending on where the same app is deployed. For a framework whose headline is "runtime-agnostic," a silent, per-runtime behavioral divergence in the response path is the exact failure it promises to prevent — and it directly violates the project's own hard rule that *every adapter must behave identically*.

2. **The flagship edge target can't build real apps (F-03).** Dropping Cloudflare's `env` makes KV/D1/R2/Durable Objects/secrets unreachable. Cloudflare Workers is marketed as first-class; in practice a non-trivial Worker must bypass the adapter.

3. **No adapter contract (F-01).** With nothing to implement against and nothing to validate conformance, "consistency" is a matter of author discipline — and the audit found it has already drifted across at least eight axes (host/hostname, `createHandler`, timeout semantics, error `Content-Type`, IP extraction, export barrels, startup errors, lifecycle). At 1.0 these become breaking changes to fix. The seam must exist *before* the API is frozen, not after.

4. **Maintainability debt guarantees future drift (F-04).** Three ~400-line near-identical Web contexts and three near-identical Web body sources — while the shared abstraction built to prevent exactly this (`AbstractBodySource`/`WebBodySource`) sits unused as dead code — means every fix is an N-way edit. This is not a stylistic nit; it is the mechanism by which the inconsistencies above were born and by which new ones will keep appearing.

Supporting these, the layer is missing capabilities a production 1.0 is expected to have: a test/mock adapter (the "easy to test" claim is currently unmet at the transport layer), any adapter-level observability (metrics/tracing/request-id/lifecycle hooks), working Netlify detection, and any AWS Lambda story despite the docstring claim.

**What would flip this to YES:** the four "Immediate" roadmap items plus the "Short-term" de-duplication — realistically a focused **2–4 week** effort given how much is already correct. Specifically: fix F-02 and F-03, introduce and enforce the `ServerAdapter`/`FetchAdapter` contract with a canonical `ServerHandle`, collapse the Web contexts/body sources onto the shared abstraction, and add a cross-adapter conformance test suite that mechanically enforces "every adapter behaves identically." Once an adapter cannot be merged without passing that suite, the consistency, maintainability, and portability scores rise together, and this becomes a defensible 1.0.

Until then: **not for 1.0, not for thousands of production apps.**

---

*Prepared from direct source review of `packages/adapters/{node,bun,deno,edge}/src/{adapter,context,body-source,utils,index}.ts`, `packages/runtime/src/{body-source,detection,headers,query,index,types}.ts`, `packages/types/src/{context,runtime,http}.ts`, `packages/core/src/application.ts`, `packages/stream/package.json`, and `packages/nextrush/src/index.ts`. Dead-code and dependency-direction claims verified via the codebase knowledge graph (inbound call tracing and symbol search).*
