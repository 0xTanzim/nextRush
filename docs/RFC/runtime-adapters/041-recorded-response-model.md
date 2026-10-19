# RFC-041: A recorded response model — one outgoing response both adapter families can rewrite

| Field                | Value                                                                 |
| -------------------- | --------------------------------------------------------------------- |
| **Status**           | `Adopted` — P1–P4 shipped and the §14 gate measured (§14.1); `FB-03` deleted from `knownFailures` |
| **RFC number**       | `041`                                                                 |
| **Date**             | `2026-10-19`                                                          |
| **Author(s)**        | Framework maintainer (R&D audit + request-path implementation session) |
| **Group**            | `runtime-adapters`                                                    |
| **Packages touched** | `@nextrush/runtime`, `@nextrush/types`, `@nextrush/core`, `@nextrush/adapter-node`, `@nextrush/adapter-{bun,deno,edge,serverless,nextjs}`, `@nextrush/compression`, `@nextrush/timer`, `packages/adapters/conformance` |
| **Framework impact** | `Breaking-adjacent` — a core response-contract change; behaviour that silently does nothing today starts working, and Node's write timing changes |
| **Supersedes**       | `—`                                                                   |
| **Superseded by**    | `—`                                                                   |
| **Related**          | RFC-039, RFC-040, RFC-018 (response serialization), ADR-0010 (adapter contract), RFC-030 (typed proxy trust), `fix-request-path-and-response-contract` (the change that measured and deferred this) |

---

## Progress Tracker

**Overall:** `[████████████████████]` 100% — 4 / 4 phases complete · Doc status: `Adopted`, §14 gate measured

| Phase | Deliverable | Status |
| ----- | ----------- | ------ |
| P1 | Record the outgoing response in the shared context, both adapter families | ✅ Shipped |
| P2 | Node flushes the recorded response after the chain unwinds | ✅ Shipped |
| P3 | Compression and timer act on the recorded response on every adapter | ✅ Shipped |
| P4 | Remove the divergence flag from conformance and its documented limitations | ✅ Shipped |

**What shipped (verified by the suites, not asserted here):**

- `@nextrush/runtime`: `OutgoingResponse` (record), `HeaderList` (allocation-free case-insensitive
  map), `WebResponseBuilder` rewritten onto the record, `WebContextBase[OUTGOING_RESPONSE]`.
- `@nextrush/types`: the `OUTGOING_RESPONSE` symbol key and `OutgoingResponseHandle` contract,
  `@internal`.
- `@nextrush/adapter-node`: `json`/`send`/`html`/`redirect`/`set` record instead of writing,
  `flushResponse()` once after the chain settles, one `writeHead` per response, derived
  `Content-Length`.
- `@nextrush/compression` and `@nextrush/timer`: read/rewrite through the record; the adapter-matrix
  limitation sections are gone from both READMEs.
- Conformance: `honorsPostHandlerHeaderWrite` deleted from the contract and all five drivers; #29
  asserts the header unconditionally; new #31 asserts a post-handler body rewrite.

**Gate measured (§14.1):** the three FB-03 probes pass on Node and Bun, the copy counter reports 0
copies for an untouched response and 1 for a rewrite, conformance is 436/436 with the divergence flag
deleted, the gated cold/bundle/wire ratios are unchanged, and the Node in-process cost is ~+0.1
µs/req (interleaved A/B). `FB-03` is deleted from `knownFailures` in the same change.

---

## 0. Revision History

