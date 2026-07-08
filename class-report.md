# NextRush Class-Based Feature — Architecture Audit

Scope audited (read-only, every finding traced to source): `@nextrush/decorators`, `@nextrush/di`, `@nextrush/controllers`, the `nextrush`/`nextrush/class` meta entries, `@nextrush/dev` generators, `apps/playground` real usage, `tsconfig.base.json`, package READMEs, and the three packages' test suites.

---

## 1. Executive Summary

The class-based feature is a competent, NestJS-familiar stack with genuinely good touches — precomputed per-route parameter plans (`builder.ts`), a clean `markInjectable` abstraction boundary so `@nextrush/decorators` never imports tsyringe directly, and some of the best error-message copy in an OSS DI container (`di/src/errors.ts`). It is not production-hostile. But it is unfinished in ways that bite exactly where a class-based framework is supposed to shine: DI correctness, request isolation, and the "first five minutes" scaffolding path. Several exported, documented APIs are dead or phantom, and the whole thing is welded to a TypeScript decorator dialect that is now the legacy one.

| Dimension | Score | Justification |
|---|---|---|
| Overall health | 62 / 100 | Solid bones, real correctness + DX defects, notable long-term risk. |
| Production readiness | 60 | Fine for small/medium apps; global-container + fail-late + guard-status issues are real. |
| Enterprise readiness | 45 | No request scope, global DI state, import-everything discovery, no module boundaries. |
| Plugin/extensibility readiness | 50 | Guards + custom param decorators + middleware refs exist; no interceptors, no filters, no lifecycle hooks. |
| Maintainability | 62 | Small files, but tsyringe-internals coupling, string-matched error detection, duplicated logic. |
| DX | 55 | Nice decorators + great errors, but broken generators, setup burden, status-code footguns. |
| API quality | 66 | Clean and familiar, undermined by dead exports and inconsistent scope defaults. |
| Architecture | 63 | Sound layering; global container + discovery-by-import + legacy-decorator bet undercut it. |
| Scalability | 50 | Serial import-everything discovery, per-request resolve, 7x @All, global container. |
| Risk | High | Legacy-decorator lock-in + tsyringe maintenance/internals coupling + global mutable state. |

Verdict: Ship-capable for hobby/SMB APIs today. Not yet trustworthy for multi-tenant, large-monorepo, or 1000-plugin scale without addressing the P0/P1 items below. The single most embarrassing issue is that `nextrush generate controller` emits code that does not compile.

---

## 2. Major Architecture Problems (Critical → Low)

### CRITICAL-1 — CLI scaffolding generates non-compiling class-based code
- Problem: `packages/dev/src/generators/templates.ts` — `controllerTemplate` emits `import { Controller, Get, Post, Body, Param } from 'nextrush';`, `serviceTemplate` emits `import { Service } from 'nextrush';`, `guardTemplate` emits `import type { GuardFn } from 'nextrush';`.
- Evidence: `packages/nextrush/src/index.ts` exports the functional API only — it does NOT export `Controller`/`Get`/`Post`/`Body`/`Param`/`Service`/`GuardFn`. Those live in `packages/nextrush/src/class.ts` (`nextrush/class`).
- Impact: `nextrush g controller|service|guard` produce files that fail with `TS2305` and crash at runtime. 3 of 5 generators broken; middleware/route generators are fine (`Middleware`/`createRouter` are at root).
- Fix: Point the three templates at `nextrush/class`; add a test that type-checks emitted output.

### CRITICAL-2 — Per-app DI is illusory; the default is a process-global container
- Problem: `@Service`/`@Repository`/`@Config` (`di/src/decorators.ts`) call tsyringe `singleton()`/`injectable()` directly → register into tsyringe's global root container at import time. `createApp()` (`nextrush/src/index.ts`) wires a router but never creates a container, so `Application.container` is `undefined`; `registerControllers` resolves `options.container ?? app.container ?? globalContainer` → the global container.
- Evidence: `di/src/container.ts` `container = createContainerWrapper(tsyContainer)`. `@nextrush/types` container.ts documents intent: "Each Application may own one (per-app, not a global singleton)." Implementation contradicts it.
- Impact: Two `createApp()` instances in one process share DI state. Test isolation, multi-tenant embedding, serverless warm-reuse leak. Even passing a custom container, `@Service` still registers into the global one.
- Fix: Decorators record metadata only; registration happens at `registerControllers` against `app.container`. `createApp()` owns a container by default. (Behavioral change — migration note required.)

