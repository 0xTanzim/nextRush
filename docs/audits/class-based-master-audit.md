# NextRush Class-Based Architecture — Master Audit (v2.0)

Read-only, multi-lens audit of `@nextrush/decorators`, `@nextrush/di`, `@nextrush/controllers`, the `nextrush`/`nextrush/class` meta entries, `@nextrush/dev` generators, and `apps/playground`. Every finding is verified against the **current** source after the 5-wave remediation (commits `e1f84e2`, `512c5a6`, `cfa45f0`, `9956698`, `147877d`). No code was modified.

Severity: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low. Confidence: High / Medium / Low.

---

## Executive Summary

The class-based stack is materially healthier than at v1.0: the broken CLI generators, dead/phantom exports, swallowed guard errors, fail-late controller DI, and the misleading status examples are genuinely fixed and covered by tests. However, this audit finds that **the highest-severity original problem (CRITICAL-2, global DI container) is not resolved — it was made explicit and deferred to an RFC — and the remediation that seam'd it introduced a NEW regression: importing the functional `nextrush` entry now transitively loads `reflect-metadata` + tsyringe**, defeating the primary reason the `nextrush` / `nextrush/class` split exists. A second new finding: eager DI validation covers controllers but **not class-based guards**, so guard DI is still fail-late. The architecture remains sound and NestJS-familiar, but its DI foundation is still a process-global singleton with partial isolation, and it is committed (by ADR) to the legacy TypeScript decorator dialect.

Overall class-based health: **72 / 100** (up from 62). Production-ready for single-app SMB use; still not enterprise/multi-tenant safe by default.

---

## Architecture Scorecard

| Dimension | v1.0 | Now | Notes |
|---|---|---|---|
| Overall health | 62 | 72 | Real fixes landed + tested |
| DI correctness | 55 | 62 | Fail-fast controllers + explicit seam; global container + guard-DI-fail-late remain |
| Controller architecture | 66 | 78 | Guard errors, discovery, hot path, status all improved |
| DX | 55 | 70 | Generators fixed, status docs, ADR; reflect-metadata regression is a new paper-cut |
| API consistency | 66 | 74 | Dead exports gone; scope-default inconsistency remains |
| Maintainability | 62 | 68 | Dedup done; tsyringe-internals coupling + string-matched errors remain |
| Scalability | 50 | 55 | Convention discovery + parallel imports help; global container + sequential eager-resolve remain |
| Bundle hygiene (functional path) | 70 | 45 | **Regressed** — functional entry now pulls tsyringe |
| Risk | High | Med-High | Legacy-decorator ADR accepted; DI redesign RFC still open |

---

## Previous Issues Verification

