# Tasks

## 1. Baseline and attribution (before)

- [x] 1.1 Capture the Bun wire baseline with `node apps/benchmark/scripts/dev-check/check.mjs wire --rt bun` (median of three `wrk` runs) and record NextRush/Hono/Elysia/raw rps plus the observed min–max range in `report/performance/bun-request-path-baseline.md`. Verify the report contains the exact command and the captured numbers.
- [x] 1.2 Capture the Bun in-process baseline with `node apps/benchmark/scripts/dev-check/check.mjs inproc --rt bun` (best of three) and record `inproc.nextrush.us`, `inproc.nextrush.vs_hono` (target 1.3 / max 1.9), and the h12 row in the same report. Verify the report quotes the committed budget values next to the measured ratio.
- [x] 1.3 Profile the request path on Bun: `node apps/benchmark/scripts/dev-check/check.mjs profile --entry inproc-nextrush --rt bun` and `--entry inproc-nextrush-web --rt bun`; record the ranked top functions and attribute cost across adapter/runner/dispatch/response in the report. If the wire gap needs more attribution than these entries explain, record the limitation explicitly instead of guessing. Verify the report lists ranked attribution sites with file/function names.
- [x] 1.4 Measure the two named candidates directly in `serve()`/`createBunRequestRunner` with the repo's allocation harness (`apps/benchmark/scripts/alloc/`) or a dedicated child script: the per-request `trackedHandler` wrapper frame and the per-request `server.requestIP` resolver thunk. Record each number, or "below the measurement floor", in the report. Verify each candidate has a recorded number before any code is written.
- [x] 1.5 Establish the noise floor with three CPU-pinned runs: `taskset -c 0-3 node apps/benchmark/scripts/dev-check/check.mjs inproc --rt bun`; record min/median/max in the report and use the recorded spread as the parking threshold for group 5. Verify the spread is the one quoted in group 5's comparisons.

## 2. Decision record (RFC-gated, before code)

- [x] 2.1 Write `docs/RFC/runtime-adapters/044-bun-request-path-trims.md` from `docs/RFC/TEMPLATE.md`: the wire-gap problem with the group-1 numbers, the accepted candidates with their attribution, which candidates are parked, the parking rule, rejected alternatives, and the before/after gate. Verify every template section is filled and the accepted/parked candidate list is explicit.
- [x] 2.2 Write `docs/adr/ADR-0032-bun-request-path-trims.md` from `docs/adr/TEMPLATE.md` recording the durable decisions (drain accounting, client-address resolution, wire-stage acceptance) and their consequences. Verify the file exists and each decision is stated in one paragraph.
- [x] 2.3 Register RFC-044 and ADR-0032 in `docs/RFC/INDEX.md` and `docs/adr/INDEX.md` and link them from `openspec/changes/reduce-bun-request-path-cost/design.md`. Verify the links resolve and each index has exactly one added row.

## 3. RED tests

- [x] 3.1 Add failing optimization-assertion tests for the drain accounting accepted in RFC-044 in `packages/adapters/bun/src/__tests__/graceful-shutdown.test.ts` (extend `StubBunServer` as needed): with an in-flight request visible only through the platform count, drain must wait — driven via the `installBunServeStub` capture — so the assertions fail on the current `trackedHandler` counter and pass after the change. Verify each fails for the intended reason.
- [x] 3.2 Keep/extend the drain characterization assertions green before and after: in-flight completion within the timeout, force-close only after the timeout, and no signal handlers installed when `gracefulShutdown` is omitted. Verify they pass on the current code (characterization) and stay green after 4.1.
- [x] 3.3 Add failing tests for the client-address resolution accepted in RFC-044 in `packages/adapters/bun/src/__tests__/per-request-work-trim.test.ts` (same pattern as its HP-1/HP-7 optimization assertions): the context factory resolves `ctx.ip` from the platform server on first read and allocates no per-request resolver closure — write the assertion against the accepted shape so it fails before implementation. Verify it fails for the intended reason.
- [x] 3.4 Keep/extend the `ctx.ip` parity matrix green (`context.test.ts` and the trim file): untrusted → platform address; trusted hops → policy result on first read, memoized once; unread `ctx.ip` performs no platform lookup. Verify pass-before/pass-after.
- [x] 3.5 For each additional profile-attributed candidate RFC-044 accepts, add its failing test before any code; if RFC-044 accepts none, record "no additional candidates" in the report. Verify the report reflects the accepted candidate list.

## 4. Implementation

- [x] 4.1 Replace the per-request drain accounting with the RFC-044 mechanism (platform pending count and/or native drain semantics), keeping the timeout/force-close and `app.close` teardown order in `drainAndClose` unchanged. Verify tasks 3.1–3.2 pass and `graceful-shutdown.test.ts` is fully green.
- [x] 4.2 Remove the per-request resolver thunk from `createBunRequestRunner`/`createBunContext`; hold the platform references and resolve `ctx.ip` on first read, keeping memoization. Verify tasks 3.3–3.4 pass and `context.test.ts` is fully green.
- [x] 4.3 Apply each remaining RFC-044-accepted trim as its own revertible step (one concern per commit); park anything the after-numbers show inside the spread and record the park. Verify each kept trim has before/after numbers and each parked trim is reverted.
- [x] 4.4 Document the resulting drain accounting and address-resolution mechanics in `packages/adapters/bun/ARCHITECTURE.md` (and the README only if a documented guarantee changes). Verify the docs describe the shipped mechanism, not the old one.

## 5. Verification and after-profile

- [x] 5.1 Run `pnpm --filter @nextrush/adapter-bun test` (plus any other touched package); verify all pass with no skipped new tests.
- [x] 5.2 Run the cross-adapter conformance suite across Node, Bun, Deno, and Edge; verify observable behavior is byte-identical and no scenario regresses.
- [x] 5.3 Run ESLint and `tsc --noEmit` (strict) for the touched packages; verify zero errors and no new warnings.
- [x] 5.4 Run per-package coverage for the touched packages; verify line coverage stays at or above 90% and does not decrease.
- [x] 5.5 Run the after wire stage with the exact command from 1.1; record medians and range in the report. Verify any claimed wire improvement is larger than the recorded spread; otherwise record the parked result.
- [x] 5.6 Run the after in-process measurement and profile with the exact commands from 1.2–1.3; record ratio, top functions, and the allocation deltas from 1.4 next to the baseline. Verify the numbers are recorded.
- [x] 5.7 Run the CPU-pinned three-run A/B with the same protocol as 1.5; verify the median win is larger than the recorded spread (or record the parked result).
- [x] 5.8 Ratchet the `inproc.nextrush.vs_hono` (and h12) target — and `max` only with repeated-run evidence and headroom — in `apps/benchmark/scripts/dev-check/budgets.json`, only if 5.6–5.7 show a win beyond the spread; never add a `wire` budget row. Verify `bookkeeping` and the Bun gate pass.
- [x] 5.9 Run the full `bundle cold inproc probe bookkeeping` gate on Bun, Node, and Deno; verify zero FAIL and no new KNOWN results.
- [x] 5.10 Run `pnpm bench:validate` (or the repository's current equivalent); verify response bodies and content types remain byte-identical across all benchmark servers.
- [x] 5.11 Update RFC-044, ADR-0032, and the report with the final before/after numbers and the kept/parked list. Verify the ADR states the accepted result.

## Workflow follow-up

- Review RFC-044 and ADR-0032 before implementation begins.
- Archive the change only after the review requirements are satisfied and the final report is committed.
