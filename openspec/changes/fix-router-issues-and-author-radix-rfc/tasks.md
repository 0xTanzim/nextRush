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

- [ ] 2.1 Extract `EMPTY_PARAMS` to a single internal leaf module (e.g.
      `packages/router/src/constants.ts` or similar) imported by both `router.ts` and
      `match-route.ts` — a leaf constant has no import cycle, so the cycle concern the current
      comments cite is resolvable. Remove both local definitions.
- [ ] 2.2 Consolidate the two path-normalization sites (`matchRoute` in `match-route.ts` vs
      `findAllowedMethods` in `matching.ts`) into one shared internal helper both call, so the
      query-strip/lowercase/`//`-collapse/trailing-slash logic has a single definition.
- [ ] 2.3 Investigate the redundant `hasParams` post-match loop in `matchRoute`: determine
      whether it's truly redundant given `matchNodeIndexed`'s backtrack deletion. Simplify/remove
      ONLY if the existing test suite (including param-backtracking edge cases) proves it
      behavior-preserving. If any doubt, leave it and add a comment documenting why it's retained.
- [ ] 2.4 Verify: full `@nextrush/router` test suite green after each dedup; the router's
      public-surface snapshot unchanged (dedup is internal only).

## 3. Finish the `router.ts` split (completes T014 / router-module-size-compliance)

- [ ] 3.1 Measure current `router.ts` line count and identify the remaining over-cap clusters
      (registration primitives, any-method/group-route helpers per design.md D2) to extract along
      the same seams the earlier split used — do NOT introduce a new structural pattern.
- [ ] 3.2 Characterize first: confirm the clusters being moved have test coverage; add
      characterization tests for any gap BEFORE moving code (refactor-TDD steering).
- [ ] 3.3 Extract one cluster at a time into a focused module, running the full router test suite
      after EACH single extraction.
- [ ] 3.4 Verify: `find packages/router/src -name '*.ts' -not -path '*__tests__*' | xargs wc -l |
      awk '$1>300'` returns nothing.
- [ ] 3.5 Verify: public-surface snapshot byte-identical before/after; full router suite green;
      run adapter-level routing integration tests to catch any integration regression.

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
