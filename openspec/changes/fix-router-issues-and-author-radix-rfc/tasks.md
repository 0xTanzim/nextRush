## 1. Router documentation accuracy (lowest-risk, highest-value — ships first per design.md D1)

- [x] 1.1 Fix `packages/types/src/router.ts` header: replace "The router uses a radix tree for
      efficient route matching" with an accurate segment-trie description (this is the only
      remaining `radix` token in any `.ts` file, confirmed via repo-wide grep).
      <!-- DONE: header now reads "segment trie keyed by whole path segments, O(k) where k = number of path segments"; no `radix` token introduced. -->
- [x] 1.2 Fix `packages/router/README.md`: remove/rewrite the "Radix Tree Algorithm" heading and
      the "The radix tree router provides" section so the README describes a segment trie
      consistently end-to-end, matching its own opening line.
      <!-- DONE: heading → "Segment Trie Algorithm"; "The radix tree router provides" → "The segment trie router provides". Only remaining README `radix` is the intentional opening contrast ("not a compressed radix tree"). -->
- [x] 1.3 Fix `packages/router/src/segment-trie.ts`'s `TrieNode.children` JSDoc: it says "keyed
      by first character" but the code keys by whole segment (`children.get(segment)`) — correct
      it to describe whole-segment keying.
      <!-- DONE: verified whole-segment keying in matching.ts:130 (matchNodeIndexed) + registration.ts:107 (addRoute); JSDoc now "Static child nodes keyed by whole path segment ... not the first character". -->
- [x] 1.4 Verify: `grep -ri radix packages/router/src packages/types/src` returns zero matches
      (or only an explicitly historical changelog reference). Reread the README end-to-end for
      internal consistency.
      <!-- DONE: `grep -rni radix packages/router/src packages/types/src` → exit 1, ZERO matches. README reread end-to-end: only the intentional "not a compressed radix tree" contrast line remains; no self-contradiction. -->

## 2. Resolve internal duplications (per design.md D3)

- [x] 2.1 Extract `EMPTY_PARAMS` to a single internal leaf module (e.g.
      `packages/router/src/constants.ts` or similar) imported by both `router.ts` and
      `match-route.ts` — a leaf constant has no import cycle, so the cycle concern the current
      comments cite is resolvable. Remove both local definitions.
      <!-- DONE: created leaf `packages/router/src/constants.ts` (imports nothing → cycle
      impossible by construction) exporting EMPTY_PARAMS; `match-route.ts` now imports it.
      DISCREPANCY vs audit premise: EMPTY_PARAMS was defined ONCE, not twice — only in
      `match-route.ts` (grep + graph confirmed: router.ts neither defines nor uses it; the T014
      split already removed the router.ts copy). Removed the sole def + its stale "also defined
      in router.ts / dodges an import cycle" comment. Frozen-null-prototype semantics identical
      (`Object.freeze(Object.create(null))`). Did NOT add an unused import to router.ts (it has
      no EMPTY_PARAMS reference), so only match-route.ts imports the shared constant today. -->