- **v1 (`2026-10-19`)** — Written as the durable record for a decision made and deliberately deferred inside `fix-request-path-and-response-contract`. Every claim about current behaviour below was measured in that change; the fix brief that first named the problem is `report/architecture/fix-briefs/fb-03-response-commit-model-and-compression.md`.
- **v2 (`2026-10-19`)** — Recorded the interim commit contract (§3.1.1) established by `align-post-handler-response-contract`: a post-commit response-header write is discarded and reported once, and a response the handler already committed outlives the handler timeout. §3.1, §3.2, §6 and §12 updated to match. Status stays `Deferred`; this RFC remains gated on the §14 measurement, and now must preserve both interim outcomes rather than revert them.
- **v3 (`2026-10-19`)** — P1–P4 implemented (see the Progress Tracker for the shipped surface). Three things were learned while implementing and are recorded here because they change the plan, not just the code:
  1. **Node's socket guard had to move later than the handler deadline.** `serve()` fed one
     `timeout` to both guards, so they expired on the same tick. That was survivable while the
     handler wrote the response immediately; once delivery is the flush, the socket guard wins the
     tie and destroys a socket whose response was ready to send (the conformance drivers had
     already worked around it locally by raising `httpServer.timeout`). `server.timeout` is now
     `timeout + SOCKET_GUARD_HEADROOM_MS`, and `handler-timeout.test.ts` pins the strict ordering.
  2. **A committed response needs a deadline without losing F-1.** A handler that commits and then
     hangs is delivered by the record, not by an eager write, so the flush must be bounded. The
     deadline is armed only after a bounded microtask window (the same `SETTLE_TURNS` trade the Web
     runner makes), which keeps a synchronously-settling chain free of `Timeout` allocations.
  3. **A replaced body invalidates its recorded length.** `setBody` drops a previously recorded
     `Content-Length`, so a middleware cannot flush a length that describes the body it replaced;
     callers that know the new length write it after the replacement (compression does).
  Status moves from `Deferred` to `Implemented`; the §14 numbers are still to be recorded before
  adoption, and `FB-03` stays in `knownFailures` until its probes pass.

---

## 1. Summary (TL;DR)

Today there are two response models behind one `Context`. The Web adapters **record** a response
(status, headers, body) and materialise a `Response` after the middleware chain unwinds. The Node
adapter **commits** as it goes: the handler writes to `ServerResponse`, and by the time post-handler
middleware runs the response is on the wire.

That difference is not cosmetic. It is why `@nextrush/compression` compresses nothing on any shipped
adapter, why `@nextrush/timer` cannot write `X-Response-Time` on Node, and why a middleware that
post-processes a response works on four adapters and silently does not on the fifth. This RFC records
the model that fixes it once — a single recorded outgoing response in the shared context, flushed by
the adapter — and the measurement that must approve it before implementation.

---

## 1a. Terminology

- **Recorded response** — status + headers + buffered body held in the context, with no transport
  write yet.
- **Commit** — the moment the adapter hands bytes to the transport. After a commit, headers can no
  longer be written.
- **Post-handler work** — middleware code that runs after `await next()` and wants to change the
  response (compression, timing headers, caching headers, ETag).

---

## 2. Decision Summary

- **Status:** `Deferred` — not rejected. Adopt the recorded response model, but only after the
  buffer-cost measurement in §14 shows the per-request cost is acceptable on Node.
- **Decision (when unblocked):**
  - _Adopt_ one recorded response in the shared context: `status`, a header map, and a buffered body.
  - _Change_ the Node adapter to flush the recorded response after the chain unwinds, instead of
    writing inside the handler.
  - _Keep_ the streaming escape hatch: `sendStream`/`sse`/`ndjson` commit immediately and mark the
    response committed, so streaming never buffers.
  - _Delete_ the `honorsPostHandlerHeaderWrite` divergence once both families honour post-handler
    writes, and delete the corresponding README limitations.
- **Non-decision:** this RFC does not change the router, the context's public shape (beyond an
  internal response handle), or the error contract.

---

## 2a. Decision Drivers

1. **Silent no-ops are worse than missing features.** Compression is documented, configured, and does
   nothing; the only signal is a once-per-process warning added as an interim measure.
2. **Post-handler work is a documented middleware pattern.** Timer, compression, ETag, and cache
   headers all need it, and every one of them is adapter-dependent today.
3. **The divergence is now measured, not suspected.** Conformance scenario #29 asserts, per adapter,
   whether a post-handler header write lands: Node fails, the Web family lands. That scenario is the
   proof this RFC must delete.
4. **Buffering is not free.** Node writes 19791 bytes of a JSON body today with no extra copy. A
   recorded model holds the body first, so the cost has to be measured, not assumed.

---

## 3. Problem & Motivation

### 3.1 Current state (what exists today)

| Adapter family | Response model | Post-handler header write | Post-handler body rewrite |
| --- | --- | --- | --- |
| Node | Commit inside the handler (`res.writeHead`/`res.end`) | Interim: discarded and reported once — no throw, the chain completes (§3.1.1); becomes "yes" under this RFC | No |
| Bun / Deno / Edge / serverless / Next.js | Record, then build `Response` after the chain | Yes | No — the record is private to the adapter |

