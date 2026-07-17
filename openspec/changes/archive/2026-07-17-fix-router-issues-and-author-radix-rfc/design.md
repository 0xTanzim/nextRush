## Context

Deep router audit (2026-07-17) established the matching engine is well-optimized and the open
issues are doc-accuracy, one unfinished split, and small internal duplications. This change fixes
those and authors the radix-package RFC. The audit also surfaced micro-optimizations on the
matching hot path — deliberately deferred here (see D4).

Current architecture (for the RFC's own reference): a 3-layer design —
`match-route.ts` (orchestration: query-strip → normalize → O(1) static Map fast-path → tree-walk
delegation), `matching.ts` (lookup primitives: `matchNodeIndexed`/`findNode`/`decodeParam`), and
`segment-trie.ts` (the `TrieNode` structure + `compileExecutor`, which bakes the middleware chain
into a closure once at registration). The `Router` interface in `@nextrush/types` is the
registration+`routes()`+`match()` contract, and deliberately excludes composition surface
(`group`/`mount`/sub-router `use`) — a fact the RFC must account for.

## Goals / Non-Goals

**Goals:**
- Zero residual "radix" claims in router code/docs; `TrieNode.children` JSDoc matches reality.
- `router.ts` under 300 lines; audit-flagged duplications resolved with behavior preserved.
- A published RFC that makes the future radix package a specified, conformance-gated effort.

**Non-Goals:**
- Not building the radix package (RFC only).
- Not rewriting the matching hot path for the `Reflect.deleteProperty` deopt (D4).
- Not hardening the `Router` interface's *implementation* now — the RFC *specifies* what the
  hardened contract should be, but changing the shipped interface is future work the RFC gates,
  not this change's job (that would be a public-API change subject to its own RFC-approval step).

## Decisions

**D1 — Doc-accuracy fixes are the highest priority and ship even if the split/dedup slip.**
The doc drift directly seeds the future radix package with wrong reference material; it's also
the lowest-risk, highest-value work. Sequence it first so it lands regardless of how the
structural work goes.

**D2 — The `router.ts` split completes T014's approach (extracted pure functions), not a new one.**
`improve-router-modularity` already extracted the matching engine, composition, and
middleware-adapter clusters. The remaining ~225 over-cap lines are further extraction along the
same seams (registration primitives, the any-method/group-route helpers). Do NOT introduce a
different structural pattern (mixins, base classes) — consistency with the already-landed split
matters more than a marginally cleaner boundary. Characterize-then-refactor per TDD steering;
verify via the public-surface snapshot that exports are byte-identical.

**D3 — Duplications: fix the safe ones, justify or defer the risky one.**
- `EMPTY_PARAMS` (dup'd in `router.ts` + `match-route.ts`): extract to a single internal module
  both import. The import-cycle concern the comments cite is resolvable — a leaf constant module
  has no cycle. This is a clean, safe DRY fix.
- Two path-normalization sites (`matchRoute` vs `findAllowedMethods`): consolidate into one
  shared internal helper so the normalization logic has one definition. Behavior-preserving;
  verify both matching paths still pass their existing tests.
- The redundant `hasParams` post-loop in `matchRoute`: this one is behavior-sensitive (it
  interacts with `matchNodeIndexed`'s backtrack deletion). Simplify **only** if the existing test
  suite — including param-backtracking edge cases — proves it behavior-preserving. If any doubt,
  leave it and document why it's kept. Do not remove defensive code on a hunch.

**D4 — The `Reflect.deleteProperty` hot-path optimization is deferred to the RFC + a benchmark,
not done here.**
`matchNodeIndexed` deletes params from an object on backtrack; deleting props deopts V8's hidden
class. A pair-array-then-materialize approach could avoid it. BUT: this is the single most-executed
function in the framework, this repo's own steering says "measure before optimizing" and "never
sacrifice API clarity for insignificant performance gains" (`AGENTS.md` §11,
`engineering-standards.md`), and bundling a speculative hot-path rewrite into a docs+split cleanup
mixes a trivial-risk change with an expert-risk one (violating change-hygiene: one concern per
change). Capture it in the RFC as a measurement-gated design item — T017's benchmark decides
whether it's worth doing at all, and whether the radix package should adopt the pair-array
approach from the start. This is the disciplined call, not a punt.

**D5 — The RFC is modeled structurally on `RFC-NEXTRUSH-ADAPTER-CONTRACT` + the adapter-conformance
precedent.**
The strongest argument for a second router package is that the repo *already* runs this exact
pattern for adapters: many implementations of one contract, parity-enforced by
`packages/adapters/conformance`. The RFC makes this explicit: the hardened `Router` interface is
the contract, a new `packages/router/conformance` (run against BOTH routers) is the parity gate,
and the segment-trie router is characterized by that suite first so the radix package has a
behavioral spec to match. The RFC must also state the honest costs: doubled maintenance against a
single-maintainer project (per T059's bus-factor finding), and that segment-trie stays the default
with radix opt-in for a stated reason (Fastify-migrant familiarity and/or a benchmarked win), never
a coin-flip forced on users.

## RFC outline (what `RFC-NEXTRUSH-ROUTER-RADIX.md` must contain)

1. **Summary & motivation** — why a second router; the concrete driver (to be filled from the
   user's actual reason: Fastify parity vs. measured perf).
2. **Current state** — the segment-trie architecture (accurately described, post-doc-fix).
3. **Segment-trie vs radix tradeoff** — honest, evidence-anchored (defer hard numbers to T017).
4. **The shared contract** — what the `Router` interface must guarantee for a package to be a
   conformant NextRush router; the composition-surface gap (`group`/`mount`) and how radix handles it.
5. **Conformance/parity model** — the `packages/router/conformance` suite, run against both.
6. **Sequencing** — contract hardening + conformance harness FIRST (characterize segment-trie),
   radix package SECOND.
7. **Deferred optimizations** — the `Reflect.deleteProperty`/pair-array consideration (D4).
8. **Costs & risks** — maintenance/bus-factor, docs split, default-router positioning.
9. **Non-goals & open questions.**

## Risks / Trade-offs

- **[Risk]** Finishing the split touches the request-critical router again, soon after
  `improve-router-modularity` did.
  → **Mitigation:** public-surface snapshot before/after + full router suite + adapter-level
  routing integration tests; extract one cluster at a time.
- **[Risk]** Removing the `hasParams` loop or merging normalization sites silently changes a
  param-edge-case behavior.
  → **Mitigation:** D3 gates both on the existing test suite proving behavior preservation; the
  `hasParams` loop stays untouched if there's any doubt.
- **[Risk]** The RFC over-commits NextRush to building radix.
  → **Mitigation:** an RFC is a design artifact, not a build commitment; it explicitly gates the
  package on a concrete driver + T017 evidence, and can land as "accepted, deferred."

## Migration Plan

No runtime migration. Ship in risk order: (1) doc fixes, (2) dedup, (3) finish split — each
independently revertible and snapshot-verified — then (4) author the RFC. The RFC changes no code.

## Open Questions

- The concrete driver for radix (Fastify-migrant familiarity vs. a perf hypothesis) — needed to
  fill RFC §1 and §3. Carried as an open question in the RFC itself if unresolved at authoring time.
