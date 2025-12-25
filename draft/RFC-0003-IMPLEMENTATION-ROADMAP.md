# RFC-0003: Implementation Roadmap

**Status:** Draft
**Author:** NextRush Team
**Target Version:** v3.0.0-alpha.2 → v3.0.0
**Last Updated:** 2025-12-25
**Depends On:** RFC-0001, RFC-0002

---

## Overview

This RFC defines the **step-by-step implementation plan** for adding DI and decorators to NextRush v3 **without breaking existing functional API**.

---

## Principles

1. **Backward Compatibility First** – Existing apps continue to work
2. **Incremental Delivery** – Ship features in phases
3. **Test-Driven** – Write tests before implementation
4. **Documentation** – Document each feature as shipped

---

## Phase 1: DI Foundation (Alpha 2)

**Target:** v3.0.0-alpha.2
**Duration:** 2 weeks
**Goal:** Basic DI system working

### Tasks

#### 1.1 Create @nextrush/di Package

```bash
# Create package structure
mkdir -p packages/di/src/__tests__

# Files
packages/di/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
└── src/
    ├── index.ts
    ├── container.ts
    ├── decorators.ts
    ├── types.ts
    ├── errors.ts
    └── __tests__/
        ├── container.test.ts
        ├── decorators.test.ts
        └── errors.test.ts
```

#### 1.2 Install Dependencies

```json
{
  "name": "@nextrush/di",
  "version": "3.0.0-alpha.2",
  "dependencies": {
    "tsyringe": "^4.8.0",
    "reflect-metadata": "^0.2.1"
  },
  "devDependencies": {
    "@nextrush/types": "workspace:*"
  }
}
```

#### 1.3 Implement Core DI

**container.ts:**
```typescript
import { container as tsyContainer } from 'tsyringe';

export const container = {
  register<T>(token: any, provider: any): void {
    if (provider.useClass) {
      tsyContainer.register(token, { useClass: provider.useClass });
    } else if (provider.useValue) {
      tsyContainer.register(token, { useValue: provider.useValue });
    } else {
      throw new Error('Invalid provider');
    }
  },

  resolve<T>(token: any): T {
    return tsyContainer.resolve<T>(token);
  },

  clear(): void {
    tsyContainer.clearInstances();
  },

  isRegistered(token: any): boolean {
    return tsyContainer.isRegistered(token);
  }
};
```

**decorators.ts:**
```typescript
import { injectable, inject as tsyInject } from 'tsyringe';

export function Service() {
  return injectable();
}

export const Repository = Service;

export function inject(token: any) {
  return tsyInject(token);
}

export const injectable = Service;
```

#### 1.4 Tests

```typescript
// container.test.ts
describe('@nextrush/di - Container', () => {
  beforeEach(() => {
    container.clear();
  });

  it('should register and resolve class', () => {
    @Service()
    class TestService {}

    container.register(TestService, { useClass: TestService });
    const instance = container.resolve(TestService);

    expect(instance).toBeInstanceOf(TestService);
  });

  it('should inject dependencies', () => {
    @Service()
    class DepService {}

    @Service()
    class MainService {
      constructor(public dep: DepService) {}
    }

    container.register(DepService, { useClass: DepService });
    container.register(MainService, { useClass: MainService });

    const instance = container.resolve(MainService);
    expect(instance.dep).toBeInstanceOf(DepService);
  });

  it('should throw on circular dependency', () => {
    // Test circular dependency detection
  });
});
```

#### 1.5 Documentation

Create `packages/di/README.md`:
- Installation
- Basic usage
- API reference
- Error handling

**Deliverable:** Working `@nextrush/di` package

---

## Phase 2: Decorators (Alpha 2)

**Target:** v3.0.0-alpha.2
**Duration:** 2 weeks (parallel with Phase 1)
**Goal:** Metadata-only decorators

### Tasks

#### 2.1 Create @nextrush/decorators Package

```bash
packages/decorators/
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── src/
    ├── index.ts
    ├── class.ts        # @Controller
    ├── routes.ts       # @Get, @Post, etc.
    ├── params.ts       # @Body, @Param, etc.
    ├── metadata.ts     # Metadata readers
    ├── types.ts
    └── __tests__/
        ├── class.test.ts
        ├── routes.test.ts
        └── params.test.ts
```

#### 2.2 Implement Decorators

**class.ts:**
```typescript
export function Controller(path = '') {
  return function (target: any) {
    Reflect.defineMetadata('controller:path', path, target);
    Reflect.defineMetadata('controller:type', 'controller', target);
  };
}
```

