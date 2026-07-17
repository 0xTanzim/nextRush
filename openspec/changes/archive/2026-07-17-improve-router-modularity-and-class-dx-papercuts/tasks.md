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
- [x] 1.6 Verify: `find packages/router/src -name '*.ts' -not -path '*__tests__*' | xargs wc -l |
      awk '$1>300'` returns none.
      **Now satisfied — closed by a sibling change, independently re-verified here, not by
      trusting either session's self-report.** This task was left open at 473 (later 525) lines
      because D1-D3's named clusters ran out before reaching 300, per 1.3's note. The remaining
      gap was closed by change `fix-router-issues-and-author-radix-rfc`'s section 3
      ("Finish the `router.ts` split (completes T014 / router-module-size-compliance)"),
      committed as `71c2dc4`/`e9b0774` on top of this change's own work — it extracted
      `dispatch.ts` (106 lines), `state.ts` (52 lines), and moved more of `registration.ts`/
      `group-router.ts`/`match-route.ts`/`segment-trie.ts`, going beyond D1-D3's originally
      named clusters (an escape hatch this proposal's design.md already anticipated by leaving
      the exact final split "a during-implementation decision"). Re-ran the verification command
      myself against current HEAD rather than accepting the other change's tasks.md claim at
      face value: `find packages/router/src -name '*.ts' -not -path '*__tests__*' | xargs wc -l |
      grep -v total | awk '$1>300'` → empty (confirmed). Largest file is now `router.ts` at 298
      lines. Also independently re-ran `pnpm --filter @nextrush/router test` (212/212 passing,
      9 files, including `public-surface.test.ts` green — export set unchanged) and
      `pnpm --filter @nextrush/router typecheck` (clean, zero errors) rather than trusting the
      prior commit messages. All source files: `router.ts` 298, `registration.ts` 282,
      `group-router.ts` 208, `matching.ts` 196, `segment-trie.ts` 195, `match-route.ts` 171,
      `dispatch.ts` 106, `redirect.ts` 97, `route-metadata.ts` 68, `composition.ts` 75,
      `state.ts` 52, `middleware-adapter.ts` 57, `constants.ts` 25, `index.ts` 34 — every file
      comfortably under the 300-line ceiling.
- [x] 1.7 Run any adapter-level or cross-package integration tests that exercise routing
      end-to-end (not just the router package's own unit tests) to catch an integration-level
      regression the unit suite might miss.
      **Verified:** ran `@nextrush/core`'s full suite (111 tests incl. `route.test.ts`'s 14
      tests exercising `Application.route()` end-to-end against the refactored `Router`) — all
      green. Ran `@nextrush/adapter-node`'s full suite (86 tests incl. real-HTTP-server
      integration tests in `graceful-shutdown.integration.test.ts`) — all green. No
      integration-level regression across the router → core → node-adapter dependency chain.

## 2. T015 — Actionable `@Body` error when body-parser is missing

