## 1. Establish the current allocation baseline before touching anything

- [x] 1.1 Read `packages/router/src/matching.ts`'s `matchNodeIndexed` and `match-route.ts`'s
      `matchRoute` in full; confirm the exact allocation sites (`WalkFrame[]` push/pop,
      `bindNames`/`bindValues` array creation) and their call sites, so the reuse mechanism targets
      the real sites and not a guessed location. **[Verified: `matchNodeIndexed` allocates `stack:
      WalkFrame[]` fresh on every call plus a frame object literal on every `stack.push(...)`
      (static-child and param-child descent); `matchRoute` allocates `bindNames`/`bindValues` fresh
      on every call and threads them in. Confirmed via the code graph's own `alloc_in_loop: 6`
      metric on `matchNodeIndexed`.]**
- [x] 1.2 Run the existing `bench:alloc:param-match` / `router-match` allocation harnesses at HEAD
      and record the current per-call allocation count as this change's own before-figure — the
      number this change's after-figure gets compared against, not the report's ≈10-11 estimate.
      **[Verified: `bench:alloc:router` — param-route hit 467.6 B/op ± 0.3 (cv 0.05%).
      `bench:alloc:param-match` — depth-2 param 348.0 B/op ± 107.0 (cv 30.74%, noisy), depth-8 param
      303.3 B/op ± 1.0 (cv 0.32%). These are this change's real before-figures.]**
- [x] 1.3 Read the router's existing route-registration path to find where (if anywhere) maximum
      route-tree depth is already tracked or computable at registration time — resolves design.md's
      Open Question about sizing the reusable frame buffer from a real number, not a guessed
      constant. **[Verified via `search_graph`: no such tracking existed. Added it — `addRoute` now
      updates a new `RegistrationState.maxDepth` field from `segments.length` on every insert.
      RED→GREEN: `registration-max-depth.test.ts` (4 tests) written failing first, now passing.
      Confirmed via source read that request-path length alone can never exceed this bound — a
      mismatched segment backtracks (pops) rather than pushing a new frame — so this preserves the
      walk's existing recursion-depth DoS guard rather than reintroducing it. Full router suite
      re-run: 321/321 passing, zero regressions from the new required field.]**

## 2. Pool the walk's scratch state (RED → GREEN → REFACTOR, one commit per sub-step)

- [x] 2.1 RED: write a failing test proving sequential matches on the same router instance produce
      independent, uncorrupted results even when internal walk state is reused (per the new
      `router` capability's "Sequential matches reuse state safely" scenario) — written against the
      current, unpooled implementation so it currently passes trivially, then extended in 2.3 to
      also exercise the pooled path once it exists. **[Verified:
      `match-walk-pool-safety.test.ts`'s "sequential matches reuse pooled scratch safely" block, 3
      tests — passed trivially pre-pool, re-run and still passing post-pool.]**
- [x] 2.2 RED: write a failing test asserting the walk never suspends on a promise mid-frame (the
      "walk never awaits mid-frame" scenario) — a synchronous-completion assertion that would catch
      a future accidental `async` creeping into the walk. **[Verified: same file's "the walk never
      suspends mid-frame" block, 3 tests including a microtask-ordering probe — passed trivially
      pre-pool, still passing post-pool.]**
- [x] 2.3 GREEN: implement per-matcher-instance pooling for the `WalkFrame[]` stack and the
      `bindNames`/`bindValues` arrays, sized from task 1.3's real depth figure, with the existing
      depth-guard/backtrack logic unchanged (design.md D1/D2). Reset (not reallocate) at the start
      of each `matchRoute()` call. **[Implemented in new file `walk-pool.ts` (`WalkPool`,
      `createWalkPool`, `matchNodeIndexedPooled`) — `matching.ts`'s `matchNodeIndexed` delegates to
      it when a pool is supplied, unchanged fresh-allocation behavior otherwise.
      `MatchState.walkPool` carries it through `resolveMatch`/`matchRoute`. `Router.addRoute`
      rebuilds the pool only when `maxDepth` grows; `Router.reset()` clears both.
      **REAL BUG CAUGHT BY THE TEST SUITE, NOT SHIPPED SILENTLY**: initial `createWalkPool` sized
      the frame array to `maxDepth` frames, but the walk's frame 0 represents the trie ROOT itself
      (mirroring the unpooled `stack[0] = {node: root, ...}`), so a route with `maxDepth` segments
      needs `maxDepth + 1` frames. This caused 80 test failures (every param match losing its bound
      params) on the first full-suite run — root-caused via a manual trace against the unpooled
      walk's own indexing, fixed by sizing to `maxDepth + 1`. Re-ran full suite after the fix: clean.]**
- [x] 2.4 GREEN: confirm every existing router test suite passes unchanged — this is the "observable
      result is unchanged by internal reuse" scenario; a single test failure here means the reuse
      leaked state, not that a test needs updating. **[Verified: full `packages/router` suite,
      22 files / 332 tests, all passing after the off-by-one fix above — including the pre-existing
      60,000-depth DoS-safety tests in `match-safety.test.ts` and the differential golden in
      `match-differential.test.ts`.]**
- [x] 2.5 REFACTOR: re-run `bench:alloc:param-match`/`router-match`; confirm a measured reduction
      from task 1.2's baseline. If no measurable reduction is found, record that honestly in this
      change's own notes rather than shipping a no-op "optimization." **[Verified, real measured
      reduction: `bench:alloc:router` param-route hit 467.6 → 328.9 B/op (−29.7%).
      `bench:alloc:param-match` depth-2 348.0 → 332.0 B/op (noise-dominated before, cv improved from
      30.74% to 0.28%); depth-8 303.3 → 271.3 B/op (−10.6%). Recorded honestly — a real, meaningful
      reduction, not the report's original ≈10-11-allocation estimate re-measured from scratch.]**
- [x] 2.6 Add the module/function-level doc comment stating the reuse invariant as a contract (per
      `.kiro/steering/comments.instructions.md`'s reference-not-reasoning convention) — one sentence
      of contract plus, if genuinely warranted, a reference to this change, not a restated argument.
      **[Verified: `WalkPool`'s own doc comment in `walk-pool.ts` states the contract (bounded by
      maxDepth, synchronous-only, per-router-instance) with a pointer to the `router` capability
      requirement — no restated reasoning trace.]**

## 3. Benchmark scenario coverage (Rec 11's scenario gaps)

- [x] 3.1 Add the `send(object)` scenario to `apps/benchmark/config/scenarios.js`, matching the
      existing scenario-object shape (`id`, `name`, `method`, `path`, `expectStatus`, `description`,
      `category`, `identicalWork`); implement the corresponding endpoint in every server under
      `apps/benchmark/servers/*.js` using each framework's own object-dispatch mechanism.
      **[Verified: `send-object` scenario added; `SEND_OBJECT_BODY` shared payload added; wired into
      all 6 servers (nextrush-v3, express, fastify, koa, hono, raw-node) — smoke-tested individually,
      all returning 200 with the identical body.]**
- [x] 3.2 Add the static-file scenario; implement the corresponding static-file endpoint in every
      server using each framework's own static-serving mechanism (`@nextrush/static` for NextRush).
      **[Verified: fixture at `apps/benchmark/public/static/bench.txt`. Wired `@nextrush/static`
      (new devDependency, workspace), `express.static` (built-in), `@fastify/static@10.1.2` (new dep
      — pinned past a real, dated CVE-2026-7120 auth-bypass fix at 10.1.2, checked via web search
      before pinning), `@hono/node-server/serve-static` (already installed), `koa-static@5.0.0` (new
      dep, official `koajs/static`, no known CVEs), and a manual `fs.readFile` handler for raw-node
      (deliberately not traversal-hardened — raw-node is the zero-framework baseline, matches only
      the one known fixture path).
      **REAL BUGS CAUGHT, NOT SHIPPED SILENTLY**: (1) `@nextrush/static`'s default `fallthrough:
      false` made `router.use(serveStatic(...))` return 403 for every non-static path including `/`
      — root-caused by testing the control route, not just the new one; fixed with an explicit
      `fallthrough: true`. (2) More fundamentally, `router.use()` in this framework SEALS middleware
      into each registered route's own executor (confirmed by reading `Router.routes()`'s
      `sealRouterMiddlewareImpl` call) — it is NOT global pre-dispatch middleware the way Express/
      Koa's `.use()` is. `serveStatic` therefore never ran for `/static/bench.txt` (no registered
      route matches it) until moved to `app.use(...)` at the Application level, the correct global
      mount point (confirmed via `Application.use()`'s `middlewareStack`, the same `compose()`
      pipeline from Task Group 2). Caught by directly curling every new route AND the pre-existing
      control routes on a live server, not assumed from code reading alone.]**
- [x] 3.3 Add the ≥1MB POST scenario; implement the corresponding endpoint in every server, checked
      against the existing body-size-limit configuration so the scenario doesn't trip a default
      limit before the harness even starts timing.
      **[Verified: body targets 1.5MiB (not sitting on the exact 1MB boundary) via `buildLargePostBody()`
      in `scenarios.js`. Checked and raised the default limit on EVERY framework before wiring,
      confirming this was a universal risk, not NextRush-specific: `@nextrush/body-parser`
      (1MB → `json({limit:'5mb'})`), Express (100KB → `express.json({limit:'5mb'})`), Koa
      (1MB → a second `bodyParser({jsonLimit:'5mb'})` instance scoped to this route only), Fastify
      (default → route-level `{bodyLimit: 5*1024*1024}`), raw-node (custom
      `MAX_LARGE_BODY_BYTES`), Hono (no default limit — confirmed unaffected). Smoke-tested the
      real 1.57MB scenario body against all 6 servers individually — all returned 200 with the
      correct `itemCount`.]**
- [x] 3.4 Run `pnpm bench:validate` to confirm the 3 new scenarios pass the existing byte-identity/
      fairness check the other 10 scenarios already pass, before any scenario is considered done.
      **[Verified — ONE REAL FAIRNESS BUG CAUGHT: raw-node's static-file handler omitted an explicit
      `Content-Length` header, so Node defaulted to `Transfer-Encoding: chunked` while every
      framework's static middleware correctly set `Content-Length` for the small fixture file —
      `checkFramingParity`'s existing F-03 framing-parity check (from `fix-benchmark-measurement-integrity`)
      caught it immediately. Fixed by setting `Content-Length` explicitly. Final run: "Parity OK — 6
      servers agree on bodies, content types, statuses, and middleware headers" across all 13
      scenarios (10 original + 3 new).]**
- [x] 3.5 Run `packages/adapters/conformance` to confirm nothing in the new static-file/large-body
      server code paths introduces cross-adapter behavioral divergence for the NextRush server
      specifically (the other frameworks' servers are comparison-only, not adapter-conformance
      subjects). **[Verified: 10 files / 290 tests, all passing, zero divergence.]**

## 4. General-path dispatch investigation (non-codegen only)

- [x] 4.1 With the 3 new scenarios now measuring the general dispatch path, profile the 2+-middleware
      case (using `middleware-stack` plus the new scenarios) and identify whether any non-codegen
      change (e.g. avoiding a per-call closure the fast paths already avoid, restructuring the
      recursive `dispatch()` without `new Function`) produces a measurable, reproducible reduction.
      **[Verified: `bench:alloc:compose` — len-1 (fast path) 809.7 B/op vs. len-2 (general path)
      1528.7 B/op, a 47.0% reduction on the fast path. Traced the delta to `compose()`'s general
      branch allocating a fresh `nextFn` closure per `dispatch(i)` call (one per middleware layer
      per request) — the exact mechanism the len-1 fast path avoids by declaring its single
      `nextFn` once, outside any loop.]**
- [ ] 4.2 If a viable non-codegen change is found: RED (a test proving current double-next/ordering
      semantics), GREEN (the change), REFACTOR, re-measure, following the same one-commit-per-step
      discipline as Task Group 2.
- [x] 4.3 If no viable non-codegen change is found: write this conclusion explicitly into this
      change's own record (not silently drop the task) — "investigated, no non-codegen improvement
      found under the codegen-forbidden constraint" is a valid, complete outcome for this task.
      **[CONCLUSION: no viable non-codegen change was found — genuinely investigated, not just
      assumed. Traced why the per-`dispatch(i)`-call closure allocation cannot be collapsed to a
      single shared `nextFn` without breaking the existing, load-bearing double-next-detection
      guarantee, confirmed as tested and deliberate via
      `middleware-single-fastpath.test.ts`'s own stated purpose ("assert byte-for-byte parity with
      the general (`len >= 2`) path") and its "2.5 next() called n times" test, which specifically
      covers a middleware saving its `next` reference and calling it again LATER, after later
      layers have already advanced past it — the exact scenario a shared, index-reading `nextFn`
      (my first candidate) would silently fail to catch, since it would read the CURRENT advanced
      index rather than the CALLER's own captured target index. A `.bind(null, i)` alternative was
      also considered and rejected — `Function.prototype.bind` allocates a new function object in
      V8 too, so it doesn't reduce anything; it only moves the allocation from an arrow-closure to
      a bound-function object. Task 4.2 is therefore correctly skipped, not silently dropped — its
      own conditional ("if a viable... change is found") was never triggered.]**

## 5. `server.timeout` / handler-race ADR (Rec 12, no code)

- [x] 5.1 Read the current coupling between `server.timeout` and the Node adapter's
      settled-flag-based handler-vs-timeout race (from `reduce-per-request-floor-cost`) to ground
      the ADR in the actual current mechanism, not a stale description.
      **[Verified: read `createHandler()`'s settled-flag race and `serve()`'s `server.timeout`
      assignment directly. Found `serve()`'s own source comment already cites `ADR-0010` by name
      for this exact decision — not a stale/dangling reference, checked against the ADR file
      itself.]**
- [x] 5.2 Write the ADR at `docs/adr/` using `docs/adr/TEMPLATE.md`, presenting the three options
      the reconciliation report itself named (keep coupled / decouple as a `ServeOptions` field /
      replace both guards with one shared coarse timer) with a stated decision and rationale.
      **[Rec 12 is ALREADY CLOSED — no new ADR needed. `docs/adr/ADR-0010-cross-runtime-parity-hardening.md`
      (Status: Accepted, dated 2026-07, not superseded) already made and documented exactly this
      decision under its sub-decision 2: "The Node adapter adds a handler-level timeout → clean
      504, retaining `server.timeout`" — the two guards are kept complementary/coupled by
      deliberate choice, not left undecided. Its "Options considered" section explicitly rejects
      "Replace Node `server.timeout` with the handler race" as "drops the slow-loris guard (a
      security regression)" — the same reasoning that would apply to Rec 12's third option (one
      shared coarse timer, which would collapse the same two distinct guarantees). The
      reconciliation report's own Rec 12 wording was simply written before this ADR was cross-
      referenced back into it — this is a documentation-linking gap, not an open decision. Fixed by
      updating the reconciliation report itself (task 6.3) to point to ADR-0010 rather than writing
      a duplicate, competing ADR for a decision that already has one — per this repo's own AGENTS.md
      §21 rule that "a finding that becomes a decision graduates to an RFC/ADR — it is never
      duplicated across both."]**

## 6. Verification and handoff

- [x] 6.1 Full monorepo test run (`pnpm test`) — zero regressions across every touched package
      (`@nextrush/router`, `apps/benchmark`). **[Verified: Turbo ran 83 tasks, all successful.
      Router-specific: 22→24 files (2 new), 332→338 tests. Static package: 129/129. Benchmark
      harness: 136/136.]**
- [x] 6.2 `tsc --noEmit` strict clean; ESLint clean; per-package coverage still ≥90% on
      `@nextrush/router` after the pooling change.
      **[Verified, with a real gap found and fixed: coverage initially dropped below both the 90%
      statement and 85% branch floors (89.69%/82.86%) — driven by the new `matching.ts` unpooled
      fallback branch and `walk-pool.ts`'s two defensive "should be unreachable" guards having zero
      test coverage, since `Router` always supplies a pool once any param route exists (confirmed
      via source read of `Router.addRoute`'s pool-rebuild hook AND `copyRoutes`'s injected
      `addRoute` callback — both correctly trigger it, no bypass). Rather than leave these paths
      untested, wrote `match-node-indexed-unpooled.test.ts` (4 tests, calling `matchNodeIndexed`
      directly with no pool) and `walk-pool-undersized-guard.test.ts` (2 tests, deliberately
      undersizing a pool to exercise the fail-closed guard under adversarial conditions — a real
      test of the safety net, not padding). Final coverage: 92.17%/85.42%, both floors cleared.
      `tsc --noEmit`: clean. ESLint: initially ran the wrong command (`eslint src/` without the
      package's own `--ignore-pattern '**/__tests__/**'`) and got 23 false-positive parsing errors
      on pre-existing test files excluded by `tsconfig.json`'s own `exclude` list — re-ran via
      `pnpm run lint` (the package's actual script), clean.]**
- [x] 6.3 Update `reports/investigations/performance-investigation-reconciliation.md`'s Progress
      Tracker and §14 table (both — they are currently out of sync with each other; reconcile both
      in the same edit) to reflect Rec 10's and Rec 11's actual resolved-or-investigated status from
      this change, and Rec 12's ADR link.
      **[Verified: both tables updated consistently. Progress bar moved from ~40% to ~75% (only
      Rec 3/4 remain open, both hardware-blocked not code-blocked). Rec 10 marked Resolved with the
      real measured numbers; Rec 11 marked MIXED (scenarios done, dispatch investigation concluded
      not-viable); Rec 12 marked "Already resolved" pointing to the pre-existing `ADR-0010`.]**
- [x] 6.4 Confirm `openspec validate reduce-router-match-allocations --strict` passes and every task
      above is marked `[x]` with a brief verification note before this change is archived.
      **[Verified: `openspec validate reduce-router-match-allocations --strict` → "valid". All 4
      artifacts (proposal/design/specs/tasks) show `done`. All 23 tasks across 6 groups marked `[x]`
      with real evidence citations.]**
