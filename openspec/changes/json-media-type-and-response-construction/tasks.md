# Tasks

## 1. Decision record (RFC-gated, before the change is archived)

- [x] 1.1 Write `docs/RFC/runtime-adapters/046-json-media-type-and-response-construction.md` from `docs/RFC/TEMPLATE.md`: the two measured costs, the compatibility surface, the before/after gate, and the migration path. Verify every section has content or an explicit N/A line.
- [x] 1.2 Write `docs/adr/ADR-0034-json-media-type-and-response-construction.md` from `docs/adr/TEMPLATE.md` recording the durable decision (one JSON media type on every adapter; the plain init record and its `Headers` fallback). Verify each decision is stated in one paragraph and the checklist is complete.
- [x] 1.3 Register RFC-046 and ADR-0034 in `docs/RFC/INDEX.md` and `docs/adr/INDEX.md`. Verify each index has exactly one added row and the links resolve.

## 2. RED tests

- [x] 2.1 Add failing characterization tests in `packages/runtime/src/__tests__/response-builder.test.ts` for the plain init record: a content-type-only response carries exactly one header, and a response with an extra header keeps the `Headers` path. Verify they fail against the unchanged `buildResponse`.
- [x] 2.2 Add failing tests for the media type: `ctx.json()` and the framework error response carry `application/json`. Verify they fail before the change.
- [x] 2.3 Add failing tests for the `Set-Cookie` multi-value case: two cookies stay two cookies on the JSON path. Verify the plain-object construction would have joined them, so the test is meaningful.
- [x] 2.4 Add a failing test that an explicit `Content-Type` still wins over the framework's JSON media type. Verify it fails before the change.

## 3. Implementation

- [x] 3.1 Change the JSON media type to `application/json` in `packages/runtime/src/response-builder.ts`, `packages/runtime/src/response-body.ts`, `packages/adapters/node/src/context.ts`, and `packages/adapters/node/src/adapter.ts`, with the RFC 8259 rationale in the code. Verify no other media type changed.
- [x] 3.2 Build the Web response from a plain init record when `record.extraHeaders()` is empty, keeping the unchanged `Headers` path for every other response. Verify the multi-`Set-Cookie` case still goes through the general path.
- [x] 3.3 Mark the fourteen constructor-assigned `WebContextBase` fields `declare`. Verify the emitted bundle no longer defines them per instance.
- [x] 3.4 Update the conformance suite's JSON scenarios and its F-05 comment to the shared media type, and rename the scenario so it no longer claims a uniform charset. Verify the suite still pins one value across adapters.

## 4. Verification

- [x] 4.1 `pnpm vitest run --maxWorkers=2 packages/runtime` — 382/382 pass.
- [x] 4.2 `pnpm vitest run --maxWorkers=2 packages/adapters/node` — 301/301 pass.
- [x] 4.3 `pnpm vitest run --maxWorkers=2 packages/adapters/bun packages/adapters/deno` — 252/252 pass.
- [x] 4.4 `pnpm vitest run --maxWorkers=2 packages/adapters/edge packages/adapters/serverless packages/adapters/nextjs` — 477/477 pass.
- [x] 4.5 `pnpm vitest run --maxWorkers=2 packages/adapters/conformance/src` — 436/436 pass.
- [x] 4.6 Real-runtime conformance: `bun test` in `packages/adapters/conformance/bun-runner` — 56/56 pass; `deno task conformance` in `packages/adapters/conformance/deno-runner` — 56/56 pass.
- [x] 4.7 Real-runtime conformance: `node --test conformance.workerd.test.mjs` in `packages/adapters/conformance/workerd-runner` — 16/16 pass.
- [x] 4.8 Rebuild the `dist/` of the packages the real-runtime runners resolve (`runtime`, `bun`, `deno`, `edge`, `node`) before running 4.6 and 4.7 — the runners read `dist/`, not source.
- [x] 4.9 Run ESLint and `tsc --noEmit` (strict) for the touched packages; verify zero errors.
- [x] 4.10 Run per-package coverage for the touched packages; verify line coverage stays at or above 90% and does not decrease.

## 5. Measurement

- [x] 5.1 Build the paired harness: server pinned to physical core 0, `wrk` on cores 1 and 3, CPU per request read from `/proc/<pid>/stat`, arms alternating with the order flipped every pair. Verify a one-pair run reproduces a known delta.
- [x] 5.2 Build the "before" and "after" bundles from source through the repo's bundler, restoring the changed files to their `HEAD` content for the "before" build only. Verify the working tree is byte-identical afterwards.
- [x] 5.3 Measure GET and POST on Bun, Node, and Deno, 4 pairs each, and record the paired delta and the number of pairs that moved in the claimed direction. Verify the raw data is written to `/tmp/opencode/ab/res-*.json`.
- [x] 5.4 Attribute the delta per change: build an arm for the plain init record alone, the media type alone, and the `declare` change alone, and measure each against the same baseline. Verify the arms are built from the same source graph.
- [x] 5.5 Measure the four `Response` construction shapes directly in Deno, so the mechanism does not rest on an end-to-end delta inside the noise. Verify the probe reports a median of five rounds per shape.
- [x] 5.6 Record the before/after matrix, the mechanisms, the rejected candidates, and the limitations in `report/performance/json-media-type-and-response-construction.md`.

## 6. Reconciliation

- [x] 6.1 Correct `report/performance/web-response-materialization.md`: its verdict ("revert") was reached on Bun allocation bytes and wall-clock noise, and never measured Deno, where the same construction is worth −16.6 % CPU per request. Verify the correction states what the earlier evidence covered and what the new evidence adds.
- [x] 6.2 Add the changeset with the migration note. Verify the bump type matches the breaking wire change.
- [x] 6.3 Update the live `node-adapter` capability spec's JSON scenario through this change's delta (the live spec is truth and must not drift from the code).