| ID | Original issue | Status | Evidence |
|---|---|---|---|
| CRITICAL-1 | Generators emit non-compiling imports | ✅ **Fixed** (High conf.) | `dev/generators/templates.ts` controller/service/guard now import from `nextrush/class`; RED-GREEN template test present |
| CRITICAL-2 | Global DI container / illusory per-app isolation | ⚠️ **Partially fixed / deferred** (High conf.) | `createApp()` sets `container = options?.container ?? sharedContainer` — the **shared global** `@nextrush/di` container. Two `createApp()` apps still share the same container instance. Full isolation is RFC'd (`docs/RFC/RFC-NEXTRUSH-DI-CONTAINER-OWNERSHIP.md`); `di/decorators.ts` still calls tsyringe `singleton()`/`injectable()` → global registration. **Not resolved for isolation.** |
| CRITICAL-3 | Fail-late controller resolution | ✅ **Fixed for controllers** (High conf.) | `registrar.ts` `validateControllers()` resolves each controller at registration when `validate !== false`. **See NEW-2: guards not covered.** |
| HIGH-1 | Guard errors swallowed → 403 only | ✅ **Fixed** (High conf.) | `builder.ts` `executeGuards` no longer has a try/catch conversion; thrown errors propagate (401 possible); `return false` → `GuardRejectionError` (403). 4 tests. |
| HIGH-2 | Discovery imports everything, serially | ✅ **Fixed** (High conf.) | `discovery.ts` default include = `**/*.controller.{ts,js}`, bounded-parallel imports (concurrency 16), single-sourced `DEFAULT_INCLUDE`, side-effects documented |
| HIGH-3 | No request scope, untested concurrency | 🟡 **Mitigated, not solved** (High conf.) | Singleton characterization test + stateless-contract docs added; request scope still absent (RFC backlog) |
| HIGH-4 | Legacy-decorator lock-in undocumented | ✅ **Addressed** (High conf.) | `docs/adr/ADR-0001-decorator-dialect.md` (Accepted) |
| P2-8 | Dead/phantom exports | ✅ **Fixed** (High conf.) | `buildFullPath`, `getMethodParameterTypes/ReturnType`, `registerController`-singular, `TypeInferenceError`, `ContainerDisposedError`, `AutoInjectable`, `MissingDependencyError`, `INTERCEPTORS` all removed |
| P2-9 | Status can't be set from return | ✅ **Doc'd + example fixed** (High conf.) | Playground throws `NotFoundError`; response/status model documented; `@HttpCode` RFC-flagged |
| P2-10 | Per-request resolve overhead | ✅ **Fixed** (High conf.) | `createRouteHandler` lazy-memoizes the singleton |
| P2-11 | tsyringe-internals coupling, string-matched errors, scope defaults | ❌ **Not addressed** (High conf.) | `di/decorators.ts` `Optional()` still writes tsyringe `'injectionTokens'`; `container.ts` still matches `message.includes('not registered')`; scope defaults still inconsistent |
| P3-12 | Duplicated `normalizePath` / param boilerplate | ✅ **Fixed** (High conf.) | `decorators/src/path-utils.ts`; param helper extracted |
| MED (dual path builder) | `buildFullPath` vs `buildFullRoutePath` | ✅ **Fixed** (High conf.) | Dead one removed; only `buildFullRoutePath` remains |
| LOW (`@All` → 7 routes) | | ❌ **Not addressed** | `routes.ts` still expands to 7 registrations |

---

## New Findings

### 🟠 NEW-1 — Functional `nextrush` entry now transitively loads `reflect-metadata` + tsyringe (Confidence: High) — ✅ RESOLVED (Wave 6, commit `55d0766`)
> `createApp()` no longer imports `@nextrush/di` or attaches a container by default; the functional path is DI-free again, verified by a source-level guard test.
- **Evidence:** `packages/nextrush/src/index.ts` now has `import { container as sharedContainer } from '@nextrush/di'`, used by `createApp()`. `@nextrush/di`'s `index.ts` begins with `import 'reflect-metadata'` and re-exports `container.ts`, which does `import { container as tsyContainer } from 'tsyringe'`.
- **Root cause:** Wave 2's container-seam wired the DI container into the *functional* meta entry to guarantee `app.container`.
- **Impact:** The entire reason `nextrush` (functional) and `nextrush/class` (OOP) are split — per the file's own docblock, *"Functional users who only need createApp/createRouter should import from nextrush — no reflect-metadata overhead"* — is now violated. Every functional user pays the `reflect-metadata` global-`Reflect`-patch + tsyringe bundle/startup cost.
- **Risk:** Bundle bloat for edge/serverless functional deployments; contradicts documented positioning; a global `Reflect` mutation now happens for all consumers.
- **Recommended fix:** Make `createApp()` provide the container lazily (only construct/attach it on first `app.container` access or when a registrar asks), or have `@nextrush/core` own a container abstraction that doesn't import tsyringe at module load. Tracked in the DI-ownership RFC §8.
- **Trade-offs:** Lazy wiring adds a small indirection; the alternative (accept the coupling) permanently taxes the functional path.
- **Priority:** High — it silently erased a headline architectural property.

