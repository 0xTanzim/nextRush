# RFC: Service Lifecycle Hooks (Class-Based Controllers)

**Status:** Accepted (complete-all directive approval)
**Date:** 2026-07-08
**Author:** NextRush Core Team
**Scope:** Additive change to `@nextrush/decorators` (two duck-typed interfaces `OnInit`/`OnShutdown` + `isOnInit`/`isOnShutdown` guards) and `@nextrush/controllers` (`registerControllers` bridges detected hooks into the app's Extension lifecycle). **Opt-in and non-breaking**: a service that implements neither hook behaves exactly as today, and no Extension is registered when no hook is present.

---

## 1. Problem

Class-based services (`@Service`/`@Repository`/`@Config`) frequently manage long-lived resources — a database pool, a cache client, a background worker — that must be **opened when the app boots** and **closed when it shuts down**. Today a service constructor runs lazily when DI first resolves it, and there is no supported place to run async initialization or graceful teardown tied to the application lifecycle. Users resort to ad-hoc top-level `await` or manual wiring in the entry file, which does not compose with `registerControllers` discovery and is easy to get wrong (init that never runs, resources that never close).

The framework already owns the two lifecycle moments a service needs: `app.ready()` (adapters call it before serving) and `app.close()` (graceful shutdown). This RFC bridges service-level hooks into those two moments — without modifying `@nextrush/core`.

## 2. Non-Goals

- **A decorator.** Hooks are **duck-typed** — a service opts in by declaring `onInit()` and/or `onShutdown()`. No `@Hook` decorator, no metadata key, nothing to import beyond the interface for typing.
- **Per-request lifecycle.** These hooks are app-scoped (once at boot, once at shutdown), not per-request. Request-scoped work stays in middleware/interceptors.
- **Modifying `@nextrush/core`.** The bridge is built entirely on the existing public `app.extend()` Extension contract. Core is untouched.
- **Strict topological ordering.** Ordering is a reverse-BFS approximation of the dependency graph (see §4), not a full topological sort. It is sufficient for the common shallow graphs and documented as such.

## 3. API

### `OnInit` / `OnShutdown` interfaces (`@nextrush/decorators`)

```typescript
interface OnInit {
  onInit(): void | Promise<void>;
}

interface OnShutdown {
  onShutdown(): void | Promise<void>;
}
```

A service implements one or both. Both may be async and are awaited.

```typescript
import { Service } from '@nextrush/di';
import type { OnInit, OnShutdown } from '@nextrush/decorators';

@Service()
class Database implements OnInit, OnShutdown {
  async onInit(): Promise<void> {
    await this.pool.connect();
  }
  async onShutdown(): Promise<void> {
    await this.pool.end();
  }
}
```

The runtime type guards `isOnInit(value)` and `isOnShutdown(value)` narrow an arbitrary **instance** (not a class constructor — unlike `isGuardClass`) by detecting a callable method, traversing the prototype chain.

## 4. Behavior

At `registerControllers(app, options)`, after routes are registered and controllers/guards validated, the registrar:

1. Walks the controller + transitive `@Service`/`@Repository`/`@Config` dependency graph (reusing `collectServiceGraph` from the isolation module).
2. Resolves each **service** from the active container (the same instances requests use — singletons are shared). **Controllers** are taken only from the validation instance cache; they are never force-resolved for hook detection, so disabling validation keeps controller construction lazy.
3. Keeps the **distinct** instances (deduped by identity) implementing `onInit` and/or `onShutdown`.
4. If at least one exists, registers a single internal Extension named `nextrush:controllers-lifecycle#<n>` (a per-call counter guarantees uniqueness, since `app.extend()` rejects duplicate names and an app may register controllers more than once). If none exist, **no Extension is registered**.

- `setup()` (runs at `app.ready()`) awaits each `onInit()` in **dependency order**: a service's dependencies initialize before the service that depends on them. This is a reverse-BFS approximation — the guarantee provided is "deeper dependencies before shallower dependents", not a strict topological order.
- `destroy()` (runs at `app.close()`) awaits each `onShutdown()` in the **reverse** of the `onInit` order.

### Guard: must register before serving

`app.extend()` is rejected once configuration is frozen (`ready()`/`start()`). If `registerControllers` runs on an already-booted or running app **and** finds hooks, it throws a clear error instructing the caller to register controllers before `serve()`/`listen()`/`ready()`. When no hooks are present, no Extension is needed and no error is raised.

## 5. Compatibility

Fully additive. Services without hooks are untouched, no Extension is added when no hook exists, and no existing API changes. Functional (DI-free) apps are unaffected.

## 6. Testing

- `@nextrush/decorators`: `isOnInit`/`isOnShutdown` detect object-literal and prototype methods; reject `null`, non-objects, and non-function members.
- `@nextrush/controllers` (real `createApp` + `await ready()`/`close()`): `onInit` fires at `ready()` not at registration; `onShutdown` fires at `close()`; async hooks are awaited; `onShutdown` runs in reverse of `onInit` across a multi-service graph; a hook-free service registers no Extension; registering on an already-ready app throws the guard error.
