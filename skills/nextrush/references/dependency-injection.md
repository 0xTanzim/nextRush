# Dependency Injection

Lightweight DI container for NextRush (`@nextrush/di` wraps tsyringe). Register services
with scopes, inject via constructors, use tokens for interfaces, test with isolated containers.

## Prerequisites

- Import from `nextrush/class` — auto-imports `reflect-metadata` (no manual import needed)
- TypeScript `experimentalDecorators` and `emitDecoratorMetadata` enabled in tsconfig.json

```typescript
// Meta-package (recommended)
import {
  Service,
  Repository,
  Config,
  Optional,
  Injectable,
  inject,
  container,
  createContainer,
  delay,
} from 'nextrush/class';

// Individual package
import {
  Service,
  Repository,
  Config,
  Optional,
  inject,
  container,
  createContainer,
  delay,
} from '@nextrush/di';
```

## Register Services

```typescript
import { Service, Repository } from 'nextrush/class';

// Singleton (default) — one instance for entire app lifetime
@Service()
class ConfigService {
  readonly dbUrl = process.env.DATABASE_URL ?? 'postgres://localhost/app';
}

// Transient — new instance each time resolved
@Service({ scope: 'transient' })
class RequestLogger {
  log(method: string, path: string): void {
    /* ... */
  }
}

// Repository — semantic alias for @Service(), indicates data access layer
@Repository()
class UserRepository {
  constructor(private config: ConfigService) {}
  async findAll() {
    return [];
  }
}
```

## @Config Decorator

Configuration holders. Always singleton. Optional `prefix` documents which env vars it reads.

```typescript
import { Config, Service } from 'nextrush/class';

@Config()
class AppConfig {
  readonly port = Number(process.env.PORT ?? 3000);
  readonly host = process.env.HOST ?? 'localhost';
}

@Config({ prefix: 'DB' })
class DatabaseConfig {
  readonly host = process.env.DB_HOST ?? 'localhost';
  readonly port = Number(process.env.DB_PORT ?? 5432);
  readonly name = process.env.DB_NAME ?? 'mydb';
}

@Service()
class DbService {
  constructor(private config: DatabaseConfig) {}
  connectionString() {
    return `postgres://${this.config.host}:${this.config.port}/${this.config.name}`;
  }
}
```

## @Optional Decorator

Mark constructor params as optional. Injects `undefined` instead of throwing when unresolvable.

```typescript
import { Service, Optional, inject } from 'nextrush/class';

@Service()
class NotificationService {
  constructor(@Optional() @inject('MAILER') private mailer?: MailerService) {}

  notify(msg: string) {
    this.mailer?.send(msg); // Safe — mailer may be undefined
  }
}
```

## @Injectable Decorator

Transient injectable without singleton scope (unlike `@Service()` which defaults to singleton).

```typescript
import { Injectable, container } from 'nextrush/class';

@Injectable()
class FeatureService {
  constructor(private logger: LoggerService) {}
}

const service = container.resolve(FeatureService); // New instance each resolve
```

## Compose Services

Constructor parameters are resolved automatically from the container.

```typescript
@Service()
class UserService {
  constructor(
    private userRepo: UserRepository,
    private logger: RequestLogger
  ) {}

  async getUsers() {
    this.logger.log('GET', '/users');
    return this.userRepo.findAll();
  }
}
```

## Use with Controllers

```typescript
import { Controller, Get } from 'nextrush/class';

@Controller('/users')
class UserController {
  constructor(private userService: UserService) {}

  @Get()
  async findAll() {
    return this.userService.getUsers();
  }
}
```

## Interface Injection with Tokens

TypeScript interfaces have no runtime representation. Use `Symbol` tokens:

```typescript
import { Service, inject, container } from 'nextrush/class';

const CACHE_TOKEN = Symbol('CacheService');

