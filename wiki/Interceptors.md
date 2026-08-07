# Interceptors

An interceptor **wraps a controller-method call** (onion / around advice): it runs code before
the method, awaits the downstream result, and may transform or replace it before it flows into
response handling. Unlike a [guard](Guards), an interceptor does not make a yes/no decision — it
shapes what crosses a handler's boundary.

Interceptors live in `nextrush/class` and apply only to **class-based controller routes**. They
are **opt-in and non-breaking**: a route with no `@UseInterceptor` behaves exactly as before —
the method result flows straight into response handling.

## The contract

An interceptor is a class that implements the `Interceptor` interface:

```ts
import { Service } from '@nextrush/di';
import type { Interceptor, Context } from 'nextrush/class';

@Service()
class WrapInterceptor implements Interceptor {
  constructor(private readonly logger: Logger) {}

  async intercept(ctx: Context, next: () => Promise<unknown>): Promise<unknown> {
    const start = performance.now();
    try {
      const result = await next(); // the downstream result (ultimately the handler's return)
      this.logger.info(`${ctx.method} ${ctx.path}`, performance.now() - start);
      return { data: result, timestamp: Date.now() }; // transform what proceeds to response
    } catch (err) {
      this.logger.error('handler failed', err);
      throw err; // rethrow so exception filters / error middleware handle it
    }
  }
}

// Class-level wraps every route; method-level wraps one route.
@Controller('/orders')
class OrdersController {
  @UseInterceptor(WrapInterceptor)
  @Get()
  list() {
    return loadOrders();
  }
}
```

- `intercept(ctx, next)` receives the same request `Context` the handler gets (`@nextrush/types`)
  — read `method`, `path`, `params`, `query`, `headers`, `body`, `state`, `get(name)`.
- `next()` invokes the rest of the chain to the inside and **resolves to the handler's return
  value**. Await it to observe the result.
- Whatever `intercept` returns becomes the result that flows into response handling. Return
  `next()`'s value unchanged to pass through, or a different value to transform.
- Interceptor classes are resolved from the **DI container at request time**, so they may inject
  services (loggers, metrics, mappers).

## Ordering: the onion

Class-level interceptors are the **outermost** layers; method-level interceptors are **inner**,
closest to the handler. The innermost `next()` invokes the actual method.

```ts
@UseInterceptor(LoggingInterceptor)      // A [ outer ]
@Controller('/orders')
class OrdersController {
  @UseInterceptor(TimingInterceptor)     //     B [ inner ]
  @Get()
  list() {
    return getOrders();
  }
}
// Execution: A.intercept → B.intercept → handler.list → B unwinds → A unwinds.
```

Both class and method interceptors are collected per route (class first, then method), and the
chain is folded so the first entry runs first and unwinds last. Within a single
`@UseInterceptor(A, B)`, `A` is outer to `B`.

## Use it for

- **Response shaping / envelope wrapping** — `intercept` returns `{ data, timestamp }`.
- **Timing, logging, and metrics** around the handler.
- **Caching** — short-circuit `next()` and return a cached value.
- **Cross-cutting error mapping** — `try/catch` around `next()`.
- **Telemetry** — tag `ctx.state` and read it in nested interceptors.

## Don't use it for

- **Access checks** — that is a guard (interceptors run *at* the method, too late to gate).
- **Global side effects for every request regardless of route** — that is middleware.
- **Yes/no decisions before the handler** — again, a guard.

An error the interceptor does not handle propagates out — exception filters, which wrap the
whole handler, can still catch it.

## Related

- [Guards](Guards) — yes/no gate that runs *before* the method; interceptors wrap *at* the method
- [Exception Filters](Exception-Filters) — catch an error an interceptor or handler rethrows
- [Controllers & Decorators](Controllers-and-Decorators) — where `@UseInterceptor` is applied
- [Dependency Injection](Dependency-Injection) — how an interceptor gets its injected services
- Interceptors reference: https://0xtanzim.github.io/nextRush/docs/concepts/interceptors