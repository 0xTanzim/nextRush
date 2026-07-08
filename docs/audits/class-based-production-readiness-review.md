# NextRush Class-Based Architecture — Production Readiness Gate Review

**Version:** Final · **Mode:** Architecture Approval Review (v1.0 stability gate)
**Reviewer stance:** Final Architecture Review Board (Spring / NestJS / ASP.NET Core / Fastify / Hono maintainer lens)
**Date:** 2026-07-08

> This is a gate review, not a bug hunt. It assumes prior audits (v1, master, strategic v3)
> and the class-consolidation work are complete, and verifies against the current tree.
> Findings are only those that still exist. The tone is deliberately adversarial — praise is
> noted only where it changes a score.

---

# Executive Summary

The **class-based architecture itself is the strongest part of this framework** and is, on its
own, close to approvable. The consolidation into `@nextrush/class`, the isolated reflection
boundary, the immutable Application Graph, opt-in diagnostics, the `@nextrush/testing` harness,
and the §4 folder layout are genuinely good work — better than most OSS frameworks at the same
age. Class tier: 301 tests, zero `any`, no file over the size caps, forced-green.

But a v1.0 stability gate is a judgment about the **whole framework the class layer sits on**,
and there the answer is **not yet**. Two facts are dispositive:

1. **The core extensibility contract is mid-breaking-rewrite.** `TODO.md` is an in-flight
   "Extension Model v4 Migration" that *deletes* the `Plugin`/`PluginWithHooks`/`PluginFactory`
   surface and replaces it with `Extension` + `ready()`. You cannot declare v1.0 stable while
   the primary extension contract every plugin author will build against is actively being
   removed in a single major. The class layer is coherent; the ground under it is moving.

2. **The public API leaks its own internals.** `nextrush/class` re-exports 34 symbols, and a
   material fraction are implementation details — `deepFreeze`, `bootstrapPipeline`,
   `BootstrapContext`, `buildRoutes`, `getConstructorParamTypes`, `collectModuleGraph`,
   `ResolvedBootstrapOptions`. At v1.0 every one of these becomes a semver-load-bearing promise.
   This directly violates the repo's own global rule §7 ("No internal types leaked through
   public API surface").

Neither is hard to fix, and both are far cheaper to fix *now*, pre-1.0, than after. Everything
else is High/Medium/Nice-to-have.

---

# Approval Recommendation

## 🟠 APPROVE WITH CONDITIONS — the class-based architecture

The class-based subsystem is approved **conditional on** the two 🔴 blockers below being closed.
Its internal design, cohesion, testing, and DX are v1.0-grade.

## 🔴 BLOCK — framework-wide v1.0 stable tag

The framework as a whole is **blocked from a `1.0.0` stable release** until the extension-model
migration lands (or is explicitly deferred out of the 1.0 line) and the public surface is
sealed. Ship the current state as **`0.x` / `1.0.0-rc`**, not `1.0.0`.

**Why:** Stability is a promise about the *public contract*. Right now the public contract is
(a) partially in migration at the core, and (b) accidentally larger than intended at the class
layer. A stable tag on either is a promise you will be forced to break.

---

# Release-Blocker Classification

## 🔴 Release Blockers (minimum set — nothing minor included)

### B1 — Core extension contract is an in-flight breaking migration
- **Evidence:** `TODO.md` → "Extension Model v4 Migration… Breaking change, single major
  version. Branch: `feat/extension-model`." Milestones M1/M2 are annotated "DONE" in prose but
  their checklists are still unchecked `[ ]` — the migration is neither clearly finished nor
  clearly parked. `packages/types/src/extension.ts` already defines `Extension`/`ExtensionContext`/
  `ExtensionHost`, while the meta package still depends on the old surface.
- **Root cause:** The class-consolidation and feature waves proceeded in parallel with a core
  contract rewrite, so the two are at different maturities.
- **Impact:** A v1.0 tag freezes the extension contract. If `Plugin` is being deleted, freezing
  now either ships a contract you intend to remove or strands the migration half-applied.
