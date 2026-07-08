# RFC-NEXTRUSH-CLASS-CONSOLIDATION — The `@nextrush/class` Runtime

**Status:** 🟢 Accepted — v2 (maintainer-approved 2026-07-08, 9.7/10; internal-structure refinements folded in; D1–D4 decided §7). Implementation gated only on execution go-ahead, not further design.
**Date:** 2026-07-08
**Type:** Package architecture + public-API (breaking — major version)
**Supersedes/settles:** the "surface consolidation" recommendation in `docs/audits/class-based-v3-strategic-audit.md`
**Related:** `ADR-0001` (decorator dialect), `RFC-NEXTRUSH-DI-CONTAINER-OWNERSHIP`, `RFC-NEXTRUSH-MODULES`, `RFC-NEXTRUSH-PLUGIN-SYSTEM`

---

## 1. Motivation

The class-based layer is feature-complete but its **public boundary is not settled**:

- The same symbols (`Controller`, `Get`, `Service`) are exported from three places
  (`@nextrush/decorators`, `@nextrush/controllers`, `nextrush/class`).
- `@nextrush/controllers` (17 source files, 2689 LOC) owns discovery, registry, builder,
  handler, param binding, guard/filter/interceptor runners, lifecycle, request scope,
  isolation, and modules. **It is the class runtime, not a "controllers" package.**
- Class-mode install is a four-package incantation.
- The `design:paramtypes` / `Reflect.getMetadata` reads (the load-bearing coupling to the
  deprecated decorator dialect per `ADR-0001`) are spread across `@nextrush/di` and
  `@nextrush/decorators` — so the future TC39 migration is a framework-wide change, not a
  contained one.

These are cheap to fix now and a **forced breaking migration** once a stable major freezes
the import paths. This RFC proposes **one consolidation release, no new features**, then a
boundary freeze.

**Non-goal:** new capabilities. This is pure boundary hygiene + future-proofing.

---

## 2. Guiding invariant

> **The class programming-model *surface* — decorators, parameter binding, and metadata —
> lives under `@nextrush/class`. The runtime *engines* it integrates with (scheduler, WS
> server, GraphQL executor, event bus) stay independent packages and are wired in.**

This is the carve-out that stops `@nextrush/class` from becoming the new god-package.
`@Cron`/`@Resolver`/`@WebSocket`/`@EventHandler` **decorators + binding** → `class`.
The cron scheduler, GraphQL executor, WS server, and `@nextrush/events` bus → their own
packages. `class` provides the decorator + binding + metadata; the engine provides the
runtime; a thin integration wires them.

---

## 3. Target package layout

```
@nextrush/types          # contracts (unchanged)
@nextrush/errors         # HTTP errors (unchanged)
@nextrush/core           # Application, middleware, extension lifecycle (unchanged)
@nextrush/router         # radix router (unchanged)
@nextrush/di             # container + @Service/@Repository/@Config + scopes  ← STAYS INDEPENDENT
@nextrush/class          # ← merged decorators + controllers (the class runtime)
@nextrush/testing        # ← NEW: DI/controller test harness
@nextrush/adapter-*      # platform adapters (unchanged)
@nextrush/<middleware>   # cors, helmet, openapi, validation, … (unchanged)
nextrush                 # meta: functional entry
nextrush/class           # subpath re-export → the one documented class entry point
```

**`@nextrush/di` stays separate — deliberately.** DI is reusable without the class runtime
(a functional app may want `@Service`/`inject` only). Merging it would couple two things
that have independent value. This is unchanged from the audit's recommendation and the
maintainer feedback agrees.

---

## 4. Internal structure of `@nextrush/class`

Feature-cohesive submodules under one mental model ("the class runtime"). Each is a folder
with its own barrel; none is a god-file (300-line cap holds).

