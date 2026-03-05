# Dependency Injection

Configure DI with `@nextrush/di` (tsyringe wrapper). Register services with
scopes, inject via constructors, use tokens for interfaces, test with mocks.

## Prerequisites

- `reflect-metadata` imported as the **first** import in your entry file
- TypeScript `experimentalDecorators` and `emitDecoratorMetadata` in tsconfig.json
- Package: `@nextrush/di`

## Register Services

```typescript
import { Service, Repository } from '@nextrush/di';

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

// Repository — semantic alias for data access layer
@Repository()
class UserRepository {
  constructor(private config: ConfigService) {}
  async findAll() {
    return [];
  }
}
```

## Compose Services

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

Constructor parameters are resolved automatically from the container.

## Use with Controllers

```typescript
import { Controller, Get } from '@nextrush/decorators';

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

Use `Symbol` tokens when injecting interfaces (TypeScript interfaces have no
runtime representation):

```typescript
import { inject, container } from '@nextrush/di';

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

## Testing with Mocks

```typescript
import { createContainer } from '@nextrush/di';

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

## Rules

- `reflect-metadata` MUST be imported before any decorated class
- `@Service()` is required for container registration
- Use `delay(() => ServiceB)` to break circular dependency chains
- Never inject transient services into singleton services (scope mismatch)
- Use `createContainer()` for isolated test containers

## Troubleshooting

| Problem                   | Cause                       | Solution                                                       |
| ------------------------- | --------------------------- | -------------------------------------------------------------- |
| Resolution error          | Missing `reflect-metadata`  | Add `import 'reflect-metadata'` before any decorated class     |
| Circular dependency       | A depends on B depends on A | Use `delay(() => ServiceB)` in one constructor                 |
| Singleton holds stale ref | Scope mismatch              | Don't inject transient into singleton                          |
| Token not found           | Missing registration        | `container.register(TOKEN, { useClass: Impl })` before resolve |
| New instance every time   | Missing `@Service()`        | Add `@Service()` decorator to the class                        |
