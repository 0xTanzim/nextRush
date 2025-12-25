# RFC-0002: Dependency Injection & Decorators

**Status:** Draft
**Author:** NextRush Team
**Target Version:** v3.0.0-alpha.2
**Last Updated:** 2025-12-25
**Depends On:** RFC-0001

---

## Summary

This RFC defines the **Dependency Injection system** and **decorator API** for NextRush v3.

The system prioritizes:
- **Constructor injection** (Spring/NestJS style)
- **Zero manual wiring** (auto-discovery)
- **Production-grade error messages**
- **Type safety** (TypeScript strict mode)

---

## Motivation

### Why DI?

Large applications require:
- **Service boundaries** (separation of concerns)
- **Testability** (mock dependencies)
- **Loose coupling** (depend on abstractions)

Manual dependency management does not scale:

```typescript
// ❌ Bad: Manual wiring
const userRepo = new UserRepository();
const userService = new UserService(userRepo);
const userController = new UserController(userService);

app.get('/users', (ctx) => userController.getUsers(ctx));
```

DI solves this:

```typescript
// ✅ Good: Auto-wiring
@Controller('/users')
class UserController {
  constructor(private userService: UserService) {}
}
```

---

## Package: @nextrush/di

### Purpose

Lightweight wrapper around **tsyringe** for better DX.

### Installation

```bash
pnpm add @nextrush/di tsyringe reflect-metadata
```

### API

```typescript
// packages/di/src/index.ts
export { container } from './container';
export { inject, injectable, singleton } from './decorators';
export { Service, Repository } from './decorators';
export type { Container, Token, Provider } from './types';
```

---

### Core API

#### container.register()

```typescript
container.register<T>(
  token: Token<T>,
  provider: ClassProvider<T> | ValueProvider<T>
): void

// Example
container.register(UserService, { useClass: UserService });
container.register('CONFIG', { useValue: { port: 3000 } });
```

#### container.resolve()

```typescript
container.resolve<T>(token: Token<T>): T

// Example
const userService = container.resolve(UserService);
```

#### container.clear()

```typescript
container.clear(): void
```

---

### Decorators

#### @Service()

Marks a class as an injectable service (singleton by default).

```typescript
@Service()
export class UserService {
  async findAll() {
    return [{ id: 1, name: 'Alice' }];
  }
}
```

**Generated Metadata:**
```typescript
{
  type: 'service',
  scope: 'singleton',
  token: UserService
}
```

#### @Repository()

Marks a class as a repository (database access layer).

```typescript
@Repository()
export class UserRepository {
  async findAll() {
    return db.users.findMany();
  }
}
```

**Same as @Service() internally**, just semantic naming.

#### @inject()

Explicit dependency injection (for interfaces or tokens).

```typescript
@Service()
export class UserService {
  constructor(
    @inject('IUserRepository') private repo: IUserRepository
  ) {}
}
```

**Note:** TypeScript can infer types, so `@inject()` is **optional** for concrete classes.

---

### Scope Support

#### Singleton (Default)

```typescript
@Service()
class LoggerService {}  // One instance for entire app
```

#### Transient (Future)

```typescript
@Service({ scope: 'transient' })
class RequestLogger {}  // New instance per injection
```

#### Request-Scoped (Future, Post-v3)

```typescript
@Service({ scope: 'request' })
class CurrentUser {}  // One instance per HTTP request
```

---

### Implementation

```typescript
// packages/di/src/container.ts
import { container as tsyContainer, injectable, inject } from 'tsyringe';

export const container = {
  register<T>(token: any, provider: any): void {
    if (provider.useClass) {
      tsyContainer.register(token, { useClass: provider.useClass });
    } else if (provider.useValue) {
      tsyContainer.register(token, { useValue: provider.useValue });
    }
  },

  resolve<T>(token: any): T {
    return tsyContainer.resolve<T>(token);
  },

  clear(): void {
    tsyContainer.clearInstances();
  }
};
```

