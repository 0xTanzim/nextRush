# @nextrush/di

Lightweight dependency injection container for NextRush v3.

## Features

- **Constructor Injection** — Automatic dependency resolution via TypeScript metadata
- **Singleton & Transient Scopes** — Control instance lifecycle per service
- **Circular Dependency Detection** — O(1) Set-based detection with cycle visualization, catches tsyringe-internal chains
- **Production-Grade Errors** — Actionable messages with fix suggestions (`@Service()`, `@Repository()`, `@Config()` hints)
- **Optional Dependencies** — `@Optional()` decorator for graceful handling of missing services
- **Test-Friendly** — Isolated containers and instance clearing for test setup

## Development

For the best development experience with full decorator and DI support, use **`@nextrush/dev`**.

```bash
pnpm add -D @nextrush/dev
```

Then in your `package.json`:

```json
{
  "scripts": {
    "dev": "nextrush dev"
  }
}
```

### Why?

TypeScript's `emitDecoratorMetadata` option emits runtime type information that allows the DI container to automatically resolve constructor dependencies. Most modern fast runners (`tsx`, `esbuild`, `node --experimental-strip-types`) strip types but **do not** emit this metadata, causing errors like:

```
TypeInfo not known for "UserService"
```

| Runtime           | Decorator Metadata | Recommended      |
| ----------------- | ------------------ | ---------------- |
| **nextrush dev**  | Full Support       | Yes              |
| **tsc + node**    | Full Support       | Yes (Production) |
| **tsx / esbuild** | Not Supported      | No               |
| **ts-node --esm** | Issues             | No               |

## Installation

```bash
pnpm add @nextrush/di
```

> If you use the `nextrush` meta-package, `reflect-metadata` is auto-imported. Otherwise, install it separately: `pnpm add reflect-metadata` and add `import 'reflect-metadata'` at your entry point.

## TypeScript Configuration

**Required** `tsconfig.json` settings:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

## Quick Start

```typescript
import 'reflect-metadata'; // Required when NOT using the nextrush meta-package
import { Service, Repository, container } from '@nextrush/di';

@Repository()
class UserRepository {
  findAll() {
    return [{ id: 1, name: 'Alice' }];
  }
}

@Service()
class UserService {
  constructor(private repo: UserRepository) {}

  getUsers() {
    return this.repo.findAll();
  }
}

const userService = container.resolve(UserService);
console.log(userService.getUsers()); // [{ id: 1, name: 'Alice' }]
```

## API Reference

### Decorators

#### `@Service(options?)`

Mark a class as an injectable service. Singletons by default.

```typescript
@Service()
class MyService {}

// Transient (new instance each time)
@Service({ scope: 'transient' })
class RequestLogger {}
```

**`ServiceOptions`:**

| Property | Type                         | Default       | Description        |
| -------- | ---------------------------- | ------------- | ------------------ |
| `scope`  | `'singleton' \| 'transient'` | `'singleton'` | Instance lifecycle |

#### `@Repository(options?)`

Semantic alias for `@Service()`. Sets metadata type to `'repository'` instead of `'service'`. Use for data access layers.

```typescript
@Repository()
class UserRepository {
  findById(id: string) {
    return db.users.find(id);
  }
}
```

#### `@inject(token)`

Explicitly inject a dependency by token. Use for interfaces, string tokens, or symbol tokens.

```typescript
const DATABASE_TOKEN = Symbol('Database');

@Service()
class UserService {
  constructor(
    @inject(DATABASE_TOKEN) private db: IDatabase,
    @inject('API_KEY') private apiKey: string
  ) {}
}
```

#### `@AutoInjectable()`

Mark a class as injectable in the container. Sets service type metadata to `'service'`.

```typescript
@AutoInjectable()
class FeatureService {
  constructor(private logger: Logger) {}
}

// Resolve through the container
const service = container.resolve(FeatureService);
```

> **Note:** Despite the name, `@AutoInjectable()` does not enable dependency injection via `new`. The current implementation uses tsyringe's `injectable()` decorator internally. Dependencies are resolved only through `container.resolve()`.

#### `delay(tokenFactory)`

Defer resolution to break circular dependencies. Returns a lazy token for use with `@inject()`.

```typescript
import { delay, inject, Service } from '@nextrush/di';

@Service()
class ServiceA {
  constructor(@inject(delay(() => ServiceB)) private b: ServiceB) {}
}

@Service()
class ServiceB {
  constructor(@inject(delay(() => ServiceA)) private a: ServiceA) {}
}
```

#### `@Optional()`

Mark a constructor parameter as optional. When the dependency is not registered, the container injects `undefined` instead of throwing.

```typescript
import { Service, Optional, inject } from '@nextrush/di';

@Service()
class NotificationService {
  constructor(
    @Optional() private emailService?: EmailService,
    @inject('SLACK_TOKEN') @Optional() private slackToken?: string
  ) {}

  notify(message: string) {
    if (this.emailService) {
      this.emailService.send(message);
    }
    if (this.slackToken) {
      // send to Slack
    }
  }
}
```

#### `isParameterOptional(target, parameterIndex)`

Check if a specific constructor parameter is marked as optional.

```typescript
import { isParameterOptional, Optional, Service } from '@nextrush/di';

@Service()
class MyService {
  constructor(@Optional() private dep?: SomeDep) {}
}

isParameterOptional(MyService, 0); // true
isParameterOptional(MyService, 1); // false
```

#### `getOptionalParams(target)`

Get all optional parameter indices for a class. Returns a `ReadonlySet<number>`.

```typescript
import { getOptionalParams } from '@nextrush/di';

const optionals = getOptionalParams(MyService);
// Set { 0 }
```

### Utility Functions

#### `hasServiceMetadata(target)`

