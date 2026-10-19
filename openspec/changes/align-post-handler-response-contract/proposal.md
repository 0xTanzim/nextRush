# Proposal

## Why

Two adapter-family divergences make identical application code behave differently on Node and on
the Web adapters, and both fail silently. All figures below were measured on 2026-10-19 with
Node v26.12.0 and Bun 1.4.3, from source, with the repo's own `dev-check` toolkit and a bundled
probe server.

1. **A post-handler header write aborts the middleware chain on Node, and is swallowed.**
   After a handler calls `ctx.json()`, the Node adapter has already run `res.writeHead()`. Any
   later `ctx.set()` therefore reaches `res.setHeader()` after `headersSent`, which throws
   `ERR_HTTP_HEADERS_SENT`. The rejection propagates out of the inner middleware's post-`next()`
   code, so **every outer middleware's post-`next()` work is skipped**, and it lands in
   `handleError`, which returns early because `ctx.responded` is already true. Measured on Node:
   the inner post-handler statement never completes, the outer middleware's post-handler work
   never runs, no log line is emitted, and the client sees an ordinary 200. The same code on Bun
   delivers the header and completes the whole chain. This affects any middleware that stamps a
   response header after the handler — timer, server-timing, ETag, cache headers, request-id —
   and it silently drops unrelated bookkeeping (metrics, audit, cleanup) in outer middleware.

2. **The Web adapters' timeout discards a response the handler already produced.**
   The shared runner returns the 504 when the timeout wins, with no check on whether the response
   was already committed (the Node adapter does check). Measured: a handler that answers and then
   takes 300 ms of post-response work returns `504 Gateway Timeout` on Bun under a 100 ms timeout,
   while the identical handler on Node returns its own 200. A correct response is thrown away and
   the client is told the request failed.

3. **A spec already requires what the runner does not do.** `openspec/specs/web-adapters` states
   that the handler timeout SHALL be armed only when the handler has not already settled, matching
   Node's fast path, and that "no timeout racing is performed" for a synchronous handler. The
   shared runner instead burns four microtask turns of racing for *every* request, including ones
   whose response is committed synchronously before the runner ever awaits. Measured: the response
   is already committed on the first synchronous check, a fast path is worth **14.4 %** of
   framework request cost in an A/B micro-benchmark, and `dev-check` reports the race at a
   consistent **0.42–0.60 µs/request** across five runs (the `TIMEOUT=0` control).

Why now: items 1 and 3 are already pinned by committed specs — the code is the outlier, not the
spec — and item 2 is a divergence of the same contract. They should be brought back into line
before the recorded-response model redesigns the same surface, rather than after. The gate that
should catch this class of drift cannot currently catch it either: every in-proc entry hard-imports
the Bun adapter's `createHandler`, so the "Node" in-proc row measures the Web runner on Node and
never exercises the Node adapter at all.

## What Changes

- **Node: a post-commit header write stops aborting the chain.** A `ctx.set()` that arrives after
  the response is committed becomes a no-op that reports once per process, instead of a platform
  error that propagates, truncates the middleware chain and is swallowed. **BREAKING (observable)**
  — a header that previously caused a silent throw now simply does not appear, and outer
  middleware post-work now runs. Migration: none for correct usage; code that relied on the throw
  to detect a late write must read `ctx.responded` (or the new warn-once log) instead.

- **Web adapters: the timeout no longer replaces a committed response.** When the handler has
  already committed a response, the client receives that response; the 504 is reserved for a
  request that has produced nothing. **BREAKING (observable)** — a respond-then-slow handler now
  answers with its own response instead of `504`. Migration: none for correct usage; a caller that
  depended on receiving 504 after the handler had already answered was depending on a discarded
  response.

- **Web adapters: the timeout is armed only when the handler has not already settled**, as
  `web-adapters` already requires. Removes four microtask turns of racing from the common
  synchronously-answered request; the timeout interval, 504 body, cancellation signal and warning
  text are unchanged for requests that do not settle.

- **The in-proc request-cost entries measure the adapter under test**, so the Node in-proc row
  exercises the Node adapter (and the Web row keeps exercising the Web runner) instead of both
  measuring the Bun entry point. Measurement only — no behavioural effect on the framework.

- **Measurement and attribution work for the two fixes**: CPU attribution from the existing
  profiler for the dispatcher and header-write paths, allocation measured with the deterministic
  counter (never sampled `heapUsed`), cache-line/branch claims recorded as labelled inference only
  (JavaScript exposes no portable counter), and kernel/syscall-level behaviour left to the
  existing OS-queue and socket-timeout evidence rather than asserted from user space.

## Capabilities

### New Capabilities

None. Every requirement here edits a capability that already owns it; no new durable capability is
born.

### Modified Capabilities

- `node-adapter`: `ctx.set()` after the response is committed SHALL be a documented no-op that
  reports once, and MUST NOT throw a platform error or abort the remaining middleware chain; the
  handler-timeout requirement pins what the client receives when the handler had already committed.
- `web-adapters`: the timeout is armed only when the handler has not already settled, and a
  committed response is never replaced by the 504.
- `runtime-adapter-contract`: `Observable parity across adapters` is extended to post-handler
  header writes and to timeout completion when the handler already committed, so the divergence
  that caused items 1 and 2 is a conformance failure rather than an adapter detail.
- `performance-gate`: the in-proc request-cost measurement measures the adapter under test,
  including the Node adapter.

## Impact

- **Code**: `packages/adapters/node/src/context.ts` (post-commit write guard),
  `packages/runtime/src/web-runner.ts` (timeout arming and completion),
  `packages/adapters/conformance` (parity scenarios), `apps/benchmark/scripts/dev-check/entries`
  (in-proc entries) and its README.
- **Public surface**: no exported signature changes. Two observable-behaviour changes on the
  adapter contract surface, both marked **BREAKING (observable)** above.
- **Tests**: new conformance scenarios for post-handler header writes and for timeout-after-commit
  on every adapter; node-adapter unit tests for the post-commit write; the web-adapters
  timeout-arming scenarios become load-bearing rather than aspirational.
- **Gate**: `dev-check` on Bun and Node; per-package line coverage at or above 90 %, ESLint clean,
  `tsc` strict clean; the `hygiene` stage (no added comment may point at a planning artifact).
- **RFC gating**: the durable decision this change makes — the post-commit write contract and
  "a committed response wins over the handler timeout" — is an adapter-contract decision and is
  RFC-gated. It MUST be recorded in `docs/RFC/` before this change is archived (see design.md
  §Decisions). `docs/RFC/runtime-adapters/041-recorded-response-model.md` owns the commit model and
  is currently `Deferred`; this change does not implement that model, so the record is an update to
  the existing RFC rather than a new one.