```typescript
// packages/di/src/decorators.ts
import { injectable as tsyInjectable, inject as tsyInject } from 'tsyringe';

export function Service() {
  return tsyInjectable();
}

export const Repository = Service;

export function inject(token: any) {
  return tsyInject(token);
}
```

---

## Package: @nextrush/decorators

### Purpose

Metadata-only decorators. **No runtime logic**, **no DI resolution**.

### Installation

```bash
pnpm add @nextrush/decorators reflect-metadata
```

### API

```typescript
export { Controller } from './class';
export { Get, Post, Put, Delete, Patch } from './routes';
export { Body, Param, Query, Header, Ctx } from './params';
export { getControllerMetadata, getRouteMetadata } from './metadata';
```

---

### Class Decorators

#### @Controller(path?: string)

```typescript
@Controller('/users')
export class UserController {}
```

**Metadata:**
```typescript
{
  type: 'controller',
  path: '/users',
  target: UserController
}
```

**Implementation:**
```typescript
export function Controller(path = '') {
  return function (target: any) {
    Reflect.defineMetadata('controller:path', path, target);
    Reflect.defineMetadata('controller:type', 'controller', target);
  };
}
```

---

### Route Decorators

#### @Get(path?)

```typescript
@Controller('/users')
class UserController {
  @Get('/')
  list() {}

  @Get('/:id')
  get() {}
}
```

**Metadata:**
```typescript
{
  method: 'GET',
  path: '/',
  methodName: 'list',
  target: UserController.prototype
}
```

**Implementation:**
```typescript
export function Get(path = '') {
  return function (target: any, propertyKey: string) {
    const routes = Reflect.getMetadata('routes', target.constructor) || [];
    routes.push({ method: 'GET', path, methodName: propertyKey });
    Reflect.defineMetadata('routes', routes, target.constructor);
  };
}
```

#### Other HTTP Methods

```typescript
export const Post = createRouteDecorator('POST');
export const Put = createRouteDecorator('PUT');
export const Delete = createRouteDecorator('DELETE');
export const Patch = createRouteDecorator('PATCH');
```

---

### Parameter Decorators

#### @Body()

Maps `ctx.body` to method parameter.

```typescript
@Post('/')
create(@Body() data: CreateUserDto) {
  return this.userService.create(data);
}
```

**Metadata:**
```typescript
{
  index: 0,        // Parameter position
  type: 'body',
  key: undefined   // Full body
}
```

#### @Body('email')

Maps `ctx.body.email` to parameter.

```typescript
@Post('/')
create(@Body('email') email: string) {}
```

**Metadata:**
```typescript
{
  index: 0,
  type: 'body',
  key: 'email'
}
```

#### @Param(key)

```typescript
@Get('/:id')
get(@Param('id') id: string) {}
```

**Metadata:**
```typescript
{
  index: 0,
  type: 'param',
  key: 'id'
}
```

#### @Query(key?)

```typescript
@Get('/')
list(@Query('page') page: number) {}
```

#### @Header(key)

```typescript
@Post('/')
create(@Header('authorization') token: string) {}
```

#### @Ctx()

Full context object.

```typescript
@Get('/')
async list(@Ctx() ctx: Context) {
  ctx.set('X-Custom', 'value');
  return { users: [] };
}
```

---

### Implementation

```typescript
// packages/decorators/src/params.ts
export function Body(key?: string) {
  return function (target: any, propertyKey: string, index: number) {
    const params = Reflect.getMetadata('params', target, propertyKey) || [];
    params[index] = { type: 'body', key };
    Reflect.defineMetadata('params', params, target, propertyKey);
  };
}

export function Param(key: string) {
  return function (target: any, propertyKey: string, index: number) {
    const params = Reflect.getMetadata('params', target, propertyKey) || [];
    params[index] = { type: 'param', key };
    Reflect.defineMetadata('params', params, target, propertyKey);
  };
}

// Similar for Query, Header, Ctx...
```

---

### Metadata Reader