`@nextrush/compression` reads a declared outgoing-response slot (`raw.res` with `getHeader`) that no
adapter populates, so it warns once and returns. It previously fell back to `ctx.body`, which is the
*parsed request body* — a measured data-leak-shaped bug fixed in `fix-request-path-and-response-contract`.

### 3.1.1 Interim commit contract (established `2026-10-19`)

`align-post-handler-response-contract` fixed two divergences the two families had to agree on before
this RFC could redesign the same surface. Both are interim: **this RFC must preserve them**, not
supersede them.

1. **A response-header write after the response headers have been sent is discarded and reported once per
   process.** It no longer throws on Node, so it no longer aborts the remaining middleware chain.
   Measured before the fix: an inner `ctx.set()` reached `res.setHeader()` after `headersSent`, threw,
   and skipped every outer middleware's post-`next()` work, which `handleError` then swallowed because
   `ctx.responded` was already true. After the fix the whole chain completes and the discarded field is
   named once. A write made *while* `writeHead` runs — after `ctx.responded` is set but before the
   headers are sent, which is where Node invokes `on-headers` listeners — is still legal and lands.
   P2 makes the late write *land* instead of being discarded — strictly better — but it must not
   reintroduce a throw, a chain abort, or a silent drop.
2. **A response the handler already committed outlives the handler timeout.** Measured before the fix:
   a handler that answered and then worked past the configured timeout returned the Web adapters'
   `504 Gateway Timeout`, discarding a correct response, while the same handler on Node returned its own
   response. After the fix a committed response is delivered on every adapter, and the `504` is reserved
   for a request that produced nothing. The recorded model is not delivered until the chain unwinds, so
   P1 must define what a committed response means for the timeout: buffering must not turn "already
   answered" back into "timed out".

### 3.2 The problems (enumerated)

1. **Compression does nothing on every shipped adapter.** Measured: `content-encoding` undefined for a
   20 KB JSON response on both Node and Bun.
2. **Timer headers work on four adapters and not the fifth.** Measured: `x-response-time: 0.25ms` on
   the Web family, absent on Node; on Node the write threw and the throw aborted every outer
   middleware's post-`next()` work, which the adapter then swallowed without a log. The throw and the
   abort are fixed and the discard is now reported once (§3.1.1); the header still does not land on
   Node until P2.
3. **Two behaviours behind one API is a documentation tax.** Every middleware that wants to touch a
   response needs an adapter matrix in its README (compression and timer both now carry one).
4. **Conformance has to encode a permanent divergence.** `honorsPostHandlerHeaderWrite` exists only
   because the framework cannot decide this for itself.

### 3.3 Why now

The request path was just measured and made cheaper (RFC-039 Part A: 25–31% lower per-request cost in
`fix-request-path-and-response-contract`). That removes the argument that a response model change is
unaffordable *because* the framework is slow. It does not remove the need to measure the buffer cost.

---

## 4. Goals & Non-Goals

### 4.1 Goals

- One response model: a recorded response the adapter flushes.
- Post-handler header *and* body rewrites work on every adapter, including Node.
- Compression and timer work by default, with no adapter matrix in their docs.
- Streaming stays unbuffered and unchanged.

### 4.2 Non-Goals

- Changing the public `Context` method set (`json`/`send`/`html`/`redirect`/`set` unchanged).
- Changing the error contract or error bodies.
- Supporting response rewrites for streamed responses.
- Preserving Node's exact write timing (a header written from a `setHeader` call after `res.end`
  cannot be made to work; the write has to move earlier).

---

## 5. Impact

- **Behaviour:** compression and timer headers start working on Node; a post-handler header write no
  longer throws anywhere.
- **Performance:** Node gains one buffer copy per response that is later rewritten; the flush path must
  be measured against the current write path (§14).
- **Public surface:** one internal response handle; `honorsPostHandlerHeaderWrite` is removed from the
  conformance driver contract once both families honour it.
- **Docs:** compression and timer READMEs lose their limitation sections; the adapter pages lose the
  post-handler caveat.

---