**routes.ts:**
```typescript
function createRouteDecorator(method: string) {
  return function (path = '') {
    return function (target: any, propertyKey: string) {
      const routes = Reflect.getMetadata('routes', target.constructor) || [];
      routes.push({ method, path, methodName: propertyKey });
      Reflect.defineMetadata('routes', routes, target.constructor);
    };
  };
}

export const Get = createRouteDecorator('GET');
export const Post = createRouteDecorator('POST');
export const Put = createRouteDecorator('PUT');
export const Delete = createRouteDecorator('DELETE');
export const Patch = createRouteDecorator('PATCH');
```

**params.ts:**
```typescript
function createParamDecorator(type: string) {
  return function (key?: string) {
    return function (target: any, propertyKey: string, index: number) {
      const params = Reflect.getMetadata('params', target, propertyKey) || [];
      params[index] = { type, key };
      Reflect.defineMetadata('params', params, target, propertyKey);
    };
  };
}

export const Body = createParamDecorator('body');
export const Param = createParamDecorator('param');
export const Query = createParamDecorator('query');
export const Header = createParamDecorator('header');

export function Ctx() {
  return function (target: any, propertyKey: string, index: number) {
    const params = Reflect.getMetadata('params', target, propertyKey) || [];
    params[index] = { type: 'ctx' };
    Reflect.defineMetadata('params', params, target, propertyKey);
  };
}
```

**metadata.ts:**
```typescript
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

#### 2.3 Tests

```typescript
describe('@nextrush/decorators', () => {
  it('should set controller metadata', () => {
    @Controller('/users')
    class UserController {}

    const meta = getControllerMetadata(UserController);
    expect(meta.path).toBe('/users');
  });

  it('should set route metadata', () => {
    @Controller('/users')
    class UserController {
      @Get('/:id')
      get() {}
    }

    const routes = getRouteMetadata(UserController);
    expect(routes).toHaveLength(1);
    expect(routes[0]).toEqual({
      method: 'GET',
      path: '/:id',
      methodName: 'get'
    });
  });

  it('should set param metadata', () => {
    class UserController {
      get(@Param('id') id: string, @Body() data: any) {}
    }

    const params = getParamMetadata(UserController.prototype, 'get');
    expect(params[0]).toEqual({ type: 'param', key: 'id' });
    expect(params[1]).toEqual({ type: 'body', key: undefined });
  });
});
```

**Deliverable:** Working `@nextrush/decorators` package

---

## Phase 3: Controller Loader (Alpha 2)

**Target:** v3.0.0-alpha.2
**Duration:** 2 weeks
**Goal:** Auto-discovery and route registration

### Tasks

#### 3.1 Create @nextrush/controllers Package

```bash
packages/controllers/
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── src/
    ├── index.ts
    ├── plugin.ts
    ├── scanner.ts      # File discovery
    ├── loader.ts       # Dynamic import
    ├── registry.ts     # DI registration
    ├── builder.ts      # Handler factory
    ├── types.ts
    └── __tests__/
        ├── plugin.test.ts
        ├── scanner.test.ts
        └── builder.test.ts
```

#### 3.2 Dependencies

```json
{
  "dependencies": {
    "@nextrush/core": "workspace:*",
    "@nextrush/types": "workspace:*",
    "@nextrush/di": "workspace:*",
    "@nextrush/decorators": "workspace:*",
    "glob": "^10.3.10"
  }
}
```

#### 3.3 Implement Plugin

**scanner.ts:**
```typescript
import { glob } from 'glob';

export async function scanFiles(options: ScanOptions): Promise<string[]> {
  // Default to scanning all .ts files. User can override.
  return glob(options.include || ['**/*.ts'], {
    cwd: options.root,
    ignore: options.exclude || ['**/*.test.ts', '**/node_modules/**', '**/dist/**'],
    absolute: true
  });
}
```

**loader.ts:**
```typescript
export async function loadModules(files: string[]): Promise<any[]> {
  return Promise.all(files.map(file => import(file)));
}
```

**registry.ts:**
```typescript
import { container } from '@nextrush/di';
import { getControllerMetadata } from '@nextrush/decorators';

