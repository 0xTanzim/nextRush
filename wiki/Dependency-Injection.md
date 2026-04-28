# Dependency Injection

NextRush provides a lightweight DI container in `@nextrush/di` that wraps [tsyringe](https://github.com/microsoft/tsyringe) with NextRush-specific decorators and production-quality error messages.

---

## Setup

Install the package and ensure `reflect-metadata` is imported once at the application entry point:

```bash
pnpm add @nextrush/di
```

```typescript
// src/index.ts — must be the first import
import 'reflect-metadata';
```

Enable decorator metadata in TypeScript:

```json
// tsconfig.json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

---

## Decorators

### `@Service()`

Marks a class as a singleton service managed by the DI container.

```typescript
import { Service } from '@nextrush/di';

@Service()
class UserService {
  async findAll() {
    return [{ id: 1, name: 'Alice' }];
  }
}
```

### `@Repository()`

Semantically identical to `@Service()`, but indicates the class is for data access.

```typescript
import { Repository } from '@nextrush/di';

@Repository()
class UserRepository {
  async findById(id: string) {
    return { id, name: 'Alice' };
  }
}
```

### `@Injectable()`

Marks a class as injectable without additional metadata (low-level; prefer `@Service` or `@Repository`).

---

## Scopes

| Scope | Behavior |
|---|---|
| `'singleton'` | One instance shared across the application (default) |
| `'transient'` | New instance created each time the class is resolved |

```typescript
// Singleton (default)
@Service()
class DatabaseService {}

// Transient — new instance per resolve
@Service({ scope: 'transient' })
class RequestLogger {}
```

---

## Constructor Injection

Dependencies are injected automatically via constructor parameter types. TypeScript's `emitDecoratorMetadata` makes this work.

```typescript
@Repository()
class UserRepository {
  findAll() {
    return [{ id: 1, name: 'Alice' }];
  }
}

@Service()
class UserService {
  // UserRepository is injected automatically
  constructor(private repo: UserRepository) {}

  getUsers() {
    return this.repo.findAll();
  }
}
```

---

## Manual Injection with `@inject()`

Use `@inject()` when injecting by token (for interfaces or abstract types):

```typescript
import { inject } from '@nextrush/di';

abstract class Logger {
  abstract log(msg: string): void;
}

@Service()
class AppService {
  constructor(@inject(Logger) private logger: Logger) {}

  run() {
    this.logger.log('Running');
  }
}
```

---

## `@Optional()`

Mark a dependency as optional (resolves to `undefined` if not registered):

```typescript
import { Optional } from '@nextrush/di';

@Service()
class NotificationService {
  constructor(@Optional() private emailClient?: EmailClient) {}

  notify(msg: string) {
    this.emailClient?.send(msg);
  }
}
```

---

## Container

### Resolving Manually

```typescript
import { container } from '@nextrush/di';

const userService = container.resolve(UserService);
```

### Registering Manually

```typescript
import { container } from '@nextrush/di';

// Register a value
container.register('CONFIG', { useValue: { apiKey: 'abc123' } });

// Register a class
container.register('Logger', { useClass: ConsoleLogger });

// Register a factory
container.register('Timestamp', { useFactory: () => Date.now() });
```

### Creating Child Containers

```typescript
import { createContainer } from '@nextrush/di';

const child = createContainer();
child.register('ScopedService', { useClass: ScopedService });
```

---

## DI Errors

| Error | Cause |
|---|---|
| `MissingDependencyError` | Class is not registered in the container |
| `CircularDependencyError` | Circular dependency detected |
| `DependencyResolutionError` | Dependency could not be resolved |
| `TypeInferenceError` | Metadata missing (emitDecoratorMetadata not enabled) |
| `InvalidProviderError` | Provider registration is malformed |
| `ContainerDisposedError` | Container was disposed before resolution |

---

## With Controllers

When using the `controllersPlugin`, `@Service`/`@Repository` classes are resolved from the DI container automatically. See [Controllers and Decorators](Controllers-and-Decorators) for details.

```typescript
import 'reflect-metadata';
import { createApp, listen } from 'nextrush';
import { Service, Repository } from '@nextrush/di';
import { Controller, Get, controllersPlugin } from '@nextrush/controllers';

@Repository()
class ProductRepository {
  findAll() { return [{ id: 1 }]; }
}

@Service()
class ProductService {
  constructor(private repo: ProductRepository) {}
  getAll() { return this.repo.findAll(); }
}

@Controller('/products')
class ProductController {
  constructor(private service: ProductService) {}

  @Get()
  list() { return this.service.getAll(); }
}

const app = createApp();
app.plugin(controllersPlugin({ root: './src' }));
listen(app, 3000);
```
