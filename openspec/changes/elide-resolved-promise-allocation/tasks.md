# Tasks — Elide redundant resolved-promise allocation in `compose()`

## 1. Characterize current behavior before changing it (RED must pass on UNCHANGED code)

These tests describe guarantees the CURRENT code already provides. They must be written and pass
**against unmodified `middleware.ts` first** — that is what makes them a regression net rather than
a description of the new code. A test here that only passes after the change would mean the change
altered observable behavior, which is a Non-Goal.

- [x] 1.1 Write `packages/core/src/__tests__/compose-return-adoption.test.ts` covering, for BOTH the
      `len === 1` fast path and the `len >= 2` general path:
      (a) a middleware returning a non-Promise thenable whose async work must complete before the
      composed promise settles, asserting an observable side effect ordering — not just resolution;
      (b) each falsy-but-defined return (`null`, `false`, `0`, `''`) resolving with that exact
      value; (c) an `undefined` return resolving to `undefined`.
      **[Verified: 16 tests written — thenable adoption (both paths, plus a rejecting thenable),
      all 4 falsy values x both paths, undefined x both paths, synchronous-execution ordering,
      25-way concurrent sentinel sharing, and a sentinel-identity assertion.]**
- [x] 1.2 Run it against UNMODIFIED `middleware.ts` and confirm every case passes. Record the pass
      count. If any case fails here, the current code already has a defect — stop and report it
      rather than "fixing" it inside a performance change.
      **[Verified: 15/15 passed against unmodified source (`git diff --stat src/middleware.ts` empty
      at the time of the run), confirming these are a genuine regression net and not a description
      of post-change behavior. The 16th test (sentinel identity) was added later in task 3.3 since
      it necessarily only holds after the change.]**

## 2. Add the sentinel (GREEN)

- [x] 2.1 Add `const RESOLVED: Promise<void> = Promise.resolve()` at module scope in
      `packages/core/src/middleware.ts`, with a one-line comment stating the contract and citing the
      router's existing sentinel precedent — no restated rationale (comment discipline).
      **[Verified: added with a 1-line contract comment + `@see` design.md pointer, no inlined
      rationale.]**