- **Recommendation:** Pick one before any stable tag: **(a)** finish the Extension Model v4
  migration and tag `1.0.0` on the new contract, or **(b)** explicitly defer it to `2.0` and
  tag `1.0.0` on the *old* Plugin contract with a documented deprecation plan. Do not tag
  `1.0.0` with both contracts half-present.
- **Trade-offs:** (a) delays 1.0 but ships the intended architecture; (b) ships sooner but
  guarantees a `2.0` breaking change for extensions.
- **Migration cost:** Medium — the RFC is approved and M1/M2 are largely done; mostly M3–M5 fan-out.

### B2 — Public API surface leaks implementation internals
- **Evidence:** `packages/class/src/index.ts` exports 34 symbols including `deepFreeze` (a pure
  util), `bootstrapPipeline`, `BootstrapContext`, `ResolvedBootstrapOptions`, `buildRoutes`,
  `getConstructorParamTypes`, `collectModuleGraph`, `collectModuleControllers`, `ClassRef`.
- **Root cause:** The barrel was assembled additively during consolidation; nothing pruned it
  against an intended public contract.
- **Impact:** Violates global-rules §7. Every leaked symbol becomes a breaking-change liability
  the moment 1.0 ships — you can never refactor the bootstrap pipeline or the freeze helper
  without a major, for symbols no user should ever import.
- **Recommendation:** Define the intended public contract (Controller/route/param/response
  decorators, `UseGuard`, `registerControllers`, `registerModule`, `Module`, lifecycle
  interfaces, `getClassDiagnostics`, the discovery sources for testing, `ApplicationGraph` as a
  *read* type). Move everything else behind an unexported internal barrel or an explicit
  `@internal` subpath. Do this **before** 1.0 — it is a non-breaking tightening now and an
  impossible one later.
- **Trade-offs:** None meaningful pre-1.0; the leaked symbols have no legitimate external users.
- **Migration cost:** Low — a barrel edit + a public-surface snapshot test.

## 🟠 High Priority (not release-blocking, but fix before or right after RC)

- **H1 — `exports` in `@Module` is a no-op.** The README admits it: "Modules group, they do not
  yet encapsulate… `exports` is recorded but not enforced." Shipping a keyword that looks like
  NestJS encapsulation but does nothing is a DX trap. Either enforce it (per-module container /
  provider visibility, per RFC-MODULES) or rename/annotate it as reserved until enforced.
- **H2 — Deprecated shim packages ship as first-class packages.** `@nextrush/controllers` and
  `@nextrush/decorators` are now single-file re-export shims. Publishing them as real 1.0
  packages commits you to carrying them. Decide the deprecation window explicitly and encode a
  removal target; ideally remove them *before* 1.0 (cheap now, breaking later).
- **H3 — No `internal` package tier.** ~40 packages (4 adapters, 15 middleware, 2 extensions,
  plus core tier) with no marked-internal layer. Contributors can't tell the supported surface
  from the plumbing. Introduce an internal/private convention before the contributor base grows.

## 🟡 Medium Priority

- **M1 — Enterprise observability gap in the class layer.** Diagnostics are dev-time and
  opt-in; there is no first-class metrics/trace-hook story for the request pipeline
  (guard→interceptor→handler→filter). Enterprises will ask for it early.
- **M2 — `@nextrush/dev` `commands/build.ts` is 674 lines** — over the 300 source cap
  (code-structure violation in shipped tooling; already noted as follow-up).
- **M3 — Configuration story is thin.** No documented, typed, layered config convention
  (env/file/defaults) for class apps; each app reinvents it.
- **M4 — Naming drift risk.** Public names mix decorator nouns (`Controller`, `Module`),
  verbs (`registerControllers`, `registerModule`), and internals; without a sealed surface
  (B2) the naming can't be reasoned about as a whole.

## 🟢 Nice to Have

- Codemod uses a `glob` dep where Node 22+ `fs` glob would remove a dependency.
- `path-utils.ts` could live in a `util/` folder (root is otherwise clean).
- Only one ADR (`ADR-0001-decorator-dialect`); more decisions deserve ADRs for the 1000-contributor future.