```typescript
// packages/decorators/src/metadata.ts
export function getControllerMetadata(target: any) {
  return {
    path: Reflect.getMetadata('controller:path', target) || '',
    type: Reflect.getMetadata('controller:type', target)
  };
}

export function getRouteMetadata(target: any) {
  return Reflect.getMetadata('routes', target) || [];
}

export function getParamMetadata(target: any, methodName: string) {
  return Reflect.getMetadata('params', target, methodName) || [];
}
```

---

## Package: @nextrush/controllers

### Purpose

The **bridge** that connects decorators, DI, and the router.

### Installation

```bash
pnpm add @nextrush/controllers
```

### API

```typescript
export { controllers } from './plugin';
export type { ControllerOptions } from './types';
```

---

### Plugin API

```typescript
import { controllers } from '@nextrush/controllers';

app.plugin(controllers({
  root: './src',
  // Optional: defaults to scanning all .ts files
  include: ['**/*.ts'],
  exclude: ['**/*.test.ts']
}));
```

**Options:**
```typescript
interface ControllerOptions {
  root: string;                    // Scan root directory
  include?: string[];              // Glob patterns (Default: ['**/*.ts'])
  exclude?: string[];              // Exclusion patterns (Default: ['**/*.test.ts'])
  enableDI?: boolean;              // Default: true
  errorHandler?: (err) => void;    // Custom error handler
}
```

---

### Smart Discovery (Boot Flow)

NextRush v3 uses **Decorator-First Discovery**. It doesn't care about your file names (`user.controller.ts` vs `UserController.ts` vs `user_controller.ts`). It only cares about what's **inside** the file.

```typescript
// packages/controllers/src/plugin.ts
import { glob } from 'glob';
import { container } from '@nextrush/di';
import { getControllerMetadata, getRouteMetadata, getParamMetadata } from '@nextrush/decorators';

export function controllers(options: ControllerOptions): Plugin {
  return {
    name: 'nextrush-controllers',
    version: '3.0.0-alpha.2',

    async install(app) {
      // 1. File Discovery (Broad scan)
      const files = await glob(options.include || ['**/*.ts'], {
        cwd: options.root,
        ignore: options.exclude || ['**/*.test.ts', '**/node_modules/**', '**/dist/**']
      });

      // 2. Dynamic Import
      const modules = await Promise.all(
        files.map(file => import(path.join(options.root, file)))
      );

      // 3. Smart Registration
      // We iterate through all exports and look for @Controller or @Service metadata
      for (const module of modules) {
        for (const exported of Object.values(module)) {
          if (isClass(exported)) {
            const meta = getControllerMetadata(exported);
            const isService = Reflect.getMetadata('di:type', exported) === 'service';

            // If it has @Controller or @Service, register it!
            if (meta.type === 'controller' || isService) {
              container.register(exported, { useClass: exported });
            }
          }
        }
      }

      // 4. Resolve Controllers & Register Routes
      // ... existing logic ...
    }
  };
}
```

---

### Handler Factory

```typescript
function createHandler(instance: any, route: RouteMetadata) {
  return async (ctx: Context) => {
    const params = getParamMetadata(instance.constructor.prototype, route.methodName);

    // Build method arguments from decorators
    const args = params.map(param => {
      switch (param.type) {
        case 'body':
          return param.key ? ctx.body[param.key] : ctx.body;
        case 'param':
          return ctx.params[param.key];
        case 'query':
          return param.key ? ctx.query[param.key] : ctx.query;
        case 'header':
          return ctx.headers[param.key];
        case 'ctx':
          return ctx;
        default:
          return undefined;
      }
    });

    // Call controller method
    const result = await instance[route.methodName](...args);

    // Auto-send JSON if not already sent
    if (result !== undefined && !ctx.res.headersSent) {
      ctx.json(result);
    }
  };
}
```

---

## Error Handling (Critical DX)

### Missing Dependency

```typescript
class DependencyResolutionError extends Error {
  constructor(chain: string[], missing: string) {
    super(`
