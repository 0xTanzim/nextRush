# @nextrush/di

Lightweight dependency injection container for NextRush v3.

## Features

- 🎯 **Constructor Injection** - Automatic dependency resolution
- 🔄 **Singleton & Transient Scopes** - Control instance lifecycle
- 🔍 **Circular Dependency Detection** - Clear error messages
- 📝 **Production-Grade Errors** - Actionable guidance for fixes
- 🧪 **Test-Friendly** - Easy mocking and isolation

## ⚠️ Runtime Requirements

**This package requires `emitDecoratorMetadata` support at runtime.**

| Runtime | Support | Recommended |
|---------|---------|-------------|
| **@swc-node/register** | ✅ Full | **✅ Yes** |
| **tsc + node** | ✅ Full | ✅ Yes |
| **tsx / esbuild** | ❌ No | ❌ No |
| **ts-node --esm** | ⚠️ Limited | ❌ No |

### Why?

TypeScript's `emitDecoratorMetadata` option emits runtime type information that allows the DI container to automatically resolve constructor dependencies. Without it, you get errors like:

```
TypeInfo not known for "UserService"
```

**Solution**: Use `@swc-node/register` for development:

```bash
pnpm add -D @swc-node/register @swc/core
```

```json
{
  "scripts": {
    "dev": "node --import @swc-node/register/esm-register src/index.ts"
  }
}
```

## Installation

```bash
pnpm add @nextrush/di reflect-metadata

# For development with decorator support
pnpm add -D @swc-node/register @swc/core typescript
```

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
import 'reflect-metadata';  // Must be first!
import { Service, Repository, container } from '@nextrush/di';

// Define a repository
@Repository()
class UserRepository {
  findAll() {
    return [{ id: 1, name: 'Alice' }];
  }
}

// Define a service with automatic dependency injection
@Service()
class UserService {
  constructor(private repo: UserRepository) {}  // Auto-injected!

  getUsers() {
    return this.repo.findAll();
  }
}

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

Explicitly inject a dependency by token. Use for interfaces or custom tokens.

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

Allow instantiation with `new` while still supporting auto-injection.

```typescript
@AutoInjectable()
class FeatureService {
  constructor(private logger?: Logger) {}
}

// Can instantiate with new - logger is auto-injected
const service = new FeatureService();

// Or provide manually
const service2 = new FeatureService(customLogger);
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

## Troubleshooting

### Error: "TypeInfo not known for X"

**Cause**: `emitDecoratorMetadata` is not being emitted at runtime.

**Fix**: Use `@swc-node/register` instead of `tsx`:

```bash
# ❌ Doesn't work
npx tsx src/index.ts

# ✅ Works
node --import @swc-node/register/esm-register src/index.ts
```

### Error: "reflect-metadata not found"

**Cause**: `reflect-metadata` must be imported before decorators.

**Fix**: Import it first in your entry point:

```typescript
import 'reflect-metadata';  // MUST be first!
import { Service } from '@nextrush/di';
```

### Constructor parameters not injected

**Cause**: Class is missing `@Service()` decorator.

**Fix**: Add the decorator:

```typescript
@Service()  // Required for DI!
class MyService {
  constructor(private dep: SomeDependency) {}
}
```

## License

MIT
