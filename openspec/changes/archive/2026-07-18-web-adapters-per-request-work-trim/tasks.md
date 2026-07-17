## 1. Preparation & baseline

- [x] 1.1 Confirm via source that each sibling context factory takes `trustProxy` positionally (no options object → HP-4 N/A) and that `_next` is always assigned a promise-returning thunk (basis for HP-7).
- [x] 1.2 Verify whether the `serverless` adapter shares the eager-ip / `async next()` shape or wraps Edge/Node (Open Question); record the finding — extend scope or file a follow-up.
- [x] 1.3 Record the current conformance-suite state (green) and per-adapter coverage baselines.

## 2. RED — HP-1 `ctx.ip` parity tests (write failing first)

- [x] 2.1 Bun: `trustProxy` false + `clientIp` present → `ctx.ip` equals `clientIp`, no lookup closure; `clientIp` absent → `''`.
- [x] 2.2 Bun: `trustProxy` true → resolves via shared policy (directIp = `clientIp ?? ''`), matching today across all four `clientIp × trustProxy` combinations.
- [x] 2.3 Deno: `trustProxy` false → `ctx.ip` equals `connInfo.remoteAddr.hostname` (or `''`), no closure; `trustProxy` true → shared policy.
- [x] 2.4 Edge: `trustProxy` false → `ctx.ip` is `''`, no closure; `trustProxy` true → `cf-connecting-ip` → `x-forwarded-for` → `x-real-ip` precedence preserved.
- [x] 2.5 All three: `trustProxy` false ignores `x-forwarded-for` / `x-real-ip` (returns platform address).
- [x] 2.6 Verify §2 tests FAIL appropriately pre-implementation.

## 3. RED — HP-7 `ctx.next()` tests (per adapter)

- [x] 3.1 `await ctx.next()` preserves onion ordering (each adapter).
- [x] 3.2 A rejection from the wired thunk propagates out of `ctx.next()` (each adapter).
- [x] 3.3 `ctx.next()` with no wired `_next` returns a resolved promise and does not throw (each adapter).
- [x] 3.4 `ctx.next()` advances the same chain the composer guards (composer multiple-`next()` detection still fires).
- [x] 3.5 Verify §3 tests FAIL appropriately pre-implementation.

## 4. GREEN — implement the trims (one adapter at a time)

- [x] 4.1 Bun HP-1: `this.ip = trustProxy ? getClientIp(request, clientIp ?? '', true) : (clientIp ?? '')`.
- [x] 4.2 Deno HP-1: `const directIp = connInfo?.remoteAddr?.hostname ?? ''; this.ip = trustProxy ? getClientIp(request, directIp, true) : directIp`.
- [x] 4.3 Edge HP-1: `this.ip = trustProxy ? getEdgeClientIp(request, true) : ''`.
- [x] 4.4 HP-7 on all three: `next(): Promise<void> { return this._next ? this._next() : <cached resolved promise>; }` (reuse a shared runtime resolved-promise constant if available).
- [x] 4.5 Run §2–§3 tests to GREEN; iterate until all pass.

## 5. Cross-adapter conformance & internal quality

- [x] 5.1 Extend `packages/adapters/conformance` to pin `ctx.ip` (trustProxy on/off, proxy-headers-ignored, Edge `cf-connecting-ip`) and `ctx.next()` (ordering/rejection/no-op) identically across all four adapters.
- [x] 5.2 Run the full conformance suite + each adapter's own suite; confirm all green.
- [x] 5.3 Clean up naming/structure; keep each `context.ts` within file-size/complexity budgets.

## 6. Performance verification gate

- [x] 6.1 Add a per-adapter allocation micro-bench (mirroring Node's `context-alloc`) proving the per-request header-lookup closure is gone when `trustProxy` is false.
- [x] 6.2 Record the allocation deltas per adapter with the absolute before/after bytes-per-request (not just a percentage), so the reduction is not overstated as a total-request-allocation figure.
- [x] 6.3 Decision gate (design D7): accept on the deterministic allocation reduction + green conformance; no sibling RPS claim is made (out of the `wrk` harness's reach).

## 7. Finalize

- [x] 7.1 Confirm per-package line coverage ≥90% with the changed `ip` / `next()` branches covered; typecheck + lint clean across the three adapters.
- [x] 7.2 Run `openspec validate web-adapters-per-request-work-trim --strict`; prepare an atomic commit scoped to the three `context.ts` files + tests + conformance additions + the micro-bench.
- [x] 7.3 Update `report/node-adapter-per-request-work-trim-followup.md` to mark the sibling work done and note the HP-4-not-applicable correction.