### 🟠 NEW-2 — Eager DI validation covers controllers but NOT class-based guards or middleware-token failures uniformly (Confidence: High) — ✅ RESOLVED (Wave 6, commit `55d0766`)
> `registerControllers` eager validation now also resolves every distinct class-based guard, so guard DI fails at boot; RED-GREEN tested. (Middleware token refs were already resolved eagerly at build time.)
- **Evidence:** `registrar.ts` `validateControllers()` loops registered controllers and calls `container.resolve(controller.target)` only. `builder.ts` `executeGuards` resolves class guards with `container.resolve(guard)` **lazily, per-request**. Middleware string/symbol refs are resolved **eagerly** in `resolveMiddlewareRefs` at `buildRoutes` time.
- **Root cause:** CRITICAL-3's fix was scoped to controller tokens; the guard and middleware resolution paths were not folded into the boot-time validation.
- **Impact:** Three different DI-failure timings: middleware-token failure → at registration; controller dep failure → at registration (validate); **class-guard dep failure → 500 on first request to a guarded route** (fail-late, the exact class of bug CRITICAL-3 set out to kill). Inconsistent and surprising.
- **Risk:** A guard with an unresolvable/circular dependency passes boot and explodes in production traffic.
- **Recommended fix:** In `validateControllers`, also resolve every class guard (`getAllGuards` per route, filtered by `isGuardClass`) so guard DI fails fast too; document the unified guarantee.
- **Trade-offs:** Slightly more boot work; instantiates guard singletons at boot (consistent with controllers).
- **Priority:** High.

### 🟡 NEW-3 — Redundant double-resolve on first request under `validate: true` (Confidence: High) — ✅ RESOLVED (Wave 7, `4c0fff8`)
- **Evidence:** With `validate: true` (default), `validateControllers` resolves each controller at boot; then `createRouteHandler`'s lazy memoize resolves the *same* singleton again on the first request (`isResolved` starts false in the closure).
- **Impact:** One redundant `container.resolve` per route on first hit (returns the cached tsyringe singleton, so correctness is fine; pure micro-waste). At 1000 controllers it's 1000 extra first-hit resolves.
- **Recommended fix:** Have `validateControllers` hand the resolved instances back to the builder (or pre-seed the handler closures), so the boot resolve and the memoized instance are the same reference.
- **Priority:** Medium (perf polish).

### 🟡 NEW-4 — Eager validation flattens `CircularDependencyError`/`DependencyResolutionError` into a generic `ControllerResolutionError` (Confidence: High) — ✅ RESOLVED (Wave 7, `4c0fff8`)
- **Evidence:** `validateControllers` wraps *any* resolve error as `new ControllerResolutionError(name, cause)`. `@nextrush/di` produces excellent specific messages (`CircularDependencyError` with cycle + break strategies; `DependencyResolutionError` with fix recipes) — these are now nested in `.cause`, and the top-level boot error is the generic controller message.
- **Impact:** The best diagnostic messages in the codebase are demoted to a cause chain at exactly the moment (boot failure) a developer most needs them.
- **Recommended fix:** In `validateControllers`, if the error is already a `DIError` subclass, rethrow it as-is (or surface its message) rather than always wrapping.
- **Priority:** Medium (DX).

### 🟡 NEW-5 — `bootstrap()` on the shared global container is not idempotent across apps (Confidence: Medium) — ✅ RESOLVED (Wave 7, `4c0fff8`)
- **Evidence:** `container.ts` `bootstrap()` iterates `factoryTokens` then `factoryTokens.clear()`. `registerControllers` calls `opts.container.bootstrap()`. Because `createApp()` defaults every app to the *same* shared container wrapper (NEW findings + CRITICAL-2), the first app's `bootstrap()` clears `factoryTokens`; a second `createApp()`+`registerControllers()` in the same process finds an empty set and silently bootstraps nothing.
- **Impact:** In multi-app-per-process setups (tests, serverless warm reuse, embedding), factory providers may not bootstrap for the second app. Silent.
- **Recommended fix:** Part of the DI-ownership RFC (per-app containers); short-term, make `bootstrap()` re-derive factory tokens or be safely re-runnable.
- **Priority:** Medium (edge, but silent).