---

# Architecture Audit

Cohesive **within** the class layer: `types → errors → core → router → di → class` is a clean,
acyclic hierarchy; `@nextrush/class` correctly depends on `core/router/di/types/errors +
reflect-metadata` and **not** on tsyringe directly. Reflection is isolated to one file. The
immutable Application Graph is a genuinely good abstraction — read-once, freeze, run — and it is
actually wired (not dead code) as the boot source of truth.

The concern that remains is **vertical, not horizontal**: the class layer is stable while the
core's extension contract beneath it is being replaced (B1). Layering is clean; the timeline is
not. A framework is only as stable as its lowest-in-flight contract.

**Coupling** is acceptable. **Boundaries** are correct except that the class package's *public*
boundary is drawn too wide (B2).

# Package Architecture Audit

- **`@nextrush/class` should be — and now is — the real package.** Correct call. `controllers`
  and `decorators` as shims is the right transitional shape; the open question is only *how long*
  they live (H2).
- **DI is correctly isolated.** `@nextrush/di` is independent, usable without the class runtime,
  and does not leak tsyringe through the class surface. Good.
- **Too many top-level packages, no internal tier (H3).** 15 middleware packages is defensible
  (à-la-carte is a selling point), but the absence of a "these are internal" signal is not.
- **Should anything merge/split?** No further merges needed in the class tier. Consider whether
  `runtime` (currently only `@nextrush/runtime`) and the adapter tier need a clearer story, but
  that is outside the class-base scope.

# Package Naming Audit

- `@nextrush/class` — good, memorable, honest about what it contains.
- `nextrush/class` as the canonical import — good; industry-familiar subpath convention.
- `@nextrush/controllers` / `@nextrush/decorators` — names are now **misleading** (they contain
  no implementation, only re-exports). Acceptable *only* as clearly-deprecated shims (H2).
- No package name is itself a blocker.

# Class-Based Architecture Audit

Reviewed each subsystem against "complete / unfinished":

| Subsystem | State | Note |
|---|---|---|
| Controllers / decorators | ✅ Complete | Clean, consolidated |
| DI | ✅ Complete | Independent, good errors |
| Guards / Filters / Interceptors | ✅ Complete | Onion runs; runners co-located with concern |
| Lifecycle (`OnInit`/`OnShutdown`) | ✅ Complete | Interfaces + hooks wired |
| Request scope | ✅ Complete | Per-request child container, singleton fast path preserved |
| Metadata / Reflection | ✅ Complete | Single reflection boundary |
| Bootstrap / Discovery | ✅ Complete | Named stages + `DiscoverySource` (FS + Memory) |
| Application Graph / Runtime | ✅ Complete | Immutable IR, executes against frozen shape |
| **Modules** | ⚠️ **Unfinished** | Group + compose ✅; **encapsulation not enforced** (H1) |

**Verdict:** the class-based architecture is **complete except for module encapsulation**, which
is honestly documented as future work. That is the one subsystem that "still feels unfinished,"
and it is the single highest-value future feature (not polish — a real capability gap for large
apps).

# API Audit

- **Ergonomics:** strong. `registerControllers` / `registerModule` are discoverable; decorators
  match the NestJS mental model most users arrive with.
- **Consistency:** good within the decorator set.
- **Discoverability / IntelliSense:** hurt by B2 — 34 exports means autocomplete surfaces
  `deepFreeze` and `bootstrapPipeline` next to `Controller`, which is noise and an invitation to
  depend on internals.
- **Breaking-change risk:** **high until B2 is fixed** — the surface is larger than intended, so
  the semver contract is larger than intended.
- **Future evolution:** the `ApplicationGraph` read-type is a good evolution seam; keep it public
  as a *read* type, keep the *builders* private.

# Developer Experience Audit (rated /10)

