# Guards

A protected route answers one question before it does any real work: is this caller allowed
in? Named inline, the check spreads into the top of every handler. A **guard** moves that
yes/no decision into one declared, reusable unit next to the route, and every request behind
it inherits the check — the handler runs only after the guards say yes.

Guards live in `nextrush/class` and apply to **class-based controller routes** (not functional
routes).

## The two shapes

A guard is either a **function** or a **DI-resolveable class**. Both feed one pipeline.

```ts
import { Ctx, Service, UseGuard, Controller, Get } from 'nextrush/class';
import type { GuardFn, CanActivate, GuardContext } from 'nextrush/class';

// Function guard — returns a boolean. Ideal for a factory that closes over config.
const AuthGuard: GuardFn = (ctx) => ctx.get('authorization') !== undefined;

// Guard factory: a function that takes options and returns a GuardFn closing over them.
const RoleGuard = (...roles: string[]): GuardFn => (ctx) => {
  const user = ctx.state.user as { role?: string } | undefined;
  return user !== undefined && roles.includes(user.role);
};

// Class guard: resolved from the DI container, so it can inject services.
@Service()
class AdminGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(ctx: GuardContext): Promise<boolean> {
    const user = await this.auth.verify(ctx.get('authorization'));
    ctx.state.user = user; // attach the verified user for later guards and the handler
    return Boolean(user);
  }
}

@UseGuard(AuthGuard, RoleGuard('admin'), AdminGuard)
@Controller('/admin')
class AdminController {
  @Get()
  dashboard() {
    return { ok: true };
  }
}
```

```ts
import { createApp } from 'nextrush';
import { Module, registerModule } from 'nextrush/class';

// Wire AdminController and the class guard through an AppModule:
@Module({
  controllers: [AdminController],
  providers: [AuthService, AdminGuard],
})
class AdminModule {}

@Module({ imports: [AdminModule] })
class AppModule {}

const app = createApp();
await registerModule(app, AppModule);
```

A class guard declares its collaborators as constructor parameters and the container injects
them, exactly as for a [service](Dependency-Injection). It is resolved from the container **per
request**.

## Execution

A guard returns `true` to allow or `false` to reject. Throwing an error also rejects it.

| Guard outcome | Result |
| ------------- | ------ |
| `return true` | Proceed to the next guard, then the handler |
| `return false` | Throws `GuardRejectionError` → **403**; the handler never runs |
| `throw new UnauthorizedError()` | The error propagates **unchanged** → **401**, never downgraded to 403 |

A `false` return always gives a 403. To produce a different status, **throw** a typed error
instead — return `false` for "forbidden", throw `UnauthorizedError` for "not authenticated".

## Guard context

`GuardContext` is a read-only snapshot of request data with exactly one live channel,
`ctx.state`:

| Field | Type | Notes |
| ----- | ---- | ----- |
| `method` | `string` | HTTP method |
| `path` | `string` | Request path |
| `params` | `Record<string, string>` | Route parameters |
| `query` | `Record<string, string \| string[] \| undefined>` | Query string |
| `headers` | `Record<string, string \| string[] \| undefined>` | Request headers |
| `body` | `unknown` | Parsed request body |
| `state` | `Record<string, unknown>` | **Live, mutable** — the channel for passing a verified user forward |
| `get(name)` | `(name: string) => string \| undefined` | Read a single header |

A guard cannot send a response — it can only permit or deny. The one writable surface is
`ctx.state`, so a guard attaches what it verified there for later guards and the handler.
Never trust a value already on `ctx.state` as verified merely because it is present — an
upstream guard or [middleware](Middleware) may have put it there without checking.

## Ordering

- **Class guards run first, then method guards.** Guards on the `@Controller` class run before
  guards on a method.
- **Within one `@UseGuard(A, B, C)` call, left-to-right.**
- **The chain short-circuits.** The runner awaits each guard and stops at the first failure —
  a rejected request never reaches controller resolution, parameter injection, or the handler.
- **Stacked decorators apply bottom-to-top.** Separate `@UseGuard(A)` above `@UseGuard(B)` run
  **B then A**, matching TypeScript's decorator order. For a guaranteed sequence, pass the
  guards in one call where left-to-right is explicit.

## When to use a guard

- **Authentication** — verify a token or session and reject anonymous callers.
- **Authorization** — check the caller's role, ownership, or permission.
- **Coarse gating** — feature flags, per-plan access, a maintenance lock.

A guard is for yes/no access only. Work that transforms the request or response belongs in
[middleware](Middleware), and shaping a handler's result belongs in an
[interceptor](Interceptors).

## Common mistakes

- **Forgetting to `await` an async check.** A guard that returns before its verifier resolves
  lets everyone through.
- **Not attaching the verified user to `ctx.state`.** A role guard then has nothing to
  authorize against.
- **Expecting a thrown `UnauthorizedError` to become a 403.** Return `false` for 403; throw the
  typed error for any other status.

## Next steps

- [Interceptors](Interceptors) — wrap a handler to shape input/output, which a guard deliberately isn't
- [Exception Filters](Exception-Filters) — turn a rejected guard's error into a clean response
- [Controllers & Decorators](Controllers-and-Decorators) — where `@UseGuard` is applied
- [Dependency Injection](Dependency-Injection) — how a class guard gets its injected services
- Guards concept guide: https://0xtanzim.github.io/nextRush/docs/concepts/guards
- Decorators reference: https://0xtanzim.github.io/nextRush/docs/reference/class/decorators