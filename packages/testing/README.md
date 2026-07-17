# @nextrush/testing

Spring/Nest-parity test harness for NextRush applications — provides isolated, type-safe test modules with DI overrides and in-memory request routing.

**Support tier:** Public — tooling (stable). See [ADR-0005](../../docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md).

## Installation

```bash
pnpm add --save-dev @nextrush/testing
```

## Usage

### Basic Test Module

```typescript
import { createTestModule } from '@nextrush/testing';
import { Controller, Get, Service } from '@nextrush/class';

@Service()
class UserService {
  getUser(id: string) {
    return { id, name: 'Alice' };
  }
}

@Controller('/users')
class UserController {
  constructor(private users: UserService) {}

  @Get('/:id')
  getUser() {
    return this.users.getUser('123');
  }
}

// In your test
const testModule = createTestModule({
  controllers: [UserController],
  providers: [UserService],
});

const ref = await testModule.compile();

// Make requests
const response = await ref.request('GET', '/users/123');
expect(response.status).toBe(200);
expect(response.body).toEqual({ id: '123', name: 'Alice' });

await ref.close();
```

### Service Overrides

```typescript
const fakeUserService = {
  getUser: (id: string) => ({ id, name: 'Fake User' }),
};

const testModule = createTestModule({
  controllers: [UserController],
  providers: [UserService],
})
  .override(UserService)
  .useValue(fakeUserService);

const ref = await testModule.compile();
// UserController now receives the fake service
```

### Multiple Overrides

```typescript
const testModule = createTestModule({
  controllers: [MyController],
  providers: [Service1, Service2, Service3],
})
  .override(Service1)
  .useValue(fakeService1)
  .override(Service2)
  .useClass(AlternateService2)
  .override(Service3)
  .useFactory(() => new Service3({ debug: true }));

const ref = await testModule.compile();
```

### Get Resolved Services

```typescript
const ref = await testModule.compile();

// Resolve directly from the test container
const userService = ref.get<UserService>(UserService);
userService.getUser('1'); // Direct method call
```

### Isolation

Each `createTestModule().compile()` creates a fresh, isolated container. Singletons are not shared between modules:

```typescript
const ref1 = await testModule.compile();
const ref2 = await testModule.compile();

const service1 = ref1.get<MyService>(MyService);
const service2 = ref2.get<MyService>(MyService);

expect(service1).not.toBe(service2); // Different instances
```

### Request-Scoped Services

Request-scoped services are fresh per `request()` call:

```typescript
@Service({ scope: 'request' })
class RequestId {
  readonly id = Math.random();
}

const r1 = await ref.request('GET', '/path');
const r2 = await ref.request('GET', '/path');

// Each request got a fresh RequestId instance
```

### Lifecycle Hooks

`OnShutdown` decorators are honored when calling `ref.close()`:

```typescript
@Service()
class Database {
  async onShutdown() {
    // Cleanup code
  }
}

await ref.close(); // Triggers onShutdown
```

## API

### `createTestModule(config?: TestModuleConfig): TestModuleBuilder`

Create a new test module builder.

**Config:**
- `controllers?: Function[]` — Controller classes to register
- `providers?: unknown[]` — Provider classes or config objects

### `TestModuleBuilder`

Chainable builder for test module configuration.

#### `.override(token): OverrideBuilder`

Override a provider token.

**Returns an object with:**
- `.useValue(value): TestModuleBuilder` — Replace with a static value
- `.useClass(cls): TestModuleBuilder` — Replace with an alternate class
- `.useFactory(fn, inject?): TestModuleBuilder` — Replace with a factory function

#### `.compile(): Promise<TestModuleRef>`

Compile the test module into an isolated, ready-to-test reference.

### `TestModuleRef`

The compiled test module reference.

#### `.get<T>(token): T`

Resolve a token from the isolated container with full type safety.

#### `.request(method: string, path: string, body?: unknown): Promise<{ status: number; body: unknown }>`

Drive a request through the router and return the captured response.

#### `.close(): Promise<void>`

Close the application and trigger all `OnShutdown` hooks.

## Guarantees

- **Full isolation** — Each compiled module has its own container and router
- **Type-safe** — Full TypeScript support; no `any` types
- **Zero shared state** — Singletons are not reused across modules
- **Request scope** — Request-scoped services are fresh per request
- **Lifecycle hooks** — `OnShutdown` decorators are called on close