| Category | Score | Note |
|---|---|---|
| First impression | 8 | Clean README, honest performance table |
| Installation | 8 | `pnpm add nextrush` + `nextrush/class` — two clean doors |
| Setup | 8 | `reflect-metadata` + decorators; standard |
| Learning curve | 7 | Familiar to NestJS users; module `exports` trap (H1) costs a point |
| Discoverability | 6 | B2 pollutes autocomplete |
| IntelliSense | 6 | Same — internals in the surface |
| Error messages | 9 | DI errors are structured with numbered remediation — a real strength |
| Documentation | 7 | Strong steering + guides; module encapsulation over-promises |
| Examples | 7 | Playground + docs; more end-to-end enterprise examples needed |
| Testing | 9 | `createTestModule().override().compile()` is excellent, NestJS-grade |
| CLI | 7 | dev/build/generate + codemod; `build.ts` god file (M2) |
| Tooling | 8 | Codemod + diagnostics are above-average for the age |
| Debugging | 7 | Diagnostics help; no request-pipeline trace hooks (M1) |
| Cognitive load | 7 | Reasonable; 40 packages + shims add background noise |
| Boilerplate | 8 | Low; decorators + auto-discovery |

# DX Friction Audit

Top friction points, ranked: (1) `exports` that silently does nothing (H1); (2) autocomplete
noise from leaked internals (B2); (3) uncertainty about whether to import from `@nextrush/class`,
`nextrush/class`, or the deprecated shims (mitigated by docs, but the shims' existence is the
friction); (4) no typed config convention (M3).

# Codebase Quality Audit

High. Zero `any` in the class tier, reflection isolated, no source file over 300 lines and no
test over 500 (just enforced), dependency direction clean, cohesion good post-§4-reorg. The one
shipped-code smell is `@nextrush/dev/commands/build.ts` (674 lines, M2). Maintainability is
strong; the main long-term risk is the leaked surface (B2) hardening into a compatibility burden.

# Testing Audit

Strong. 301 class cases + 86 DI + 11 testing + 116 dev, forced-green with no-cache verification
as policy. The `@nextrush/testing` harness closes the biggest historical class-DI testing gap.
**Gap:** no public *contract/surface snapshot test* guarding the intended public API — which is
exactly why B2 could happen silently. Add one as part of fixing B2.

# Documentation Audit

Above average: tiered doc standards, MDX component discipline, per-feature RFCs (11 RFCs), a
migration guide, and honest limitation callouts (the module-encapsulation note is a model of
honesty). **Gaps:** enterprise topics (observability, config, deployment hardening) and the fact
that some public symbols (the leaked internals) are undocumented — because they were never meant
to be public.

# Tooling Audit

`@nextrush/dev` (dev server, build, generators), the `consolidate-imports` codemod, and the
diagnostics API are a strong tooling story for a framework this young. Deductions: the 674-line
`build.ts` (M2) and the removable `glob` dependency (🟢).

# Missing Features (production / enterprise)

- Module encapsulation (H1) — the one that matters most.
- Request-pipeline observability hooks / metrics (M1).
- Typed, layered configuration convention (M3).
- A settled extension model (B1) — currently in flux.

# Remaining Technical Debt

- Leaked public internals (B2).
- Deprecated shim packages awaiting a removal decision (H2).
- `build.ts` god file (M2).
- No internal package tier (H3).

# Enterprise Readiness

**68/100.** Blocked by: no encapsulation (multi-team apps need module privacy), no first-class
observability in the class pipeline, thin config story, and an unsettled extension contract.
Strengths that count: excellent DI errors, testing harness, request scope, and diagnostics.

# OSS Readiness

**70/100.** Blocked by: a mid-migration core contract (contributors can't build stable plugins
against a moving target), ~40 packages with no internal tier, and deprecated shims. Strengths:
clean hierarchy, strong steering docs, RFC/ADR discipline, real tests.

# Future Evolution — "what breaks first?"

Imagining WebSocket + GraphQL + Scheduler + Cron + Event Bus + a plugin marketplace + 1000
contributors + 10000 apps:

- **First to break: the extension contract (B1).** A plugin marketplace on a contract that is
  currently being replaced is the highest-risk item. Settle it before inviting an ecosystem.
- **Second: the leaked surface (B2).** With 10000 apps, someone imports `bootstrapPipeline`, and
  now you can't refactor boot without breaking them. Seal it before adoption, not after.
