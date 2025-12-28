# RFC-0001: NextRush v3 – Complete Architecture

**Status:** Draft
**Author:** NextRush Team
**Target Version:** v3.0.0-alpha.2
**Last Updated:** 2025-12-25

---

## Summary

This RFC defines the **complete architecture** of NextRush v3, a **batteries-included application framework** that supports:

- **Both functional and OOP styles** (user choice)
- **Zero-configuration DX** for OOP users (Spring Boot-like)
- **Minimal, fast runtime** (no magic in request path)
- **Modular monorepo** architecture with clean separation

---

## Motivation

### The Problem

Current state (v3-alpha.1):
- ✅ Excellent functional API
- ✅ Clean middleware system
- ✅ Modular packages
- ❌ Manual controller registration (bad DX at scale)
- ❌ No dependency injection (hard to write testable OOP code)
- ❌ Senior engineers prefer OOP patterns (SOLID, DI)

### The Solution

Add an **optional OOP layer** that:
- Auto-discovers controllers via conventions (`*.controller.ts`)
- Provides constructor-based DI (using tsyringe wrapper)
- Uses decorators for routes and parameters
- **Does not break existing functional API**

---

## Core Principles

### 1. Support Both Styles

```typescript
// ✅ Style 1: Functional (existing, unchanged)
const app = createApp();
app.use(json());
app.get('/users', async (ctx) => {
  ctx.json({ users: [] });
});

// ✅ Style 2: OOP (new, optional)
@Controller('/users')
class UserController {
  constructor(private userService: UserService) {}

  @Get('/')
  async list() {
    return this.userService.findAll();
  }
}
```

### 2. Magic Only at Startup

- File scanning → **once at boot**
- DI resolution → **once at boot**
- Route binding → **once at boot**

Request path stays **plain function calls**.

### 3. Clean Separation of Concerns

```
Runtime Engine (no decorators, no DI)
       ↓
   DI Layer (tsyringe wrapper)
       ↓
Decorator Layer (metadata-only)
       ↓
Controller Loader (connects everything)
```

### 4. Backward Compatible

Existing apps using functional style **continue to work unchanged**.

---

## Package Architecture

### Layer 1: Runtime Engine (No Magic)

```
@nextrush/types        → Shared types
@nextrush/core         → Application, Middleware
@nextrush/router       → Radix tree routing
@nextrush/adapter-node → Node.js HTTP server
```

**Zero changes** to these packages.

---

### Layer 2: DI System (New)

```
@nextrush/di
```

**Purpose:** Lightweight wrapper around tsyringe

**Features:**
- Constructor injection
- Singleton scope (initial)
- Circular dependency detection
- Clear error messages

**API:**
```typescript
// packages/di/src/index.ts
export { container } from './container';
export { inject, injectable, singleton } from './decorators';
export type { Container, Token } from './types';
```

**Implementation:**
```typescript
// Wraps tsyringe for better DX
import { container as tsyContainer } from 'tsyringe';

export const container = {
  register<T>(token: Token<T>, provider: Provider<T>): void,
  resolve<T>(token: Token<T>): T,
  clear(): void
};
```

---

### Layer 3: Decorators (New)

```
@nextrush/decorators
```

**Purpose:** Metadata-only decorators (no magic, no DI logic)

**Class Decorators:**
```typescript
@Controller(path?: string)  → Mark as controller
@Service()                  → Mark as injectable service
@Repository()               → Mark as injectable repository
```

**Route Decorators:**
```typescript
@Get(path?)
@Post(path?)
@Put(path?)
@Delete(path?)
@Patch(path?)
```

**Parameter Decorators:**
```typescript
@Ctx()          → Full context
@Body()         → ctx.body
@Param(key)     → ctx.params[key]
@Query(key)     → ctx.query[key]
@Header(key)    → ctx.headers[key]
```

**Implementation:**
```typescript
// Decorators only write metadata
export function Controller(path = '') {
  return function (target: any) {
    Reflect.defineMetadata('controller:path', path, target);
    Reflect.defineMetadata('controller:class', target, target);
  };
}
```

---

### Layer 4: Controller Loader (New)

```
@nextrush/controllers
```

**Purpose:** The bridge between decorators, DI, and runtime

**Boot Flow:**
1. Scan files matching `**/*.controller.ts`, `**/*.service.ts`
2. Import discovered files
3. Read decorator metadata
4. Register classes in DI container
5. Resolve controllers (auto-injects services)
6. Build route handlers from method metadata
7. Register routes on `@nextrush/router`

**API:**
```typescript
import { controllers } from '@nextrush/controllers';

app.plugin(controllers({
  root: './src'
}));
```

**How it works:**
```typescript
export function controllers(options: ControllerOptions): Plugin {
  return {
    name: 'nextrush-controllers',

    async install(app) {
      // 1. Scan
      const files = await glob('**/*.{controller,service,repository}.ts', {
        cwd: options.root
      });

      // 2. Import
      const modules = await Promise.all(
        files.map(f => import(path.join(options.root, f)))
      );

      // 3. Register in DI
      for (const mod of modules) {
        for (const exported of Object.values(mod)) {
          if (isController(exported)) {
            container.register(exported, { useClass: exported });
          }
        }
      }

      // 4. Resolve and register routes
      const controllerInstances = resolveControllers();
      for (const ctrl of controllerInstances) {
        const routes = getRoutes(ctrl);
        for (const route of routes) {
          app[route.method](route.path, route.handler);
        }
      }
    }
  };
}
```