### CRITICAL-3 — Fail-late dependency resolution (first-request 500s, no boot validation)
- Problem: `createRouteHandler` (`controllers/src/builder.ts`) calls `container.resolve(controllerClass)` per request. Registration never resolves.
- Impact: Unsatisfiable/circular deps let the app boot, then 500 (`ControllerResolutionError`) on first request.
- Fix: Resolve every registered controller once at end of `registerControllers` (or `validate: true`).

### HIGH-1 — Guard errors swallowed; guards can only produce 403
- Problem: `executeGuards` (`builder.ts`) catches any thrown guard error and rethrows generic `GuardRejectionError` (403) without `cause`. Returning `false` also → 403.
- Impact: A guard throwing `UnauthorizedError` (401) becomes 403; reason/stack lost. No 401 path. Violates "no silent failures."
- Fix: Preserve `cause`; let thrown typed HTTP errors propagate; only `return false` → 403.

### HIGH-2 — Discovery imports every file, serially, executing side-effects
- Problem: `discovery.ts` dynamically `import()`s every `.ts/.js` under `root` (default `**/*.ts`) one-by-one to check `isController`.
- Impact: All module side-effects run; O(files) serial startup; imports its own entry (safe only via ESM cache). DI registration is load-bearing on this import-everything behavior.
- Fix: Convention default include (`**/*.controller.{ts,js}`), parallelize with concurrency cap, document side-effects.

### HIGH-3 — No request scope; singleton controllers, untested concurrency
- Problem: `Scope = 'singleton' | 'transient'` only (`types/src/container.ts`); controllers registered singleton (`registry.ts`). No request-scoped DI. Zero concurrency/isolation tests.
- Impact: Per-request state on `this` leaks across requests. Request-scoped services impossible via DI.
- Fix (minimal, no new public API): characterization tests for singleton statelessness + document the contract. Adding a `request` scope is a public API addition → RFC.

### HIGH-4 — Legacy-decorator lock-in
- Problem: `tsconfig.base.json` sets `experimentalDecorators` + `emitDecoratorMetadata` + `ignoreDeprecations: "6.0"`. Entire feature depends on pre-TC39 decorators + `design:paramtypes`.
- Impact: TC39 Stage-3 decorators (TS5 default) don't support parameter decorators or `emitDecoratorMetadata`; migration = redesign. Forces consumer tsconfig + metadata-emitting build.
- Fix: ADR committing to the decorator dialect + supported lifetime; migration RFC if standard decorators are a goal.

### Lower-ranked
- MED: Return-value convention can't set HTTP status (see §4 DX-1).
- MED: Two path builders — `buildFullPath` (`decorators/metadata.ts`, dead) vs `buildFullRoutePath` (`builder.ts`, live).
- LOW: `@All` expands to 7 route registrations (`routes.ts`).

---

## 3. Class-Based Design Review

Classes are the right call for controllers/services (constructor DI, method grouping, testable business logic). The functional path stays default; classes are gated behind `nextrush/class` so functional users don't pay the reflect-metadata tax — a mature decision.

Weak spots: dual-typed guards (`GuardFn | Constructor<CanActivate>`) distinguished by sniffing `proto.canActivate` (`isGuardClass`) is fragile — a class guard missing `canActivate` is called as a function → `TypeError` swallowed to 403. Inheritance is essentially unused (`IMPLEMENTS`=1) — good, no base god-class, but it means "class-based" is really "decorated POJOs + constructor DI," raising whether the full decorator surface earns its weight vs a typed functional-builder API. Future risk: decorator-dialect lock-in (HIGH-4); no service lifecycle hooks.

---

## 4. Developer Experience Audit (ranked)

- DX-1 (CRITICAL): Broken generators — first `nextrush g controller` emits non-compiling code.
- DX-2 (CRITICAL): Status codes can't be set from return values. `builder.ts` does `ctx.json(result)` (200). Official playground `UserController.findById` returns `{ error, status: 404 }` → ships HTTP 200 with a `status` body field. Only `@SetHeader`/route `statusCode`/`@Ctx`/`throw` set status.
- DX-3 (HIGH): `emitDecoratorMetadata` setup cliff; breaks under tsx/esbuild.
- DX-4 (HIGH): Guards are 403-only and lose their reason.
- DX-5 (MED): Silent import side-effects at boot.
- DX-6 (MED): Documented APIs that don't work (`TypeInferenceError`, `AutoInjectable`).
- Bright spots: DI error messages, familiar decorators, `nextrush/class` auto-loads reflect-metadata, `GuardContext` correctly can't send responses.

