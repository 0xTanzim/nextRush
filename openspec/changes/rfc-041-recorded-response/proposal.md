# Proposal

## Why

`@nextrush/compression` compresses nothing on any shipped adapter, and `@nextrush/timer` cannot emit
`X-Response-Time` on Node. Both are documented features, both are registered by the benchmark probe
server, and all three probes that cover them (`compression-gzip`, `timer-header`,
`server-timing-header`) are the only remaining entries in `knownFailures`. The cause is one
structural divergence: the Web adapters **record** a response and materialise it after the middleware
chain unwinds, while the Node adapter **commits** as it goes — so by the time a post-handler
middleware runs, Node's response is already on the wire.

The previous change made that divergence safe (a late write is discarded and reported once, never a
chain-aborting throw) but did not remove it. This change removes it: one recorded outgoing response,
flushed once by the adapter, after the chain unwinds. RFC-041 owns the analysis and the gate; this
change runs that gate and implements the model behind it.

## What Changes

- **One outgoing-response record, reachable by middleware that runs after the handler.** The record
  carries status, headers and the serialized body. Post-handler middleware mutates the record; the
  adapter flushes it once. **BREAKING (observable, in the fixing direction)** — compression and timer
  start working on every adapter, and a post-handler header write lands instead of being discarded.
  Migration: none for correct usage; code that read `ctx.raw.res` to detect Node's early commit must
  read `ctx.responded` instead.
- **Node flushes after the chain instead of committing inside the handler.** A handler's `ctx.json()`
  writes the record, not the socket. The adapter writes head and body once, at the end.
- **The buffer cost is measured before the model is adopted.** RFC-041 §14's gate: `inproc.vs_hono`
  must not regress beyond the committed maximum on either runtime, and the copy count must be zero
  for a response no post-handler middleware touched. A measured counter, not a heap sample.
- **Streaming keeps its current path.** `sendStream`, SSE and NDJSON commit immediately and are never
  buffered. The static middleware's direct `ctx.raw.res` writes are an explicit, documented escape
  hatch that commits immediately.
- **The interim contract is preserved, not superseded.** A committed response still outlives the
  handler timeout on every adapter, and a write that arrives after the flush is still reported once
  rather than thrown.
- **The divergence flag is deleted.** `honorsPostHandlerHeaderWrite` leaves the conformance driver
  contract, and scenario #29 asserts the header lands on every adapter.

## Capabilities

### New Capabilities

None. The response model is already owned by four existing capabilities; a new one would be a
change-shaped name rather than a durable capability.

### Modified Capabilities

- `runtime-adapter-contract`: the outgoing response is one recorded object with a defined view for
  post-handler middleware, on every adapter, and post-handler header/body rewrites are parity-pinned
  with no capability flag.
- `node-adapter`: the response is recorded and flushed after the chain, so a post-handler header
  write lands; a write after the flush is still discarded and reported once.
- `web-adapters`: the Web family flushes the shared record through one runner; the builder's
  committed-response and timeout semantics are unchanged.
- `core-middleware`: a middleware that responds and then calls `next()` is a warning, not a
  second response — the double-response guard now means "the record was already committed", and a
  post-handler write to a committed record is the documented supported case.

## Impact

- `packages/adapters/node/src/context.ts` — the largest edit: every response method writes the record
  instead of `res`.
- `packages/runtime/src/response-builder.ts` and `web-runner.ts` — the record becomes the shared
  model, and the Web flush reads it.
- `packages/middleware/compression`, `packages/middleware/timer` — read the record instead of
  `ctx.raw.res`; both lose their adapter-matrix limitation sections.
- `packages/adapters/conformance` — the driver capability flag is removed, and scenarios #29/#30 are
  rewritten to assert the single outcome.
- `apps/benchmark/scripts/dev-check/budgets.json` — the `FB-03` exemption is deleted in the same
  change that makes its probes pass.
- `packages/middleware/static` — its direct `ctx.raw.res` writes are documented as an immediate-commit
  escape hatch; no behaviour change.

**RFC note:** RFC-041 gates this change. Its §14 measurement must be run and recorded, and its
Progress Tracker must move off `Deferred`, before this change is archived. The `bun-response-cost`
change is independent: it trims the Web builder's allocation and does not touch the record model, and
this change does not depend on it landing first. If both land, the copy-counter gate is re-measured
after the trim, since the two changes touch the same builder.