- **Third: module encapsulation (H1).** At enterprise scale, global provider visibility becomes
  a correctness and coupling problem. The `exports` no-op will be discovered and resented.
- **Survives well:** the immutable graph, request scope, DI isolation, the reflection boundary,
  and the testing harness. These are the load-bearing good decisions.

# Answers to the 16 Required Questions

1. **Remaining architectural flaws:** in-flight core extension contract (B1); public surface
   drawn too wide (B2); module encapsulation unenforced (H1).
2. **Package boundaries that feel wrong:** none in the class tier's *internal* structure; the
   *public* boundary of `@nextrush/class` is too wide (B2). Shims blur the tree (H2).
3. **APIs that feel awkward:** `@Module.exports` (does nothing, H1); the leaked internal exports.
4. **DX problems:** autocomplete noise (B2), the `exports` trap (H1), shim ambiguity.
5. **Cognitive friction:** which package/import to use (shims), 40-package surface, `exports`
   semantics.
6. **Hidden complexity:** the bootstrap pipeline/graph is exposed rather than hidden (B2).
7. **Missing production features:** encapsulation, pipeline observability, typed config.
8. **Missing enterprise capabilities:** module privacy, metrics/tracing hooks, config layering.
9. **OSS blockers:** moving extension contract, no internal tier, deprecated shims.
10. **Package names to change:** none mandatory; `controllers`/`decorators` are misleading but
    acceptable strictly as deprecated shims.
11. **Should become internal:** `deepFreeze`, `bootstrapPipeline`, `BootstrapContext`,
    `ResolvedBootstrapOptions`, `buildRoutes`, `getConstructorParamTypes`, `collectModuleGraph`,
    `collectModuleControllers` (B2).
12. **Should become public:** the intended contract, explicitly sealed and snapshot-tested —
    including `ApplicationGraph` as a *read* type and the discovery sources for testing.