## 6. Issue → Solution Mapping

| Issue | today | after |
| --- | --- | --- |
| Compression has no outgoing body | Declared slot no adapter fills; warns once, does nothing | Reads the recorded response; compresses on every adapter |
| Timer header absent on Node | Late write was thrown, the chain aborted, the error was swallowed; interim: discarded and reported once, chain completes (§3.1.1) | Late write mutates the record; Node flushes it |
| Two response models | Encoded divergences and per-package adapter matrices | One model; divergence flag deleted |
| Streaming must not buffer | Already immediate | Unchanged: streaming commits and marks responded |

---

## 7. Architecture

### 7.1 Before

```mermaid
sequenceDiagram
    participant H as Handler
    participant C as Context
    participant A as Adapter
    participant T as Transport
    H->>C: ctx.json(body)
    alt Node
        C->>T: writeHead + end (committed here)
    else Web
        C->>C: record status/headers/body
        A->>C: getResponse() after chain
        A->>T: Response
    end
    Note over C,T: Post-handler middleware runs after the commit on Node
```

### 7.2 After

```mermaid
sequenceDiagram
    participant M as Post-handler middleware
    participant C as Context (recorded response)
    participant A as Adapter
    participant T as Transport
    M->>C: mutate headers/body after next()
    A->>C: flush()
    alt Node
        A->>T: writeHead + write + end (once)
    else Web
        A->>T: new Response(...)
    end
```

### 7.3 Why this architecture

Recording is already what four of five adapters do, and it is what post-handler middleware requires.
The change is to make it the *only* model and to make the record reachable by the middleware that
needs it — not to invent a new pipeline.

---

## 7a. Architecture Invariants

1. A response is committed exactly once, by the adapter, after the middleware chain unwinds.
2. A committed response is immutable; a later write is an error, not a silent no-op.
3. Streaming commits immediately and marks the response committed; nothing buffers a stream.
4. `ctx.body` is never an outgoing response (it is the parsed request body).

---

## 8. Detailed Design

### 8.1 Public API / surface

No new public methods. An internal `OutgoingResponse` handle (status, header map, body buffer) is
exposed to middleware through the context so post-handler work can mutate it — the exact accessor is
decided in P1 with the public-surface gate in mind.

### 8.2 Internal components

- `ResponseRecorder` (runtime): status, header map, buffered body, committed flag.
- `flush()` (adapter): materialise `Response` (Web) or write head + body + end (Node).
- Streaming path (unchanged): `sendStream`/`sse`/`ndjson` mark committed immediately.

### 8.3 Request / execution flow

`dispatch → handler → post-handler middleware (mutates record) → adapter flush → transport`.

### 8.4 Data structures

Header map must be case-insensitive with multi-value support (`set-cookie` arrays) and preserve
`ctx.set()` semantics. Body is `Uint8Array` or a string after serialization; the record stores the
serialized form so a rewrite never re-serializes.

### 8.5 Error handling

A write after commit throws a typed error naming the adapter and the reason (the opposite of today's
silent swallow). The never-unanswered guarantee still applies: a failure in the flush path answers with
the last-resort error body it can still construct.

### 8.6 Edge cases

- `HEAD` and bodyless statuses: no body flush, headers only.
- `Content-Length`: computed at flush time from the final body.
- `ctx.set` after flush from a detached promise: documented as outside the contract.
- A stream that has started: no rewrite, no buffer.

### 8.7 Examples

```ts
// Works on every adapter after this RFC.
app.use(async (ctx, next) => {
  await next();
  ctx.set('x-response-time', `${elapsed}ms`);
});
```

---

## 9. Alternatives Considered

### 9.1 Keep the divergence and document it per package

Cheapest, and it is what the interim change did. Rejected as the end state: it makes every
response-aware middleware adapter-dependent forever, and the divergence is invisible at the call site.

### 9.2 Record on the Web family only, special-case Node in each middleware

Rejected: it moves the divergence into every middleware's source instead of the adapter's, and the
Node special case cannot work at all for body rewrites.

### 9.3 Do nothing

Rejected: compression and timer are documented features that do not work; the framework should not ship
a capability that only appears in its docs.

---

## 10. Rejected Ideas

