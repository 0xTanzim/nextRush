# Request Scope

Most services are **singletons** — one instance per container, shared across every request, and stateless. A service that carries per-request state (the current user, a per-call transaction, request correlation data) needs a new instance per HTTP request instead. NextRush's DI supports three scopes, and the class runtime adds one subtle behavior on top: **scope bubbling**.

## The three scopes

| Scope | Instance lifetime |
| ----- | ----------------- |
| `singleton` | One instance per container, shared everywhere. **Default.** |
| `transient` | A new instance on every resolve. |
| `request` | One instance per HTTP request, via a per-request child container. |

Declare it on the service:

```ts
import { Service } from '@nextrush/di';

@Service({ scope: 'request' })
class RequestContext {
  user?: User;              // per-request state lives here
  startedAt = Date.now();
}
```

A request-scoped service resolves fresh for each request and is shared within that request — two controllers on the same request see the same instance of `RequestContext`, but each new request gets its own.

## Scope bubbling: why it's automatic

Here is the trap a naive implementation would have. Suppose a `singleton` controller depends on a request-scoped service:

```ts
@Service({ scope: 'request' })
class RequestStore {}

@Controller('/orders')
class OrdersController {      // singleton by default
  constructor(private store: RequestStore) {}   // request-scoped dependency
}
```

If `OrdersController` stays a singleton, the container creates it **once** and it caches one request's `RequestStore` forever — every later request sees the first request's data. That is a correctness bug, not a performance one.

So the class runtime **bubbles request scope**: a class is effectively request-scoped if its declared scope is `'request'` **or if any transitive dependency class is effectively request-scoped**. In the example above, `OrdersController` is promoted to request scope automatically, so it resolves fresh per request and never caches a stale `RequestStore`.

```
        singleton controller
        depends on request-scoped service
                  │
                  ▼
   controller is bubbled to request scope
   (resolves fresh per request, dependencies too)
```

- A request-scoped dependency **anywhere** in a controller's graph makes that controller resolve per request.
- A **pure-singleton graph** keeps the memoized fast path — no per-request resolution overhead.

## When to use request scope

- A service that holds per-request state (current user, correlation id, a request-scoped transaction).
- A short-lived object you don't want leaked into a long-lived singleton.

## When not to

- **Global, stateless services** — leave them singleton; request scope adds per-request allocation for no benefit.
- Prefer passing data between middleware and handlers through `ctx.state` (via `@Ctx()`) when you just need to move per-request values around, rather than injecting a service.

## Request Scope and Modules

Request scope works the same inside a [module](Modules) graph — a request-scoped provider declared in any module bubbles to every controller that (transitively) depends on it.

## Related

- [Dependency Injection](Dependency-Injection) — the container and the full scope table
- [Classes & Decorators](Controllers-and-Decorators) — where request-scoped services get injected
- [Modules](Modules) — request-scoped providers inside a module graph
- Request scope reference: https://0xtanzim.github.io/nextRush/docs/reference/class/controllers
