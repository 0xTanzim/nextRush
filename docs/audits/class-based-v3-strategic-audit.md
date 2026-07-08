# NextRush Class-Based Architecture — Strategic Audit V3

**Mode:** Strategic architecture review (not a bug audit)
**Date:** 2026-07-08
**Reviewers:** Architecture Review Board — Principal Framework Architect, OSS Maintainer, Package Architecture Specialist, API Designer, DX Researcher, Software Evolution Architect, Enterprise Architect
**Scope:** The class-based half of NextRush v3 — `@nextrush/di`, `@nextrush/decorators`, `@nextrush/controllers`, `@nextrush/types`, `@nextrush/core`, the `nextrush` meta package, and the `nextrush/class` entry point. Evaluated against Spring Boot, NestJS, ASP.NET Core, Fastify, and Hono as the ten-year bar.

> **Method note.** Every structural claim below is grounded in the current tree (package manifests, `index.ts` export surfaces, per-file line counts, the 10 RFCs in `docs/RFC/`, `ADR-0001`, `class-based-master-audit.md`, and `TODO.md`). Where a prior audit or the audit brief itself asserts something the code contradicts, the code wins and the correction is called out.

---

## Executive Summary

The class-based architecture is **fundamentally sound and worth keeping for the next 5–10 years** — but it is *early-mature*, not *finished*. After the v1→v2→v3 remediation waves it now has the feature surface of a serious server framework (controllers, DI, guards, exception filters, interceptors, lifecycle hooks, request scope, modules) on top of a genuinely clean, correctly-layered package graph. That is the strong part.

The weak part is not the architecture; it is **surface cohesion and boundary discipline**. The same symbols (`Controller`, `Get`, `Service`) are exported from three places (`@nextrush/decorators`, `@nextrush/controllers`, and `nextrush/class`), the `decorators`↔`controllers` split is the least-justified boundary in the tree, and two packages carry over-cap files (`di/decorators.ts` 384 lines, `decorators/params.ts` 376 lines). None of these are fatal; all are the kind of debt that becomes *expensive to change* once real adoption locks the public surface.

**Verdict up front:** *Approve the architecture, block the "1.0 / stable" label.* The layering and dependency direction are the best-in-class part of this codebase and should be preserved verbatim. The public-API surface needs one consolidation pass — ideally collapsing `decorators` + `controllers` into a single `@nextrush/class` package and making `nextrush/class` the one canonical documented boundary — *before* a stable major freezes the import paths. Do that, and this architecture scales cleanly through OpenAPI, WebSocket, jobs, and a scheduler.

**Headline scores:** Architecture **83** · Package Architecture **74** · API Design **72** · DX **70** · Enterprise Readiness **58** · Overall **73/100**.

---

## Architecture Evolution Review

### Where it started (v1 audit era)