export function registerInDI(modules: any[]): void {
  for (const mod of modules) {
    for (const exported of Object.values(mod)) {
      if (isClass(exported)) {
        const meta = getControllerMetadata(exported);
        const isService = Reflect.getMetadata('di:type', exported) === 'service';

        // Smart Discovery: Register if it has @Controller or @Service metadata
        if (meta.type === 'controller' || isService) {
          container.register(exported, { useClass: exported });
        }
      }
    }
  }
}
```

**builder.ts:**
```typescript
import { getParamMetadata } from '@nextrush/decorators';
import type { Context } from '@nextrush/types';

export function createHandler(instance: any, route: RouteMetadata) {
  return async (ctx: Context) => {
    const params = getParamMetadata(instance.constructor.prototype, route.methodName);

    const args = params.map(param => {
      switch (param.type) {
        case 'body':
          return param.key ? ctx.body?.[param.key] : ctx.body;
        case 'param':
          return ctx.params[param.key];
        case 'query':
          return param.key ? ctx.query?.[param.key] : ctx.query;
        case 'header':
          return ctx.headers[param.key];
        case 'ctx':
          return ctx;
        default:
          return undefined;
      }
    });

    const result = await instance[route.methodName](...args);

    if (result !== undefined && !ctx.res?.headersSent) {
      ctx.json(result);
    }
  };
}
```

**plugin.ts:**
```typescript
import type { Plugin } from '@nextrush/types';
import { scanFiles } from './scanner';
import { loadModules } from './loader';
import { registerInDI } from './registry';
import { createHandler } from './builder';
import { container } from '@nextrush/di';
import { getControllerMetadata, getRouteMetadata } from '@nextrush/decorators';

export function controllers(options: ControllerOptions): Plugin {
  return {
    name: 'nextrush-controllers',
    version: '3.0.0-alpha.2',

    async install(app) {
      const files = await scanFiles(options);
      const modules = await loadModules(files);

      registerInDI(modules);

      const controllers = findControllers(modules);

      for (const ControllerClass of controllers) {
        const instance = container.resolve(ControllerClass);
        const controllerMeta = getControllerMetadata(ControllerClass);
        const routes = getRouteMetadata(ControllerClass);

        for (const route of routes) {
          const fullPath = controllerMeta.path + route.path;
          const handler = createHandler(instance, route);

          const method = route.method.toLowerCase();
          app[method](fullPath, handler);
        }
      }
    }
  };
}
```

#### 3.4 Tests

```typescript
describe('@nextrush/controllers', () => {
  it('should scan and discover controllers', async () => {
    const files = await scanFiles({ root: './test-fixtures' });
    expect(files).toContain('user.controller.ts');
  });

  it('should register routes from controllers', async () => {
    const app = createApp();

    await app.pluginAsync(controllers({ root: './test-fixtures' }));

    // Verify routes registered
  });
});
```

**Deliverable:** Working `@nextrush/controllers` package

---

## Phase 4: Meta Package Update (Alpha 2)

**Target:** v3.0.0-alpha.2
**Duration:** 1 week
**Goal:** Export OOP APIs from `nextrush` package

### Tasks

#### 4.1 Update nextrush/package.json

```json
{
  "dependencies": {
    "@nextrush/core": "workspace:*",
    "@nextrush/router": "workspace:*",
    "@nextrush/types": "workspace:*",
    "@nextrush/di": "workspace:*",
    "@nextrush/decorators": "workspace:*",
    "@nextrush/controllers": "workspace:*"
  }
}
```

#### 4.2 Update nextrush/src/index.ts

```typescript
// Functional API (existing)
export { createApp } from '@nextrush/core';
export { createRouter } from '@nextrush/router';
export type { Context, Middleware, Plugin } from '@nextrush/types';

// DI System (new)
export { container, Service, Repository, inject } from '@nextrush/di';

// Decorators (new)
export {
  Controller,
  Get, Post, Put, Delete, Patch,
  Body, Param, Query, Header, Ctx
} from '@nextrush/decorators';

// Controller Loader (new)
export { controllers } from '@nextrush/controllers';
export type { ControllerOptions } from '@nextrush/controllers';
```

#### 4.3 Tests

Verify both styles work:

```typescript
// Test functional style
import { createApp } from 'nextrush';
const app = createApp();
app.get('/test', async (ctx) => ctx.json({ ok: true }));