- **Write headers into Node's `ServerResponse` earlier and buffer only the body.** Does not fix body
  rewrites, and keeps two models.
- **A `res.on('pipe')` interception layer.** Transport-specific, unverifiable across runtimes, and it
  would still be too late for the Web adapters.
- **Buffering everything, including streams.** Removes the point of streaming and would break SSE.

---

## 11. Risks & Mitigations

- **Buffer cost on Node** → §14 measures bytes copied and per-request time; if the cost is not
  acceptable, keep the record lazy (record only when a post-handler middleware declares interest).
- **Memory pressure for large bodies** → keep the existing in-memory cap used by compression and make
  the record spill-free only under that cap; larger bodies stream as today.
- **Behaviour change for code that relied on Node committing early** → documented migration note; the
  commit point is not part of the public contract, but the timing changes.
- **Two copies for a response that is never rewritten** → mitigation in §14: allocate the record only
  when post-handler middleware exists on the chain, else write straight through.

---

## 12. Backward Compatibility & Migration

Additive for application code. The observable changes: compression and timer start working (a fix, not
a break); a post-handler header write stops throwing on Node; response headers that a handler used to
"lose" now appear. It builds on the interim contract in §3.1.1 — a committed response already
outlives the handler timeout and a post-commit header write is already discarded rather than thrown —
and must preserve both. Documented in the migration page with a one-line note each. Internal adapter
implementations change; the adapter contract keeps its entry points.

---

## 13. Cross-Cutting Concerns

- **Observability:** the flush path logs a write-after-commit error with the adapter name.
- **Security:** header values are validated at set time (existing `assertHeaderSafe`) and again at
  flush; a recorded header cannot inject CRLF any more than a direct one can.
- **Performance:** §14 and RFC-040's gate decide acceptance.

---

## 14. Success Metrics (the gate for un-deferring)

1. `inproc.nextrush.vs_hono` does not regress beyond the committed `max` on either runtime (RFC-040).
2. Node buffer copy measured and recorded; ≤ 1 copy per response, and no copy for a response that no
   post-handler middleware touched.