```
@nextrush/class/src/
  reflection/        # ★ the ONLY place that touches Reflect / design:paramtypes
    reflection-service.ts       # read constructor param types, metadata get/set
    parameter-reader.ts
    constructor-reader.ts
  metadata/          # cohesive read/write functions keyed by constants (NOT a runtime service)
    metadata-keys.ts
    route-metadata.ts
    controller-metadata.ts
    parameter-metadata.ts
    guard-metadata.ts
    filter-metadata.ts
    interceptor-metadata.ts
    module-metadata.ts
    lifecycle-metadata.ts
  decorators/        # @Controller, @Get/@Post…, @Body/@Param…, @UseGuard/@UseFilter/@UseInterceptor,
                     # @HttpCode, @SetHeader/@Redirect, @Module, response decorators
  binding/           # param resolution (formerly param-resolver.ts)
  guards/            # guard-runner
  filters/           # filter-runner
  interceptors/      # interceptor-runner
  lifecycle/         # OnInit/OnShutdown collection + app.extend bridge
  request/           # request-scope + scope bubbling (formerly scope.ts) + isolation
  modules/           # @Module graph, module-registrar
  discovery/         # ★ DiscoverySource interface (filesystem | manifest | generated | memory)
  registrar/         # ControllerRegistry + registration (boot-time)
  bootstrap/         # ★ named linear stages producing the Application Graph (see §5)
  runtime/           # ★ request-time EXECUTION: handler assembly + guard→interceptor→method→filter
                     #   onion + per-request binding + request-scope child-container resolution
  diagnostics/       # ★ opt-in, zero-cost-when-off: route/provider graph dump, boot/reflection timing
  errors.ts
  index.ts           # public barrel (the class surface)
```

**Three-phase discipline (no folder becomes the new god-folder):**

| Phase | Owner | Responsibility |
| --- | --- | --- |
| Boot-time — build | `discovery/` + `bootstrap/` | Discover classes, read metadata (via `reflection/`), compute the frozen Application Graph. |
| Boot-time — register | `registrar/` | Register providers + routes + lifecycle bridge from the graph. |
| Request-time — execute | `runtime/` | Assemble/execute the handler onion and per-request (child-container) resolution against the frozen graph. |

