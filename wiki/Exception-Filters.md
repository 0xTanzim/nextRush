# Exception Filters

An exception filter **localizes error handling to a controller or route**. A filter is a class
that declares which errors it handles and turns a thrown error into a response — instead of
relying on the global error middleware for every route, a controller can give its own errors a
specific shape and status.

Filters live in `nextrush/class` and apply only to **class-based controller routes**. They are
**opt-in and non-breaking**: a controller/route with no `@UseFilter` behaves exactly as before —
errors propagate to the global error middleware.

## The contract

A filter is a class implementing `ExceptionFilter`. It declares which errors it handles with
`@Catch(...)` and is attached to a controller or route with `@UseFilter(...)`:

```ts
import { Service } from '@nextrush/di';
import { Catch, UseFilter } from 'nextrush/class';
import type { ExceptionFilter, Context } from 'nextrush/class';
import { NotFoundError } from '@nextrush/errors';

@Service()
@Catch(NotFoundError)
class NotFoundFilter implements ExceptionFilter {
  catch(error: unknown, ctx: Context): void {
    ctx.status = 404;
    ctx.json({ error: 'Resource not found' });
  }
}

@UseFilter(NotFoundFilter)
@Controller('/users')
class UsersController {
  @Get('/:id')
  findOne(@Param('id') id: string) {
    const user = findUser(id);
    if (!user) throw new NotFoundError('User not found');
    return user;
  }
}
```

```ts
import { createApp } from 'nextrush';
import { Module, registerModule } from 'nextrush/class';

// Wire the controller and filter through an AppModule:
@Module({
  controllers: [UsersController],
  providers: [NotFoundFilter],
})
class UsersModule {}

@Module({ imports: [UsersModule] })
class AppModule {}

const app = createApp();
await registerModule(app, AppModule);
```

- `catch(error, ctx)` receives the thrown error and the request `Context`, and **produces the
  response by mutating `ctx`** — set `ctx.status`, `ctx.set(name, value)`, and send the body with
  `ctx.json(...)` / `ctx.send(...)`.
- Filter classes are resolved from the **DI container at catch time**, so they may inject
  services (loggers, metrics, error mappers).
- `catch` may be sync or async (`void | Promise<void>`).

## Matching: `@Catch(...)`

`@Catch` declares which error constructors the filter handles, matched with `instanceof`:

| Declaration | Matches |
| ----------- | ------- |
| `@Catch(NotFoundError)` | `NotFoundError` **and its subclasses** |
| `@Catch(ValidationError, ConflictError)` | Any of the listed types |
| `@Catch()` (no args) | **Anything** — catch-all |
| no `@Catch` at all | Also treated as catch-all |

`instanceof` matching means a filter for a base error type also catches its subclasses.

## Precedence

- **Method-level filters take precedence over class-level filters.** For a given route, the
  runtime walks method filters first, then class filters.
- **Within a level, the first matching filter wins.** The first filter whose `@Catch` types match
  the thrown error is resolved and invoked; later filters are not consulted.
- **If no filter matches, the error is rethrown unchanged** so the global error middleware still
  handles it — filters never mask errors they didn't declare.

```ts
@UseFilter(ClassFilter)
@Controller('/users')
class UsersController {
  @UseFilter(MethodFilter) // consulted first for this route
  @Get('/:id')
  findOne(@Param('id') id: string) {}
}
```

## What a filter catches

A filter wraps the whole route handler, so it catches errors thrown anywhere in the pipeline:

- **Guards** that throw or reject (see [Guards](Guards)) — a `GuardRejectionError` is a 403
  `ForbiddenError`; a guard that throws a typed `HttpError` propagates it unchanged.
- **Parameter resolution** — e.g. `MissingParameterError` (400).
- **The handler method** itself, including errors an interceptor does not handle.

The one thing a filter does *not* wrap is the global middleware pipeline — errors outside a
controller route (middleware, routing) still go to the global error middleware.

## When to use a filter

- Give a domain error a stable HTTP shape (status, code, body) at the controller boundary.
- Normalize validation errors into a uniform response format.
- Catch-all error formatting for one controller while others keep global defaults.

Filters are per-controller/route. For app-wide error handling, keep using the global error
middleware (see [Error Handling](Error-Handling)).

## Related

- [Guards](Guards) — a guard's `false`/thrown error lands here if a filter is declared
- [Interceptors](Interceptors) — an error an interceptor rethrows lands here
- [Error Handling](Error-Handling) — the global error middleware filters fall back to
- [Controllers & Decorators](Controllers-and-Decorators) — where `@Catch`/`@UseFilter` are applied
- Exception filters reference: https://0xtanzim.github.io/nextRush/docs/concepts/exception-filters