- [x] 2.2 Consolidate the two path-normalization sites (`matchRoute` in `match-route.ts` vs
      `findAllowedMethods` in `matching.ts`) into one shared internal helper both call, so the
      query-strip/lowercase/`//`-collapse/trailing-slash logic has a single definition.
      <!-- DONE: added shared `normalizePathForMatch(path, caseSensitive, strict)` in
      `matching.ts` (lowercase + //-collapse + trailing-slash); both matchRoute and
      findAllowedMethods call it. Query-strip kept caller-specific in matchRoute — confirmed
      intentional: findAllowedMethods receives an already-query-free ctx.path. matchRoute's
      case-preserving `originalPath` reuses the helper with caseSensitive=true. Behavior
      identical (212 tests green, incl. case-insensitive param-case preservation).
      NOTE (out of scope, flagged not touched): a THIRD method `Router.normalizePath` (router.ts)
      shares the //-collapse+trailing-slash mechanics but is a separate registration-time concern
      (prefix-join + leading-slash ensure + never case-folds) — correctly outside D3's named
      2-site scope and inside section 3's file; left untouched. -->
- [x] 2.3 Investigate the redundant `hasParams` post-match loop in `matchRoute`: determine
      whether it's truly redundant given `matchNodeIndexed`'s backtrack deletion. Simplify/remove
      ONLY if the existing test suite (including param-backtracking edge cases) proves it
      behavior-preserving. If any doubt, leave it and add a comment documenting why it's retained.
      <!-- DONE: RETAINED-WITH-REASON (one-line WHY comment added in matchRoute). Analysis: the
      `deleteProperty` branch is defensive, not functional — matchNodeIndexed only ever assigns
      string param values and deletes its own keys on backtrack, so no undefined-valued key can
      survive a successful match; the loop's LIVE purpose is computing `hasParams` to return the
      shared frozen EMPTY_PARAMS sentinel vs an allocated object. Removal buys nothing (Object.keys
      runs regardless to decide hasParams) while dropping the guard, and hot-path rewrites are
      deferred to the radix RFC benchmark (design.md D4). Full suite incl. router-edge-cases.test
      + param-decoding backtracking green — but retained per D3's "do not remove defensive code on
      a hunch" since removal has no upside. -->
- [x] 2.4 Verify: full `@nextrush/router` test suite green after each dedup; the router's
      public-surface snapshot unchanged (dedup is internal only).
      <!-- DONE: `pnpm --filter @nextrush/router test` → 212/212 passed across 9 files (router,
      router-edge-cases, router-audit, allowed-methods, param-decoding, route-metadata,
      middleware-pipeline, audit-fixes, public-surface). public-surface.test.ts green → runtime +
      type export set byte-identical (index.ts untouched; new EMPTY_PARAMS/normalizePathForMatch
      are internal, not re-exported from the barrel). typecheck clean, ESLint clean (0 warnings),
      tsup build success. -->


## 3. Finish the `router.ts` split (completes T014 / router-module-size-compliance)

- [x] 3.1 Measure current `router.ts` line count and identify the remaining over-cap clusters
      (registration primitives, any-method/group-route helpers per design.md D2) to extract along
      the same seams the earlier split used — do NOT introduce a new structural pattern.
      <!-- DONE: router.ts measured at 525 lines (over the 300 cap). Read in full; identified the
      extractable clusters along T014's existing seams (all pure-function extractions, NO new
      structural pattern — no mixins/base classes): (a) dispatch/allowed-methods middleware
      generation (routes()/allowedMethods() closures), (b) registration primitives
      (normalizePath, the any-method introspection-row push shared by all()/_pushAnyMethodRouteDefinition),
      (c) match-result assembly (match() → resolveMatch), (d) route-group setup (group() overload
      resolution), (e) trie reset (reset()'s node clearing), (f) router-state construction
      (constructor opts + memoized state struct). Confirmed >1 extraction needed (a single dispatch
      extraction only reached ~477). -->
- [x] 3.2 Characterize first: confirm the clusters being moved have test coverage; add
      characterization tests for any gap BEFORE moving code (refactor-TDD steering).
      <!-- DONE: Captured a GREEN baseline of 212 tests / 9 files BEFORE any move (incl.
      public-surface.test.ts). Confirmed the risk-sensitive seams are already covered — prefix /
      strict / trailing-slash normalization, `.all()`, `.group()`, and isAnyMethod appear across
      router.test.ts, router-edge-cases.test.ts, router-audit.test.ts (56 matches); routes()/
      allowedMethods() in allowed-methods.test.ts + middleware-pipeline.test.ts; reset() in
      audit-fixes.test.ts (RT-1); match()/params in param-decoding.test.ts. NO coverage gap → no
      new characterization test required (all moves are mechanical relocations of existing logic;
      the existing suite IS the characterization, re-run green after every single extraction). -->
- [x] 3.3 Extract one cluster at a time into a focused module, running the full router test suite
      after EACH single extraction.
      <!-- DONE: Extracted incrementally, full @nextrush/router suite (212) GREEN after EACH step:
      NEW dispatch.ts (106 lines: createRoutesMiddleware + createAllowedMethodsMiddleware) 525→477;
      registration.ts (+normalizeRegistrationPath +pushAnyMethodDefinition; Router memoizes the
      shared state struct) 477→442; group-router.ts (+runRouteGroup, also dedups the nested
      GroupRouter.group() overload logic) 442→418; inline sealRouterMiddleware into routes() +
      remove banner-ASCII dividers + trim re-typed @param JSDoc 418→376; match-route.ts
      (+MatchState +resolveMatch, Router.match now a 1-line delegator — matchRoute's own contract
      untouched) 376→366; segment-trie.ts (+clearNode for reset()) + JSDoc compaction 366→325;
      merged the reg/match state structs into one (DRY) 325→319; NEW state.ts (52 lines:
      resolveRouterOptions + createRouterState — thins the constructor) 319→304; final JSDoc
      compaction 304→298. Router stays the public shell delegating to the extracted pure functions.
      Every module ≤300: router.ts 298, dispatch.ts 106, state.ts 52, registration.ts 282,
      match-route.ts 171, group-router.ts 208, segment-trie.ts 195. -->
- [x] 3.4 Verify: `find packages/router/src -name '*.ts' -not -path '*__tests__*' | xargs wc -l |
      awk '$1>300'` returns nothing.
      <!-- DONE: the awk '$1>300' check returns NOTHING (empty). Largest shipping src files:
      router.ts 298, registration.ts 282, group-router.ts 208, matching.ts 196, segment-trie.ts
      195, match-route.ts 171. All ≤300. -->
- [x] 3.5 Verify: public-surface snapshot byte-identical before/after; full router suite green;
      run adapter-level routing integration tests to catch any integration regression.
      <!-- DONE: public surface byte-identical — src/index.ts (the barrel) has an EMPTY git diff and
      public-surface.test.ts is green (runtime exports still exactly {createRouter, endpoint, Router,
      createNode, NodeType, parseSegments}; type-only surface unchanged). New modules dispatch.ts/
      state.ts are internal, NOT re-exported from the barrel. Full @nextrush/router suite 212/212
      green; adapter-node integration 86/86 green (real app+router boot, incl. graceful-shutdown);
      typecheck clean, ESLint clean (0 warnings), tsup build success. NOTE: format:check flags
      index.ts/matching.ts/redirect.ts — PRE-EXISTING prettier drift (all three have an empty git
      diff, untouched by this section); all 7 files THIS section touched are prettier-clean. -->


## 4. Author the radix-package RFC (per design.md D5 + the RFC outline)

- [ ] 4.1 Author `docs/RFC/RFC-NEXTRUSH-ROUTER-RADIX.md` following the existing RFC convention
      (naming + structure of `RFC-NEXTRUSH-ADAPTER-CONTRACT.md`), covering all 9 outline sections
      from design.md: summary/motivation, current state (accurately post-doc-fix), segment-trie
      vs radix tradeoff, the shared `Router` contract (incl. the composition-surface gap), the
      conformance/parity model (modeled on `packages/adapters/conformance`), sequencing
      (contract+conformance first, radix package second), the deferred `Reflect.deleteProperty`
      optimization as measurement-gated, costs/risks (maintenance/bus-factor, docs split,
      default-router positioning), and non-goals/open questions.
- [ ] 4.2 Record the concrete driver for radix (Fastify-migrant familiarity vs. a perf
      hypothesis) in RFC §1/§3 — or carry it as an explicit open question if unresolved, and note
      that T017's benchmark is the evidence gate for both the "why" and the deferred hot-path item.
- [ ] 4.3 Cross-link the RFC from the router README and/or `architecture.instructions.md`'s
      router section if that's this repo's convention for surfacing RFCs (check how existing RFCs
      are referenced before adding a link).

## 5. Cross-cutting

- [ ] 5.1 Run the full repo `pnpm verify` — confirm no regression beyond the known pre-existing
      failures (@nextrush/di#test + @nextrush/class#test circular-dep timeout, @nextrush/dev#lint,
      docs#lint); classify any new failure as a real regression requiring investigation.
- [ ] 5.2 Confirm no file outside this change's declared scope (per proposal.md's Impact section)
      was modified.
- [ ] 5.3 Add a changeset for `@nextrush/router` (patch — internal split + dedup + doc fixes,
      verified non-breaking via surface snapshot) and `@nextrush/types` (patch — doc-comment-only
      correction). No changeset for the RFC (a docs/RFC/ design artifact, not a published-package
      change).
- [ ] 5.4 Update `docs/audits/03-gap-checklist.md` if any of this work maps to an open task
      (the `router.ts` split completion relates to T014's spec; the doc-accuracy work extends
      T002's original scope into `types`) — add Verified: notes citing this change's commits,
      following the checklist's own citation style; do not rewrite original task text.