`runtime/` owns *execution*, not *construction* — it never reads `Reflect` (that already
happened at boot, cached in the graph) and never re-discovers. This keeps `bootstrap/` from
growing unbounded (the maintainer's concern) without letting `runtime/` absorb boot concerns.

### 4a. `reflection/` — the future-proofing keystone

**Rule: no file outside `reflection/` calls `Reflect.getMetadata`, `Reflect.defineMetadata`,
or reads `design:paramtypes` directly.** Everything goes through `ReflectionService`.

Why this is the most important part of the RFC: `ADR-0001` commits the class layer to the
*deprecated* `experimentalDecorators`/`emitDecoratorMetadata` dialect, and the audit named
that the #2 long-term risk. Today the reflection reads are scattered across di + decorators,
so the eventual TC39-Stage-3 / compiler-transform / codegen migration is a framework-wide
rewrite. With this boundary, **that migration becomes one module's rewrite** — every other
submodule consumes `ReflectionService` and survives unchanged. This converts the biggest
long-term risk into a contained one.

### 4b. `metadata/` — module, not service

Cohesive **pure functions** (`getRouteMetadata`, `setParamMetadata`, …) keyed by the
constants in `metadata-keys.ts`. **Not** an injected `MetadataProvider` object — a stateful
runtime service here would be a god-object and add hot-path indirection. Centralize the keys
and accessors; keep them stateless. (This already exists ~70% as `metadata.ts` +
`metadata-keys.ts`; this formalizes it.)

---

## 5. Bootstrap pipeline (named stages, not a pipeline engine)

`registerControllers` / `registerModule` are refactored into an explicit, testable stage
sequence — **composable functions, not an abstract `Pipeline`/`Stage` framework** (that is
YAGNI until third-party bootstrap stages exist, which they don't):

```
bootstrap(app, options):
  1. discover      → collect controller/module classes
  2. metadata      → read route/param/guard/filter/interceptor/module metadata (via reflection/)
  3. providerGraph → collect @Service graph, compute effective scopes (bubbling)
  4. validation    → eager DI + guard validation (fail-fast at boot)
  5. registrar     → register providers + build routes + lifecycle bridge
  6. router        → mount routes on app.router
```

Each stage is a pure-ish function taking a single **`BootstrapContext`** and returning the
next — never a 15-parameter signature. The context accumulates as it flows:

```ts
interface BootstrapContext {
  readonly app: Application;
  readonly options: ResolvedOptions;
  readonly source: DiscoverySource;      // §4/§D-new: how classes were found
  controllers: ClassRef[];
  providers: ProviderNode[];
  metadata: MetadataGraph;               // read once, frozen after stage 2 (see below)
  graph: ApplicationGraph;               // the IR, built by stage 3
  routes: BuiltRoute[];
  diagnostics: Diagnostics;              // opt-in; no-op sink when disabled
}
```

`registerControllers`/`registerModule` become thin orchestrators over these stages. Each
stage is unit-testable in isolation; future stages (e.g. an OpenAPI-metadata stage) slot in
by name.

### 5a. The Application Graph (immutable IR) — "read once, freeze, run"

The keystone refinement. Instead of re-reading `Reflect`/metadata during execution, the
bootstrap builds a **frozen Application Graph** — the framework's internal representation,
in the lineage of the Angular compiler, NestJS's module graph, and ASP.NET Core's endpoint
model:

```
reflection  →  MetadataGraph (frozen after stage 2)  →  ApplicationGraph (frozen after stage 3)
                                                              │
                                       controllers · providers · routes · modules ·
                                       guards · filters · interceptors · effective scopes
                                                              │
                                                       runtime/ executes it
```

- **Metadata is read exactly once** (stage 2, through `reflection/`) into a `MetadataGraph`,
  then `Object.freeze`d. No `Reflect.getMetadata` on the request path. This satisfies the
  maintainer's "read once, freeze, run" requirement and removes reflection from the hot path.
- The `ApplicationGraph` (stage 3) is the composed IR the registrar registers and `runtime/`
  executes.

**Two honesty flags (written in so they aren't discovered later):**

1. **The IR freezes the *shape*, not the *instances*.** Routes, provider graph, metadata,
   and effective scopes are immutable; **request-scoped controllers/services still
   instantiate per request** from the frozen graph via the child-container path (Wave 13).
   Freezing instances would silently break request scope. The graph is a *plan*, not a cache
   of live objects.
2. **This is a genuine boot-path internal redesign, not the mechanical move of steps 1–2.**
   It raises the consolidation's cost and gets its own migration phase (§8, phase 3b). No
   public-API change; behavior identical; but it is a rewrite of the boot sequence guarded by
   characterization tests, not a file relocation. Worth it for the reflection-isolation and
   diagnostics payoff — stated plainly rather than sold as free.

### 5b. `DiscoverySource` — discovery doesn't know the filesystem

Stage 1 depends on a `DiscoverySource` interface, not `fs` directly:

```ts
interface DiscoverySource {
  discover(): Promise<ClassRef[]>;   // or sync
}
// implementations: FilesystemSource (today), ManifestSource, GeneratedSource, MemorySource
```

`MemorySource` makes `@nextrush/testing` trivial (feed classes directly, no disk);
`GeneratedSource`/`ManifestSource` future-proof for build-time codegen — the same axis
`ADR-0001` flags as a possible decorator-dialect successor. Non-breaking: `FilesystemSource`
is the default and preserves today's `root`-scanning behavior.

### 5c. Diagnostics — first-class, zero-cost when off

`diagnostics/` exposes the route graph, provider graph, duplicate-route/circular-dependency
detection, and boot/reflection timing — the data a CLI (`nextrush graph`, `nextrush doctor`)
and better error messages need. **Constraint:** disabled by default and behind a no-op sink,
so it adds nothing to boot time when off (protects the §12 "boot performance unchanged"
criterion). Enabled via option or env for tooling.

---

## 6. Public API after consolidation

**One documented import path per programming model:**

```ts
// Functional
import { createApp, createRouter, listen } from 'nextrush';

// Class-based — ONE source
import {
  Controller, Get, Post, Body, Param, Query,
  Service, Repository, inject,
  UseGuard, UseFilter, UseInterceptor, Catch, HttpCode,
  Module, registerControllers, registerModule,
} from 'nextrush/class';
```

- `@nextrush/decorators` and `@nextrush/controllers` **stop being documented public
  packages.** Internal packages stop re-exporting each other.
- Internal-flavoured exports (`buildRoutes`, `ControllerRegistry`, raw metadata readers)
  move behind a `nextrush/class/internal` sub-path or a `metadata` namespace so they are not
  in the newcomer's first autocomplete but remain available for tooling.
- `@nextrush/di` remains public and independently importable.

---

## 7. Open decisions (require maintainer sign-off before implementation)

| # | Decision | Options | RFC recommendation |
| --- | --- | --- | --- |
| D1 | Class install shape | (a) `nextrush/class` subpath only → `pnpm add nextrush` but functional-only users pull class/DI deps; (b) standalone `@nextrush/class` → one extra install line, functional/edge users stay lean | **(b) standalone `@nextrush/class`**, with `nextrush/class` kept as a re-export subpath for discoverability. Bundle-sensitive (edge) users matter more than one install line. |
| D2 | `@nextrush/decorators` fate | keep as thin internal re-export vs. fully absorb | Absorb into `@nextrush/class/decorators`; publish a deprecation shim for one major. |
| D3 | Reflection abstraction depth | service object vs. free functions | Free functions in `reflection/` with a stable internal interface — enough to isolate the dialect, not a heavyweight service. |
| D4 | Timing | ship before or with the Extension-model v4 major | Fold into the same major to spend one migration budget, not two. |

**Decisions (maintainer, 2026-07-08 — all accepted):**
- **D1 → (b)** standalone `@nextrush/class`; functional/edge users must not install
  reflect-metadata + decorators + controller runtime. `nextrush/class` kept as a re-export
  subpath for discoverability.
- **D2 → absorb** `@nextrush/decorators` into `@nextrush/class/decorators`; deprecation shim
  for one major. "Nobody imports `@nextrush/decorators` in 2027."
- **D3 → free functions** in `reflection/`; no service object.
- **D4 → fold into the Extension-model v4 major**; one migration budget, not two.

---

## 8. Migration plan

1. **Docs-hide (non-breaking, ship now):** make `nextrush/class` the only documented class
   import; stop cross-package re-exports in docs and examples. No code move.
2. **Internal refactor (non-breaking):** split `di/decorators.ts` (384) and
   `decorators/params.ts` (376) under the cap; introduce `reflection/` + `metadata/`
   boundaries *within the current packages* first (characterization-tested, zero behavior
   change) so the physical merge is a move, not a rewrite.
3. **Physical merge (breaking, major):** `decorators` + `controllers` → `@nextrush/class`
   with the §4 layout. Ship a `@nextrush/decorators` / `@nextrush/controllers` deprecation
   shim that re-exports from `@nextrush/class` for one major line.
4. **Application Graph (IR) + `BootstrapContext` + `runtime/` split (breaking-internal only,
   same major):** the boot-path redesign (§5a). Behavior identical, public API unchanged, but
   a genuine rewrite of the boot sequence — guarded by characterization tests captured
   *before* the change. Introduce `DiscoverySource` and `diagnostics/` here. This is the
   phase whose cost §5a flags; it is deliberately *after* the mechanical merge so the merge
   stays a low-risk move.
5. **Codemod:** `nextrush-codemod consolidate-imports` rewriting old imports → `nextrush/class`.
6. **`@nextrush/testing`:** land as its own package (see §9), backed by `MemorySource`.
7. **Freeze:** declare the boundary the long-term contract; stable major.

**Migration cost:** high (major + codemod + migration guide), but *lower than the forced
migration later* — most real users import from `nextrush/class` already, so the shim + codemod
covers the majority with a one-line change.

---

## 9. `@nextrush/testing` (first-class)

Spring/Nest-parity harness — the highest adoption-ROI item:

```ts
import { createTestModule } from '@nextrush/testing';

const mod = await createTestModule({
  controllers: [UserController],
  providers: [UserService],
})
  .override(UserService).useValue(fakeUserService)   // override()
  .compile();

const controller = mod.get(UserController);            // resolve()
const svc = mod.get(UserService);                      // service()
// mod.request(...) for in-memory HTTP-level assertions
```

Backed by an isolated per-test child container (the request-scope machinery already provides
child-container support) so tests never leak singletons across cases.

---

## 10. Trade-offs summary

| | Gain | Cost |
| --- | --- | --- |
| Merge → `@nextrush/class` | Single mental model; ends triple-export drift; name matches contents | Major + codemod + shim maintenance |
| `reflection/` boundary | TC39/dialect migration becomes one module, not a framework | Small internal indirection |
| `metadata/` module | One read/write source of truth | Formalizing existing code |
| Bootstrap stages | Testable, extensible boot | Characterization-tested refactor |
| Single public entry | Two memorable doors; huge DX | Docs + example churn |
| `@nextrush/testing` | Adoption driver | New package to maintain |

---

## 11. Long-term impact

Ends the framework's "collection of related packages" identity and replaces it with two
clean, memorable programming models — **functional (`nextrush`)** and **class-based
(`nextrush/class`)** — behind which everything else is an implementation detail free to
evolve. Future class-model features (`@Cron`, `@Resolver`, `@WebSocket`, `@EventHandler`)
have an unambiguous home (their *decorators* in `@nextrush/class`, their *engines* in their
own packages), and the reflection boundary makes the one bet the framework can't easily walk
back (`ADR-0001`) survivable. This is the release that earns a stable major.

---

## 12. Success criteria (measurable — this is the "done" definition)

The consolidation is complete only when **all** of these hold. Each is checkable, not a vibe.

| # | Criterion | How it's verified |
| --- | --- | --- |
| S1 | Users only ever need to remember **`nextrush`** (functional) or **`nextrush/class`** (class). | Docs, examples, generators, and `create-nextrush` templates reference no other class import path. Grep of `apps/` + `docs/` for `@nextrush/decorators` / `@nextrush/controllers` returns only historical/migration files. |
| S2 | No user-facing docs mention `controllers`, `decorators`, `reflection`, `metadata`, or any internal package as an import surface. | Docs audit; the tiered docs standards updated. |
| S3 | Every internal API is replaceable without a public break. | `reflection/` is the sole `Reflect`/`design:paramtypes` consumer (lint rule / grep gate); swapping it changes no public type. |
| S4 | **Request-time performance unchanged** (± noise). | `apps/benchmark` before/after: RPS within run-to-run variance on the class-controller scenario; zero `Reflect` calls on the request path (IR frozen at boot). |
| S5 | **Bundle size unchanged for functional users**; class users pay only the class runtime. | Functional-only import graph excludes reflect-metadata + class runtime (D1 standalone package makes this structural). Size check in CI. |
| S6 | Boot performance not regressed beyond a stated budget. | Boot-timing diagnostic; IR build within an agreed ms budget on the reference app (diagnostics off by default so the measurement path adds nothing when disabled). |
| S7 | **Codemod migrates ≥95% of imports automatically.** | Run `nextrush-codemod consolidate-imports` against playground + examples + a sample repo; manual edits ≤5% of changed import sites. |
| S8 | Zero behavior change. | Full forced no-cache `typecheck --force` + `build` + `test` green; characterization tests captured before the IR redesign still pass. |
| S9 | Deprecation shims present for one major. | `@nextrush/decorators` / `@nextrush/controllers` re-export from `@nextrush/class` and emit a documented deprecation notice. |

**Anti-goals (explicitly out of scope for this release):** no new user-facing features, no
pipeline/stage *engine* abstraction, no DI merge, no default flip of per-app isolation, no
module-encapsulation enforcement (that is its own RFC). This release is boundary hygiene +
internal future-proofing only.
