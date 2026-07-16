## 1. T014 — Split `router.ts` (over the 300-line ceiling)

- [x] 1.1 Characterize existing behavior: audit current test coverage for the matching engine
      (`match`, `matchNodeIndexed`, `findNode`, `decodeParam`, `extractSegment`,
      `findAllowedMethods`) — if any code path lacks a test, write one FIRST against current
      behavior, per this repo's refactor-TDD steering, before moving any code.
      **Verified:** audited all 8 existing `__tests__/*.test.ts` files. `match`/`matchNodeIndexed`/
      `extractSegment`/`decodeParam` were well covered (including the malformed-encoding fallback
      branch in `param-decoding.test.ts`). `findNode`/`findAllowedMethods` had a real gap:
      `allowedMethods()` (the public middleware wrapping them) had only one shallow test
      (`typeof === 'function'`), never invoked end-to-end. Added
      `src/__tests__/allowed-methods.test.ts` (8 new tests: OPTIONS/200, unregistered-method/405,
      unknown-path/404-untouched, param/wildcard/nested-static `findNode` branches, non-404
      no-op) against CURRENT behavior before touching any code. 202 → 210 tests, all green.
- [x] 1.2 Extract the matching-engine cluster into `packages/router/src/matching.ts` as standalone
      exported functions per design.md D1, one method at a time — after EACH single extraction,
      run the full router package test suite before extracting the next method.
      **Verified:** extracted in 4 steps, full suite run after each: (1) `decodeParam`+
      `extractSegment` (leaf, no state dep), (2) `matchNodeIndexed` (decode threaded explicitly),
      (3) `findNode`+`findAllowedMethods` (root/caseSensitive/strict threaded explicitly — this
      broke one pre-existing test that called the private `findAllowedMethods` directly via a
      TS/vitest type-check gap; replaced with an equivalent assertion through the public
      `allowedMethods()` middleware, per the poor-test-replacement rule), (4) `match` itself,
      per D1's "thin delegating wrapper" — `Router.match()` is now a ~20-line delegate. All 4
      steps: 210/210 green. `matching.ts` later split further (see 1.3 note) once it approached
      300 lines itself.
- [x] 1.3 Measure `router.ts`'s remaining line count after 1.2's extraction (resolves design.md's
      Open Question). If still over 300 lines, extract the composition cluster
      (`use`/`mount`/`mountRouter`/`copyRoutes`) into `packages/router/src/composition.ts` and/or
      the middleware-adaptation cluster (`routes`/`sealRouterMiddleware`/`allowedMethods`) into
      `packages/router/src/middleware-adapter.ts`, per design.md D3 — decide the exact split
      based on the measured remainder, not a pre-committed guess.
      **Verified (measured, not guessed) — resolves the Open Question with real numbers, but
      the file is NOT yet under 300 lines; see concern below.** Post-D1: 773 lines (design.md's
      "~400-500" estimate was wrong). Extracted composition (`copyRoutes` → `composition.ts`,
      `AddRouteFn` injected since it needs `Router.addRoute`) → 733. Extracted middleware-
      adaptation (`sealRouterMiddleware`'s tree-walk → `middleware-adapter.ts`) → 711. Still far
      over cap, so — beyond D3's two named clusters — also extracted `addRoute` itself into
      `registration.ts` per D2's explicit escape hatch ("only... if `addRoute` itself is large
      enough to warrant it" — it was 116 lines, the highest-complexity function in the file) →
      621. Extracted `redirect()`'s multi-method registration into `registration.ts` too
      (same injected-callback shape as `copyRoutes`) → 551. Trimmed 6 JSDoc `@example` blocks
      that fully duplicated content already in `packages/router/README.md` (measured: 43% of
      the file was comment/JSDoc lines before trimming) → 473. **Final state: `router.ts` is
      473 lines, down from 918 (48% reduction), but still over the 300-line ceiling.** Every
      remaining line is either a required field/constructor, a thin 3-6 line delegating
      wrapper, or JSDoc with no further non-duplicated content to cut — extracting the 9
      HTTP-verb shortcuts (`get`/`post`/etc., D2 explicitly says keep them on `Router`) would
      only save ~45 more lines even if done, nowhere near enough to reach 300, and would need
      the exact ceremony (injected callbacks or a new class boundary) D1 explicitly rejected for
      units this thin. Flagging as a design-basis-was-wrong finding for follow-up rather than
      inventing new ceremony unilaterally — see commit message and summary for detail.
- [x] 1.4 Verify: run the full `@nextrush/router` test suite after every extraction step — zero
      regressions at each step, not just at the end.
      **Verified:** ran after all 9 extraction steps (listed in 1.2/1.3 above), zero regressions
      at every step. One caught-and-fixed regression along the way was a self-inflicted `tsc`
      wrapper-scoping issue (`rtk pnpm --filter` silently ignored the filter and checked a
      different scope, masking a missing `createNode` import for one round-trip) — caught by
      running `vitest` directly and cross-checking with `tsc` invoked directly against
      `packages/router/tsconfig.json`, not through the ambiguous wrapper. Final suite: 210/210.
- [x] 1.5 Verify: run the router package's public-surface snapshot test before and after the
      entire split — confirm the exported symbol set is byte-identical.
      **Verified:** `src/__tests__/public-surface.test.ts` passed unmodified before the split
      (baseline run) and passes unmodified now (final run) — it asserts an exact `toEqual`
      against a hardcoded expected export list (`createRouter`, `endpoint`, `Router`,
      `createNode`, `NodeType`, `parseSegments` + the type-only surface), so passing without any
      edit to the test itself is byte-identical confirmation. None of the 5 new internal files
      (`matching.ts`, `match-route.ts`, `composition.ts`, `middleware-adapter.ts`,
      `registration.ts`) are re-exported from `src/index.ts`.
- [ ] 1.6 Verify: `find packages/router/src -name '*.ts' -not -path '*__tests__*' | xargs wc -l |
      awk '$1>300'` returns none.
      **Not satisfied.** Command returns `473 packages/router/src/router.ts` — see 1.3's note
      for the full accounting of why, and what was tried. Every other source file in the package
      (`matching.ts` 167, `match-route.ts` 140, `composition.ts` 75, `middleware-adapter.ts` 57,
      `registration.ts` 211, `segment-trie.ts` 183, `group-router.ts` 174, `redirect.ts` 97,
      `route-metadata.ts` 68, `index.ts` 34) is comfortably under the ceiling.
- [x] 1.7 Run any adapter-level or cross-package integration tests that exercise routing
      end-to-end (not just the router package's own unit tests) to catch an integration-level
      regression the unit suite might miss.
      **Verified:** ran `@nextrush/core`'s full suite (111 tests incl. `route.test.ts`'s 14
      tests exercising `Application.route()` end-to-end against the refactored `Router`) — all
      green. Ran `@nextrush/adapter-node`'s full suite (86 tests incl. real-HTTP-server
      integration tests in `graceful-shutdown.integration.test.ts`) — all green. No
      integration-level regression across the router → core → node-adapter dependency chain.