13. **Recent decisions that were mistakes:** additive barrel assembly without a public-contract
    gate (produced B2); running the class consolidation to "done" in parallel with an unfinished
    core extension migration without reconciling the release story (produced B1's ambiguity).
14. **Recent decisions that were excellent:** the `@nextrush/class` merge; isolating reflection;
    the immutable Application Graph; keeping DI independent; the `@nextrush/testing` harness; the
    §4 reorg; honest documentation of the encapsulation limitation.
15. **If starting today:** define the public contract *first* (contract-first barrel + snapshot
    test), and freeze the core extension model *before* building the class layer on top of it —
    lowest layer's contract first, per the repo's own "build the foundation first" rule.
16. **What would stop v1.0 approval today:** B1 and B2. Nothing else is release-blocking.

---

# Scorecard (0–100)

| Dimension | Score | Why / Evidence / Improvement |
|---|---|---|
| Architecture | 78 | Clean acyclic hierarchy, isolated reflection, real immutable IR. **Evidence:** `@nextrush/class` deps; `graph.ts` wired into pipeline. **Improve:** settle B1, seal B2. |
| Package Design | 70 | Correct class-tier shape; ~40 packages + shims + no internal tier. **Evidence:** package inventory; shim `index.ts` files. **Improve:** H3, H2. |
| API Design | 72 | Good ergonomics, familiar model; surface too wide. **Evidence:** 34 exports incl. internals. **Improve:** B2 + snapshot test. |
| Developer Experience | 80 | Two clean import doors, codemod, testing, great DI errors. **Evidence:** `di/errors.ts`, `createTestModule`. **Improve:** B2 autocomplete noise, H1. |
| Documentation | 75 | Tiered standards, 11 RFCs, honest limits. **Evidence:** docs steering, README module note. **Improve:** enterprise topics, seal undocumented exports. |
| Tooling | 78 | dev/build/generate + codemod + diagnostics. **Evidence:** `@nextrush/dev`. **Improve:** M2 god file, glob dep. |
| Testing | 85 | 301 class + harness + forced gates. **Evidence:** forced 72/72. **Improve:** add public-surface snapshot test. |
| Performance | 82 | Frozen-graph boot, singleton fast path, competitive benchmarks. **Evidence:** README bench, request-scope design. **Improve:** publish class-path overhead numbers. |
| Scalability | 74 | Solid runtime; encapsulation gap hurts large apps. **Evidence:** H1. **Improve:** enforce module boundaries. |
| Maintainability | 80 | Clean post-reorg, reflection isolated, caps enforced. **Evidence:** §4 folders, size gates. **Improve:** B2 to avoid frozen internals. |
| Enterprise Readiness | 68 | No encapsulation/observability/config story. **Evidence:** H1, M1, M3. **Improve:** those three. |
| OSS Readiness | 70 | Moving contract + shims + no internal tier. **Evidence:** TODO.md, shims. **Improve:** B1, H2, H3. |
| Plugin Readiness | 60 | Extension model is literally being rebuilt. **Evidence:** TODO.md M1–M5. **Improve:** finish or defer B1. |
| Class-Based Architecture | 86 | Complete except module encapsulation; strongest area. **Evidence:** subsystem table. **Improve:** H1. |
| Functional Architecture | 78 | Clean core/router/context; depends on B1's outcome. **Improve:** settle extension model. |
| **Overall Framework** | **74** | Strong engineering; blocked from *stable* by B1 + B2. **Improve:** close both, tag RC first. |

---

# Top 20 Highest-Priority Improvements (ranked by impact)

1. **(B1)** Finish or explicitly defer the Extension Model v4 migration before any stable tag.
2. **(B2)** Seal the `@nextrush/class` public surface; move internals behind an internal barrel.
3. Add a public-API **surface snapshot test** so the contract can never silently widen again.
4. **(H1)** Enforce or reserve `@Module.exports` (stop shipping a no-op that mimics encapsulation).
5. **(H2)** Decide and encode the deprecation/removal window for the `controllers`/`decorators` shims.
6. **(H3)** Introduce an internal/private package tier and mark the supported surface.
7. Tag the current state **`1.0.0-rc`**, not `1.0.0`.
8. **(M1)** Add request-pipeline observability hooks (metrics/trace around guard→handler→filter).
9. **(M3)** Ship a typed, layered configuration convention for class apps.
10. **(M2)** Split `@nextrush/dev/commands/build.ts` (674 → under cap).
11. Document the intended public contract explicitly (what is supported vs internal).
12. Add enterprise-facing docs: observability, config, deployment hardening.
13. Provide an end-to-end enterprise example app (modules + guards + scope + testing).
14. Ship the module-encapsulation RFC implementation (per RFC-NEXTRUSH-MODULES) as the flagship next feature.
15. Publish class-path overhead benchmarks (registration + per-request cost) for honesty.
16. Consolidate ADRs — capture the recent big decisions (consolidation, IR, reflection) as ADRs.
17. Remove the `glob` dependency in the codemod (Node 22+ `fs` glob).
18. Add a `hasDecorator`/extension collision-detection story once B1 lands.
19. Provide a migration guide for the eventual shim removal (before it happens).
20. Add a "supported surface" CI check that fails a PR adding an unintended export.

---

# Final Verdict

**If I were a Spring or ASP.NET Core maintainer, would I approve this architecture for a stable
v1.0 today? No — I would block the stable tag, and I would say exactly why in two sentences:**

> *"Your class-based architecture is excellent and I'd approve it in isolation. But I won't put a
> stability promise on a framework whose core extension contract is mid-rewrite and whose public
> API is accidentally exporting its own bootstrap internals — seal the surface, settle the
> extension model, and come back with an RC."*

That is a **narrow, closable block**, not a rejection. B1 and B2 are the only true blockers; both
are cheaper now than at any later point, and neither reflects a fundamental design error. The
underlying decisions — one class package, isolated reflection, an immutable graph, independent DI,
a real testing harness — are the decisions a mature framework is built on. Close the two blockers,
ship an RC, land module encapsulation as the headline 1.x feature, and this becomes a framework I
would approve without reservation.

**Recommendation: Ship `1.0.0-rc` now. Tag `1.0.0` after B1 + B2 close.**
