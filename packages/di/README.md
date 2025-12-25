# @nextrush/di

Lightweight dependency injection container for NextRush v3.

## Features

- 🎯 **Constructor Injection** - Automatic dependency resolution
- 🔄 **Singleton & Transient Scopes** - Control instance lifecycle
- 🔍 **Circular Dependency Detection** - Clear error messages
- 📝 **Production-Grade Errors** - Actionable guidance for fixes
- 🧪 **Test-Friendly** - Easy mocking and isolation

## Installation

```bash
pnpm add @nextrush/di
```

## Quick Start

```typescript
import 'reflect-metadata';
import { Service, Repository, container } from '@nextrush/di';

// Define a repository
@Repository()
class UserRepository {
  findAll() {
    return [{ id: 1, name: 'Alice' }];
  }
}

// Define a service with dependency
@Service()
class UserService {
  constructor(private repo: UserRepository) {}

  getUsers() {
    return this.repo.findAll();
  }
}

// Register dependencies
container.register(UserRepository, { useClass: UserRepository });
container.register(UserService, { useClass: UserService });

// Resolve with automatic injection
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

#### `@Repository(options?)`

Semantic alias for `@Service()`. Use for data access layers.

```typescript
@Repository()
class UserRepository {
  findById(id: string) {
    return db.users.find(id);
  }
}
```

#### `@inject(token)`

Explicitly inject a dependency by token.

```typescript
@Service()
class UserService {
  constructor(
    @inject('DATABASE_URL') private dbUrl: string,
    @inject(IUserRepository) private repo: IUserRepository
  ) {}
}
```

### Container

#### `container.register(token, provider)`

Register a dependency with the container.

```typescript
// Class provider
container.register(UserService, { useClass: UserService });

// Value provider
container.register('CONFIG', { useValue: { port: 3000 } });

// Factory provider
container.register(Logger, {
  useFactory: (c) => new Logger(c.resolve('CONFIG'))
});
```

#### `container.resolve(token)`

Resolve a dependency from the container.

```typescript
const service = container.resolve(UserService);
const config = container.resolve<Config>('CONFIG');
```

#### `container.resolveAll(token)`

Resolve all dependencies registered under a token.

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

Clear singleton instances. Useful for testing.

```typescript
beforeEach(() => {
  container.clearInstances();
});
```

#### `container.reset()`

Reset the container completely.

#### `createContainer()`

Create a new isolated container.

```typescript
const testContainer = createContainer();
testContainer.register(UserService, { useClass: MockUserService });
```

## Circular Dependencies

Use `delay()` to break circular dependencies:

```typescript
import { delay, inject, Service } from '@nextrush/di';

@Service()
class ServiceA {
  constructor(
    @inject(delay(() => ServiceB)) private b: ServiceB
  ) {}
}

@Service()
class ServiceB {
  constructor(
    @inject(delay(() => ServiceA)) private a: ServiceA
  ) {}
}
```

## Error Handling

All errors extend `DIError` and include actionable messages:

```typescript
import {
  DependencyResolutionError,
  CircularDependencyError,
  TypeInferenceError,
} from '@nextrush/di';

try {
  container.resolve(UnregisteredService);
} catch (error) {
  if (error instanceof DependencyResolutionError) {
    console.log(error.missingDependency);
    console.log(error.chain);
  }
}
```

## TypeScript Configuration

Requires these `tsconfig.json` settings:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

## License

MIT
