## 1. Preparation & baseline

- [x] 1.1 Audit every caller of `compose()` via the code graph (`trace_path`/`search_graph`) and confirm the `len === 1` cases and whether any caller passes a meaningful tail `next`; record findings in the change notes.
- [x] 1.2 Capture a baseline `pnpm bench:compare --profile full` (5 runs, CPU-pinned) for Hello World and Route Params, and record `pnpm bench:validate` passing, so the A/B in §7 has a real before-number.
- [x] 1.3 Confirm the current `@nextrush/core` coverage number so §8 can assert no decrease.

## 2. RED — next() call-count edge-case tests (write failing first)

- [x] 2.1 Add `packages/core/src/__tests__/` tests for the fast path: `next()` called once advances the tail and preserves onion before/after ordering.
- [x] 2.2 Test: `next()` called zero times settles without invoking the tail.
- [x] 2.3 Test: `next()` called twice synchronously → second rejects with exactly `next() called multiple times`.
- [x] 2.4 Test: `next()` called three times → both the second and third reject.
- [x] 2.5 Test (parametric): `next()` called n times for n > 3 → exactly the first advances, all others reject.
- [x] 2.6 Test: `next()` called twice with an `await` between the calls → second rejects.
- [x] 2.7 Verify all §2 tests FAIL for the right reason before any implementation (the fast path does not exist yet, or a naive stub drops the guard).

## 3. RED — surface, error, and warning tests

- [x] 3.1 Test: `ctx.next()` advances the same chain as the `next` argument.
- [x] 3.2 Test: argument-then-`ctx.next()` and `ctx.next()`-then-argument are BOTH detected as double-calls (mixed-surface guard).
- [x] 3.3 Test: a context without `setNext` runs via the `next` argument and does not throw.
- [x] 3.4 Test: synchronous throw → rejected promise; returned rejected promise → propagates.
- [x] 3.5 Test: non-`Error` throw (string, number, null, undefined, object) → rejection is `Error` with message `String(thrown)`.
- [x] 3.6 Test: an error from the tail `next()` propagates back through an awaiting middleware.
- [x] 3.7 Test: double-response warning fires in non-production (message + index-0 parity) and is silent in production.

## 4. RED — concurrency isolation & general-vs-fast parity

- [x] 4.1 Test: two concurrent invocations, one double-calling `next()` and one single — only the double-caller rejects, no cross-talk.
- [x] 4.2 Test: high-concurrency mix (many interleaved invocations, half double-calling) — exactly the double-callers reject; counts independent.
- [x] 4.3 Test: interleaved async (A awaits a slow tail while B completes) — A/B guard and response state stay independent.
- [x] 4.4 Build a parity harness that runs the same middleware behaviors through the fast path (1-entry stack) and the general path (forced multi-entry with a transparent passthrough) and asserts identical resolution, ordering, rejection messages, and warning text.
- [x] 4.5 Verify all §3–§4 tests FAIL appropriately pre-implementation.

## 5. GREEN — implement the fast path

- [x] 5.1 Extract the shared rejection message (`next() called multiple times`) and the double-response warning text into a single internal helper/constant used by BOTH the general path and the fast path (design D4), so they cannot drift.
- [x] 5.2 Add the `len === 1` branch to `compose()` in `packages/core/src/middleware.ts`: a per-invocation guarded `next` thunk (declared INSIDE the returned per-request function — design D2), wired to `ctx.setNext` as the SAME thunk passed as the argument (design D3), with sync-throw→reject and non-`Error` wrapping.
- [x] 5.3 Confirm the `len === 0` and `len >= 2` paths are untouched (diff review + the existing compose suite).
- [x] 5.4 Run §2–§4 tests to GREEN; iterate until all pass.

## 6. REFACTOR & internal quality

- [x] 6.1 Clean up naming/structure of the fast-path branch and the shared helper; keep `compose()` within the file-size/complexity budgets.
- [x] 6.2 Add a regression test asserting `len === 2` still uses the general path (boundary guard), and that the single middleware need not be the router (lone `app.use`).
- [x] 6.3 Re-run the full `@nextrush/core` test suite; confirm no regressions.

## 7. Performance verification gate

- [x] 7.1 Add an allocation micro-benchmark proving the recursive `dispatch` closure is not allocated on the `len === 1` path (only the single guarded thunk).
- [x] 7.2 Re-run `pnpm bench:validate` — response bodies + Content-Type remain byte-identical.
- [x] 7.3 Run `pnpm bench:compare --profile full` (5 runs, CPU-pinned) after the change; compare against the §1.2 baseline for Hello World / Route Params.
- [x] 7.4 Decision gate (design D6): if the A/B shows no regression AND a gain beyond stddev, proceed; if no movement beyond noise, park/revert and record the allocation-only outcome for the deferred engine-unification follow-up. No merge on aesthetics.

## 8. Integration, cross-adapter & finalize

- [x] 8.1 Add adapter-level integration tests (Node): the single-middleware app serves static/param/POST 200s and an unmatched-path 404 correctly, including the 404 fall-through (single tail `next()` resolves).
- [x] 8.2 Add/confirm a test that the router's own per-route multiple-`next()` detection (`compileExecutor`) still rejects independently of the app-level fast path.
- [x] 8.3 Confirm cross-adapter parity expectation holds (compose is shared core) via the existing adapter conformance/behavioral suites.
- [x] 8.4 Confirm per-package line coverage is ≥90% and the new branch is covered; run typecheck + lint clean (zero errors/warnings).
- [x] 8.5 Run `openspec validate core-single-middleware-fastpath --strict` and update tasks/status; prepare an atomic, single-concern commit scoped to `packages/core/src/middleware.ts` + its tests + the benchmark harness addition.