### 🟢 NEW-6 — Guard `GuardContext` snapshot can desync from a mutated `ctx` (Confidence: Medium) — ✅ RESOLVED (Wave 7, `4c0fff8`, documented contract)
- **Evidence:** `executeGuards` builds a `guardContext` object copying `ctx.method/path/params/query/headers/body/state`. `state` is passed by reference (mutations visible), but `body`/`params` are captured by value at guard time. A guard mutating `ctx.body` via the real context isn't possible (it only has the snapshot), and a guard that sets `guardContext.state.user` works only because `state` is the same reference.
- **Impact:** Subtle: guards can attach to `state` (works) but the value-captured fields could drift if middleware mutates `ctx` after the snapshot — not currently exploitable since guards run before the handler, but it's an implicit contract.
- **Priority:** Low (document the contract).

### 🟢 NEW-7 — `import 'reflect-metadata'` duplicated as a side-effect import across many source files (Confidence: High) — ✅ RESOLVED (Wave 7, `4c0fff8`)
- **Evidence:** `builder.ts`, `registrar.ts`, `registry.ts`, `discovery.ts`, decorator files, and di all carry top-level `import 'reflect-metadata'`. Harmless (idempotent) but scattered.
- **Priority:** Low (tidy to a single entry-point import).

---

## Remaining Technical Debt (carried from v1.0, still open)
- **P2-11:** `Optional()` writes tsyringe's private `'injectionTokens'` metadata; `container.resolve` detects errors by `message.includes('not registered'|'cannot resolve'|'unregistered dependency')`; three inconsistent scope defaults (`@Service`=singleton, `register()`=transient, registry=singleton). All fragile across tsyringe versions.
- **CRITICAL-2 core:** global container / global `@Service` registration — RFC open.
- **HIGH-3 core:** no request-scoped DI — RFC backlog.
- **LOW:** `@All` → 7 route registrations.
- **Missing production features** (RFC backlog, `TODO.md`): interceptors, exception filters, service lifecycle hooks, module system/encapsulation, `@HttpCode`.

---

## Package-by-Package Audit
- **`@nextrush/decorators`** — 8/10. Clean metadata; dedup done; still bound to `experimentalDecorators`. `Symbol.for('nextrush:*')` metadata keys use the global registry (pro: cross-duplicate-version interop; con: forgeable/global namespace).
- **`@nextrush/di`** — 6.5/10. Fail-fast surfaced via registrar; excellent error copy (now partly buried, NEW-4). Global container + tsyringe-internals coupling + string-matched errors persist.
- **`@nextrush/controllers`** — 7.5/10. Guard errors, discovery, hot path all improved; NEW-2/3/4 are the remaining gaps. `resolveMiddlewareRefs` eager vs guards lazy (inconsistent timing).
- **`@nextrush/dev` generators** — 7/10. Imports fixed + tested.
- **`nextrush` / `nextrush/class`** — 6/10. Split integrity regressed by NEW-1.

---

## DI Audit
Constructor injection, singleton/transient, circular detection, `@Optional`, factory + async (`bootstrap`), child containers all present. Versus peers: **weaker than Spring/NestJS/ASP.NET Core** — no per-request scope, no module encapsulation, no lifecycle hooks, container is a process-global. **Simpler than** those (single `resolve`/`register` surface, great errors). **Comparable to raw tsyringe** (it *is* a thin tsyringe wrapper), inheriting tsyringe's maintenance risk and its global-container model. Key remaining weaknesses: NEW-1, NEW-2, NEW-5, P2-11, CRITICAL-2 core.

## Controller Audit
Discovery (convention + parallel), guards (correct error propagation), param injection (precomputed plan), response (return→200 documented), lazy-memoized resolution — all solid. Gaps: NEW-2 (guard DI fail-late), NEW-3 (double-resolve), `@All` fan-out, and a missing-body-parser `@Body` failure reports a generic `MissingParameterError` without hinting the real cause (no body-parser middleware) — DX paper-cut.