Check if a class has DI metadata (decorated with `@Service()` or `@Repository()`).

```typescript
import { hasServiceMetadata, Service } from '@nextrush/di';

@Service()
class MyService {}

hasServiceMetadata(MyService); // true
```

#### `getServiceType(target)`

Get the service type from a decorated class. Returns `'service'`, `'repository'`, or `undefined`.

#### `getServiceScope(target)`

Get the scope from a decorated class. Returns `'singleton'`, `'transient'`, or `undefined`.

### Container

#### `container.register(token, provider)`

Register a dependency with the container.

```typescript
// Class provider
container.register(UserService, { useClass: UserService });

// Value provider
container.register('CONFIG', { useValue: { port: 3000 } });

// Factory provider — receives the container for nested resolution
container.register(Logger, {
  useFactory: (c) => new Logger(c.resolve('CONFIG')),
});
```

#### `container.resolve(token)`

Resolve a dependency from the container.

```typescript
const service = container.resolve(UserService);
const config = container.resolve<Config>('CONFIG');
```

#### `container.resolveAll(token)`

Resolve all dependencies registered under a token. Returns an empty array if none are registered.

```typescript
container.register('Plugin', { useValue: pluginA });
container.register('Plugin', { useValue: pluginB });

const plugins = container.resolveAll<Plugin>('Plugin');
```

#### `container.isRegistered(token)`

Check if a token is registered.

```typescript
if (container.isRegistered(UserService)) {
  // ...
}
```

#### `container.clearInstances()`

Clear cached singleton instances. Registrations remain — the next `resolve()` creates fresh instances.

```typescript
beforeEach(() => {
  container.clearInstances();
});
```

#### `container.reset()`

Reset the container completely, removing all registrations and instances.

#### `container.createChild()`

Create a child container. The child inherits parent registrations but can override them independently.

#### `createContainer()`

Create a new isolated container with no inherited registrations.

```typescript
const testContainer = createContainer();
testContainer.register(UserService, { useClass: MockUserService });
```

## Error Handling

All errors extend `DIError` and include actionable messages:

```typescript
import {
  DIError,
  DependencyResolutionError,
  CircularDependencyError,
  TypeInferenceError,
  MissingDependencyError,
  InvalidProviderError,
  ContainerDisposedError,
} from '@nextrush/di';

try {
  container.resolve(UnregisteredService);
} catch (error) {
  if (error instanceof DependencyResolutionError) {
    console.log(error.missingDependency); // token name
    console.log(error.chain); // resolution path
  }
  if (error instanceof CircularDependencyError) {
    console.log(error.cycle); // ['ServiceA', 'ServiceB', ...]
  }
}
```

| Error                       | Cause                                                                                         |
| --------------------------- | --------------------------------------------------------------------------------------------- |
| `DependencyResolutionError` | Token not registered — includes fix suggestions (`@Service()`, import order, manual register) |
| `CircularDependencyError`   | Circular dependency detected (wrapper-level + tsyringe-internal chains)                       |
| `MissingDependencyError`    | _(Deprecated)_ Use `DependencyResolutionError` instead                                        |
| `InvalidProviderError`      | Provider missing `useClass`, `useValue`, or `useFactory`                                      |
| `TypeInferenceError`        | Constructor parameter type not available at runtime                                           |
| `ContainerDisposedError`    | Container has been reset or disposed                                                          |

## TypeScript Exports

```typescript
// Container
import { container, createContainer } from '@nextrush/di';

// Decorators
import { Service, Repository, AutoInjectable, Optional, inject, delay } from '@nextrush/di';

// Utility functions
import {
  hasServiceMetadata,
  getServiceType,
  getServiceScope,
  isParameterOptional,
  getOptionalParams,
} from '@nextrush/di';

// Metadata keys
import { METADATA_KEYS } from '@nextrush/di';

// Error classes
import {
  DIError,
  DependencyResolutionError,
  CircularDependencyError,
  MissingDependencyError,
  InvalidProviderError,
  TypeInferenceError,
  ContainerDisposedError,
} from '@nextrush/di';

// Types
import type {
  ContainerInterface,
  Provider,
  ClassProvider,
  ValueProvider,
  FactoryProvider,
  Token,
  Constructor,
  Scope,
  ServiceOptions,
} from '@nextrush/di';
```

## Integration with Guards

Class-based guards implementing `CanActivate` are resolved from the DI container:

```typescript
import { Service } from '@nextrush/di';
import type { CanActivate, GuardContext } from '@nextrush/decorators';

@Service()
class AuthGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(ctx: GuardContext): Promise<boolean> {
    const token = ctx.get('authorization');
    if (!token) return false;

    const user = await this.authService.verify(token);
    ctx.state.user = user;
    return Boolean(user);
  }
}
```

The `@nextrush/controllers` plugin automatically detects class guards and resolves them from the container.

## Troubleshooting

### Error: "TypeInfo not known for X"

**Cause**: `emitDecoratorMetadata` is not being emitted at runtime.

**Fix**: Use `@nextrush/dev` for development. It automatically handles metadata emission.

```bash
# ❌ Doesn't work (no decorator metadata)
npx tsx src/index.ts

# ✅ Works (full decorator support)
npx nextrush dev
```

### Error: "reflect-metadata not found"

**Cause**: `reflect-metadata` must be imported before decorators.

**Fix**: Import it first in your entry point:

```typescript
import 'reflect-metadata'; // MUST be first!
import { Service } from '@nextrush/di';
```

### Constructor parameters not injected

**Cause**: Class is missing `@Service()` decorator.

**Fix**: Add the decorator:

```typescript
@Service() // Required for DI!
class MyService {
  constructor(private dep: SomeDependency) {}
}
```

## License

MIT
