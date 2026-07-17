## Context

`router.ts` is a single 918-line file containing one `Router` class (lines 65-902, ~837 lines)
with 30 methods. Read directly via the file's own method list — this is not several unrelated
functions crammed together, it's one class with clear internal thematic clusters:

- **Core state & registration primitives**: `constructor`, `normalizePath`, `addRoute`,
  `getRoutes`, `reset`, `_addGroupRoute`.
- **Public HTTP-verb registration API**: `get`/`post`/`put`/`delete`/`patch`/`head`/`options`/
  `all`/`route`/`redirect`/`group` — the user-facing surface.
- **Composition/mounting**: `use`, `mount`, `mountRouter`, `copyRoutes` — sub-router composition.
- **Matching engine**: `match`, `decodeParam`, `extractSegment`, `matchNodeIndexed`, `findNode`,
  `findAllowedMethods` — the actual segment-trie lookup logic (per
  `architecture.instructions.md`, this is the O(k) lookup the router package exists to provide).
- **Middleware adaptation**: `routes`, `sealRouterMiddleware`, `allowedMethods` — wrapping the
  router as consumable middleware.

This confirms a splittable file, not a monolith with no internal seams — the 300-line ceiling
violation is a real structural smell (one class doing registration + composition + matching +
middleware-adaptation is exactly the "over the size ceiling" symptom `code-structure.md` treats
as a god-object marker), not an arbitrary line-count violation on otherwise-cohesive code.

## Goals / Non-Goals

**Goals:**
- Split `router.ts` into files aligned with the clusters above, each under the 300-line
  ceiling, with zero behavior change (verified via characterization tests + the existing
  public-surface snapshot).
- Fix T015/T016 as small, independent, same-package-family papercuts.

**Non-Goals:**
- Not changing the `Router` class's public API shape (still one `Router` class, still the same
  methods) — this is a file-organization refactor, not an API redesign. Whether the split uses
  mixins, a single class importing helper functions, or multiple classes composed together is a
  design decision to make cautiously (see D1), but the *outward* `Router` contract does not move.
- Not optimizing the matching algorithm itself as part of this split — this is purely structural;
  any algorithmic change to the segment-trie matching is out of scope and would need its own
  characterization-test-first process separately.
- Not touching `TrieNode`/`segment-trie.ts` (already renamed and clean per the earlier
  `fix-dependency-claim-router-naming-coverage-gate` change) — this split is scoped to
  `router.ts` itself.

## Decisions

**D1 — Split via extracted pure functions/helper modules the `Router` class delegates to, not
via multiple inheritance/mixins.**
`engineering-standards.md` prefers composition over inheritance and pure functions where
possible. The matching engine (`match`, `matchNodeIndexed`, `findNode`, `decodeParam`,
`extractSegment`, `findAllowedMethods`) is the most naturally pure-function-extractable cluster —
these operate on the trie structure and inputs, not on broad `Router` instance state beyond the
root node. Extract them into a `matching.ts` module as standalone functions taking the trie root
(and other needed state) as explicit parameters, with the `Router` class's `match()` method
becoming a thin delegating wrapper. Alternative considered: split into multiple classes
(`RouterCore`, `RouterMatcher`, etc.) composed via delegation. Rejected as more ceremony than
needed — plain exported functions are simpler and match this repo's "prefer pure functions"
principle directly, without inventing new class boundaries that don't exist in the current design.

**D2 — Registration methods (`get`/`post`/etc.) stay on the `Router` class itself; only their
shared internals (`addRoute`) extract if `addRoute` itself is large enough to warrant it.**
These are thin, nearly-identical one-liners delegating to `route()`/`addRoute()` — extracting them
into a separate file would fragment a cohesive, small public API across files for no real size
win. Keep them in the main `router.ts` (which becomes the class's "shell" file after the bigger
clusters are extracted).

**D3 — Composition (`use`/`mount`/`mountRouter`/`copyRoutes`) and middleware-adaptation
(`routes`/`sealRouterMiddleware`/`allowedMethods`) each become their own extracted module if,
after D1's extraction, the remaining `router.ts` is still over 300 lines — decide the exact
final file boundaries once the matching-engine extraction's actual line savings are known, rather
than pre-committing to a specific split of the remaining ~400-500 lines before measuring.**
This is deliberately left flexible in design (not tasks) — the concrete file list is a
during-implementation decision informed by real line counts after the first extraction, not a
guess made before touching the code.

## Risks / Trade-offs

- **[Risk]** Any refactor to a file this central (the segment-trie router underlies every
  request in the framework) risks a subtle behavior change even with "pure" extraction.
  → **Mitigation**: Per this repo's TDD steering for refactors — characterize existing behavior
  with tests FIRST if coverage has any gap, before moving code, and run the full router package
  suite (plus any adapter-level integration tests that exercise routing) after each extraction
  step, not just once at the end.
- **[Risk]** Extracting matching logic into standalone functions could change how `TrieNode`'s
  internals are accessed (e.g. if extraction accidentally changes something from a method with
  implicit `this` access to a function requiring explicit parameter threading, a parameter could
  be passed incorrectly).
  → **Mitigation**: Extract one method at a time, running the full test suite after each single
  extraction, rather than moving all matching-engine methods in one large edit.
- **[Risk]** T016's `@All` change (7 rows → 1 row) could break a consumer that specifically
  iterates `getRoutes()` expecting 7 entries per `@All` route (e.g. an OpenAPI generator or route
  introspection tool).
  → **Mitigation**: Search the codebase (`@nextrush/openapi`, any diagnostics/discovery code in
  `@nextrush/class`) for consumers of `getRoutes()`/route introspection before implementing, per
  the proposal's own Impact note — if a real consumer depends on the 7-row shape, that consumer
  needs updating in the same change, not left broken.

## Migration Plan

No runtime/data migration. T014 (router split) ships as its own commit, verified via the
existing public-surface snapshot test showing zero export changes. T015 and T016 ship as their
own separate, small commits — all three are independently revertible.

## Open Questions

- After D1's matching-engine extraction, how many lines remain in the "shell" `router.ts`? This
  determines whether D3's further splits are needed at all, or whether one extraction already
  brings the file under 300 lines. Resolve by measuring during implementation, not guessing here.
