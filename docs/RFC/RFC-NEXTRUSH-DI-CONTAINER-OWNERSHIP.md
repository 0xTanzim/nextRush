# RFC: Per-App DI Container Ownership & Isolation

**Status:** 📝 Proposed
**Date:** 2026-07-08
**Author:** NextRush Core Team
**Packages:** `@nextrush/di`, `@nextrush/decorators`, `@nextrush/controllers`, `nextrush` (meta)
**Framework impact:** Behavioral change to service registration (`@Service`/`@Repository`/`@Config`) and controller registration. Migration note required. No change to `@nextrush/types` container contract (it already specifies per-app ownership).

---

## 0. Relationship to the class-based audit

This RFC is the full remedy for **CRITICAL-2** ("Per-app DI is illusory; the default is a process-global container") and generalizes **CRITICAL-3** ("Fail-late dependency resolution"). Wave 2 shipped two safe, non-breaking seams that this RFC builds on:

1. **`createApp()` owns a container** (meta package). It defaults `app.container` to the shared `@nextrush/di` `container` export — explicit ownership with zero DI-resolution behavior change. This is the single seam this RFC swaps for a genuine per-app child container.
2. **Eager DI validation at registration** (`registerControllers`, `validate: true` by default). Every registered controller is resolved once at boot, so unsatisfiable/circular deps fail fast instead of on the first request. This RFC extends the same eager walk to transitively register a controller's `@Service`/`@Repository` graph.

Neither Wave 2 change touched `@nextrush/di/src/decorators.ts` — the decorator-registration redesign below is deliberately deferred to this RFC because of its edge cases.

---

## 1. Problem

`@Service()`, `@Repository()`, and `@Config()` call tsyringe's `singleton()`/`injectable()` **at decoration (import) time**, which registers the class into tsyringe's **process-global root container**. There is no per-app container in scope when a module is imported, so:

- Two `createApp()` instances in one process share DI state. Manual `container.register(TOKEN, { useValue })` on one app is visible to the other.
- Test isolation leaks: a service registered in one test file is resolvable in the next unless the global container is reset.
- Multi-tenant embedding and serverless warm-reuse cannot give each app its own service singletons.
- Even when a caller passes a custom container, `@Service` classes still land in the global one — the custom container only "works" because tsyringe child containers delegate unregistered tokens to the parent.

The `@nextrush/types` container contract already documents the intended design ("Each Application may own one — per-app, not a global singleton"). The implementation contradicts it.

---

## 2. Goals

- A `@Service`/`@Repository`/`@Config`/`@Controller` class can be registered into **a specific app's container** with its declared scope, not the process-global container.
- Two apps in one process have **fully isolated** service singletons by default.
- Boot-time validation of the whole reachable dependency graph (generalized CRITICAL-3).
- **Backward compatibility** for existing code that imports and resolves from the global `container` export.

## 3. Non-Goals

- Request-scoped DI (`Scope = 'request'`). Tracked separately (HIGH-3) — additive and orthogonal.
- Replacing tsyringe. This RFC works within tsyringe's model.
- Changing the middleware/functional (DI-free) path. Functional users must keep paying zero DI cost (see §8).

---

## 4. Core idea: metadata-only decorators + eager graph registration

### 4.1 Decorators record intent, they do not register

Today `@Service` both records metadata **and** calls `tsySingleton()`/`tsyInjectable()` (which registers globally). The redesign splits these:

- `@Service`/`@Repository`/`@Config` keep writing `di:type` and `di:scope` reflect-metadata (already present via `METADATA_KEYS.SERVICE_TYPE` / `SERVICE_SCOPE`).
- They still call the tsyringe **constructor-metadata** step so `design:paramtypes` / injection-token descriptors are captured (`markInjectable`), but they do **not** register a provider into any container.

The distinction matters: tsyringe's `injectable()` does two things — it records the constructor's type info (needed to construct the class) and, when called as `singleton()`, also registers a provider. We keep the former (type info is global and harmless) and drop the latter (the global provider registration is the bug).

> Constraint discovered in Wave 2: `emitDecoratorMetadata` is required for **implicit** constructor injection. Bundlers/transformers that don't emit `design:paramtypes` (esbuild, tsx, swc without the plugin) cannot inject implicit deps. This RFC does not fix that — it is an ecosystem constraint (see ADR for HIGH-4). Eager validation makes it fail at boot instead of per request, which is strictly better feedback.

### 4.2 `registerControllers` walks and registers the graph into `app.container`

At registration, for each discovered/declared controller:

1. Read its constructor dependency tokens (from `design:paramtypes` + explicit `@inject` descriptors + `@Optional` marks).
2. For each dependency that is a class carrying `di:type` metadata (`@Service`/`@Repository`/`@Config`), register it into **`app.container`** with its declared `di:scope`, then recurse into *its* dependencies.
3. Register the controller itself (already done today) and eagerly resolve it (Wave 2's `validate`).

This is a transitive closure walk over the reachable graph, registering each node once (memoized by token) into the app-owned container. The result: each app's container holds its own singletons; no global registration.

### 4.3 `createApp()` gives each app a real child container

The Wave 2 seam (`options?.container ?? sharedContainer`) becomes `options?.container ?? di.createContainer()` — a fresh isolated container per app. `createContainer()` already exists (`tsyContainer.createChildContainer()` + `reset()`).

---

## 5. Edge cases (the reason this is an RFC, not a patch)

### 5.1 Factory-provider bootstrap is per-wrapper

The `@nextrush/di` container **wrapper** keeps `factoryTokens` and `bootstrappedValues` as closure-local state, and `bootstrap()` only resolves factories registered on **that wrapper instance**. A child container created via `wrapper.createChild()` gets a *new* wrapper with empty `factoryTokens`, so it will **not** bootstrap factory providers that were registered on the parent wrapper. Any design that swaps `app.container` for a child must ensure factory providers the app relies on are (a) registered on the app's own wrapper, or (b) explicitly re-bootstrapped. Proposal: `registerControllers` calls `app.container.bootstrap()` (it already does) **after** the graph walk, so factory providers registered during the walk into `app.container` are bootstrapped on the correct wrapper.

### 5.2 String / symbol `@inject` tokens

`@inject('DATABASE_URL')` / `@inject(SYMBOL)` tokens are **not** classes and carry no `di:type` metadata, so the graph walk cannot auto-register them. These must be registered by the user (e.g. `app.container.register('DATABASE_URL', { useValue })`) **before** `registerControllers`. Eager validation will fail fast at boot if a required string/symbol token is unregistered — the desired behavior. Document this ordering requirement prominently.

### 5.3 `@Optional()`

`@Optional()` sets tsyringe's `isOptional` on the injection descriptor and records the param index in our own metadata. The graph walk must **skip** unresolved optional dependencies (inject `undefined`) rather than fail validation. Eager resolution already honors this because tsyringe returns `undefined` for optional unregistered tokens; the walk must not treat an optional token's absence as a graph node to register.

### 5.4 Transient scope

`@Service({ scope: 'transient' })` must register as transient in `app.container` (via `register(token, { useClass }, { scope: 'transient' })`), not singleton. The walk reads `di:scope` per node. Note the current inconsistency (audit §7: `@Service`=singleton, `register()`=transient default, registry=singleton) should be unified: the walk always uses the class's declared `di:scope`, defaulting to `singleton`.

### 5.5 Back-compat for the global `container` export

Existing code does `import { container } from '@nextrush/di'; container.resolve(UserService)`. After this RFC, `@Service` no longer auto-registers into that global container, so such resolves would fail. Mitigation options (pick one during review):

- **(A) Opt-in isolation flag** — `createApp({ isolatedContainer: true })` triggers the new behavior; default stays global for one minor version, with a deprecation warning. Safest migration.
- **(B) Dual-registration shim** — decorators still register into the global container *and* metadata, so old code keeps working while new apps get isolated graphs. Heavier; keeps the leak for global-container users.
- **(C) Hard switch + migration guide** — a major-version break; global-container resolution requires manual `container.register`.

Recommendation: **(A)** for the first release, flipping the default in the next major.

---

## 6. Generalizing CRITICAL-3

Wave 2's eager validation resolves each **controller**. This RFC's graph walk means validation now covers the **entire reachable service graph** — every `@Service`/`@Repository` a controller transitively needs is registered and resolved once at boot. An unsatisfiable dependency three levels deep fails at `registerControllers` with a `ControllerResolutionError` (or a new `RegistrationError` naming the missing node), not on the first request that happens to touch that path. `validate: false` remains the escape hatch.

---

## 7. Proposed API sketch

```typescript
// createApp (meta) — one-line seam change
const container = options?.container ?? di.createContainer(); // was: sharedContainer

// registerControllers options (additive)
interface ControllersOptions {
  // ...existing...
  validate?: boolean;        // default true (shipped in Wave 2)
  isolatedContainer?: boolean; // §5.5 option (A), transitional
}
```

No new public decorator surface. `@Service`/`@Repository`/`@Config` keep their signatures; only their internal registration behavior changes.

---

## 8. Functional-path cost (must not regress)

`nextrush` (functional entry) must not force `reflect-metadata`/`tsyringe` onto DI-free users. Wave 2 introduced a static import of the shared `di` container into `packages/nextrush/src/index.ts` to guarantee `app.container` — this pulls `reflect-metadata` into the functional path and conflicts with the `"sideEffects": ["./dist/class.js"]` tree-shaking intent. This RFC should resolve that by making the container **lazily created only when a class-based registrar runs** (e.g. `registerControllers` creates and attaches a container if the app has none), so the functional `createApp` can return an app with no container and no DI import. This is the cleaner long-term shape and removes the Wave 2 tradeoff.

---

## 9. Migration

- Document that string/symbol `@inject` tokens and any manual providers must be registered on `app.container` **before** `registerControllers` (§5.2).
- Provide before/after examples for code that resolved from the global `container` export.
- Ship option (A) with a deprecation warning for one minor version before flipping the default.

---

## 10. Open questions

1. Is `RegistrationError` (naming the missing graph node) worth adding, or is wrapping in `ControllerResolutionError` sufficient?
2. Should the graph walk register services eagerly (at registration) or lazily (first resolve) once discovered? Eager gives boot validation; lazy is cheaper for large graphs with cold routes.
3. Interaction with a future `request` scope (HIGH-3): the walk must not eagerly resolve request-scoped nodes at boot.