## 2. T015 — Actionable `@Body` error when body-parser is missing

- [ ] 2.1 RED: write a failing test in `packages/class/src/__tests__/` (check existing
      param-resolver test file naming first) asserting that a route using `@Body()` with no
      body-parser registered produces an error whose message mentions body-parser / the likely
      fix, not just the generic `MissingParameterError` text.
- [ ] 2.2 Verify RED: run it, confirm it fails because the current error lacks the hint, not for
      an unrelated reason.
- [ ] 2.3 GREEN: update `packages/class/src/binding/param-resolver.ts` to detect the
      "`@Body()` yielded nothing" case specifically and include the remediation hint in the
      thrown error (extending `MissingParameterError` with a more specific message, or a
      dedicated subtype — decide based on how `MissingParameterError` is used elsewhere in the
      codebase, to avoid breaking any existing `instanceof` check).
- [ ] 2.4 Verify GREEN: the new test passes. Run the full `@nextrush/class` test suite — zero
      regressions, including any existing test that asserts on `MissingParameterError`'s current
      shape/message for other (non-body) parameter types.

## 3. T016 — `@All` registers one route, not seven

- [ ] 3.1 Search the codebase for consumers of `getRoutes()` / route-table introspection
      (`@nextrush/openapi`'s route generation, `@nextrush/class`'s diagnostics/discovery code, any
      other in-repo consumer) per design.md's Risk section — confirm whether any consumer assumes
      the current 7-row-per-`@All` shape before changing the registration behavior.
- [ ] 3.2 RED: write a failing test asserting `@All('/x')` (and/or `app.all('/x', handler)`)
      produces exactly one entry in `getRoutes()`, not seven.
- [ ] 3.3 RED: write a failing test (if not already covered by existing tests) asserting all
      standard HTTP methods still correctly match a route registered via `@All`/`app.all`, as a
      regression guard for the matching behavior itself.
- [ ] 3.4 Verify RED: confirm both fail for the right reason against current (7-registration)
      behavior.
- [ ] 3.5 GREEN: change `@All()`'s decorator implementation (`packages/class/src/decorators/routes.ts`)
      and/or the router's `all()` method to register a single ANY-method route entry, per the
      spec's requirement — the exact mechanism (a new "any method" marker on `RouteDefinition`,
      or a special HTTP-method sentinel value the matcher already understands) is a small design
      decision to make during implementation, informed by 1.2's matching-engine extraction (if
      T014 landed first) or the current `router.ts` structure (if not).
- [ ] 3.6 If 3.1 found a real consumer assuming the old shape, update that consumer in this same
      task (per the spec's "no existing route-table consumer breaks" scenario) — do not ship this
      change with a known-broken downstream consumer.
- [ ] 3.7 Verify GREEN: both new tests pass. Run the full `@nextrush/class` and `@nextrush/router`
      test suites — zero regressions.

## 4. Cross-cutting

- [ ] 4.1 Run the full repo `pnpm verify` with all three tasks' changes applied together —
      confirm no interaction effect (e.g. T014's file split changing something T016's
      implementation depends on).
- [ ] 4.2 Confirm no file outside this change's declared scope (per proposal.md's Impact section)
      was modified.
- [ ] 4.3 Add changesets: `@nextrush/router` (patch — internal split, verified non-breaking via
      surface snapshot) and `@nextrush/class` (patch for T015's error-message improvement; note
      whether T016's introspection-output change warrants a different bump level than patch,
      per semver conventions for an observable-but-non-API behavior change — decide during
      implementation based on this repo's existing precedent for similar changes).
- [ ] 4.4 Update `docs/audits/03-gap-checklist.md`: mark T014, T015, T016 ☑ with Verified: notes
      citing this change's commits; recompute the Progress Dashboard's Phase 1 row and Total row.