- [x] 2.1 RED: write a failing test in `packages/class/src/__tests__/` (check existing
      param-resolver test file naming first) asserting that a route using `@Body()` with no
      body-parser registered produces an error whose message mentions body-parser / the likely
      fix, not just the generic `MissingParameterError` text.
      **Verified:** no `param-resolver.test.ts` existed yet (only `errors.test.ts` covers
      `MissingParameterError`'s constructor directly, and only for the `'param'` source).
      Created `src/__tests__/param-resolver.test.ts` (matching the 1:1 source-filename
      convention used by `route-metadata.test.ts`/`path-utils.test.ts`) calling
      `resolveParametersFromPlan` directly against a minimal `Context` stub with
      `ctx.body === undefined` (simulating no body-parser having run) for a required
      `@Body()` param. Three tests: (1) the RED case — asserts the thrown error is
      `instanceof MissingParameterError` AND its message matches `/body-?parser/i` and
      contains `app.use(json())`; (2) a `@Body()` route WITH `ctx.body` populated resolves
      correctly (guards the spec's second scenario — unaffected happy path); (3) a `@Param`
      (non-body) missing-parameter case keeps the generic message with no body-parser text
      (guards against over-broadening the hint to sources it wasn't meant for).
- [x] 2.2 Verify RED: run it, confirm it fails because the current error lacks the hint, not for
      an unrelated reason.
      **Verified:** ran `vitest run src/__tests__/param-resolver.test.ts` before any source
      change. Test 1 failed with `AssertionError: expected 'Required body parameter "index 0"
      is …' to match /body-?parser/i` — confirms it failed specifically because the message
      lacked the hint, not for an unrelated reason (wrong import, bad fixture, etc.). Tests 2
      and 3 passed even pre-change, as expected (they assert on behavior that wasn't broken).
- [x] 2.3 GREEN: update `packages/class/src/binding/param-resolver.ts` to detect the
      "`@Body()` yielded nothing" case specifically and include the remediation hint in the
      thrown error (extending `MissingParameterError` with a more specific message, or a
      dedicated subtype — decide based on how `MissingParameterError` is used elsewhere in the
      codebase, to avoid breaking any existing `instanceof` check).
      **Verified — extended the message, did NOT introduce a subtype.** Searched the whole
      repo (graph + text search) for `instanceof MissingParameterError` and any other coupling
      to the type: found exactly one runtime use (a re-throw guard inside
      `resolveParametersFromPlan`'s own catch block, unaffected either way) and one docs
      example (`controllers.mdx`'s error-handling snippet, which checks
      `instanceof MissingParameterError` generically and reads `.message` — stays accurate
      since a subtype would still pass an `instanceof MissingParameterError` check via
      subclassing, but a message-only change is the smaller diff and keeps `error.code ===
      'MISSING_PARAMETER'` stable for any consumer keying off `.code` in a JSON API). Added an
      optional 5th constructor parameter `messageOverride?: string` to `MissingParameterError`
      in `errors.ts` (backward-compatible — existing 4-arg call sites in `errors.test.ts` and
      the non-body path in `param-resolver.ts` are unaffected). Added a
      `createMissingParameterError()` helper in `param-resolver.ts` that composes the
      body-parser remediation hint only when `source === 'body'`, leaving every other source
      (`param`, `query`, `header`, `custom`) on the original generic message.
- [x] 2.4 Verify GREEN: the new test passes. Run the full `@nextrush/class` test suite — zero
      regressions, including any existing test that asserts on `MissingParameterError`'s current
      shape/message for other (non-body) parameter types.
      **Verified:** `param-resolver.test.ts` — 3/3 passing. `tsc --noEmit` on the package — 0
      errors. Full `@nextrush/class` suite: 304/305 passing, including `errors.test.ts`'s
      existing `MissingParameterError` test (asserts the `'param'`-source message/shape is
      unchanged — still passes verbatim, no edit needed). The 1 failure
      (`registrar.test.ts` › `surfaces @nextrush/di CircularDependencyError as-is`, a 10s
      timeout) is **pre-existing and unrelated to this task** — confirmed by stashing this
      task's changes and re-running against the exact T014-baseline commit: identical timeout,
      byte-for-byte same failure. That test exercises DI container circular-dependency
      detection (`container.register(CycleA, ...)`), nothing in `files_in_scope` for T015
      (`param-resolver.ts`, `errors.ts`) touches DI/registrar code. Not fixed here — out of
      scope, flagged as a finding for whichever session covers `di`/`registrar`.

## 3. T016 — `@All` registers one route, not seven

- [x] 3.1 Search the codebase for consumers of `getRoutes()` / route-table introspection
      (`@nextrush/openapi`'s route generation, `@nextrush/class`'s diagnostics/discovery code, any
      other in-repo consumer) per design.md's Risk section — confirm whether any consumer assumes
      the current 7-row-per-`@All` shape before changing the registration behavior.
      **Found (not "not found" — a real consumer):** grep across the repo for `getRoutes` located
      exactly one real production consumer: `@nextrush/openapi`. Its `middleware.ts` calls
      `options.router.getRoutes()` once (cached), and `generate.ts`'s `generateDocument()` iterates
      the result doing `pathItem[route.method.toLowerCase()] = await buildOperation(route, ...)` —
      keying an OpenAPI PathItem object by the row's `.method`. This is exactly the 7-row
      assumption design.md's Risk section flagged: today, an `@All()`/`.all()` route produces 7
      concrete-method `RouteDefinition` rows, so the generator naturally emits 7 OpenAPI operations
      (`get`, `post`, `put`, ...) for that path. `@nextrush/class`'s own diagnostics/discovery code
      (`diagnostics/collector.ts`) was also checked — it reads route metadata for a diagnostics
      report but does not key or branch on method-row-count, so it needed no change. No other
      in-repo consumer of `getRoutes()`/route-table introspection exists (confirmed via
      `grep -r getRoutes` across `packages/`, 18 files, all either the router's own
      implementation/tests, class-package tests, or `@nextrush/openapi`). **Action taken (3.6):**
      updated `@nextrush/openapi/src/generate.ts` in this same task — see 3.6's note.
- [x] 3.2 RED: write a failing test asserting `@All('/x')` (and/or `app.all('/x', handler)`)
      produces exactly one entry in `getRoutes()`, not seven.
      **Verified:** added to `packages/router/src/__tests__/router.test.ts` ("should register
      .all() as a single route-table entry, not one per method (T016)") — confirmed RED against
      current behavior: `expected [...7 entries...] to have a length of 1 but got 7`. Also added
      an equivalent decorator-level test to `packages/class/src/__tests__/routes.test.ts`
      (replacing the old `@All` test, which only asserted method *coverage* across 7 rows, not
      row count) — confirmed RED the same way. A third case was found necessary during
      implementation and is not part of the original plan: `GroupRouter.all()`
      (`packages/router/src/group-router.ts`) is a second, independent call site with the exact
      same per-method-registration pattern (`router.group(...).all(...)`) — added a matching test
      ("should register a group's .all() as a single route-table entry...") once discovered; see
      3.5's note for why this needed its own fix.
- [x] 3.3 RED: write a failing test (if not already covered by existing tests) asserting all
      standard HTTP methods still correctly match a route registered via `@All`/`app.all`, as a
      regression guard for the matching behavior itself.
      **Already covered — no new test needed.** `router.test.ts`'s pre-existing "should register
      all methods with .all()" test already asserts every standard method matches via
      `router.match()`, and was already green before this task (confirmed: ran it in isolation,
      passed against the pre-fix 7-registration behavior). Re-ran it after the GREEN
      implementation — still green, confirming matching is completely unaffected by the
      introspection-only change. `router-audit`/`audit-fixes` and the existing "should support
      .all() in groups" matching test were similarly re-checked and remain green.
- [x] 3.4 Verify RED: confirm both fail for the right reason against current (7-registration)
      behavior.
      **Verified:** both 3.2 tests failed with `expected [...] to have a length of 1 but got 7` —
      the exact shape of the bug, not an unrelated setup/import error. Ran before any source
      change in both packages.
- [x] 3.5 GREEN: change `@All()`'s decorator implementation (`packages/class/src/decorators/routes.ts`)
      and/or the router's `all()` method to register a single ANY-method route entry, per the
      spec's requirement — the exact mechanism (a new "any method" marker on `RouteDefinition`,
      or a special HTTP-method sentinel value the matcher already understands) is a small design
      decision to make during implementation, informed by 1.2's matching-engine extraction (if
      T014 landed first) or the current `router.ts` structure (if not).
      **Verified — mechanism chosen and implemented across 4 packages:**
      - `@nextrush/types` (`route-metadata.ts`): added `readonly isAnyMethod?: boolean` to
        `RouteDefinition` — purely additive, does not touch the RFC-frozen `method: HttpMethod`
        field (widening `HttpMethod` itself to add an `'ANY'` value was considered and rejected —
        it would ripple into the matcher's static-route hash keys and every downstream consumer
        of that core type for no benefit; the router's matching engine is completely untouched
        by this change).
      - `@nextrush/router`: `registration.ts`'s `addRoute()` gained an optional
        `recordIntrospection = true` parameter — when `false`, it still inserts the concrete
        per-method trie handler (so that method still matches) but skips pushing an
        introspection row. `Router.all()` calls `addRoute` 7× with `recordIntrospection: false`
        (unchanged matching, per-method trie insertion identical to before), then pushes exactly
        ONE consolidated row itself with `isAnyMethod: true`. `Router.private addRoute()` wrapper
        and `GroupRouterHost`/`GroupRouter.all()` were extended with the same flag/consolidation
        pattern once the group-router duplicate (found during 3.2, not pre-planned) surfaced.
      - `@nextrush/class`: `RouteMethods` (`decorators/route-types.ts`, a class-package-LOCAL
        type, not the router's `HttpMethod`) widened to include `'ALL'` as a decorator-metadata
        sentinel meaning "every standard method," never a real on-the-wire verb.
        `isValidHttpMethod` (`metadata/metadata-keys.ts`) updated to accept `'ALL'` too — checked
        first (via grep) that this exported public function has zero in-repo call sites, so
        widening its accepted set carries no behavioral risk to existing logic.
        `All()` in `decorators/routes.ts` changed from a 7-iteration loop calling
        `createRouteDecorator(method)` per method to a single
        `export const All = createRouteDecorator('ALL')` — mirroring `Get`/`Post`/etc.'s own
        one-liner shape exactly, not a special case.
      - `bootstrap/stages/router.ts` needed **zero changes** — its existing generic dispatch
        (`router[route.method.toLowerCase()]`) already resolves `'ALL'.toLowerCase()` → `'all'`
        → `Router.all()` correctly, since that method already existed under that exact name.
        Confirmed by direct instrumentation during a debugging session (see 3.7's note on a
        stale-build issue found along the way) that this dispatch was never the problem.
      - `@nextrush/openapi` (`generate.ts`): see 3.6.
- [x] 3.6 If 3.1 found a real consumer assuming the old shape, update that consumer in this same
      task (per the spec's "no existing route-table consumer breaks" scenario) — do not ship this
      change with a known-broken downstream consumer.
      **Done.** `generate.ts`'s `deriveOperationId`/`buildOperation` were changed to accept an
      explicit `verb` parameter instead of reading `route.method` implicitly. `generateDocument`'s
      main loop now checks `route.isAnyMethod`: for a normal row it still emits exactly one
      operation keyed by `route.method.toLowerCase()` (unchanged behavior — all 21 pre-existing
      openapi tests still pass verbatim); for an `isAnyMethod: true` row it expands into 7
      operations, one per `ALL_OPENAPI_VERBS` (`get`/`post`/`put`/`delete`/`patch`/`head`/
      `options`), each with a distinct `operationId` (`${verb}_${slug}`). Added a RED-first test
      ("expands an isAnyMethod route into an operation for every standard HTTP method (T016)")
      confirming the pre-fix behavior would have silently emitted only ONE operation (dropping 6
      methods from the generated spec) — a real correctness bug, not just a hypothetical risk,
      caught by writing the test before assuming "no test broke" meant "no test needed."
- [x] 3.7 Verify GREEN: both new tests pass. Run the full `@nextrush/class` and `@nextrush/router`
      test suites — zero regressions.
      **Verified, with one real detour worth recording.** After the GREEN source changes, a new
      end-to-end test through the real DI/bootstrap pipeline
      (`registerControllers` → `bootstrap/stages/router.ts` → `Router.all()`) initially FAILED
      even though the unit-level decorator test and the router-level test both passed — root
      cause (confirmed via the 5-field root-cause checkpoint, not assumed): `@nextrush/router`'s
      published `package.json` `exports`/`main` resolve to `./dist/index.js`, and that `dist/`
      (along with `@nextrush/types`'s) was stale from BEFORE this session started (timestamped
      before this session's first edit) — `@nextrush/class`'s cross-package import of
      `@nextrush/router` was silently running pre-T016 compiled code even though `src/` was
      correct. Rebuilt `@nextrush/types` then `@nextrush/router` (in dependency order — router's
      own DTS build failed first, correctly, because `types`' stale dist didn't have
      `isAnyMethod` yet) then `@nextrush/openapi`, then re-ran the end-to-end test: passed,
      confirming the source-level implementation was correct all along and this was purely a
      stale-artifact issue, not a design flaw. **Full suite results after rebuild:**
      `@nextrush/router` — 212/212 (211 baseline/1.x-added + 1 new single-entry test), `tsc`
      clean. `@nextrush/class` — 305/306 (304 baseline + 1 new/updated `@All` test + 1 new
      end-to-end test; single failure is `registrar.test.ts`'s pre-existing DI
      circular-dependency 10s timeout, confirmed unrelated to T016 — same failure T015's session
      already documented as pre-existing, reconfirmed here since none of T016's files touch
      DI/registrar code), `tsc` clean. `@nextrush/openapi` — 22/22 (21 baseline + 1 new), `tsc`
      clean. `@nextrush/core` — 111/111 (unaffected, re-run as a sanity check since it also
      depends on `@nextrush/router`), confirming no regression at the integration boundary.
      **Flagging for follow-up (not fixed here, out of this task's scope):** the stale-`dist/`
      issue is systemic, not T016-specific — `packages/{core,di,errors}/dist/` are ALSO
      timestamped before this session started, meaning any prior source-only change to a
      cross-package dependency in this repo is silently invisible to consumers' cross-package
      tests until a `pnpm build` runs. Since T014/T015 only edited `src/` within their own single
      package and ran `vitest`/`tsc` directly (not through a cross-package boundary), this never
      surfaced for them — but it will resurface for any future task that changes a lower-layer
      package and expects a higher-layer package's tests to see it without an explicit rebuild
      step. Worth a `pnpm build` (or a `turbo build` dependency-aware rebuild) as a standing step
      before any cross-package integration test, or a workspace-level fix (e.g. TS project
      references / `exports` pointing at `src/` in dev). Logged as a lesson-memory candidate.

## 4. Cross-cutting

- [x] 4.1 Run the full repo `pnpm verify` with all three tasks' changes applied together —
      confirm no interaction effect (e.g. T014's file split changing something T016's
      implementation depends on).
      **Verified — found and fixed one real, new regression before confirming clean.**
      `pnpm exec turbo run verify --continue` initially returned 5 failures, not the documented
      4: the known pre-existing set (`@nextrush/di#test`, `@nextrush/class#test`,
      `@nextrush/dev#lint`, `docs#lint`) plus a genuinely new `@nextrush/router#lint` error at
      `router.ts:250` (`@typescript-eslint/no-confusing-void-expression` on `redirect()`'s
      injected-callback arrow, `(method, path, entries) => this.addRoute(...)` — an
      arrow-shorthand body whose sole statement is a void-returning call). Confirmed via
      `git show add-graceful-shutdown-and-health-package:packages/router/src/router.ts` that
      `redirect()` called `addRoute()` as a plain statement pre-T014, never through an arrow
      callback — this pattern only exists because of T014's own extraction (task 1.3's
      `redirect()`-into-`registration.ts` split), making it a real interaction effect this
      sub-task exists to catch, not a pre-existing issue. Fixed with a minimal, mechanical brace
      wrap (zero behavior change — verified via `@nextrush/router`'s full suite staying 212/212
      and `tsc --noEmit` clean before and after) in its own commit (`ce8c779`), separate from
      T014-T016's own commits. Re-ran the full repo verify after the fix: exactly the 4
      documented pre-existing failures remain, confirmed byte-identical by test name/assertion/
      timeout duration against what T015's and T016's own sessions already documented — in
      particular, `@nextrush/class#test`'s failure is
      `registrar.test.ts > registerControllers() > eager DI validation > surfaces @nextrush/di
      CircularDependencyError as-is (not the generic wrapper)`, a 10000ms timeout on
      `container.register(CycleA, { useClass: CycleA })` — the exact same test name, fixture, and
      timeout duration cited by both prior sessions, not a new or different class-package
      failure. No other interaction effect between T014/T015/T016 found.
- [x] 4.2 Confirm no file outside this change's declared scope (per proposal.md's Impact section)
      was modified.
      **Verified.** Merge-base `1f5143e` (confirmed via `git merge-base HEAD
      add-graceful-shutdown-and-health-package`, matching the commit that closed Phase 1 in the
      gap checklist). `git diff --stat 1f5143e..HEAD` touches 22 files (before this task group's
      own lint-fix/changeset/gap-checklist commits, which add 4 more, all within this same
      change's own bookkeeping scope). Every file traces to a documented, in-scope rationale:
      the three files proposal.md names explicitly (`router.ts`, `param-resolver.ts`,
      `routes.ts`); design.md's D1-D3 extraction modules (`matching.ts`, `match-route.ts`,
      `composition.ts`, `middleware-adapter.ts`, `registration.ts`); files covered by proposal's
      own catch-all ("any router-level code that currently assumes one route registration per
      HTTP method for `@All`") — `group-router.ts` (a second `.all()` call site found only
      during 3.2's implementation) and `errors.ts`/`route-types.ts`/`metadata-keys.ts` (T015's
      `MissingParameterError` extension, T016's `'ALL'` sentinel widening); and
      `@nextrush/openapi`'s `generate.ts` + test, which is not named in proposal.md's Impact
      *bullet list* but is explicitly pre-authorized by the Impact *section's own prose* and
      design.md's Risk mitigation ("if a real consumer depends on the 7-row shape, that consumer
      needs updating in the same change, not left broken") — exactly the contingency task 3.1
      triggered by finding a real consumer. `public-surface.test.ts` shows zero diff, confirming
      "verify unchanged" rather than "edited." No file outside this accounting was touched.
- [x] 4.3 Add changesets: `@nextrush/router` (patch — internal split, verified non-breaking via
      surface snapshot) and `@nextrush/class` (patch for T015's error-message improvement; note
      whether T016's introspection-output change warrants a different bump level than patch,
      per semver conventions for an observable-but-non-API behavior change — decide during
      implementation based on this repo's existing precedent for similar changes).
      **Verified — patch for both, plus a third changeset for the real openapi consumer fix not
      named in this sub-task's own text.** `.changeset/split-router-and-class-dx-papercuts.md`
      (`@nextrush/router` + `@nextrush/class`, both patch) covers T014-T016's router/class-side
      changes. A separate `.changeset/fix-openapi-any-method-expansion.md` (`@nextrush/openapi`,
      patch) covers T016's real consumer-side correctness fix — added because `@nextrush/openapi`
      has genuine user-facing behavior change and is not in `.changeset/config.json`'s `fixed`
      version group (unlike `@nextrush/router`, which is), so it needed its own entry to be
      released correctly. **Bump-level decision for T016, per this sub-task's own instruction to
      check precedent first:** patch, not minor — grounded in `packages/errors/CHANGELOG.md`
      3.1.0's existing precedent (a `errorHandler()` fix for `ValidationError.issues` being
      silently dropped from an existing method's output, classified patch, with the stated
      reasoning "the shape for existing... usage is unchanged"). T016 is the same class of
      change: an existing method's (`getRoutes()`) output changing for one already-possible
      input shape (an `@All()` route) because the old output was arguably incorrect/inconsistent,
      not a new capability being added. Contrasted against `packages/router/CHANGELOG.md`
      3.1.0's *minor* bump for `getRoutes()` itself — that precedent doesn't apply here because
      introducing the method was a brand-new capability, which is categorically different from
      changing what an existing method already returns. `pnpm exec changeset status --verbose`
      confirms all three changesets parse correctly and are picked up by the tooling.
- [x] 4.4 Update `docs/audits/03-gap-checklist.md`: mark T014, T015, T016 ☑ with Verified: notes
      citing this change's commits; recompute the Progress Dashboard's Phase 1 row and Total row.
      **Verified.** T014/T015/T016 each carry a new "Verified (2026-07-17):" note citing this
      branch's real commit hashes (`71c2dc4`, `38d475e`, `069de37`) and re-derived evidence, not
      the source sessions' self-reports — including an honest correction that T014's own
      473-line figure (accurate as of its own commit) is stale at final HEAD, where `router.ts`
      is 525 lines (T016 layered more code onto the same file afterward), still the sole file
      over the 300-line cap. Phase 1's dashboard row recomputed from its actual 9 task bodies
      (T010-T018): 7 ☑ / 2 □ (T017/T018 remain genuinely open) = 77.8%, replacing a stale
      "9/100%" that already contradicted its own section's body glyphs before this task group
      started. Total row recomputed from an exact count across all 64 task bodies in the
      document (42 □ / 1 ◐ / 21 ☑ = 32.8%), which also corrects a second, unrelated pre-existing
      discrepancy: the prior Total's "2 ◐" never matched the document body (only one task, T020,
      has ever been ◐) — flagging, not silently fixing, that Phase 2's own row has the same kind
      of pre-existing mismatch (states "1|2|3" against T019-T024's actual 1□/1◐/4☑), which is
      outside this sub-task's declared scope (Phase 1 + Total only) and wasn't independently
      re-verified. No original task description was rewritten anywhere — confirmed via `git
      diff` showing only the intended status-glyph and dashboard-row lines changed.