---

## 5. Package Review

- `@nextrush/decorators` — 7/10. Clean metadata; dead exports (`buildFullPath`, `getMethodParameterTypes`, `getMethodReturnType`); `normalizePath` duplicated (class.ts vs routes.ts, divergent); param-push boilerplate ~5x in params.ts; `INTERCEPTORS` key with no impl.
- `@nextrush/di` — 6/10. Global container (CRITICAL-2); `Optional()` pokes tsyringe `'injectionTokens'` internals; error detection by string-matching tsyringe messages; `resolveAsync` no-op ternary; dead `TypeInferenceError`/`ContainerDisposedError`; deprecated `AutoInjectable`/`MissingDependencyError` still exported at v4.
- `@nextrush/controllers` — 6.5/10. Precomputed param plan, wired decorator-middleware, OpenAPI contribution, strong error hierarchy. Hand-rolled glob with hardcoded dir-prune; fail-late resolution; per-request resolve overhead; `registerController` singular dead; guard swallowing.
- `@nextrush/dev` generators — 4/10 for class slice. Broken imports (CRITICAL-1); no compile test.
- `nextrush`/`nextrush/class` — 7/10. Good split; re-exports `AutoInjectable`; `createApp` makes no container.

---

## 6. API Audit (selected)
- `registerControllers` good single entry; `controllers?:` README-deprecated but no `@deprecated` JSDoc; no eager `validate` option.
- Param decorators overloads nice; `@Body` default `required:true` vs `@Query`/`@Header` `false` undocumented at type level.
- `Scope` should include `request` or stop implying per-app isolation.
- Dead exports pollute public surface and are semver hazards.
- Guards can't express 401/reason.

---

## 7. Code Quality Findings
- Dead/phantom (verified): `buildFullPath` (test-only), `getMethodParameterTypes`/`getMethodReturnType` (0 callers), `TypeInferenceError`/`ContainerDisposedError` (never thrown), `AutoInjectable` (@deprecated removed-in-v4, still exported), `registerController` singular (test-only), `INTERCEPTORS` key (no impl).
- Duplication: `normalizePath` (class.ts + routes.ts); param push boilerplate ~5x (params.ts).
- Clever/magic: `Optional()` tsyringe internals; error string-matching; DI registration as import side-effect into global container.
- Dead logic: `resolveAsync` `return result instanceof Promise ? result : result;`.
- Inconsistency: 3 scope defaults (@Service=singleton, register()=transient, registry=singleton).

---

## 8. Missing Features
1. Request-scoped DI. 2. Eager DI graph validation at boot. 3. Interceptors. 4. Exception filters. 5. Service lifecycle hooks. 6. Module system/encapsulation. 7. First-class validation pipe. 8. 401 vs 403 from guards. 9. Richer OpenAPI from decorators. 10. Per-app container factory.

---

## 9. Future Scaling Risks
- Breaks first: startup time + correctness under embedding (import-everything discovery; global container).
- Expensive: per-request `resolve()` on hot path.
- Blocks evolution: legacy-decorator bet; tsyringe internals coupling.
- Redesign now: container ownership + discovery contract.

---

## 10. Recommended Refactoring Roadmap

Priority 0 — Critical
1. Fix CLI templates → `nextrush/class` + compile test. (CRITICAL-1)
2. Per-app container ownership; decorators metadata-only; register at `registerControllers`. (CRITICAL-2)
3. Eager DI graph validation at registration. (CRITICAL-3)

Priority 1 — High
4. Stop swallowing guard errors; enable 401; preserve cause. (HIGH-1)
5. Convention include default + parallel discovery + document side-effects. (HIGH-2)
6. Request-scope: characterization tests + document singleton contract now; `request` scope via RFC. (HIGH-3)
7. ADR on decorator-dialect commitment. (HIGH-4)

Priority 2 — Medium
8. Delete dead/phantom exports; remove or implement `INTERCEPTORS`.
9. Status-code-from-handler story + fix playground example.
10. Hoist `resolve(controller)` to build time.
11. Replace tsyringe string-matching + `'injectionTokens'` poking; unify scope defaults.

Priority 3 — Nice to have
12. De-dup `normalizePath` + param-push boilerplate.
13. Exception filters, service lifecycle hooks, module/encapsulation (RFC-scoped).
14. Reconcile README pseudo-code ordering; add `@deprecated` tag to `ControllersOptions.controllers`.