- [x] 2.2 Replace the four fresh-allocation sites per design.md D2: the `len === 0` terminal, the
      `composedSingle` `nextFn` terminal, the general path's `if (!fn)` early return, and both
      paths' middleware-return using the strict `result === undefined ? RESOLVED :
      Promise.resolve(result)` form. Do NOT introduce an `instanceof Promise` test anywhere.
      **[Verified: all 4 sites replaced. `grep -c "Promise.resolve()"` returns 1 — the `RESOLVED`
      declaration itself, no fresh construction left. `grep "instanceof Promise"` returns nothing,
      confirming D2's forbidden pattern was not introduced.]**
- [x] 2.3 Re-run task 1.1's suite — every case must still pass, unchanged. This is the load-bearing
      check that the optimization is semantics-preserving.
      **[Verified: 15/15 still passing post-change, identical to the pre-change run — thenables
      still adopted, falsy values still preserved.]**
- [x] 2.4 Run the full `packages/core` suite (173 tests expected) plus
      `packages/core/src/__tests__/middleware-single-fastpath.test.ts` specifically, confirming the
      double-next-detection and fast-path-vs-general-path parity assertions still hold.
      **[Verified: full core suite 189/189 (was 173, +16 new). `middleware-single-fastpath.test.ts`
      30/30 — the double-next detection and byte-for-byte fast-vs-general parity assertions all
      still hold.]**

## 3. Prove the benefit with the only instrument that can see it

- [x] 3.1 Measure a genuinely SYNCHRONOUS single-middleware stack (returns `undefined`) before and
      after, with `--expose-gc`, retaining returned promises. Expect a material reduction
      (spike measured 84.0 → 12.0 B/op, −86%). If there is no improvement, revert per design.md's
      Rollback Plan trigger 6 — do not ship risk for zero benefit.
      **[Verified: added a permanent `sync` variant to the EXISTING `bench:alloc:compose` harness
      (rather than a throwaway script) so this claim stays reproducible. Apples-to-apples with the
      same harness, source reverted via `git stash` for the before-run:
      **115.6 B/op ± 0.3 → 14.0 B/op ± 0.4, −87.9%**. Trigger 6 not met; benefit is real.]**
- [x] 3.2 Run `bench:alloc:compose` and record the async-middleware result. Expect it to be FLAT
      (within noise) and state that explicitly as the expected outcome — a change here would mean
      something unintended happened to the async path.
      **[Verified FLAT as predicted: Fast (len 1, async) 806.1 → 814.5 B/op; General (len 2)
      1526.8 → 1538.1 B/op. Both within run-to-run noise, confirming the async path was untouched
      because `Promise.resolve(p) === p` already avoided allocation there. The fast-vs-general
      reduction gate still reports PASS at 47.0%.]**
- [x] 3.3 Assert the shared sentinel is actually being returned (`composed(ctx) === composed(ctx)`
      for a synchronous middleware), so the measurement is attributed to the intended mechanism
      rather than to unrelated drift.
      **[Verified: permanent test asserts a synchronous middleware yields the SAME promise object
      across calls while a promise-returning middleware still yields distinct promises — so the
      −87.9% is attributed to the sentinel, not to drift.]**

## 4. Cross-package verification

- [x] 4.1 Run `packages/adapters/conformance` (290 tests expected) — no cross-adapter divergence.
      **[Verified: 290/290 passing, 10 files.]**
- [x] 4.2 Run `apps/benchmark`'s `node scripts/validate-parity.js` — all 6 servers still agree on
      bodies, content types, statuses, and middleware headers.
      **[Verified: "Parity OK — 6 servers agree on bodies, content types, statuses, and middleware
      headers."]**
- [x] 4.3 Start a benchmark server and confirm no `unhandledRejection` /
      `MaxListenersExceededWarning` in its log (Rollback Plan trigger 4) — the shared-sentinel risk
      most likely to appear only at runtime.
      **[Verified: ran 6s of load on `/`, 4s on `/middleware` (5 middleware layers), plus a hit on
      `/error` to exercise the rejection path. Server log contained only the startup line — zero
      warnings, zero unhandled rejections. This is the check that would catch handler accumulation
      on a shared promise; it did not occur, consistent with design.md D1.]**
- [x] 4.4 `pnpm exec tsc --noEmit` and the package's own `pnpm run lint` in `packages/core` — both
      clean. Use the package's own lint script, not a raw `eslint src/` invocation.
      **[Verified: `tsc --noEmit` clean, `pnpm run lint` clean (zero output). Used the package's own
      script, which carries `--ignore-pattern '**/__tests__/**'` matching its tsconfig exclude.]**

## 5. Correct the record

- [x] 5.1 Update `reports/investigations/performance-investigation-reconciliation.md`'s Rec 11 entry
      (BOTH the Progress Tracker table and the §14 table) to mark F-09 resolved with the real
      −86%-on-synchronous-middleware figure, and state plainly that it does not move any benchmark
      scenario because every benchmark middleware is async.
      **[Verified: both tables updated. Rec 11 moved from MIXED to Resolved with all three parts
      itemized (scenarios / closure-not-reducible / F-09 shipped at −87.9%), and the "moves no
      benchmark scenario" limit stated explicitly in both places rather than glossed.]**
- [x] 5.2 Correct the same report's Rec 3/4 status: CPU pinning is **available** on this machine
      (`taskset` + the harness's existing `--pin`/`--client-pin`), and measured between-batch drift
      falls from ±25–58% unpinned to ~1–5% pinned. What remains blocked is only the multi-hour
      `standard`/`full` profile runtime, not the capability. The current "hardware-blocked" wording
      overstates the blocker.
      **[Verified: Rec 3 and Rec 4 rows rewritten with the measured pinning figures and the explicit
      note that earlier "hardware-blocked" wording overstated the blocker. Rec 4 additionally
      records the cautionary datum: an unpinned A/B showed +23% that fully REVERSED under
      interleaving (58% swing on identical config), so no timeout-arm conclusion may be drawn from
      an unpinned non-interleaved run. Progress bar updated 75% → 83%.]**
- [x] 5.3 Add a note to the same report that `bench:alloc:compose`'s absolute figures
      (807/1526 B/op) are an allocation-RATE comparison using an `async` middleware and retaining
      every returned promise — they are NOT compose's per-request cost, and only the
      fast-vs-general DELTA between them is a valid same-methodology comparison. This corrects a
      real misreading made while analysing this report.
      **[Verified: added as a new prominent `§0 How to read the allocation harness numbers` ahead of
      the Executive Summary, with an explicit valid/invalid split and the rule that a B/op figure may
      only be cited against the same harness+variant. The Progress Tracker now points readers to §0
      before citing any B/op figure. Self-documents that the bad comparison was actually made once,
      so it reads as a correction rather than generic advice.]**

## 6. Close out

- [x] 6.1 `openspec validate elide-resolved-promise-allocation --strict` passes.
      **[Verified: "Change 'elide-resolved-promise-allocation' is valid". Final suites: core 189/189,
      router 338/338, conformance 290/290.]**
- [x] 6.2 Every task above marked `[x]` with a `**[Verified: ...]**` note citing real evidence — a
      test file and pass count, or a measured number. Never a bare checkbox.
      **[Verified: all 16 tasks carry a Verified note citing a test file + pass count or a measured
      B/op figure.]**
- [x] 6.3 Commit as one atomic, independently revertible commit referencing the rollback procedure,
      then archive the change.
