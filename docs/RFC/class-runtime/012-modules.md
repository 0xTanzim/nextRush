# RFC: Module System

**Status:** ✅ Accepted — complete-all directive approval (Wave 14).
**Date:** 2026-07-08
**Author:** NextRush Core Team
**Packages:** `@nextrush/decorators`, `@nextrush/controllers`
**Framework impact:** Additive, non-breaking. A new `@Module` decorator and a new `registerModule` registrar. `registerControllers` is unchanged; every existing caller keeps working.

---

## 0. Relationship to prior class-based work

This RFC builds on the controller registrar shipped across the class-based waves:
**RFC-NEXTRUSH-DI-CONTAINER-OWNERSHIP** (per-app container + opt-in `isolate`),
**RFC-NEXTRUSH-LIFECYCLE-HOOKS** (`OnInit`/`OnShutdown`), and
**RFC-NEXTRUSH-REQUEST-SCOPE** (scope bubbling). A module does not reimplement any
of that machinery — it **composes** controllers and providers and hands the
flattened set to the *existing* `registerControllers` pipeline. Route building,
eager DI validation, guard validation, lifecycle-hook bridging, and
isolate/request-scope support are reused verbatim, not duplicated.

---

## 1. Problem

The class-based API registers controllers either by filesystem auto-discovery
(`root`) or by an explicit `controllers: [...]` array. Neither expresses **the
feature boundary** — the natural unit an application grows in. A "users" feature
is a controller *plus* the services it needs *plus* the sub-features it composes.
Today those are wired in three disconnected places: services register themselves
at import time (`@Service`), controllers are listed flat, and there is no single
artifact that says "this is the users feature and here is everything it owns."

Frameworks that scale (Angular, NestJS) solve this with a **module**: one
declaration that groups the feature's controllers, its providers, and the other
modules it depends on, exposed through a single registration entry point.

## 2. Goals / Non-goals

**Goals**

- A `@Module({ imports, controllers, providers, exports })` class decorator that
  records the feature's composition as metadata.
- A `registerModule(app, RootModule, options?)` registrar that recursively walks
  `imports`, registers every module's `providers` into the DI container, and
  registers **all** controllers across the whole module graph through the
  existing `registerControllers` pipeline.
- Deterministic, safe graph traversal: duplicate/diamond imports are registered
  once, and an import cycle is guarded (no infinite loop).
- Provider ergonomics: a provider is either a bare class (registered with its
  declared `@Service` scope) or a provider config
  (`{ provide, useClass | useValue | useFactory, scope }`).
- `registerModule` honors the same options as `registerControllers` where
  sensible: `prefix`, `middleware`, `container`, `isolate`, `validate`, `debug`.

**Non-goals (this wave)**

- **True per-module encapsulation.** See §5 — this is deliberately deferred.
- Changing `registerControllers` behavior or the functional (`nextrush`) entry.
- Async module factories / dynamic modules (`forRoot`/`forFeature` patterns).

## 3. Design

### 3.1 `@Module` metadata

`@Module(options)` stores a normalized `ModuleMetadata` record on the class
(`imports`, `controllers`, `providers`, `exports`, each defaulted to `[]`) under a
dedicated reflect-metadata key, and marks the class injectable for symmetry with
`@Controller`. Two readers back it: `isModule(cls)` and `getModuleMetadata(cls)`.

```typescript
@Module({
  imports: [BillingModule],
  controllers: [UserController],
  providers: [UserService, { provide: 'CONFIG', useValue: cfg }],
  exports: [UserService],
})
class UserModule {}
```

`ModuleProvider` is a union:

```typescript
type ModuleProvider = Function | ModuleProviderConfig;

interface ModuleProviderConfig {
  provide: Token;
  useClass?: Constructor;
  useValue?: unknown;
  useFactory?: (...args: unknown[]) => unknown;
  inject?: Token[];   // deps for useFactory
  scope?: Scope;      // singleton (default) | transient | request
}
```

### 3.2 Module-graph collection

`collectModuleGraph(root)` performs a depth-first, **post-order** walk over
`imports`:

