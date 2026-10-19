# Tasks

## 1. Spike: measure the construction variants before touching the builder

- [ ] 1.1 Add `apps/benchmark/scripts/alloc/response-construction-alloc-child.js` measuring the five
      variants from design.md D1 (`current`, `literal`, `shared-frozen`, `json`, `pre-serialized`)
      for a hello-world JSON body, and its parent `response-construction-alloc.js` that runs each
      variant in its own `--expose-gc` child and reports bytes-per-op plus a timing figure. Verify:
      the harness runs under Node and reports five rows; a run with a GC inside the measurement
      window is rejected and retried, matching the existing allocation harnesses.
- [ ] 1.2 Run the harness under Bun and under Node with the real header shapes (default
      `Content-Type`, plus one non-default header, plus two cookies). Verify: a result file is
      written per runtime and the three shapes are distinguishable in the output.
- [ ] 1.3 Record the spike verdict in `design.md` under Decisions: which variant is cheapest, how far
      apart the record variants are, and whether the gap is large enough to be worth an
      implementation. Verify: the verdict names the numbers and, if the answer is "no measurable
      gap", says so plainly.

## 2. Baseline the Bun gate before changing anything

- [ ] 2.1 Run `node apps/benchmark/scripts/dev-check/check.mjs inproc --rt bun` three times on a
      pinned CPU and record `inproc.nextrush.us` and `inproc.nextrush.vs_hono` for each. Verify:
      three rows are recorded and their spread is stated.
- [ ] 2.2 Confirm the baseline is stable enough to gate on. Verify: if the spread is wider than the
      expected effect, say so in `design.md` and treat the gate as unable to resolve the change —
      do not proceed to implementation on an unresolvable measurement.

## 3. Implement the lazy header record

- [ ] 3.1 (RED) Add `packages/runtime/src/__tests__/response-builder.test.ts` cases asserting that a
      JSON response with no non-default header produces the same status, `Content-Type` and body
      bytes as today, and that `ctx.set('x-request-id', …)` then a second header yields both on the
      response. Verify: the "record is not allocated" assertion fails against the current builder
      for the expected reason.
- [ ] 3.2 (GREEN) Split `_headers` into `_contentType` and a nullable `_headers` per design.md D2,
      route `json`/`html`/`redirect`/`send` through `_contentType`, and materialise the record only
      in `set()` and the HEAD branch. Verify: 3.1 passes and the full `@nextrush/runtime` suite
      passes.
- [ ] 3.3 Keep `send()`'s auto-detect probe correct across both stores (design.md D3). Verify: a
      handler that sets `Content-Type` and then calls `send()` still keeps its own value, and a
      handler that calls `send()` with no prior type still gets the detected one.
- [ ] 3.4 Merge the literal and the record in `getResponse()` so a handler content type plus cookies
      emits both. Verify: a scenario with `Content-Type: text/plain` and two cookies yields all
      three headers, and a scenario with no cookies yields no `Set-Cookie` at all.
- [ ] 3.5 (REFACTOR) Keep `response-builder.ts` under the 300-line ceiling and remove any branch the
      split makes unreachable. Verify: the file's line count is under the ceiling and no comment
      describes the removed eager allocation.
- [ ] 3.6 Add the conformance scenario pinning the emitted header set and the exact `Content-Type`
      string for a hello-world JSON response. Verify: `packages/adapters/conformance` passes on
      Node, Bun, Deno and serverless, and fails if the default content type string drifts.

## 4. Gate and record the verdict

- [ ] 4.1 Run the allocation harness from 1.1 against the changed tree and confirm the per-request
      bytes for the `current` shape dropped by the amount the spike predicted. Verify: the reported
      delta matches the spike's record-variant gap within the harness's own spread.
- [ ] 4.2 Run `node apps/benchmark/scripts/dev-check/check.mjs inproc --rt bun` three times on the
      same pinned CPU as 2.1 and compare against the baseline. Verify: the three rows are recorded
      next to the baseline rows and the change is stated as adopted or parked against the rule in
      design.md D6.
- [ ] 4.3 Run the full `dev-check` on Bun and on Node to confirm no other stage regressed. Verify:
      `bundle`, `cold`, `inproc`, `wire`, `probe`, `bookkeeping` and `hygiene` all pass, with the
      `FB-03` exemption unchanged and no new exemption added.
- [ ] 4.4 If the gate rejects the change, revert the builder commit and record the null result
      instead of keeping the code. Verify: `git log` shows the revert, and `design.md` and RFC-039
      both state the measured outcome.
- [ ] 4.5 If the gate accepts the change, record the outcome and the numbers in
      `docs/RFC/runtime-adapters/039-precompile-per-request-tax.md` §3.9 and correct the stale P3
      verdict row while there. Verify: the RFC states the measured result, not a plan, and no
      planning-artifact path is referenced from source comments.

## 5. Documentation

- [ ] 5.1 Update the `web-adapters` capability documentation to state the response builder's
      allocation contract: no eager header record, byte-identical output, and header ordering not
      part of the contract. Verify: the docs match the shipped behaviour and the spec delta.
- [ ] 5.2 Confirm no public API, export, or `.d.ts` changed. Verify: `git diff` touches no
      `index.ts` export surface, and a `pnpm turbo build` of the affected packages succeeds.

## Workflow follow-up

- Archive this change after the gate verdict is recorded, keeping `FB-03` in `knownFailures` (this
  change does not touch compression or the timer).
