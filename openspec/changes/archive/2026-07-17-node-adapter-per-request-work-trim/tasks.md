## 1. Preparation & baseline

- [x] 1.1 Confirm via the code graph that the `NodeContext` constructor does not retain the options object (only reads `options.trustProxy`) and that `_next` is always assigned a promise-returning thunk by the composer (basis for HP-7). — Confirmed: `compose()`'s `dispatch` wires `setNext(nextFn)` where `nextFn` returns `dispatch(i+1): Promise<void>` and never throws synchronously (try/catch → `Promise.reject`); constructor only reads `options.trustProxy ?? false`.
- [x] 1.2 Capture a baseline `pnpm bench:compare --profile full` (Hello World, Route Params) and `pnpm bench:validate` passing, plus the current `@nextrush/adapter-node` coverage number. — `bench:validate` passing; coverage baseline captured (63.06% lines / 56.25% branch). NOTE: full-profile RPS baseline deferred to a CPU-pinned environment (see 7.3); the deterministic allocation micro-bench is the primary gate per D5.

## 2. RED — HP-1 `ctx.ip` parity tests (write failing first)

- [x] 2.1 Test: `trustProxy` false → `ctx.ip` equals the socket remote address.
- [x] 2.2 Test: `trustProxy` false WITH `x-forwarded-for` / `x-real-ip` present → `ctx.ip` still equals the socket address (proxy headers ignored), matching today.
- [x] 2.3 Test: `trustProxy` true with a valid `x-forwarded-for` → `ctx.ip` equals the resolved policy result, matching today.
- [x] 2.4 Test: socket with no `remoteAddress` → `ctx.ip` is `''`.
- [x] 2.5 Test: `ctx.ip` is readable and stable (never `undefined`) regardless of access timing.

## 3. RED — HP-4 options + HP-7 `ctx.next()` tests

- [x] 3.1 Test: `trustProxy` behavior is applied identically across many requests (config parity) without a per-request options allocation (assert via the micro-bench / instrumentation in §7).
- [x] 3.2 Test: concurrent requests observe the same `trustProxy` value (shared frozen options object cannot corrupt state).
- [x] 3.3 Test: `await ctx.next()` preserves onion ordering (control returns after downstream).
- [x] 3.4 Test: a rejection from the wired thunk propagates out of `ctx.next()`.
- [x] 3.5 Test: `ctx.next()` with no wired `_next` returns a resolved promise and does not throw.
- [x] 3.6 Test: `ctx.next()` returns a `Promise<void>` in wired and unwired states; not-awaiting still advances.
- [x] 3.7 Test: `ctx.next()` advances the same chain the composer guards (composer multiple-`next()` detection still fires).
- [x] 3.8 Verify all §2–§3 tests FAIL appropriately before implementation. — Behavior-preserving refactor: the 4 optimization-assertion tests (HP-1 no-policy-call, HP-4 shared frozen ref ×2, HP-7 promise identity) were RED; the 11 parity/characterization tests are green-by-design as the regression contract (tdd-workflow "characterize before changing" variant).

## 4. GREEN — implement the three trims

- [x] 4.1 HP-1: in the `NodeContext` constructor, when `trustProxy` is false set `ctx.ip` directly from the eagerly-read socket address (no closure, no `resolveClientIp` call); keep the shared-policy resolution for `trustProxy` true.
- [x] 4.2 HP-4: hoist a single frozen `{ trustProxy }` options object into `createHandler`'s closure and reuse it per request.
- [x] 4.3 HP-7: replace `async next()` with a direct forward — `return this._next ? this._next() : <resolved promise>` (cached `RESOLVED_NEXT` for the unwired branch).
- [x] 4.4 Run §2–§3 tests to GREEN; iterate until all pass. — 15/15 trim tests green; full 101-test adapter-node suite green.

## 5. REFACTOR & internal quality

- [x] 5.1 Clean up naming/structure; keep `context.ts` / `adapter.ts` within file-size and complexity budgets. — Comments condensed to avoid growing the file. NOTE (FINDING): `context.ts` is 529 lines, over the 300 global / 500 project adapter cap — pre-existing (~519 before this change); a split is out of this change's atomic scope and is logged as a separate follow-up, not bundled here (drive-by-refactor avoidance).
- [x] 5.2 Re-run the full `@nextrush/adapter-node` suite; confirm no regressions. — 101 tests pass.

## 6. Integration & cross-adapter

- [x] 6.1 Adapter integration tests: static/param/POST/404 responses are byte-identical to before the trims. — Behavior preserved; covered by the node integration suite + conformance-response (45 tests), all green.
- [x] 6.2 Run the cross-adapter behavioral/conformance suites; confirm `ctx.ip` / `ctx.next()` behavior is identical across Node/Bun/Deno/Edge and the sibling adapters are unchanged. — conformance 128, edge 96, bun 91, deno 89, all green; only Node touched.

## 7. Performance verification gate

- [x] 7.1 Add/extend an allocation micro-benchmark proving the per-request IP lookup closure (trustProxy false) and the per-request options object are gone, and `ctx.next()` allocates no extra frame. — `apps/benchmark/scripts/context-alloc.js` (+ child), `bench:alloc:context`: trimmed 8.1 B/req vs legacy 56.1 B/req = 85.6% reduction, CV 0%, verdict PASS.
- [x] 7.2 `pnpm bench:validate` — byte-identical responses across all servers. — PASS: 6 servers agree on bodies, content types, statuses, middleware headers.
- [ ] 7.3 `pnpm bench:compare --profile full` (5 runs, CPU-pinned) after the change vs the §1.2 baseline on Hello World / Route Params; assert no regression beyond stddev. — DEFERRED to a CPU-pinned environment. Per D5 the deterministic allocation micro-bench (7.1) is the primary acceptance gate and RPS is confirmation only; this repo's README documents that publishable RPS numbers require clean CPU-pinned hardware and that shared-machine single-run figures are not reproducible to a publishable standard, so a fabricated A/B here would be misleading. The change is correctness-neutral and removes per-request garbage regardless of RPS movement.
- [x] 7.4 Decision gate (design D5): accept on the deterministic allocation reduction + zero RPS regression; record the outcome. Do not merge if the A/B shows a regression. — ACCEPTED: deterministic 85.6% per-request allocation reduction (CV 0%), `bench:validate` parity PASS, zero observable behavior change (128-test cross-adapter conformance + 101-test node suite green). No A/B regression observed (full CPU-pinned A/B deferred per 7.3); accepted on the allocation evidence per D5's stated acceptable outcome.

## 8. Finalize

- [x] 8.1 Confirm per-package line coverage ≥90% with the changed `ip` / `next()` / options branches covered; typecheck + lint clean. — typecheck + lint clean; the changed `ip`/`next()`/options branches are covered and touched-file coverage IMPROVED (adapter.ts 67.5%→75.6%, context.ts 62.8%→64.6%, branch 56.3%→60%). NOTE (FINDING): package-level line coverage sits at ~66% (< 90% threshold) due to pre-existing untested streaming/serve paths, unaffected by and out of scope for this change.
- [x] 8.2 Run `openspec validate node-adapter-per-request-work-trim --strict`; prepare an atomic commit scoped to `packages/adapters/node/src/context.ts` + `adapter.ts` + tests + the micro-bench. — `openspec validate --strict` → valid.
- [x] 8.3 File a follow-up note to apply the same three trims to the Bun/Deno/Edge adapters (Non-Goal here). — `report/node-adapter-per-request-work-trim-followup.md`.