## Decorator Audit
Metadata-only, `getOwnMetadata` used to avoid inheritance bleed (good). Legacy-dialect committed via ADR-0001. Guards' `isGuardClass` proto-sniff remains a footgun (a class guard missing `canActivate` is treated as a function → constructor-without-`new` TypeError, which now correctly propagates as a 500 rather than a masked 403 — an improvement from HIGH-1).

## Guard Audit
Fixed 401/403 semantics. Remaining: class-guard DI fail-late (NEW-2); guards run before controller resolution (correct); no interceptor/pipe layer.

## Middleware Audit
Controller/route `middleware` refs are wired and resolved eagerly at build time. Timing inconsistency with guards (NEW-2). Function refs used directly; token refs from DI.

## Metadata Audit
`Symbol.for` global-registry keys (NEW-7 relation). `design:paramtypes` powers tsyringe constructor injection; the now-removed method-param readers confirm NextRush never used method-level `design` metadata.

## Plugin Architecture Audit
The class system integrates via the registrar + DI, not a formal plugin lifecycle. A "plugin" can register controllers (call `registerControllers` with explicit `controllers: []`), register/replace services (`container.register` — but on the *global* container, so no isolation), and contribute route metadata. **Cannot**: cleanly override another plugin's services in isolation, scope registrations per plugin, or extend decorators/metadata through a supported API. Limited vs NestJS modules / Spring Boot auto-config.

## Startup & Bootstrap Audit
`registerControllers`: discover → `bootstrap()` factories → register routes → (validate) eager-resolve controllers. NEW-2 (guards excluded), NEW-3 (double-resolve), NEW-5 (bootstrap idempotency), and sequential eager-resolve (O(controllers)) are the boot-path risks.

## Performance Audit
Hot path is now allocation-light (precomputed params, memoized instance). Boot cost grows with controllers × service graph (eager resolution instantiates all singletons at boot — intended fail-fast, but heavy at 1000+ controllers, and sequential). Discovery is bounded-parallel. Functional-path startup regressed (NEW-1).

## DX Audit
Generators fixed, status model documented, ADR present. Paper-cuts: NEW-1 (functional users get tsyringe), NEW-4 (buried DI errors at boot), missing-body-parser confusion, `emitDecoratorMetadata` setup cliff (documented, inherent to the dialect).

## Security Audit
Discovery `import()`s matched files (convention default shrinks the surface vs scan-all). Metadata is forgeable via the global `Symbol.for` registry (requires in-process code — low). No new injection vectors. Global container means one plugin/app can read/replace another's service registrations in-process (isolation gap, tied to CRITICAL-2).

## OSS Maintainability Audit
Small files, good tests, clear errors, ADR + RFC discipline. Risks for contributors: tsyringe-internals coupling (P2-11) and string-matched error detection are brittle and non-obvious; the global container model will confuse anyone expecting per-app DI.

## Enterprise Readiness Audit
Blocking for large/multi-tenant use: global container (no isolation), no request scope, no module encapsulation, boot cost at 1000+ controllers, NEW-5 bootstrap idempotency. The DI-ownership RFC is the gate for enterprise readiness.

## Dead Code Audit
Clean — all v1.0 dead/phantom exports removed and verified (grep shows only regenerated build-cache artifacts). No new dead code introduced.

## API Consistency Audit
Improved (dead exports gone, explicit registration first-class). Remaining inconsistency: three DI scope defaults; eager vs lazy DI-failure timing (NEW-2).

## Documentation Audit
Strong: README/docs reconciled to real handler order, response/status documented, ADR + RFC written, TODO backlog. Minor: `di/decorators.mdx` `@SetHeader` wording ("before the handler sends a response") is looser than the reconciled controllers page (advisory, defensibly accurate).

## Test Coverage Gaps
- No test for **class-guard DI failure** (NEW-2).
- No test for **multi-app / bootstrap idempotency** (NEW-5).
- No true **concurrency** test (singleton same-instance is covered; concurrent-safety is not).
- No test asserting the **functional path stays tsyringe-free** (would have caught NEW-1).

