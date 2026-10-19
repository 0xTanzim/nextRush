# Tasks

## 1. Decision record (RFC-gated, before code)

- [x] 1.1 Write `docs/RFC/runtime-adapters/043-web-native-body-read.md` from the RFC template: measurable problem, fast-path conditions, fallback, security boundary, rejected alternatives, and before/after gate. Verify the file exists and every template section is filled.
- [x] 1.2 Write `docs/adr/ADR-0031-web-native-body-read.md` from the ADR template recording the durable decision and its consequences. Verify the file exists and the decision is stated in one paragraph.
- [x] 1.3 Link RFC-043 and ADR-0031 from `openspec/changes/bun-body-read-parity/design.md` and confirm the links resolve.

## 2. Baseline profiling (before)

- [x] 2.1 Capture the Bun POST baseline with `node apps/benchmark/scripts/dev-check/check.mjs inproc --rt bun` and `node apps/benchmark/scripts/dev-check/check.mjs profile --entry inproc-nextrush-post --rt bun`. Record `POST us`, the Hono ratio, and the top profile functions in `report/performance/bun-body-read-baseline.md`. Verify the report contains the exact commands and captured numbers.
- [x] 2.2 Capture the Deno POST baseline and the Node POST control with the same `dev-check` commands. Record them in the same report and state the per-runtime conclusion. Verify all three runtimes are present.
- [x] 2.3 Run a CPU-pinned A/B baseline: `taskset -c 0-3 node apps/benchmark/scripts/dev-check/check.mjs inproc --rt bun` three times; record min/median/max POST values. Verify the spread is recorded and used as the noise floor.

## 3. RED tests

- [x] 3.1 Add failing `WebBodySource` tests in `packages/runtime/src/__tests__/body-source.test.ts`: a known `Content-Length` within the limit reads successfully even when `request.body.getReader` is stubbed to throw, proving the native path is selected; returned bytes are identical to the reader path. Verify the test fails before implementation.
- [x] 3.2 Add failing tests for the fallback and errors: absent/understating `Content-Length` still uses the incremental reader; an honest over-limit `Content-Length` rejects before any read; a mid-stream over-limit chunked body rejects with `BodyTooLargeError`; a platform read failure maps to the existing body-read error. Verify each fails for the intended reason.
- [x] 3.3 Add failing cache/consumption tests: `buffer()` twice returns the cached buffer; a second read after cache is not a `BodyConsumedError`; a stream consumer after `buffer()` still reports consumed. Verify all three fail before the change.
- [ ] 3.4 Add failing body-parser integration tests in `packages/middleware/body-parser/src/__tests__/limit-and-hotpath.test.ts`: 1 KB JSON parses identically; `rawBody` bytes are identical; a 10 KB limit still rejects a chunked 900 KB body incrementally. Verify the tests fail only on the fast-path expectation, not on existing behavior.
- [ ] 3.5 Add the same behavior matrix to `packages/adapters/bun/src/__tests__/body-source.test.ts` and the Deno equivalent. Verify both fail before implementation and assert the native path is used only when the length is provable.

## 4. Implementation

- [x] 4.1 Add the `WebBodySource._buffer` native fast path: when `this.contentLength !== undefined && this.contentLength <= limit`, read with `request.arrayBuffer()` and return `new Uint8Array(...)`; otherwise use the existing reader loop unchanged. Verify tasks 3.1–3.5 turn green.
- [x] 4.2 Keep `AbstractBodySource.buffer(limit)` as the only owner of the content-length pre-check, `_consumed`, post-read length check, and cache; the fast path must not duplicate or bypass them. Verify the cache/consumption tests stay green.
- [x] 4.3 Map native-read rejections through the existing `BodyReadError` path and keep `BodyTooLargeError` messages unchanged. Verify the error-contract tests stay green.
- [x] 4.4 Document the fast-path condition, fallback, and security boundary in `packages/runtime/ARCHITECTURE.md` and `packages/adapters/bun/ARCHITECTURE.md`; add a short note to the body-parser README only if it changes a documented guarantee. Verify the docs state when the native path is used and when the incremental path is required.

## 5. Verification and after-profile

- [x] 5.1 Run `pnpm --filter @nextrush/runtime --filter @nextrush/body-parser --filter @nextrush/adapter-bun --filter @nextrush/adapter-deno test`; verify all pass with no skipped new tests.
- [x] 5.2 Run the cross-adapter conformance suite across Node, Bun, Deno, and Edge; verify observable body-reading behavior is identical and no scenario regresses.
- [x] 5.3 Run ESLint and `tsc --noEmit` (strict) for the touched packages; verify zero errors and no new warnings.
- [ ] 5.4 Run per-package coverage for the touched packages; verify line coverage stays at or above 90% and does not decrease.
- [x] 5.5 Run the after-profile with the exact commands from 2.1 and 2.2; record `POST us`, ratio, and top functions in the same report. Verify the Bun POST result is materially lower and Node/Deno are not worse than the baseline noise floor.
- [x] 5.6 Run a CPU-pinned after A/B with the same three-run protocol from 2.3; verify the median Bun POST win is larger than the recorded spread.
- [ ] 5.7 Run a wire POST measurement (the existing benchmark POST scenario or a pinned `wrk` POST run) before and after; record whether the in-process win translates to the socket path. Verify the result is recorded even if the wire path does not improve.
- [x] 5.8 Tighten `apps/benchmark/scripts/dev-check/budgets.json` for the Bun `inproc.post.nextrush.vs_hono` rule only after 5.5/5.6 show the win; set max and target with the measured spread as headroom. Verify `bookkeeping` and the Bun gate pass.
- [x] 5.9 Run the full `bundle cold inproc probe bookkeeping` gate on Bun, Node, and Deno; verify zero FAIL, with only the existing Deno `FB-03` KNOWN result.
- [x] 5.10 Run `pnpm bench:validate` (or the repository's current equivalent) and verify response bodies and content types remain byte-identical across all benchmark servers.
- [x] 5.11 Update ADR-0031 with the final measured before/after numbers and the budget ratchet; verify the ADR states the accepted result.

## Workflow follow-up

- Review RFC-043 and ADR-0031 before implementation begins.
- Archive the change only after the review requirements are satisfied and the final report is committed.
