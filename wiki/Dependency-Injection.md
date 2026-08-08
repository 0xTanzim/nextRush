# Dependency Injection


The DI container turns hand-wired dependency graphs into declarations. Instead of writing `new
UserService(new UserRepository(db))` and threading that through every handler, you decorate the
classes once, and the container assembles the graph from constructor signatures.

The class runtime resolves controllers, guards, and filters from the same container — so a
controller's constructor declares what it needs, and the framework fills it in.

## Where DI lives

The container is `@nextrush/di` (a typed wrapper around the well-known `tsyringe` container).
The functional `nextrush` entry is DI-free by design — importing it never loads the container.
Use `nextrush/class`, which re-exports the DI surface in one import:

```ts
import { createApp, listen } from 'nextrush';
import { Service, Repository, container, inject, createContainer } from 'nextrush/class';
```

Install `@nextrush/di` directly when you only want the container (e.g. a non-HTTP service):

```bash
npm i @nextrush/di
```

`nextrush/class` auto-imports `reflect-metadata`, so no manual side-effect import is needed there.

## Prerequisites

Decorator DI needs type metadata emitted at compile time. Your `tsconfig.json` must enable both:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

Build class apps with `nextrush dev` / `nextrush build` — fast bundlers (esbuild, tsx, swc) skip
decorator-metadata emission, and DI then silently resolves `undefined` constructor arguments.

## Marking classes

| Decorator | Purpose |
| --------- | ------- |
| `@Service()` | A service — the default injectable. Singleton unless scoped. |
| `@Repository()` | A data-access service. Semantically identical to `@Service`. |
| `@Injectable()` | Any other injectable class (no service/repository meaning). |
| `@Config({ prefix })` | A config holder, always a singleton; `prefix` documents the env-var family it reads (e.g. `DB_*`). |
| `@Optional()` | Parameter: resolve `undefined` instead of throwing when the dependency is missing. |
| `@inject(token)` | Parameter: override which token to resolve for that argument. |

```ts
@Service() // singleton, one instance shared
class UserService {
  constructor(private readonly users: UserRepository) {}
}

@Repository()
class UserRepository {
  findAll() { return db.users.findMany(); }
}

@Config({ prefix: 'DB' })
class DatabaseConfig {
  readonly host = process.env.DB_HOST ?? 'localhost';
  readonly port = Number(process.env.DB_PORT ?? 5432);
}
```

Services are **singletons by default** — keep them stateless, or opt into a shorter life:

```ts
@Service({ scope: 'transient' }) // new instance per resolve
class RequestLogger {}
```

## Scopes

| Scope | Instance lifetime |
| ----- | ----------------- |
| `singleton` | One instance per container, shared everywhere. **Default.** |
| `transient` | A new instance on every resolve. |
| `request` | One instance per HTTP request, via a per-request child container. |

`@Config` classes are always singletons regardless of options.

> **Request scope bubbles.** A class whose declared scope is `'request'` (or that transitively depends on one) is resolved fresh per HTTP request — so a singleton controller depending on a request-scoped service is automatically promoted to request scope instead of caching one request's instance forever. See [Request Scope](Request-Scope) for how and when this happens.

## Resolving

The framework resolves controller dependencies automatically, but you can resolve by hand:

```ts
import { container, inject } from 'nextrush/class';

const users = container.resolve(UserService);
```

There is also a global `container` singleton and `createContainer()` for an isolated one
(useful in tests). `container.register(token, provider)` accepts three provider kinds:

```ts
container.register(UserRepository, { useClass: UserRepository });
container.register('CONFIG', { useValue: cfg });
container.register(EmailClient, {
  useFactory: () => new EmailClient(process.env.SMTP_URL!),
});
```

For circular dependencies, `delay` defers the token lookup to resolve time:

```ts
@Service()
class A { constructor(@inject(delay(() => B)) private b: B) {} }
```

## Errors teach

A class that is injected but never decorated produces an actionable `DIError` — it names the
missing class and suggests adding `@Service()`, `@Repository()`, or `@Config()`. Unsatisfiable
or circular dependencies fail at boot (eager controller resolution), not as a first-request 500.

## Testing

Tests get a fresh graph per test by resetting the global container between cases:

```ts
beforeEach(() => container.reset());
```

Because the global container is a singleton, the test runner must not interleave container
mutation across cases — NextRush's own suite runs vitest sequentially for this reason.

## Next steps

- [Controllers and Decorators](Controllers-and-Decorators) — what resolves from this container
- [Modules](Modules) — group providers behind one `@Module` declaration
- [Extensions](Extensions) — long-lived app-scoped services that attach to the app
- DI reference: https://0xtanzim.github.io/nextRush/docs/reference/class/di
- Container reference: https://0xtanzim.github.io/nextRush/docs/reference/class/di-container
- DI errors reference: https://0xtanzim.github.io/nextRush/docs/reference/class/di-errors
- DI concept guide: https://0xtanzim.github.io/nextRush/docs/concepts/dependency-injection