The original class-based feature was a NestJS-flavoured layer bolted onto a functional core with real correctness holes: broken async generators, a **global DI singleton masquerading as per-app isolation**, guard errors silently swallowed (401s impossible), and eager-vs-lazy resolution confusion. The v1 audit scored it ~62/100. The architecture *shape* was already close to right; the *implementation* leaked and the *contract* lied (docs promised isolation the code didn't deliver).

### The Extension-Model v4 pivot (`TODO.md`, `RFC-NEXTRUSH-PLUGIN-SYSTEM.md`)

The single most important architectural decision in this period was **killing the plugin ceremony** and replacing it with a three-tier composition taxonomy: **Middleware (99%) / Registrars (0.9%) / Extensions (0.1%)**. This is why `registerControllers(app, …)` is a plain async *registrar function* and not a `ControllersPlugin` class, why `@nextrush/events` is the only true `Extension`, and why `openapi`/`template` became middleware factories. This pivot is the reason the class-based layer composes cleanly instead of accreting a parallel plugin lifecycle.

### The remediation + feature waves (v2→v3)

Two distinct kinds of work, and it matters which is which:

- **Correctness/DX remediation** (fixing lies and footguns): eager DI validation, app-owned container seam, guard-error propagation, single-resolve memoization, opt-in per-app isolation (`RFC-DI-CONTAINER-OWNERSHIP`, Option A), and the decorator-dialect commitment (`ADR-0001`). This work moved the architecture *forward* — it made the contract honest.
- **Net-new capability** (RFC + TDD per feature): `@HttpCode`, exception filters, interceptors, lifecycle hooks (`OnInit`/`OnShutdown` bridged into `app.ready()`/`close()` via the Extension model — a genuinely elegant reuse), request-scoped DI with scope-bubbling, and the module system.

**Assessment:** the evolution was disciplined — every net-new public API got an RFC (10 in `docs/RFC/`) and tests, and the Extension-model reuse for lifecycle hooks shows the team is composing new features *through* existing seams rather than bolting on parallel machinery. That is the signature of an architecture that is converging, not sprawling.

---

## Recent Improvements — What Helped vs. What Added Complexity

### Genuinely improved the framework

| Change | Why it's a real improvement |
| --- | --- |
| Extension-model v4 (registrar taxonomy) | Removed an entire parallel lifecycle; `registerControllers` is now just a function. Highest-leverage decision in the set. |
| Opt-in per-app DI isolation | Closed the "global singleton pretending to be per-app" lie without a breaking default flip. Honest contract. |
| Eager DI validation + single-resolve | Fail-fast at boot instead of first-request; kills the singleton-state footgun on the hot path. |
| Lifecycle hooks via `app.extend()` | Reused the Extension lifecycle instead of inventing a new one — zero new concepts for the user, zero new machinery for the maintainer. |
| Request-scope **bubbling** | The correct semantic (a singleton controller depending on a request-scoped service becomes request-scoped) with a cycle-guard. Most frameworks get this subtly wrong. |
| `builder.ts` 446→153 split | Turned a god-file into cohesive `handler`/`param-resolver`/`guard-runner`/`filter-runner`/`interceptor-runner` units. |
| `ADR-0001` (decorator dialect) | Wrote down the load-bearing legacy-decorator commitment and its exact migration trigger. Removes a future "why are we on deprecated flags?" landmine. |

### Added complexity without proportional payoff (watch these)

| Change | The concern |
| --- | --- |
| Module system (MVP) | Ships `@Module`/`registerModule` but **`exports` is recorded, not enforced** (`RFC-MODULES` §5 is honest about this). A module system that groups but does not *encapsulate* teaches users a NestJS mental model the runtime doesn't honor. This is the highest-risk "looks done, isn't" surface. |
| Triple re-export of decorators | `Controller`/`Get`/`Service` are now exported from `@nextrush/decorators`, `@nextrush/controllers`, **and** `nextrush/class`. Three import paths for one symbol is discoverability debt that hardens with adoption. |
| Feature-count growth | Filters + interceptors + guards + lifecycle + scope + modules is a lot of surface for a framework with (per README) single-machine benchmarks and early adoption. Each is individually justified; collectively they raise the learning curve toward NestJS levels without NestJS's docs/tooling maturity yet. |

---

## Package Architecture Audit

Current class-relevant package graph (verified). Hierarchy is strict and acyclic:

```
types → errors → core → router → di → decorators → controllers → adapters → middleware
```

| Package | LOC (src) | Responsibility | One responsibility? | Verdict |
| --- | --- | --- | --- | --- |
| `@nextrush/types` | small | Shared contracts (Context, Scope, Extension) | Yes | **Keep.** Correct foundation. |
| `@nextrush/errors` | ~600 | HTTP error hierarchy | Yes | **Keep.** |
| `@nextrush/core` | ~1.5k | Application, middleware compose, extension lifecycle | Yes | **Keep.** |
| `@nextrush/router` | ~1k | Radix routing | Yes | **Keep.** |
| `@nextrush/di` | 927 | Container + `@Service`/`@Repository`/`@Config` + scopes | Mostly | **Keep, split file.** `decorators.ts` at 384 is over the 300 cap. |
| `@nextrush/decorators` | 2555 | Route/param/guard/filter/interceptor/module decorators + metadata readers | Yes (metadata) | **Keep or merge.** Weakest boundary — see naming audit. `params.ts` 376 over cap. |
| `@nextrush/controllers` | 2689 | Registrar, discovery, registry, builder, handler, param binding, runners (guard/filter/interceptor), lifecycle, scope, isolation, modules | **Overloaded name, cohesive contents** | **Rename or merge.** |
| `nextrush` (`/class`) | facade | reflect-metadata + re-export di/decorators/controllers | Yes (facade) | **Promote to canonical boundary.** |

**Correction to the audit brief:** the brief states `@nextrush/controllers` owns "OpenAPI contribution." It does **not**. OpenAPI lives entirely in `@nextrush/openapi` (13/11/10 references across `generate.ts`/`index.ts`/`middleware.ts`) and reads the **router's** route table (`RFC-ROUTE-METADATA`), not controller metadata. Controllers and OpenAPI are correctly decoupled. This is a point *in the architecture's favour*, not against it.

**The one real structural smell:** `@nextrush/decorators` (pure metadata, 2555 LOC) and `@nextrush/controllers` (the runtime that consumes that metadata, 2689 LOC) are *always used together*, and no third consumer reads decorator metadata (OpenAPI reads router metadata instead). The split therefore buys layering purity at the cost of a two-package coordination tax and the triple-export problem. It is the only boundary in the tree I would redraw.

---

## Package Naming Audit

### `@nextrush/controllers` — the name is now too small for the package

The package owns discovery, registry, builder, handler, param binding, guard/filter/interceptor runners, lifecycle, request-scope, isolation, and modules. "Controllers" describes ~30% of it. A newcomer looking for "how do modules work" or "where does request scope live" will not guess `@nextrush/controllers`. **This is a High-severity naming mismatch.**

Options, in order of preference:
1. **Merge `decorators` + `controllers` → `@nextrush/class`** (physical package). Name now matches contents ("the class-based runtime"), eliminates the triple export, kills the weakest boundary. Migration cost: rename imports (mostly `nextrush/class` users are unaffected). Major-version move.
2. **Rename `controllers` → `@nextrush/class` alone, keep `decorators` separate.** Cheaper, but preserves the coordination tax and the split.
3. **Do nothing, make `nextrush/class` the only documented path.** Lowest cost, hides the mismatch behind the facade. Acceptable short-term.

### Other names

- `@nextrush/di`, `@nextrush/types`, `@nextrush/errors`, `@nextrush/router`, `@nextrush/core` — **all correct.** Precise, single-word, match contents.
- `@nextrush/dev` — fine as a toolchain grab-bag (dev server + build + generators), but "dev" is vague; `@nextrush/toolkit` or `@nextrush/cli` would be clearer. Low severity.
- `nextrush/class` (subpath) — **the best-named boundary in the whole system.** It is what users should import. The architecture's problem is that it's *not treated as authoritative* — packages beneath it also export the same symbols.

---

## Class Architecture Review — Is it mature?

**Early-mature (≈ 7/10 on the maturity curve).**

Mature parts: the composition pipeline (guards → interceptors(onion) → method → filters, with filters outermost) is coherent and matches how NestJS users think; DI is fail-fast and correctly scoped; the Extension-model reuse for lifecycle is elegant; layering is clean.

Immature parts:
- **Modules group but don't encapsulate.** This is the maturity gap. A real module system enforces provider visibility; this one records `exports` and shares one flat container. Until encapsulation lands, "modules" is organizational sugar, and the docs must keep saying so loudly (they currently do — credit for honesty).
- **No request-context injection into services.** Request-scoped services get fresh instances but can't `@Inject` the current request; they read it via a controller `@Ctx` param. That's a documented v1 limitation but a real ergonomic gap vs. NestJS `REQUEST` injection.
- **Surface duplication** (triple export) signals the boundary isn't settled.

---

## Public API Review

**Strengths:** exports are explicit and typed (no `any` leakage observed at the barrels); `import type` used for boundary types; the functional core pays *zero* decorator tax (reflect-metadata only loads via `nextrush/class`) — a genuinely good design decision that most decorator frameworks miss.

**Problems:**
1. **Three sources of truth.** `Controller` is exported from `@nextrush/decorators`, `@nextrush/controllers`, and `nextrush/class`. Autocomplete shows all three; docs must pick one; drift is inevitable. *Fix: internal packages stop re-exporting each other; `nextrush/class` is the only public path.*
2. **`@nextrush/controllers` re-exports DI + decorators** (`Body`, `Service`, `container`, `Repository`…). A package should export its own surface plus types it *returns*, not a convenience mirror of its dependencies. This is the mechanism behind problem 1.
3. **Metadata readers are public** (`getRouteMetadata`, `getControllerDefinition`, `getAllParamMetadata`…). These are useful for tooling (an OpenAPI-from-decorators generator would want them) but they leak internal representation. Keep them, but under a clearly-labelled `@nextrush/decorators/metadata` sub-path or a `metadata` namespace so they aren't in the newcomer's first autocomplete.
4. **Duck-typed lifecycle interfaces** (`OnInit`/`OnShutdown` with `isOnInit`/`isOnShutdown` guards) are pragmatic but un-discoverable — there's no decorator to hang IntelliSense on. A `@Lifecycle`-free convention is fine; document it prominently.

**Can it evolve?** Yes — the barrels are additive-friendly and the RFC gate protects the contract. The evolution risk is entirely in the *duplication*, not the *shape*.

---

## DX Review (0–100 per category)

| Category | Score | Why |
| --- | --- | --- |
| First impression | 78 | README quick-start is strong; class example is clean and NestJS-familiar. |
| Installation | 70 | `pnpm add nextrush @nextrush/di @nextrush/decorators @nextrush/controllers` for class mode is a **four-package incantation** — friction. `create-nextrush` mitigates it. |
| Setup | 60 | `experimentalDecorators`+`emitDecoratorMetadata`+metadata-emitting runtime is a hard requirement; bare `tsx`/`esbuild` fail with "TypeInfo not known" (`ADR-0001`). Documented, but the #1 first-run failure. |
| Learning curve | 66 | NestJS users feel at home; newcomers face guards+filters+interceptors+scopes+modules — NestJS-sized surface without NestJS-sized docs. |
| Project structure | 80 | Feature-folder discipline in playground; generators emit correct structure. |
| Package organization | 68 | Clean layering, but four packages + triple exports + a "controllers" package that owns modules. |
| API discoverability | 62 | Triple export + public metadata readers cloud autocomplete. |
| Naming consistency | 72 | Decorators are consistent (NestJS-parity); `controllers` package name is the outlier. |
| Public API quality | 74 | Typed, explicit, additive — minus the duplication. |
| Documentation | 68 | RFCs/ADR are excellent for contributors; user-facing depth is mid (tiered docs standards exist, coverage is partial). |
| Examples | 66 | Playground + examples exist; not yet a broad cookbook. |
| IntelliSense | 70 | Good types; polluted by three import sources. |
| TypeScript inference | 72 | Strong at boundaries; param decorators can't infer body/param shape without a validation layer. |
| Error messages | 80 | DI errors are production-grade (`DependencyResolutionError`, `CircularDependencyError`); guard/controller errors are typed. A real strength. |
| Debugging | 64 | Decorator+metadata indirection makes stack traces less direct than functional handlers. |
| Stack traces | 62 | Reflection + registrar layers add frames; no source-map-aware handler naming yet. |

**DX average ≈ 70.** The ceiling is held down by setup friction (decorator toolchain), install friction (four packages), and surface duplication — all fixable without touching the architecture.

---

## Enterprise Readiness

**Score: 58/100.** Present: DI, request scope, lifecycle hooks, structured errors, guards (authz seam), OpenAPI, validation, security middleware (helmet/cors/csrf/rate-limit). Missing for enterprise adoption:

- **Module encapsulation** (provider isolation) — enterprises rely on it for large-team boundaries.
- **Configuration system** — no first-class typed config/secrets story beyond `@Config` DI tokens.
- **Observability contract** — logging exists; no built-in tracing/metrics/correlation-ID contract across the request lifecycle (the global steering *requires* correlation IDs; the framework doesn't yet provide the seam).
- **Testing utilities** — no official `Test.createModule()`-style harness for spinning a DI graph in unit tests (NestJS's `@nestjs/testing` is a major adoption driver).
- **Maturity signals** — single-machine benchmarks, early version line, no LTS/support policy.

---

## Future Evolution — Will today's architecture scale through the roadmap?

| Future feature | Scales cleanly? | Why / caveat |
| --- | --- | --- |
| Modules (deeper) | ⚠️ | Grouping done; **encapsulation is the hard part** and needs per-module containers — the request-scope child-container machinery is a good foundation to build on. |
| Plugins/Extensions | ✅ | Extension-model v4 is purpose-built for this. Best-prepared axis. |
| Event system | ✅ | `@nextrush/events` is already the reference Extension. |
| Background jobs / scheduler | ✅ | Lifecycle hooks (`OnInit`/`OnShutdown`) + Extension boot/teardown give a clean home. Request scope does **not** apply — jobs need their own scope, a future `Scope` value. |
| OpenAPI | ✅ | Already decoupled via router metadata. Could optionally consume decorator metadata readers for richer specs. |
| GraphQL | ⚠️ | Resolver decorators would live naturally in the decorators/class package, but the param-binding model is HTTP-shaped (`@Body`/`@Query`); GraphQL args need a new param source. Additive but non-trivial. |
| WebSocket | ✅ | `@nextrush/websocket` factory + optional attach-Extension already sketched. Gateway decorators would extend the class package. |

**Overall:** the architecture scales on every axis it was designed around (composition, DI, lifecycle). The two axes that need real new design are **module encapsulation** and **non-HTTP param binding** (GraphQL/WS). Neither requires re-architecting; both are additive within the current seams.

---

## Missing Capabilities (before "complete")

1. **Module encapsulation** — enforce `exports`; module-private providers. (Largest gap.)
2. **Testing harness** — `@nextrush/testing` with `createTestModule({ providers, controllers })`. (Highest adoption ROI.)
3. **Request-context injection** into request-scoped services.
4. **Typed configuration + secrets** layer.
5. **Observability seam** — correlation-ID/tracing/metrics contract across the lifecycle.
6. **`@nextrush/dev` build determinism** — a guaranteed metadata-emitting build so "TypeInfo not known" becomes impossible, not just documented.

---

## Remaining Technical Debt

| Item | Evidence | Severity |
| --- | --- | --- |
| Over-cap source files | `di/decorators.ts` 384, `decorators/params.ts` 376 (cap 300) | Medium |
| Over-cap test file | `di/__tests__/container.test.ts` 731 (test cap 500) | Low |
| Triple public export of decorators | `class.ts` + `controllers/index.ts` + `decorators/index.ts` | High (hardens with adoption) |
| Module `exports` recorded-not-enforced | `RFC-MODULES` §5 | High (semantic gap) |
| `controllers` package name vs. contents | 17 files, only ~5 are "controller" concerns | Medium |
| Public metadata readers leak representation | `decorators/index.ts` metadata exports | Medium |
| Isolation opt-in (default off) | `RFC-DI-CONTAINER-OWNERSHIP` Option A | Low (deliberate, major-gated) |

---

## Long-term Risks

1. **Import-path lock-in.** Once real apps import `Controller` from any of the three sources, consolidation becomes a breaking change with a migration guide. **This is the risk with the shortest fuse — fix before stable.**
2. **Decorator-dialect bet** (`ADR-0001`). Load-bearing on TypeScript's *deprecated* `experimentalDecorators`/`emitDecoratorMetadata`. Well-documented with an explicit migration trigger, but if TC39/TS forces the issue, it's a major redesign of param injection + DI discovery. Accepted, monitored — correct posture.
3. **Feature surface outrunning docs/tooling.** NestJS-sized API with a fraction of NestJS's learning material invites "powerful but confusing" reputation.
4. **Module system teaching the wrong mental model** until encapsulation lands.

---

## Recommended Architecture Changes

1. **Consolidate the public surface (do first, pre-stable).** Internal packages stop re-exporting each other; `nextrush/class` becomes the single documented import path. Zero code-behavior change, pure boundary hygiene.
2. **Merge `@nextrush/decorators` + `@nextrush/controllers` → `@nextrush/class`.** Physical package matching the `nextrush/class` entry. Keep `@nextrush/di` separate (genuinely reusable, lower layer). Major-version, migration-guided.
3. **Split the two over-cap files** (`di/decorators.ts`, `decorators/params.ts`) before the merge so the merged package starts clean.
4. **Ship module encapsulation** on the request-scope child-container foundation, or downgrade the docs/marketing to "module grouping" until it lands. Don't ship a NestJS-shaped promise the runtime breaks.
5. **Add `@nextrush/testing`.** Highest DX/adoption ROI of anything on this list.

Each carries the standard trade-off: consolidation costs a migration guide now but saves a *forced* one later; the merge costs import churn but ends the triple-export drift permanently.

---

## Recommended Package Layout (if starting today)

```
@nextrush/types          # contracts (unchanged)
@nextrush/errors         # HTTP errors (unchanged)
@nextrush/core           # Application, middleware, extension lifecycle (unchanged)
@nextrush/router         # radix router (unchanged)
@nextrush/di             # container + @Service/@Repository/@Config + scopes (KEEP SEPARATE)
@nextrush/class          # ← merged decorators + controllers: all class-based runtime + decorators
@nextrush/adapter-*      # platform adapters (unchanged)
@nextrush/<middleware>   # cors, helmet, openapi, validation, … (unchanged)
nextrush                 # meta: functional entry (createApp/createRouter/listen)
nextrush/class           # meta subpath: the ONE public class-based import path
```

Rationale: the layering that exists today is right and stays. The *only* change is collapsing the decorators/controllers boundary (no third consumer justifies it) and elevating `nextrush/class` from "convenience facade" to "the boundary." `@nextrush/di` stays independent because it's the one class-tier package with standalone reuse value.

---

## Architecture Roadmap

**6 months**
- Surface consolidation (stop cross-re-exports; `nextrush/class` canonical).
- Split the two over-cap files.
- `@nextrush/testing` harness.
- Module encapsulation RFC + implementation (or docs downgrade).

**1 year**
- Merge `decorators`+`controllers` → `@nextrush/class` (major, migration guide).
- Request-context injection for request-scoped services.
- Observability seam (correlation-ID/tracing contract) + typed config layer.
- Scheduler/jobs on the lifecycle+Extension foundation.

**3 years**
- Non-HTTP param binding (GraphQL/WebSocket gateway decorators) as additive class-package surface.
- Decorator-dialect migration *only if* the `ADR-0001` trigger fires (TC39/TS forces it).
- Stable/LTS line with a support policy once adoption + docs maturity justify it.

---

## Final Verdict

**As lead architect: I approve the architecture, and I block the "stable/1.0" label until the surface is consolidated.**

Why approve: the load-bearing decisions are right and rare. Clean acyclic layering, an honest per-app DI contract, the Extension-model composition taxonomy, fail-fast DI, correct request-scope bubbling, and OpenAPI correctly decoupled from controllers — these are the things that are *expensive to fix later*, and they are already correct. The feature surface is complete enough to build real applications today.

Why block stable: the things that are still wrong (triple export, the `decorators`/`controllers` boundary, module encapsulation, over-cap files) are all things that get *harder* to fix the moment a stable major freezes the import paths and the "modules encapsulate" mental model. Fixing them is cheap now and a breaking migration later. Ship the consolidation, then stamp it stable.

This is an architecture that will survive ten years **if the next release is a boundary-consolidation release, not another feature release.**

---

## Appendix A — Developer Experience Audit (per category, current → expected)

Format: **Current score** · Strengths · Weaknesses · Missing · Improvements · **Expected after improvements**.

- **Testing experience** — **48** · DI is mockable; real-object-friendly. · No official test module/harness; DI graph setup is manual. · `@nextrush/testing`, in-memory app factory. · Ship `createTestModule`. · **80**
- **Plugin development** — **82** · Extension model v4 is purpose-built; `events` is a clean reference. · Sparse extension-authoring docs. · Extension cookbook. · Add docs + a template. · **88**
- **Extension development** — **80** · `setup`/`destroy` lifecycle + `decorate` collision detection. · `decorate` typing ergonomics under-documented. · Typed decoration examples. · **86**
- **Migration experience** — **60** · `guides/migration.mdx` exists; changesets discipline. · No codemods; class-mode migration from Nest not documented. · Codemod + Nest-parity guide. · **75**
- **Scaffolding** — **78** · `create-nextrush` with functional/class/full presets. · Preset depth limited. · More templates. · **85**
- **Generators** — **75** · `nextrush g controller|service|middleware|guard|route`. · No module/filter/interceptor generators. · Add them. · **85**
- **Build tooling** — **62** · `@nextrush/dev` validates required tsconfig flags. · Metadata-emitting build is a requirement, not a guarantee; `tsx`/`esbuild` footgun persists. · Deterministic metadata build. · **82**
- **Performance DX** — **72** · `apps/benchmark` with wrk+autocannon; competitive numbers. · Single-machine results; no per-PR perf gate. · CI perf regression gate. · **82**

## Appendix B — Codebase Engineering-Quality Audit (score · evidence · why · improvement)

- **Architecture** — **85** · strict acyclic hierarchy `types→…→controllers`. · seams are correct and reused (lifecycle via Extension). · collapse decorators/controllers.
- **Package Design** — **72** · 33 packages, clean deps · one over-broad name + triple export. · consolidate.
- **Folder Structure** — **82** · feature-cohesive `controllers/src` (runner-per-concern). · a couple of files near cap. · split them.
- **Code Readability** — **80** · small focused files (most <200 LOC). · `params.ts` 376. · extract.
- **Naming** — **74** · decorators match NestJS; DI precise. · `controllers` package. · rename/merge.
- **Consistency** — **78** · runner pattern applied uniformly (guard/filter/interceptor). · duck-typed lifecycle breaks the decorator convention. · document convention.
- **Maintainability** — **80** · RFC+TDD per feature. · surface duplication drifts. · single source of truth.
- **Coupling** — **84** · OpenAPI↔controllers decoupled via router metadata. · decorators↔controllers effectively co-dependent. · merge.
- **Cohesion** — **76** · each runner single-purpose. · `controllers` package aggregates many concerns under one name. · rename to `class`.
- **Abstraction Quality** — **80** · scope-bubbling, onion interceptors are the right abstractions. · module abstraction over-promises (no encapsulation). · enforce or relabel.
- **Layering** — **88** · dependency direction never violated. · — · preserve verbatim.
- **Dependency Direction** — **90** · verified acyclic; lower never imports higher (`ADR`/hierarchy enforced). · strongest single property of the codebase. · keep as the invariant.
- **Complexity** — **74** · feature surface large but each unit simple. · cumulative concept count high. · docs + testing harness lower perceived complexity.
- **Boilerplate** — **70** · four-package install + tsconfig flags. · setup tax. · one meta package path.
- **Test Quality** — **78** · TDD RED→GREEN, behavior-focused, real `createApp`. · one over-cap test file. · split.
- **Documentation Quality** — **72** · excellent RFC/ADR corpus; tiered doc standards. · user docs partial. · fill tiers.
- **Refactorability** — **82** · small files, strong tests, forced no-cache verification culture. · public surface not yet frozen (good — refactor now). · consolidate before freeze.
- **Future Evolution** — **80** · Extension model + lifecycle + scope foundations. · module encapsulation + non-HTTP binding are the open designs. · RFC both.

## Appendix C — Package Strategy (per package)

- **`@nextrush/controllers`** — one responsibility? *No* (aggregates 6+). Exposes too much? *Yes* (re-exports di+decorators). Merge? *Yes, with decorators → `@nextrush/class`.* Internal? *No, stays public.* Better name? *`@nextrush/class`.*
- **`@nextrush/decorators`** — one responsibility? *Yes (metadata).* Split? *No.* Merge into `class`? *Yes* — no independent consumer. Public? *Via `nextrush/class` only.*
- **`@nextrush/di`** — one responsibility? *Yes.* Merge? *No — keep independent (standalone reuse).* Split file `decorators.ts` 384? *Yes.*
- **`@nextrush/types`** — perfect as-is. Foundation.
- **`@nextrush/dev`** — one responsibility? *No (server+build+generators) but acceptable as toolkit.* Better name? *`@nextrush/toolkit`/`cli` (low priority).*
- **`@nextrush/core`** — correct, single responsibility, keep.
- **`nextrush`** — meta functional entry, keep.
- **`nextrush/class`** — the canonical boundary; promote from facade to authoritative.

**If starting today:** the layout in "Recommended Package Layout" above — identical layering, one merge (`class`), one elevation (`nextrush/class`).

## Appendix D — API Experience (first-time user, per API)

| API | Rating | Instantly understandable? |
| --- | --- | --- |
| Autocomplete | ⚠️ | Clouded by three import sources for one symbol. |
| Discoverability | ⚠️ | `registerModule`/request-scope not guessable under "controllers". |
| Imports | ⚠️ | Four packages OR `nextrush/class`; docs must force the latter. |
| Naming | ✅ | Decorator names are NestJS-parity, obvious. |
| Consistency | ✅ | `@Use*` family + runner pattern consistent. |
| Fluent API | ✅ | `app.use().get().route()` reads well. |
| Decorator APIs | ✅ | `@Controller/@Get/@Body/@UseGuard` — instantly clear to NestJS users. |
| DI APIs | ✅ | `@Service({scope})`, `@Repository`, `@Config`, `inject` — clear; errors excellent. |
| Controller APIs | ✅ | `registerControllers(app, opts)` obvious. |
| Builder APIs | ⚠️ | `buildRoutes`/`ControllerRegistry` are public but internal-flavoured. |
| Middleware APIs | ✅ | Koa-style, familiar. |
| Plugin/Extension APIs | ✅ | `app.extend()` + Extension interface clean. |
| OpenAPI APIs | ✅ | `app.use(openapi(app.router, opts))` clear post-v4. |
| Validation APIs | ✅ | Standard-Schema (Zod/Valibot/ArkType) via `@nextrush/validation`. |
| Configuration APIs | ⚠️ | Only `@Config` DI token; no typed config system. |
| Error APIs | ✅ | Typed hierarchy + filters; among the best surfaces. |

**Would developers instantly understand it?** *NestJS/Spring users: yes.* *Newcomers: mostly, except which package to import from and what "module" guarantees.*

## Appendix E — Scorecard (0–100, high scores justified)

| Category | Score | Justification |
| --- | --- | --- |
| Architecture | 83 | Clean acyclic layering, honest DI contract, reused seams. Held below 90 by unsettled public boundary. |
| Developer Experience | 70 | Strong errors/structure; dragged by setup + install + import friction. |
| API Design | 72 | Typed, additive, familiar — minus triple export + leaked metadata readers. |
| Package Architecture | 74 | Correct layering; one over-broad package + duplication. |
| Maintainability | 80 | RFC/TDD/forced-verification culture; small files. |
| Readability | 80 | Most files <200 LOC, cohesive naming. |
| Scalability | 80 | Scales on all designed axes; encapsulation + non-HTTP binding are open. |
| Enterprise Readiness | 58 | Missing testing harness, config, observability, encapsulation. |
| Plugin Readiness | 82 | Extension-model v4 purpose-built; reference Extension exists. |
| Documentation | 68 | Elite contributor docs (RFC/ADR); partial user docs. |
| Testing | 76 | Behavior-first TDD, real app in tests; no user-facing harness; one over-cap test file. |
| Performance | 78 | Competitive benchmarks; single-machine, no perf gate. |
| Tooling | 72 | `dev` server/build/generators solid; metadata-build footgun. |
| OSS Friendliness | 74 | Changesets, RFCs, ADRs, clear hierarchy. |
| Contribution Experience | 76 | Steering + RFC gate + TDD iron law make expectations explicit. |
| Learning Curve | 66 | NestJS-sized surface, sub-NestJS docs. |
| Code Quality | 82 | Strict TS, zero-`any` at barrels, disciplined splits. |
| Consistency | 78 | Uniform runner/`@Use*` patterns; duck-typed lifecycle is the outlier. |
| **Overall Framework Quality** | **73** | Strong bones, early-mature surface, one consolidation away from genuinely excellent. |

*No score is above 90 except Dependency Direction (90, Appendix B) — justified by a verified, never-violated acyclic import graph, the single most objectively-checkable property here.*

## Appendix F — DX Friction Audit (cognitive load)

| Friction | Severity | Why it exists | Who's affected | Redesign | Expected gain |
| --- | --- | --- | --- | --- | --- |
| Triple import source for one symbol | High | Convenience re-exports never pruned | New + experienced | `nextrush/class` sole path; stop cross-re-exports | Clean autocomplete; no drift |
| Decorator toolchain requirement ("TypeInfo not known") | Critical | Legacy dialect + metadata-stripping runtimes (`ADR-0001`) | New users (first run) | Deterministic metadata build in `@nextrush/dev`; loud preflight | Eliminates #1 first-run failure |
| Four-package class install | High | Layered packages, no class meta-package | New users | Merge to `@nextrush/class` | One install line |
| "controllers" owns modules/scope/lifecycle | Medium | Package grew past its name | All (discoverability) | Rename/merge to `class` | Guessable API |
| Module `exports` implies encapsulation | High | MVP grouping without enforcement | Experienced (Nest mental model) | Enforce, or relabel "grouping" | No broken expectations |
| Public metadata readers in first autocomplete | Medium | Tooling surface not namespaced | New users | Sub-path/namespace | Cleaner surface |
| Duck-typed lifecycle (no decorator) | Low | Interfaces over decorators | All | Document convention prominently | Discoverable hooks |

### Total cognitive load vs. peers

- **vs. Spring Boot:** dramatically lighter (no application context XML/annotations sprawl, no starter maze). NextRush wins on simplicity, loses on maturity/ecosystem.
- **vs. NestJS:** *comparable concept count* (controllers/DI/guards/interceptors/filters/scope/modules) but **lower current load per concept** thanks to fewer abstractions (no separate providers-vs-modules ceremony yet) — offset by weaker docs and the triple-import friction. Roughly **85% of NestJS's cognitive load** today; consolidation + testing harness would drop it to ~70%.
- **vs. Fastify:** higher — Fastify's plugin-encapsulation model is one concept; NextRush's class mode is many. Fastify wins for minimalists.
- **vs. Hono:** much higher — Hono is deliberately tiny. Not a fair comparison; NextRush's *functional* mode is the Hono-tier surface, and it's clean. The class mode targets the Nest/Spring segment.

**Bottom line:** NextRush's class-based cognitive load is **NestJS-class, trending lower** — its architecture is simpler than Nest's, and the remaining friction is surface/tooling hygiene, not conceptual weight. Fix the consolidation and the testing harness and it becomes the *lightest* full-featured class-based Node framework in its segment.