3. `compression-gzip`, `timer-header`, and `server-timing-header` probes pass on **both** runtimes.
4. Conformance scenario #29 passes with `honorsPostHandlerHeaderWrite` removed from the driver contract.
5. Streaming scenarios (#streaming, SSE, NDJSON) still pass on every runnable adapter, unbuffered.
6. The §3.1.1 interim outcomes are preserved: a committed response still outlives the handler timeout
   on every adapter, and a post-commit header write is still discarded and reported once rather than
   throwing, aborting the chain, or being dropped silently.

**Baseline this gate compares against (recorded 2026-10-19).** The before-state is now measured on
both runtimes: `inproc.nextrush.vs_hono` 1.39 on Bun and 0.96 on Node, with per-shape attribution
in RFC-039 §3.8 — Node dispatcher 1.5–2.4 % on hello and 3.9–4.7 % in the middleware shape,
`serializeJson` 0.9–2.1 %, and undici/platform ≈ 25 % of in-process samples. A recorded-response
model must be judged against those numbers, not against an unquantified "before".

**Criterion 2 needs a counter, not a heap sample.** "No copy when no post-handler middleware
touched the response" is an allocation claim, and sampled `heapUsed` is not a usable metric on this
toolkit (RFC-039 §3.8 limits; the deterministic alloc harness only resolves bytes for the path it
instrumented). The gate must increment a copy counter inside the recorder and assert zero, which is
checkable and does not depend on machine noise.

### 14.1 Measured (2026-10-19, this machine; `dev-check`, source-run)

Before = `4fe802dc` (the record type exists, no adapter uses it). After = P1–P4 plus the
write-through flush. Values are the toolkit's own output; `dev-check` is a local script, not CI.

| Criterion | Before | After | Verdict |
| --- | --- | --- | --- |
| 1. `inproc.nextrush.vs_hono` (max 1.9) | Bun ~1.13–1.38, Node ~0.95 µs/req floor | Bun **1.23**, Node **0.16** | ✅ inside the committed max. The toolkit now reports this ratio as informational on Node ("arms use different request models"), so it is a bound, not a comparison |
| 1b. Node in-process absolute (interleaved A/B, 4 pairs) | **1.01 µs/req** (median) | **1.11 µs/req** (median) | ~**+0.1 µs/req** for the record plus the flush. The first implementation was +0.9 µs/req because it re-encoded every string body; the write-through flush removed that |
| 2. Body copies | n/a | **0** for an untouched response, **1** for a rewrite | ✅ `bodyCopies` (record test) + the string written through unchanged (no `Uint8Array` materialised) |
| 3. `compression-gzip`, `timer-header`, `server-timing-header` | fail on every adapter | **PASS on Node and Bun** | ✅ `content-encoding=gzip bytes=1990`, `x-response-time=0.15ms`, `server-timing=total;dur=0.06` |
| 4. Conformance #29 without the flag | #29 asserted the divergence | **PASS, flag deleted** | ✅ 436 scenarios across node/bun/deno/edge/serverless/nextjs |
| 5. Streaming unbuffered | pass | **pass** | ✅ Node streaming/SSE/NDJSON suites and the conformance streaming scenarios are unchanged |
| 6. §3.1.1 interim outcomes | pass | **pass** | ✅ committed-response-outlives-timeout and discard-once-not-throw tests, plus conformance #30 |
| Cold start (`cold.n25` / `cold.n1000` vs Hono) | 0.98 / 0.59 Node, 1.06 / 0.41 Bun | same | ✅ unchanged |
| Bundle (root / bun / node KB, max 40/60/70) | 29.7 / 55.2 / 58.3 | same | ✅ |

**What is not measurable here.** `wire.nextrush.vs_hono` on Bun sat at 0.82–0.93 against a 0.85
*target* (the hard floor is 0.5), while identical code produced 0.85–1.66 across runs and Hono's own
throughput moved between 21k and 46k rps on this contended machine. The spread is larger than any
effect this change could have, so no before/after claim is made for it. The Node wire ratio measured
1.04 with the same caveat.

**One deviation from the plan, recorded in §18 and v3:** `serve()`'s socket guard now expires
`SOCKET_GUARD_HEADROOM_MS` (1 s) after the handler deadline. At an equal deadline it won the tie and
destroyed sockets whose recorded response was ready to flush — the failure the conformance drivers
had been working around locally with `httpServer.timeout = 5_000`.

---

## 15. Phased Implementation Plan

| Phase | Work | Gate |
| --- | --- | --- |
| P1 | `ResponseRecorder` in the shared context; Web adapters flush it | Web conformance green, streaming unchanged |
| P2 | Node flushes after the chain; a post-flush write is discarded and reported, never thrown (§3.1.1) | Node conformance green, §14.2 measured |
| P3 | Compression and timer read the recorded response on every adapter | Probes green on both runtimes |
| P4 | Delete the divergence flag and the README limitations | Conformance #29 rewritten or removed |

### 15.1 Testing strategy

Per phase: unit tests for the recorder, conformance scenarios for the adapter behaviour, real Bun/Deno/
workerd runs for the Web family, and the dev-check probes for both runtimes. The probes are the
acceptance evidence, not the unit tests.

---

## 16. Rollback Plan

Each phase is independently revertible. P1–P2 are behind the adapter's own flush path, so reverting P2
restores Node's commit-inside-handler behaviour without touching the Web family. The divergence flag is
deleted only in P4, so a rollback at any earlier phase keeps the conformance suite honest.

---

## 17. Future Work

- ETag and conditional-request middleware become possible once the record is reachable.
- A `Response`-shaped public API (`ctx.response.headers`) could follow, decided separately.

---

## 18. Open Questions

- ~~Should the record be allocated lazily only when a post-handler middleware is present on the chain?~~
  **Answered during P1:** the record itself is one small object per request, and its *header map* is
  what dominates — so the map is allocated lazily on the first `set()` and the content type lives in
  its own slot. A response whose only header is the body method's default allocates no map at all.
  Detecting "a post-handler middleware exists" per request was rejected: the composition is not
  introspectable, and the lazy map already removes the allocation that mattered.
- ~~Is `honorsPostHandlerHeaderWrite` worth keeping for adapters that genuinely cannot buffer?~~
  **Answered in P4:** no. Buffering is now a requirement of the adapter contract — a third-party
  adapter that cannot record a response is not conformant, and the flag is gone from the contract and
  every driver.