## Missing Production Features
Interceptors, exception filters, service lifecycle hooks, module system, request-scoped DI, `@HttpCode`, per-app DI isolation — all RFC-tracked in `TODO.md`.

## Hidden Architectural Risks
1. **tsyringe as the DI foundation** — low upstream activity; NextRush pokes its internals. A tsyringe break/abandon is a framework-level risk.
2. **Global container as the default** — every isolation story depends on the open RFC.
3. **Legacy decorator dialect** — accepted, but a hard ceiling on TC39 migration.

## Future Evolution Risks
- Migrating off the global container is now a breaking change with a real migration burden the longer adoption grows.
- The `nextrush`↔`nextrush/class` boundary is eroding (NEW-1); left unfixed, "functional is lightweight" stops being true and can't be walked back without another breaking change.

## Refactoring Recommendations
1. Fix NEW-1 (lazy/tsyringe-free functional container) — protects the split.
2. Fix NEW-2 (validate guard DI at boot) — completes CRITICAL-3.
3. Land the DI-ownership RFC (per-app containers) — unlocks isolation, fixes NEW-5, enables request scope.
4. NEW-4 (preserve DI error types at boot), NEW-3 (single resolve).
5. Address P2-11 (stop poking tsyringe internals; typed error detection).

## Prioritized Roadmap
- **🔴 Critical:** DI-ownership RFC implementation (global container → per-app) — the one blocker for enterprise/isolation. (Approval-gated.)
- **🟠 High:** NEW-1 (functional path tsyringe regression) · NEW-2 (guard DI fail-late) · add the two missing tests that would have caught them.
- **🟡 Medium:** NEW-3, NEW-4, NEW-5 · P2-11 (tsyringe internals + error detection + scope defaults) · missing-body-parser DX hint.
- **🟢 Low:** `@All` fan-out · NEW-6 guard-context contract doc · NEW-7 reflect-metadata import tidy · `@SetHeader` doc wording.

---

### Verdict
The remediation was real and well-tested, but this audit's headline is that **CRITICAL-2 remains open by design and its interim seam introduced NEW-1**, and **CRITICAL-3 is incomplete (NEW-2)**. Closing NEW-1, NEW-2, and the DI-ownership RFC would move the class-based system from "good, single-app-ready" to genuinely enterprise-grade.

---

## Update — Wave 8 (commit `90e7350`)

- **CRITICAL-2 (global DI container / per-app isolation)** — ⚠️→✅ **Opt-in isolation shipped.** `registerControllers(app, { isolate: true })` now gives an app its own service-singleton graph via a child container + transitive `@Service`/`@Repository`/`@Config` re-registration (`packages/controllers/src/isolation.ts`). Default (`isolate: false`) is unchanged and non-breaking; `@Service` still registers globally for back-compat. Proven by a multi-app isolation test. Flipping the default to isolation is a future major (RFC Option A → next major). The functional-path cost (RFC §8) was already resolved in Wave 6.
- **P2-11 (DI internals)** — ✅ **Resolved.** (a) Missing/unregistered dependencies now throw `DependencyResolutionError` (checked before the "Cannot inject" cycle heuristic — fixes the Wave-7 misclassification as `CircularDependencyError`); true cycles still throw `CircularDependencyError`. (b) Scope defaults unified on the declared `di:scope` (singleton default; explicit `options.scope` wins). (c) The `@Optional()` tsyringe-descriptor manipulation is isolated behind one documented, defensively-guarded adapter (`markTsyringeParamOptional`) with an end-to-end test — deliberate, contained tsyringe coupling (full decoupling would mean dropping tsyringe).

Remaining known items: full per-app isolation *by default* (future major, RFC), request-scoped DI + interceptors/filters/lifecycle-hooks/module-system/`@HttpCode` (RFC backlog in `TODO.md`), and a `builder.ts` size split (>300-line ceiling, pre-existing structural debt).
