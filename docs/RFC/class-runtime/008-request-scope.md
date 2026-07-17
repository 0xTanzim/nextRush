# RFC: Request-Scoped Dependency Injection

**Status:** ✅ Accepted — complete-all directive approval (Wave 13).
**Date:** 2026-07-08
**Author:** NextRush Core Team
**Packages:** `@nextrush/types`, `@nextrush/di`, `@nextrush/controllers`
**Framework impact:** Additive, non-breaking. A new `'request'` value on `Scope`. `singleton`/`transient` behavior is unchanged. Per-request overhead is incurred **only** when a request scope is actually in play for a given controller.

---

## 0. Relationship to prior DI work

This RFC builds on **RFC-NEXTRUSH-DI-CONTAINER-OWNERSHIP** (per-app container + opt-in `isolate`) and the eager service-graph walk shipped there. It reuses the same graph-walking primitives (`collectDependencyClasses`, `collectServiceGraph`) to compute a new *effective* scope, and the same "register the reachable graph into the app's container" seam to bind request-scoped classes to tsyringe's `ContainerScoped` lifecycle.

---

## 1. Problem

Services have two lifecycles today: `singleton` (one shared instance) and `transient` (a fresh instance on every resolve). Neither models **one instance per HTTP request** — the natural scope for request-correlated state such as a per-request identity, a unit-of-work / DB transaction, a correlation ID, or an audit accumulator.

- `singleton` caches one instance for the process lifetime — request state would leak across requests.
- `transient` is fresh on *every resolve* — two collaborators in the same request that both depend on the service get **different** instances, so they cannot share request state.

The missing lifecycle is: **fresh per request, shared within a request.**

## 2. Goals / Non-goals

**Goals**
- Add `'request'` to `Scope`. A `@Service({ scope: 'request' })` yields a different instance across requests, and the *same* instance for all collaborators within one request.
- **Scope bubbling**: a singleton (or transient) that transitively depends on a request-scoped service must itself become request-scoped, otherwise a singleton controller would cache one request's instances forever.
- **Zero added per-request cost** when request scope is not used: purely-singleton controllers keep the existing lazy-memoized singleton fast path.

**Non-goals**
- Injecting the request `Context` into a service constructor. Services access the request via a method parameter decorator (`@Ctx`) on the controller, then pass what they need. Constructor-injected request context is future work.
- Changing `singleton`/`transient` semantics or the functional (`nextrush`) DI-free entry.

## 3. Design

### 3.1 The `'request'` scope → tsyringe `ContainerScoped`

`@nextrush/di`'s `container.register(token, { useClass }, { scope: 'request' })` maps to tsyringe's `Lifecycle.ContainerScoped`. tsyringe caches a `ContainerScoped` instance **per container**: `createChildContainer()` copies each `ContainerScoped` registration into the child *without* its cached instance, so the child constructs its own instance on first resolve and reuses it for the rest of that child's lifetime. A fresh child per request therefore gives "fresh per request, shared within a request" for free; `singleton` registrations are **not** copied into children, so they delegate up to the parent and stay shared.

`Container.createChild()` already exists and returns a wrapper around `tsyInstance.createChildContainer()` — the per-request unit.

`@Service({ scope: 'request' })` records `di:scope='request'` metadata and marks the class injectable (`tsyInjectable`) so its constructor metadata is captured, but does **not** register a singleton. Actual container registration (with `ContainerScoped`) is performed by the controllers layer, which knows the *effective* scope.

### 3.2 Scope bubbling (effective scope)

At registration time the controllers layer walks each controller's constructor dependency graph and computes an **effective scope** for every reachable class:

> A node's effective scope is `'request'` if its declared `di:scope` is `'request'` **or** any of its transitive dependency classes is effectively `'request'`. Otherwise it is the node's declared scope.

Each node is then registered with its *effective* scope: request-effective nodes → `ContainerScoped`; others keep their declared `singleton`/`transient`. Bubbling is mandatory — without it a singleton controller depending on a request-scoped service would resolve and cache one request's instance permanently.

### 3.3 Per-request resolution (build-time decision)

The route handler decides **once, at build time**, whether its controller is effectively request-scoped:

- **Yes** → on *each* request, create a per-request child (`container.createChild()`) and resolve the controller from it. Request-scoped dependencies are fresh per request and shared within it; singletons resolve from the parent and stay shared. The controller instance is **not** memoized.
- **No** → keep the existing lazy-memoized singleton path. No child is created, so there is zero new per-request overhead.

Guards, interceptors, and filters continue to resolve from the app container (unchanged).

### 3.4 Non-isolate override

In the default (non-isolate) path a request-effective service that was *declared* `singleton` is already registered as a tsyringe `Singleton` by its decorator at import time. The controllers layer re-registers it with `ContainerScoped`; tsyringe's registry returns the **last** registration on resolve, so the request lifecycle wins. Note that the shared global container means this promotion is process-wide for that class — use `isolate: true` when two apps in one process need independent request-scope wiring. Under `isolate`, the fresh container has no prior registration, so request-effective nodes are registered cleanly.

## 4. Public API

```typescript
@Service({ scope: 'request' })
class RequestContextHolder {
  readonly id = crypto.randomUUID();
}
```

`Scope` is now `'singleton' | 'transient' | 'request'`. No other surface changes.

## 5. Alternatives considered

- **tsyringe `ResolutionScoped`** — one instance per *resolution tree*, not per request; a second `resolve` in the same request (e.g. a guard resolving the controller, then the handler resolving it) would get a different instance. Rejected.
- **Manual per-request `Map`** — reinvents `ContainerScoped` caching and bypasses tsyringe's dependency wiring. Rejected.

## 6. Test plan

1. `@Service({ scope: 'request' })` → different instance across two requests, same instance within one request.
2. A singleton service is shared across requests.
3. Scope bubbling: a singleton-declared controller depending on a request-scoped service gets a fresh controller **and** service per request.
4. A purely-singleton controller creates no per-request child (memoize path holds — resolve-once).
5. `transient` remains fresh per resolve.
6. DI-level: `ContainerScoped` via `createChild()` gives per-child instances.

## 7. Rollout

`@nextrush/types` minor, `@nextrush/di` minor, `@nextrush/controllers` minor. Non-breaking; existing suites stay green.