---

### Layer 5: Meta Package (Updated)

```
nextrush
```

**Exports for Functional Users (unchanged):**
```typescript
export { createApp } from '@nextrush/core';
export { createRouter } from '@nextrush/router';
export * from '@nextrush/types';
```

**New Exports for OOP Users:**
```typescript
export { controllers } from '@nextrush/controllers';
export {
  Controller, Service, Repository,
  Get, Post, Put, Delete, Patch,
  Body, Param, Query, Header, Ctx
} from '@nextrush/decorators';
```

---

## Application Bootstrap Comparison

### Functional Style (Existing)

```typescript
import { createApp } from 'nextrush';
import { json } from '@nextrush/body-parser';

const app = createApp();
app.use(json());

app.get('/users', async (ctx) => {
  ctx.json({ users: [] });
});

app.listen(3000);
```

### OOP Style (New)

```typescript
// src/main.ts
import { createApp, controllers } from 'nextrush';
import { json } from '@nextrush/body-parser';

const app = createApp();
app.use(json());

app.plugin(controllers({ root: './src' }));

app.listen(3000);
```

```typescript
// src/controllers/user.controller.ts
import { Controller, Get, Post, Body, Param } from 'nextrush';
import { UserService } from '../services/user.service';

@Controller('/users')
export class UserController {
  constructor(private userService: UserService) {}

  @Get('/')
  async list() {
    return this.userService.findAll();
  }

  @Get('/:id')
  async get(@Param('id') id: string) {
    return this.userService.findById(id);
  }

  @Post('/')
  async create(@Body() data: CreateUserDto) {
    return this.userService.create(data);
  }
}
```

```typescript
// src/services/user.service.ts
import { Service } from 'nextrush';

@Service()
export class UserService {
  async findAll() {
    return [{ id: 1, name: 'Alice' }];
  }

  async findById(id: string) {
    return { id, name: 'Alice' };
  }

  async create(data: any) {
    return { id: 2, ...data };
  }
}
```

---

## Project Structure

### Functional Style (Feature-Based)

```
src/
├── main.ts
├── middleware/
│   ├── auth.ts
│   └── logging.ts
└── routes/
    ├── users.ts
    └── posts.ts
```

### OOP Style (Feature-Based)

```
src/
├── main.ts
├── features/
│   ├── user/
│   │   ├── user.controller.ts    ← Auto-discovered
│   │   ├── user.service.ts       ← Auto-discovered
│   │   └── user.repository.ts    ← Auto-discovered
│   └── auth/
│       ├── auth.controller.ts    ← Auto-discovered
│       └── auth.service.ts       ← Auto-discovered
```

---

## Request Flow (Both Styles)

```
HTTP Request
    ↓
Adapter (Node.js)
    ↓
Middleware Chain (@nextrush/core)
    ↓
Router Match (@nextrush/router)
    ↓
Handler (function or controller method)
    ↓
Response
```

**Performance:** Same for both styles. Controllers are resolved **once at boot**.

---

## DI Error Messages (Critical for DX)

### Missing Dependency

```
❌ Dependency Resolution Failed

UserController → UserService → UserRepository

UserRepository is not registered.

Possible fixes:
  • Add @Repository() to UserRepository class
  • Ensure file is in scan directory: ./src
  • Check file naming: *.repository.ts
```

### Circular Dependency

```
❌ Circular Dependency Detected

UserService → AuthService → UserService

Break the cycle by:
  • Extracting shared logic to a third service
  • Using event-driven communication
```

### Type Inference Failed

```
❌ Cannot Resolve Constructor Parameter

UserController constructor parameter #1 has no type.

Fix:
  constructor(private userService: UserService) {}
                                   ^^^^^^^^^^^
```

---

## Performance Characteristics

| Phase | Cost |
|-------|------|
| Cold Start | +50-100ms (file scan + DI) |
| First Request | Same as functional |
| Subsequent Requests | Same as functional |
| Memory Overhead | +1-2MB (DI container) |

---

## Non-Goals (v3)

- ❌ Request-scoped DI
- ❌ Guards / Interceptors / Pipes
- ❌ `@Module` system
- ❌ Class-based application bootstrap

---

## Migration Path

### Phase 1: Add DI + Decorators (Alpha 2)
- `@nextrush/di`
- `@nextrush/decorators`
- `@nextrush/controllers`

### Phase 2: Documentation (Alpha 3)
- OOP style guide
- DI best practices
- Migration examples

### Phase 3: Validation Integration (Beta)
- `@Body()` with class-validator
- DTO validation

---

## Guiding Rule

> **Magic is allowed at startup.
> Magic is forbidden in the request path.**

---

## Decision

This architecture is **accepted** for NextRush v3.

**Approved:** 2025-12-25

---

## Appendix: Package Dependencies

```
@nextrush/core         → @nextrush/types
@nextrush/router       → @nextrush/types
@nextrush/adapter-node → @nextrush/core, @nextrush/types
@nextrush/di           → tsyringe, reflect-metadata
@nextrush/decorators   → reflect-metadata, @nextrush/types
@nextrush/controllers  → @nextrush/decorators, @nextrush/di, @nextrush/core
nextrush (meta)        → all above
```