interface CacheService {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

@Service()
class MemoryCacheService implements CacheService {
  private store = new Map<string, string>();
  async get(key: string) {
    return this.store.get(key) ?? null;
  }
  async set(key: string, value: string) {
    this.store.set(key, value);
  }
}

// Register implementation for the token
container.register(CACHE_TOKEN, { useClass: MemoryCacheService });

// Inject by token
@Service()
class ProductService {
  constructor(@inject(CACHE_TOKEN) private cache: CacheService) {}
}
```

## Circular Dependencies

Use `delay(() => ServiceB)` to lazily resolve one side of a circular chain:

```typescript
import { Service, inject, delay } from 'nextrush/class';

@Service()
class UserService {
  constructor(@inject(delay(() => OrderService)) private orderService: OrderService) {}
}

@Service()
class OrderService {
  constructor(@inject(delay(() => UserService)) private userService: UserService) {}
}
```

## Container API

```typescript
import { container, createContainer } from 'nextrush/class';

// Resolve a service from the global container
const userService = container.resolve(UserService);

// Register a value/class/factory
container.register('API_KEY', { useValue: 'secret' });
container.register(CACHE_TOKEN, { useClass: MemoryCacheService });

// Create isolated container (for testing)
const testContainer = createContainer();
```

## Testing with Mocks

```typescript
import { createContainer } from 'nextrush/class';

describe('UserService', () => {
  it('returns users', async () => {
    const testContainer = createContainer();
    testContainer.register(UserRepository, {
      useValue: { findAll: async () => [{ id: '1', name: 'Test' }] } as UserRepository,
    });
    const service = testContainer.resolve(UserService);
    expect(await service.getUsers()).toHaveLength(1);
  });
});
```

## Scope Reference

| Scope       | Behavior                      | Use Case                              |
| ----------- | ----------------------------- | ------------------------------------- |
| `singleton` | One instance for entire app   | Config, database pools, caches        |
| `transient` | New instance each `resolve()` | Request loggers, per-request services |

`@Service()` = singleton. `@Service({ scope: 'transient' })` = transient. `@Injectable()` = transient.
`@Config()` = always singleton. `@Repository()` = singleton by default.

## DI Error Types

| Error                       | Description                                         |
| --------------------------- | --------------------------------------------------- |
| `DIError`                   | Base error for all DI errors                        |
| `DependencyResolutionError` | Failed to resolve a dependency                      |
| `MissingDependencyError`    | Required dependency not registered                  |
| `CircularDependencyError`   | Circular dependency chain detected                  |
| `ContainerDisposedError`    | Container used after disposal                       |
| `InvalidProviderError`      | Invalid provider configuration                      |
| `TypeInferenceError`        | Cannot infer type (missing `emitDecoratorMetadata`) |

All errors importable from `@nextrush/di`. They are thrown automatically by the container.

## Rules

- Import from `nextrush/class` to auto-load `reflect-metadata` — no manual import needed
- `@Service()` is required for container registration
- Use `delay(() => ServiceB)` to break circular dependency chains
- Never inject transient services into singleton services (scope mismatch)
- Use `createContainer()` for isolated test containers
- `@Config()` is always singleton — no scope option
- `@Optional()` must be placed before `@inject()` on the same parameter

## Troubleshooting

| Problem                   | Cause                                  | Solution                                                       |
| ------------------------- | -------------------------------------- | -------------------------------------------------------------- |
| Resolution error          | Missing `reflect-metadata`             | Import from `nextrush/class` (auto-loads it)                   |
| Circular dependency       | A → B → A                              | Use `delay(() => ServiceB)` in one constructor                 |
| Singleton holds stale ref | Scope mismatch                         | Don't inject transient into singleton                          |
| Token not found           | Missing registration                   | `container.register(TOKEN, { useClass: Impl })` before resolve |
| New instance every time   | Using `@Injectable()` not `@Service()` | Use `@Service()` for singletons                                |
| TypeInferenceError        | `emitDecoratorMetadata` disabled       | Enable in tsconfig.json                                        |
| @Optional not working     | Wrong decorator order                  | Put `@Optional()` before `@inject()`                           |

## Rules

- Import from `nextrush/class` to auto-load `reflect-metadata` — no manual import needed
- `@Service()` is required for container registration (plain classes are not injectable)
- Use `delay(() => ServiceB)` to break circular dependency chains
- Never inject transient services into singleton services (scope mismatch)
- Use `createContainer()` for isolated test containers
- `@Config()` classes are always singletons

## Troubleshooting

| Problem                   | Cause                                  | Solution                                                       |
| ------------------------- | -------------------------------------- | -------------------------------------------------------------- |
| Resolution error          | `reflect-metadata` not loaded          | Import from `nextrush/class` (auto-loads it)                   |
| Circular dependency       | A depends on B depends on A            | Use `delay(() => ServiceB)` in one constructor                 |
| Singleton holds stale ref | Scope mismatch                         | Don't inject transient into singleton                          |
| Token not found           | Missing registration                   | `container.register(TOKEN, { useClass: Impl })` before resolve |
| New instance every time   | Using `@Injectable()` not `@Service()` | Use `@Service()` for singletons                                |
| TypeInferenceError        | `emitDecoratorMetadata` disabled       | Enable in tsconfig.json                                        |
| @Optional not working     | Wrong decorator order                  | Put `@Optional()` before `@inject()`                           |