// Test OOP style
import { createApp, Controller, Get, controllers } from 'nextrush';
@Controller('/test')
class TestController {
  @Get('/')
  test() {
    return { ok: true };
  }
}
const app2 = createApp();
app2.plugin(controllers({ root: './' }));
```

**Deliverable:** Updated `nextrush` meta package

---

## Phase 5: Documentation (Alpha 3)

**Target:** v3.0.0-alpha.3
**Duration:** 2 weeks
**Goal:** Complete documentation for OOP features

### Tasks

#### 5.1 Create Guides

- `docs/guides/dependency-injection.md`
- `docs/guides/decorators.md`
- `docs/guides/controllers.md`
- `docs/guides/oop-vs-functional.md`

#### 5.2 API Reference

- `docs/api/di.md`
- `docs/api/decorators.md`
- `docs/api/controllers.md`

#### 5.3 Examples

```
examples/
├── functional-todo-api/
├── oop-todo-api/
└── hybrid-api/
```

#### 5.4 Migration Guide

- `docs/migration/functional-to-oop.md`

**Deliverable:** Complete documentation

---

## Phase 6: Advanced Features (Beta)

**Target:** v3.0.0-beta.1
**Duration:** 3 weeks
**Goal:** Validation, error handling, testing utilities

### Tasks

#### 6.1 Validation Integration

```typescript
@Post('/')
async create(@Body() @Validate(CreateUserDto) data: CreateUserDto) {
  return this.userService.create(data);
}
```

#### 6.2 Testing Utilities

```typescript
import { createTestingModule } from '@nextrush/testing';

const module = createTestingModule({
  controllers: [UserController],
  providers: [{ provide: UserService, useClass: MockUserService }]
});

const controller = module.get(UserController);
```

#### 6.3 Error Filters

```typescript
@Controller('/users')
@Catch(NotFoundException)
class UserController {
  @Get('/:id')
  async get(@Param('id') id: string) {
    const user = await this.userService.findById(id);
    if (!user) throw new NotFoundException();
    return user;
  }
}
```

**Deliverable:** Advanced features package

---

## Phase 7: Stabilization (RC)

**Target:** v3.0.0-rc.1
**Duration:** 2 weeks
**Goal:** Bug fixes, performance tuning, final testing

### Tasks

#### 7.1 Performance Benchmarks

- Compare functional vs OOP startup time
- Measure request throughput
- Memory profiling

#### 7.2 Edge Cases

- Test circular dependencies
- Test missing dependencies
- Test type inference edge cases

#### 7.3 Real-World Testing

- Build 3 production-like apps
- Collect feedback

**Deliverable:** Stable release candidate

---

## Phase 8: Release (Stable)

**Target:** v3.0.0
**Duration:** 1 week
**Goal:** Production-ready release

### Tasks

- Final QA
- Release notes
- Blog post
- Update README
- Social media announcement

**Deliverable:** NextRush v3.0.0

---

## Timeline

| Phase | Duration | Target Version |
|-------|----------|----------------|
| Phase 1: DI Foundation | 2 weeks | Alpha 2 |
| Phase 2: Decorators | 2 weeks | Alpha 2 |
| Phase 3: Controller Loader | 2 weeks | Alpha 2 |
| Phase 4: Meta Package | 1 week | Alpha 2 |
| **Alpha 2 Total** | **7 weeks** | **Alpha 2** |
| Phase 5: Documentation | 2 weeks | Alpha 3 |
| Phase 6: Advanced Features | 3 weeks | Beta 1 |
| Phase 7: Stabilization | 2 weeks | RC 1 |
| Phase 8: Release | 1 week | v3.0.0 |
| **Total** | **15 weeks** (~4 months) | **v3.0.0** |

---

## Success Criteria

### Alpha 2
- ✅ DI working (constructor injection, singletons)
- ✅ Decorators working (Controller, routes, params)
- ✅ Auto-discovery working
- ✅ Both functional and OOP styles supported
- ✅ All tests passing

### Alpha 3
- ✅ Documentation complete
- ✅ Examples working
- ✅ Migration guide written

### Beta 1
- ✅ Validation integrated
- ✅ Testing utilities available
- ✅ Error handling improved

### v3.0.0
- ✅ Production-ready
- ✅ Performance benchmarks met
- ✅ Real-world apps tested

---

## Risk Mitigation

### Risk 1: Breaking Changes

**Mitigation:** Keep functional API unchanged. OOP is additive.

### Risk 2: Performance Regression

**Mitigation:** Benchmark at each phase. Optimize if needed.

### Risk 3: Complexity

**Mitigation:** Document extensively. Provide examples.

### Risk 4: tsyringe Issues

**Mitigation:** Wrapper allows swapping DI implementation if needed.

---

## Decision

This implementation roadmap is **approved**.

**Start Date:** 2025-12-26
**Expected Completion:** 2026-04-15

---