- **Post-order** → an imported (feature) module's providers/controllers are
  collected before the importer's, so a root module that imports a feature module
  registers the feature first.
- **Dedupe** via a `seen` set → a module imported through two paths (diamond) or
  listed twice is collected exactly once.
- **Cycle guard** via a `visiting` set → a back-edge to an in-progress module is
  skipped, so a cycle (`A imports B imports A`) terminates instead of recursing
  forever.
- A non-`@Module` class in `imports` (or as the root) throws `NotAModuleError`.

### 3.3 Provider registration

For each module in graph order, every provider is registered into the container:

- **Bare class** → registered as `{ useClass }` with its declared `@Service`
  scope (`getServiceScope`), or `singleton` if undecorated, and only if not
  already registered (its `@Service` decorator may have registered it at import
  time already).
- **Provider config** → `container.register(provide, provider, { scope })` with
  the matching provider kind (`useValue` / `useFactory` + `inject` / `useClass`).
  Value providers ignore scope; class/factory providers default to `singleton`.

### 3.4 Delegation to the existing pipeline

`registerModule` selects the container **once** (an explicit `options.container`
wins; otherwise `isolate` gets a fresh `createContainer()`; otherwise
`app.container` → the global container), registers all providers into it, then
calls `registerControllers(app, { ...options, container, controllers })` with the
flattened, deduped controller list. Passing the container explicitly means it
wins inside `registerControllers` even under `isolate: true`, so providers and the
controller graph share one container. Everything downstream — route building,
`validate`, guard validation, `OnInit`/`OnShutdown` bridging, request-scope
bubbling — is the existing code path, unchanged.

## 4. Execution flow

```
registerModule(app, RootModule, options)
  → select container (explicit | isolate | app | global)
  → collectModuleGraph(RootModule)          // post-order, deduped, cycle-guarded
  → for each module: register its providers into the container
  → collectModuleControllers(modules)       // flattened, deduped
  → registerControllers(app, { ...options, container, controllers })
       → bindRequestScopes → registry.registerAll → registerRoutes
       → validate → registerLifecycleExtension
```

## 5. Honest scope: composition today, encapsulation later

**What ships now:** modules are **composition + grouping** units. `registerModule`
is a single entry point that recursively registers a module graph's imports,
controllers, and providers. This is the 90% value: feature-oriented wiring in one
declaration.

**What does NOT ship now — and why:** *true per-module encapsulation* — where a
module's providers are private to that module and invisible to sibling modules
unless listed in `exports` — is **explicitly deferred to follow-up work**. The DI
layer (`@nextrush/di`, a tsyringe wrapper) uses a **flat/hierarchical** container:
once a provider is registered it is resolvable by anything sharing that container.
Enforcing hard module-private scoping requires per-module child containers, an
export-aware resolution chain that walks only a module's own registrations plus
its imports' `exports`, and controller resolution bound to its owning module's
container. That is significant machinery and is **not** implemented here.

Because of this, the `exports` field is **recorded in metadata now but not yet
enforced** — every provider in the graph is currently globally visible within the
shared container. Capturing `exports` today means the future encapsulation step
is a pure DI-layer change: the metadata contract is already in place, so enabling
enforcement will not require re-authoring existing `@Module` declarations.

**Future direction (follow-up RFC):** per-module container hierarchy, export-gated
resolution, and diagnostics that reject cross-module use of a non-exported
provider.

## 6. Alternatives considered

- **Enforce encapsulation now via child containers.** Rejected for this wave: the
  per-module-container + export-resolution machinery is large and risks
  regressing the shared-container fast path that every existing caller depends on.
  Shipping composition first delivers the majority of the value with zero risk to
  the current pipeline.
- **A second parallel registrar that duplicates route building.** Rejected:
  violates the "reuse, do not duplicate" rule. Flattening to the existing
  `registerControllers` keeps one code path for routes/validation/lifecycle.

## 7. Backward compatibility

Fully additive. No existing type, function, or behavior changes. `@Module`,
`registerModule`, and the module types are net-new exports; `registerControllers`
and the functional entry are untouched.