❌ Dependency Resolution Failed

${chain.join(' → ')} → ${missing}

${missing} is not registered.

Possible fixes:
  • Add @Service() or @Repository() to ${missing}
  • Ensure file is in scan directory
  • Check file naming convention: *.service.ts
    `);
    this.name = 'DependencyResolutionError';
  }
}
```

### Circular Dependency

```typescript
class CircularDependencyError extends Error {
  constructor(cycle: string[]) {
    super(`
❌ Circular Dependency Detected

${cycle.join(' → ')} → ${cycle[0]}

Break the cycle by:
  • Extracting shared logic to a third service
  • Using event-driven communication
  • Lazy loading with providers
    `);
    this.name = 'CircularDependencyError';
  }
}
```

### Type Inference Failed

```typescript
class TypeInferenceError extends Error {
  constructor(className: string, paramIndex: number) {
    super(`
❌ Cannot Resolve Constructor Parameter

${className} constructor parameter #${paramIndex} has no type.

Fix:
  constructor(private service: ServiceClass) {}
                              ^^^^^^^^^^^^
Add explicit type annotation.
    `);
    this.name = 'TypeInferenceError';
  }
}
```

---

## Testing Strategy

### Unit Test Controllers

```typescript
describe('UserController', () => {
  let controller: UserController;
  let mockUserService: UserService;

  beforeEach(() => {
    mockUserService = {
      findAll: vi.fn().mockResolvedValue([{ id: 1, name: 'Alice' }])
    };

    controller = new UserController(mockUserService);
  });

  it('should list users', async () => {
    const result = await controller.list();

    expect(result).toEqual([{ id: 1, name: 'Alice' }]);
    expect(mockUserService.findAll).toHaveBeenCalled();
  });
});
```

### Integration Test with DI

```typescript
describe('UserController (Integration)', () => {
  beforeAll(() => {
    container.register(UserService, { useClass: MockUserService });
  });

  afterAll(() => {
    container.clear();
  });

  it('should resolve and inject dependencies', () => {
    const controller = container.resolve(UserController);

    expect(controller).toBeInstanceOf(UserController);
    expect(controller['userService']).toBeInstanceOf(MockUserService);
  });
});
```

---

## Performance Impact

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Cold Start | 30ms | 80ms | +50ms |
| First Request | 2ms | 2ms | 0ms |
| Memory | 10MB | 12MB | +2MB |
| Request Throughput | Same | Same | 0% |

**Conclusion:** Boot-time cost is acceptable for improved DX.

---

## Trade-offs

### Accepted

- ✅ Slower cold start (+50ms)
- ✅ More internal complexity
- ✅ reflect-metadata dependency

### Benefits

- ✅ Zero manual wiring
- ✅ Excellent testability
- ✅ SOLID principles
- ✅ Enterprise-grade DX

---

## Non-Goals (v3)

- ❌ Request-scoped DI
- ❌ Guard system
- ❌ Interceptors
- ❌ Custom parameter decorators

---

## Migration Example

### Before (Functional)

```typescript
// src/main.ts
import { createApp } from 'nextrush';

const app = createApp();

app.get('/users', async (ctx) => {
  const users = await db.users.findMany();
  ctx.json(users);
});
```

### After (OOP)

```typescript
// src/main.ts
import { createApp, controllers } from 'nextrush';

const app = createApp();
app.plugin(controllers({ root: './src' }));

// src/services/user.service.ts
@Service()
export class UserService {
  async findAll() {
    return db.users.findMany();
  }
}

// src/controllers/user.controller.ts
@Controller('/users')
export class UserController {
  constructor(private userService: UserService) {}

  @Get('/')
  list() {
    return this.userService.findAll();
  }
}
```

---

## Decision

This DI + decorator design is **accepted** for NextRush v3.

**Approved:** 2025-12-25

---

## Appendix: tsconfig.json Requirements

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "strict": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler"
  }
}
```
