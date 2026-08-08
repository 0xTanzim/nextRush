# Lifecycle (onInit / onShutdown)

A service that owns a resource — a database pool, a queue subscription, a background timer — needs to open that resource once before the app takes its first request, and close it once when the app shuts down. A **constructor is the wrong place for either**: constructors run the moment something first resolves the class, which can be earlier than boot, and they have no matching moment for teardown at all.

NextRush gives `@Service`, `@Repository`, `@Config`, and controller classes two **duck-typed lifecycle hooks** — `onInit` and `onShutdown` — that run once each, at boot and at shutdown, distinct from the per-request pipeline that runs on every request.

## The two hooks

A class opts in by implementing the matching method. There is **no decorator**: `@Service` is enough, and the registrar detects the hooks by checking whether the resolved instance has a callable `onInit` / `onShutdown`.

```ts
import { Service } from '@nextrush/di';
import type { OnInit, OnShutdown } from 'nextrush/class';

@Service()
class Database implements OnInit, OnShutdown {
  async onInit(): Promise<void> {
    await this.pool.connect();   // once, at boot
  }
  async onShutdown(): Promise<void> {
    await this.pool.end();       // once, at shutdown
  }
}
```

| Hook | Signature | Runs |
| ---- | --------- | ---- |
| `OnInit.onInit()` | `() => void \| Promise<void>` | At `app.ready()`, **in dependency order** (a service's dependencies initialize before it) |
| `OnShutdown.onShutdown()` | `() => void \| Promise<void>` | At `app.close()`, in the **exact reverse** of the `onInit` order (dependents tear down first) |

Both may be sync or async and are awaited.

Register the service through a module — the hooks run for services reachable from your
controllers:

```ts
import { createApp, listen } from 'nextrush';
import { Controller, Get, Module, registerModule } from 'nextrush/class';

@Controller('/users')
class UsersController {
  constructor(private db: Database) {}   // injecting Database keeps it in the reachable graph
  @Get() list() { return { ok: true }; }
}

@Module({ controllers: [UsersController], providers: [Database] })
class AppModule {}

const app = createApp();
await registerModule(app, AppModule);   // Database.onInit() runs at app.ready()
await listen(app, 8080);                // app.close() runs Database.onShutdown()
```

A service's hooks fire only if it is reachable from a registered controller (directly or as a
transitive dependency), because the registrar collects hooks by walking that graph.

## When the hooks run

`registerControllers` / `registerModule` collects every instance in the reachable service graph that implements a hook and bridges it into the application lifecycle via one internal [Extension](Extensions):

```
        boot                                   shutdown
         │                                       ▲
         ▼                                       │
 app.ready()  ── onInit in DEP order ──┐   ┌── onShutdown in REVERSE
                                        │   │        │
        ── requests run ──             ◀───┘        │
                                        │            │
 app.close()  ◀──────────────────────────┘            │
```

This **application lifecycle** is a different axis from the [Request Lifecycle](Request-Lifecycle): the hooks run once, for the whole app, while the request lifecycle's middleware onion runs fresh for every request in between. Per-request setup belongs in middleware, not in `onInit`.

## Rules and gotchas

- **Register before the server starts.** If `registerControllers`/`registerModule` finds hooks on an app that is already booted (`ready()`) or running, it throws — configuration is frozen and the lifecycle Extension can't be added. Call it **before** `serve()`/`listen()`/`ready()`.
- **`validate: false` disables controller-level hook detection.** A controller's hooks are detected only through its already-resolved, eagerly-validated instance. Keep eager validation on (the default) for any controller with a hook.
- **An async `onInit` that rejects fails the whole boot.** Awaiting every `onInit` means boot does not complete until all hooks settle — catch a recoverable failure inside the hook rather than letting it propagate.
- **`onShutdown` failures are isolated.** A throwing `onShutdown` does not strand later services' teardown; multiple failures are collected into a single `AggregateError`.
- **Zero cost when unused.** If no instance in the graph implements a hook, no lifecycle Extension is registered at all.

## Common mistakes

- **Writing `@OnInit()` / `@OnShutdown()` as decorators.** Every other class feature is a decorator, but lifecycles are not. Implement the plain method — a decorator either fails to compile or has no effect.
- **Putting per-request work in `onInit`.** That runs once for the app's whole life. Per-request setup is a middleware's job.

## Next steps

- [Dependency Injection](Dependency-Injection) — how the container resolves the instances the lifecycle collector walks
- [Classes & Decorators](Controllers-and-Decorators) — where `onInit`/`onShutdown` attach to the class runtime
- [Modules](Modules) — a module's services can carry lifecycle hooks too
- [Extensions](Extensions) — the mechanism the registrar uses to run these hooks at `ready()`/`close()`
- Lifecycle concept: https://0xtanzim.github.io/nextRush/docs/concepts/lifecycle
