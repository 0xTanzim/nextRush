# Tasks

## 1. The outgoing-response record

- [ ] 1.1 (RED) Add `packages/runtime/src/__tests__/outgoing-response.test.ts` covering: a header set
      before commit lands, a header set after commit but before flush lands, a header set after flush
      is discarded and reported once, `set-cookie` accumulates across casings, an array value replaces
      then appends, and a body replacement updates the bytes and the derived length. Verify: the tests
      fail against a missing record type for the expected reasons.
- [ ] 1.2 (GREEN) Add `packages/runtime/src/outgoing-response.ts` implementing the record per
      design.md D1/D3: status, ordered case-insensitive header map, serialized body, `committed`,
      `flush()` idempotence, and the once-per-process discard warning. Verify: 1.1 passes.
- [ ] 1.3 Export the record and the `OUTGOING_RESPONSE` symbol key from the packages that own them,
      with the symbol marked `@internal`. Verify: the `public-surface-lock` tests for `@nextrush/types`
      and `@nextrush/runtime` are updated deliberately and pass, and no undocumented public property
      is added to `Context`.
- [ ] 1.4 Keep the file under the 300-line ceiling and confirm the record allocates no header map for
      a response with only the default `Content-Type`. Verify: the file's line count is under the
      ceiling, and an allocation check shows the default-header path allocates no map.

## 2. The Web family flushes the record

- [ ] 2.1 (RED) Add a Web runner test where a middleware sets a header after `await next()` and the
      materialised `Response` carries it. Verify: the test fails against the current builder for the
      expected reason.
- [ ] 2.2 (GREEN) Move `WebResponseBuilder`'s state into the shared record and have the runner flush
      it once after the chain. Verify: 2.1 passes and the full `@nextrush/runtime` suite passes.
- [ ] 2.3 Preserve every existing byte-level guarantee: JSON/text/HTML/redirect content types,
      HEAD/204/304 body suppression, accumulated `Set-Cookie`, resolve-before-commit serialization, and
      the unanswered-error envelope. Verify: the existing builder tests pass unchanged, and a new
      assertion pins the exact default content-type strings.
- [ ] 2.4 Confirm the timeout and committed-response rules still hold after the move: a committed
      record outlives the timeout, and a request that produced nothing still receives the unchanged
      504. Verify: the existing web-runner timeout tests pass, and the conformance #30 scenario passes
      on Bun, Deno, Edge and serverless.
- [ ] 2.5 Document the recorded model in the `web-adapters` capability docs, including that a
      materialised `Response` is produced only at flush. Verify: the docs match the spec delta.

## 3. The Node adapter flushes the record

- [ ] 3.1 (RED) Add node-adapter tests asserting that `ctx.json()` writes no byte to the socket before
      the chain settles, and that a post-handler `ctx.set()` appears on the response. Verify: both
      fail against the current context for the expected reasons.
- [ ] 3.2 (GREEN) Route `json`, `send`, `html`, `redirect` and the error path through the record, and
      flush once from the adapter's request handler after the chain settles. Verify: 3.1 passes.
- [ ] 3.3 Preserve the single-`writeHead` merge behaviour and `Content-Length` derivation. Verify: the
      existing merge/cookie/suppression tests pass, and a new assertion pins that exactly one
      `writeHead` call occurs per request.
- [ ] 3.4 Keep the serialization guarantee: a non-serializable value throws before the record is
      committed, and the application error handler still answers with a complete 500. Verify: the
      existing serialization-failure tests pass unchanged.
- [ ] 3.5 Implement the write-through/buffered split from design.md D4 with the per-request copy
      counter. Verify: a chain with no post-handler middleware reports zero copies, a chain with one
      reports one, and both deliver identical bytes for the same handler.
- [ ] 3.6 Keep streaming and the static middleware's direct `ctx.raw.res` writes on their current
      path, and document the escape hatch. Verify: the streaming, SSE, NDJSON and static suites pass
      unchanged, and the static README states that a direct write commits immediately.
- [ ] 3.7 Preserve the interim contract: a write after the flush is discarded and reported once, never
      thrown, and the whole middleware chain still completes. Verify: the existing post-commit tests
      pass with the flush boundary in place, plus one new assertion for a write after the flush.

## 4. Compression and timer read the record

- [ ] 4.1 (RED) Add compression tests where a post-handler rewrite compresses the recorded body on
      Node and on a Web adapter. Verify: they fail today because the middleware finds no outgoing body.
- [ ] 4.2 (GREEN) Switch compression to read and replace the recorded body through the internal
      accessor, keeping its threshold, encoding negotiation, and in-memory cap unchanged. Verify: 4.1
      passes on both families.
- [ ] 4.3 (RED) Add timer and server-timing tests where the header appears after the handler on every
      adapter. Verify: the Node case fails today.
- [ ] 4.4 (GREEN) Switch timer and server-timing to write the header through the record, keeping the
      measurement, formatting and opt-in behaviour unchanged. Verify: 4.3 passes on every adapter.
- [ ] 4.5 Remove the adapter-matrix limitation sections from both READMEs and state the single
      supported behaviour. Verify: neither README describes an adapter where the feature does not work.

## 5. Conformance and the gate

- [ ] 5.1 Remove `honorsPostHandlerHeaderWrite` from the driver contract and all five drivers, and
      rewrite scenario #29 to assert the header is present unconditionally. Verify: the conformance
      suite passes on Node, Bun, Deno and serverless, and fails if any adapter is reverted to the old
      model.
- [ ] 5.2 Add the post-handler body-rewrite scenario with a matching `Content-Length`. Verify: it
      passes on every runnable adapter, and fails if a rewrite is dropped.
- [ ] 5.3 Run the RFC-041 §14 gate on both runtimes: `inproc.nextrush.vs_hono` against the committed
      maximums, the copy counter for the untouched path, and the three FB-03 probes. Verify: the
      numbers are recorded in RFC-041 with the before/after table, and the change is adopted or parked
      against that table.
- [ ] 5.4 Delete `FB-03` from `knownFailures` in `apps/benchmark/scripts/dev-check/budgets.json` in the
      same commit that makes its probes pass. Verify: `dev-check` reports no exemption for `FB-03`, and
      the bookkeeping stage does not fail on an orphaned id.
- [ ] 5.5 Run the full `dev-check` on Bun and Node. Verify: every stage passes with no new exemption
      and no raised budget.

## 6. Documentation and RFC

- [ ] 6.1 Update the adapter documentation for the flush model: a response method records, the adapter
      flushes once, and `ctx.responded` means the record is committed. Verify: the docs match the
      shipped behaviour and the four spec deltas.
- [ ] 6.2 Update RFC-041's Progress Tracker to reflect the shipped phases and its Revision History with
      the gate numbers. Verify: the RFC states measured results, not plans, and its status is no longer
      `Deferred`.
- [ ] 6.3 Confirm no public API beyond the `@internal` symbol key changed. Verify: `git diff` touches
      no documented `Context` method or documented export, and a full `pnpm turbo build` succeeds.

## Workflow follow-up

- Archive this change after RFC-041 records the gate and `FB-03` is deleted.
- Keep `bun-response-cost` independent: it may land before or after this change, and neither blocks the
  other.
