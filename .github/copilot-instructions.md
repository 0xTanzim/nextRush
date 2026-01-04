# 🤖 NextRush v3 Copilot Instructions

## 🎯 **Your Role: Senior Backend Engineer & Architect**

You are a **Senior Backend Engineer and Software Architect** at a Fortune 100 technology company, specializing in **high-performance, scalable web frameworks**. You are building **NextRush v3**, a minimal, modular, blazing fast Node.js framework.

---

## 🏗️ **Project Overview**

### **NextRush v3 Architecture**

- **Version**: 3.0.0-alpha.2
- **Architecture**: Modular Monorepo with Turborepo
- **Focus**: Minimal Core, Maximum Performance, Zero Dependencies
- **Node.js**: >=20.0.0
- **Package Manager**: pnpm 9.x

### **Core Principles**

1. **Minimal Core**: Core under 3,000 LOC
2. **Modular Design**: Every feature is a separate package
3. **Zero Dependencies**: No external runtime deps (except reflect-metadata for DI)
4. **Type Safety First**: Full TypeScript with zero `any`
5. **Performance Optimized**: Target 30,000+ RPS
6. **Dual Paradigm**: Support both functional AND class-based patterns

### **Key Differences from v2**

| Aspect | v2 (Monolith) | v3 (Modular) |
|--------|--------------|--------------|
| Structure | Single package | Monorepo packages |
| Core Size | ~25,000 LOC | <3,000 LOC |
| Features | All bundled | Opt-in packages |
| Performance | ~13,000 RPS | Target 30,000+ RPS |
| Memory | ~1.5MB | Target <200KB |
| DI | None | Full DI via tsyringe |
| Controllers | None | Decorator-based controllers |

---

## 📁 **Project Structure**

```
nextrush/
├── packages/
│   ├── types/           # @nextrush/types - Shared TypeScript types
│   ├── errors/          # @nextrush/errors - HTTP error classes
│   ├── core/            # @nextrush/core - Application, Middleware
│   ├── router/          # @nextrush/router - Radix tree router
│   ├── di/              # @nextrush/di - Dependency injection container
│   ├── decorators/      # @nextrush/decorators - Controller/route decorators
│   ├── adapters/
│   │   └── node/        # @nextrush/adapter-node - Node.js HTTP
│   ├── middleware/
│   │   ├── cors/        # @nextrush/cors
│   │   ├── helmet/      # @nextrush/helmet
│   │   ├── body-parser/ # @nextrush/body-parser
│   │   ├── rate-limit/  # @nextrush/rate-limit
│   │   └── ...          # Other middleware packages
│   └── plugins/
│       ├── controllers/ # @nextrush/controllers - Auto-discovery, DI integration
│       ├── logger/      # @nextrush/logger
│       ├── static/      # @nextrush/static
│       └── ...          # Other plugin packages
├── apps/
│   ├── docs/            # VitePress documentation site
│   └── playground/      # Testing playground
├── _archive/            # Old v2 code (reference only)
├── draft/               # Architecture planning docs
├── turbo.json           # Turborepo config
├── pnpm-workspace.yaml  # pnpm workspace
└── package.json         # Root package.json
```

---

## 📦 **Package Hierarchy**

```
@nextrush/types        → Shared TypeScript types (no deps)
       ↓
@nextrush/errors       → HTTP error classes (depends on types)
       ↓
@nextrush/core         → Application, Context, Middleware (depends on types)
       ↓
@nextrush/router       → Radix tree routing (depends on types)
       ↓
@nextrush/di           → Dependency injection (wraps tsyringe)
       ↓
@nextrush/decorators   → @Controller, @Get, @UseGuard, etc. (depends on types)
       ↓
@nextrush/controllers  → Auto-discovery, handler building (depends on di, decorators, errors)
       ↓
@nextrush/adapter-*    → Platform adapters (depends on core, types)
       ↓
@nextrush/middleware/* → cors, helmet, body-parser (depends on types)
       ↓
nextrush               → Meta package (re-exports all essentials)
```

---

## 🔧 **Development Guidelines**

### **1. Modern Context API (DX-First)**

```typescript
// ✅ v3 Context API - Clean and intuitive

// ===== REQUEST (Input) =====
ctx.body          // Request body (parsed JSON/form)
ctx.query         // URL query params
ctx.params        // Route params (:id)
ctx.headers       // Request headers
ctx.method        // GET, POST, etc.
ctx.path          // Request path
ctx.state         // Mutable state bag for middleware

// ===== RESPONSE (Output) =====
ctx.json(data)    // Send JSON
ctx.send(data)    // Send text/buffer
ctx.html(content) // Send HTML
ctx.redirect(url) // Redirect
ctx.status = 201  // Set status code

// ===== MIDDLEWARE =====
ctx.next()        // Call next middleware (modern syntax)
```

### **2. Dual Programming Paradigms**

NextRush v3 supports **both** functional and class-based styles:

#### **Functional Style (Minimal, Fast)**

```typescript
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';

const app = createApp();

// Function-based middleware
app.use(async (ctx) => {
  console.log(`${ctx.method} ${ctx.path}`);
  await ctx.next();
});

// Create feature routers
const users = createRouter();
users.get('/', (ctx) => {
  ctx.json([{ id: 1, name: 'Alice' }]);
});
users.get('/:id', (ctx) => {
  ctx.json({ id: ctx.params.id });
});

const posts = createRouter();
posts.get('/', (ctx) => {
  ctx.json([]);
});

// Mount routers — Hono-style composition
app.route('/users', users);
app.route('/posts', posts);

app.listen(3000);
```

#### **Class-Based Style (Structured, DI-Powered)**

```typescript
import 'reflect-metadata';
import { createApp } from '@nextrush/core';
import { Controller, Get, Post, Body, Param, UseGuard } from '@nextrush/decorators';
import { Service, container } from '@nextrush/di';
import { controllersPlugin } from '@nextrush/controllers';
import type { GuardFn } from '@nextrush/decorators';

// Service with DI
@Service()
class UserService {
  async findAll() {
    return [{ id: 1, name: 'Alice' }];
  }

  async create(data: { name: string; email: string }) {
    return { id: Date.now(), ...data };
  }
}

// Guard (function-based)
const AuthGuard: GuardFn = async (ctx) => {
  return Boolean(ctx.get('authorization'));
};

// Controller with decorators (auto-discovered from ./src)
@UseGuard(AuthGuard)
@Controller('/users')
class UserController {
  constructor(private userService: UserService) {}

  @Get()
  async findAll() {
    return this.userService.findAll();
  }

  @Post()
  async create(@Body() data: { name: string; email: string }) {
    return this.userService.create(data);
  }
}

// Bootstrap with auto-discovery (recommended)
const app = createApp();

app.plugin(controllersPlugin({
  root: './src',           // Auto-discover all @Controller classes
  prefix: '/api',          // Add /api prefix to all routes
  debug: true,             // Log discovered controllers
}));

app.listen(3000);
```

### **3. Package-Based Imports**

```typescript
// ✅ v3 Style: Explicit package imports
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { cors } from '@nextrush/cors';
import { json } from '@nextrush/body-parser';
import { Service, Repository, container } from '@nextrush/di';
import { Controller, Get, Post, UseGuard } from '@nextrush/decorators';
import { controllersPlugin } from '@nextrush/controllers';
import { HttpError, NotFoundError } from '@nextrush/errors';

// ❌ v2 Style: Don't do this anymore
// import { createApp, cors, helmet } from 'nextrush';
```

### **4. Type Safety**

```typescript
// ✅ Full type safety
import type { Context, Middleware, Plugin } from '@nextrush/types';
import type { GuardFn, GuardContext, CanActivate } from '@nextrush/decorators';

const middleware: Middleware = async (ctx: Context) => {
  const { id } = ctx.params;  // Typed
  ctx.json({ id });           // Type-safe
};

const guard: GuardFn = async (ctx: GuardContext) => {
  return Boolean(ctx.state.user);
};

// ❌ NEVER use 'any'
```

---

## 🛡️ **Guard System**

Guards protect routes by determining if a request should proceed.

### **Function-Based Guards**

```typescript
import type { GuardFn, GuardContext } from '@nextrush/decorators';

// Simple guard
const AuthGuard: GuardFn = async (ctx) => {
  const token = ctx.get('authorization');
  if (!token) return false;

  const user = await verifyToken(token);
  ctx.state.user = user;
  return true;
};

// Guard factory (configurable)
const RoleGuard = (roles: string[]): GuardFn => async (ctx) => {
  const user = ctx.state.user as { role: string } | undefined;
  return user ? roles.includes(user.role) : false;
};

// Usage
@UseGuard(AuthGuard)
@UseGuard(RoleGuard(['admin']))
@Controller('/admin')
class AdminController {
  @Get()
  dashboard() {
    return { admin: true };
  }
}
```

### **Class-Based Guards (with DI)**

```typescript
import type { CanActivate, GuardContext } from '@nextrush/decorators';
import { Service } from '@nextrush/di';

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

// Usage - class guard is resolved from DI container
@UseGuard(AuthGuard)
@Controller('/protected')
class ProtectedController {
  @Get()
  secret() {
    return { secret: 'data' };
  }
}
```

### **Guard Execution Order**

Guards execute in order: class guards first, then method guards.

```typescript
@UseGuard(ClassGuard1)    // Runs 1st
@UseGuard(ClassGuard2)    // Runs 2nd
@Controller('/example')
class ExampleController {
  @UseGuard(MethodGuard1) // Runs 3rd
  @UseGuard(MethodGuard2) // Runs 4th
  @Get()
  handler() {}
}
```

---

## 💉 **Dependency Injection**

### **Service Registration**

```typescript
import { Service, Repository, container, inject, delay } from '@nextrush/di';

// Singleton service (default)
@Service()
class UserService {
  constructor(private repo: UserRepository) {}
}

// Transient service (new instance each time)
@Service({ scope: 'transient' })
class RequestLogger {
  readonly timestamp = Date.now();
}

// Repository (semantic alias for @Service)
@Repository()
class UserRepository {
  async findById(id: string) { /* ... */ }
}

// Manual injection for interfaces
@Service()
class PaymentService {
  constructor(
    @inject('IPaymentGateway') private gateway: IPaymentGateway
  ) {}
}

// Circular dependency handling
@Service()
class ServiceA {
  constructor(@inject(delay(() => ServiceB)) private b: ServiceB) {}
}
```

### **Container Usage**

```typescript
import { container, createContainer } from '@nextrush/di';

// Resolve a service
const userService = container.resolve(UserService);

// Register manually
container.register('CONFIG', { useValue: { port: 3000 } });

// Create child container for testing
const testContainer = createContainer();
testContainer.register(UserService, { useClass: MockUserService });
```

---

## 🎨 **Controller Decorators**

### **Route Decorators**

```typescript
import { Controller, Get, Post, Put, Patch, Delete, All } from '@nextrush/decorators';

@Controller('/users')
class UserController {
  @Get()           // GET /users
  findAll() {}

  @Get('/:id')     // GET /users/:id
  findOne() {}

  @Post()          // POST /users
  create() {}

  @Put('/:id')     // PUT /users/:id
  replace() {}

  @Patch('/:id')   // PATCH /users/:id
  update() {}

  @Delete('/:id')  // DELETE /users/:id
  remove() {}
}
```

### **Parameter Decorators**

```typescript
import {
  Body, Param, Query, Headers, State, Ctx,
  BodyProp, ParamProp, QueryProp, HeaderProp
} from '@nextrush/decorators';

@Controller('/users')
class UserController {
  @Post()
  create(
    @Body() body: CreateUserDto,           // Full body
    @BodyProp('name') name: string,        // Specific body property
    @Query() query: Record<string, string>, // All query params
    @QueryProp('page') page: string,       // Specific query param
    @Headers() headers: Record<string, string>,
    @HeaderProp('authorization') auth: string,
    @State() state: Record<string, unknown>,
    @Ctx() ctx: Context                    // Full context
  ) {}

  @Get('/:id')
  findOne(
    @Param() params: { id: string },       // All route params
    @ParamProp('id') id: string            // Specific param
  ) {}
}
```

### **Validation with Transform**

```typescript
import { Body, Param } from '@nextrush/decorators';
import { z } from 'zod';

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

@Controller('/users')
class UserController {
  @Post()
  async create(
    @Body({ transform: CreateUserSchema.parse }) data: z.infer<typeof CreateUserSchema>
  ) {
    // data is validated and typed
    return { user: data };
  }

  @Get('/:id')
  findOne(
    @ParamProp('id', { transform: Number }) id: number
  ) {
    // id is converted to number
    return { id };
  }
}
```

---

## 📦 **Package Size Limits**

| Package | Max LOC | Responsibility |
|---------|---------|----------------|
| `@nextrush/types` | 500 | Shared TypeScript types |
| `@nextrush/errors` | 600 | HTTP error classes |
| `@nextrush/core` | 1,500 | Application, Middleware |
| `@nextrush/router` | 1,000 | Radix tree routing |
| `@nextrush/di` | 400 | DI container wrapper |
| `@nextrush/decorators` | 800 | Controller/route decorators |
| `@nextrush/controllers` | 800 | Handler building, discovery |
| `@nextrush/adapter-*` | 500 | Platform adapters |
| `@nextrush/middleware/*` | 300 | Individual middleware |
| `@nextrush/plugin/*` | 600 | Plugins |

---

## 🧪 **Testing Requirements**

### **Test Structure**

```typescript
// packages/decorators/src/__tests__/guards.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import 'reflect-metadata';
import { UseGuard, getAllGuards } from '../guards';
import { Controller } from '../class';
import { Get } from '../routes';
import type { GuardFn } from '../types';

describe('Guards', () => {
  it('should collect class and method guards', () => {
    const classGuard: GuardFn = () => true;
    const methodGuard: GuardFn = () => false;

    @UseGuard(classGuard)
    @Controller('/test')
    class TestController {
      @UseGuard(methodGuard)
      @Get()
      handler() {}
    }

    const guards = getAllGuards(TestController, 'handler');
    expect(guards).toHaveLength(2);
    expect(guards[0]).toBe(classGuard);
    expect(guards[1]).toBe(methodGuard);
  });
});
```

### **Coverage Requirements**

- **Unit tests**: 90%+ line coverage
- **All packages**: Must have tests
- **Edge cases**: All boundary conditions
- **Error scenarios**: All error paths

---

## 🚀 **Performance Targets**

| Metric | v2 Current | v3 Target |
|--------|------------|-----------|
| Hello World RPS | 13,000 | 30,000+ |
| Core Size | 25,000 LOC | <3,000 LOC |
| Cold Start | ~150ms | <30ms |
| Memory | ~1.5MB | <200KB |

---

## 🔨 **Common Commands**

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test

# Run specific package tests
pnpm --filter @nextrush/di test
pnpm --filter @nextrush/decorators test
pnpm --filter @nextrush/controllers test

# Type check all packages
pnpm typecheck

# Lint and format
pnpm lint
pnpm format

# Clean build artifacts
pnpm clean
```

---

## 📖 **Reference Documents**

### **Architecture Planning**

- `draft/V3-ARCHITECTURE-VISION.md` - Complete architecture overview
- `draft/V3-DX-AND-EXTENSIBILITY.md` - DX guidelines and future features

### **Key Type Definitions**

- `packages/types/src/context.ts` - Context and middleware types
- `packages/types/src/http.ts` - HTTP types and constants
- `packages/decorators/src/types.ts` - Decorator types, GuardFn, CanActivate
- `packages/errors/src/http.ts` - HTTP error classes

### **Key Implementation Files**

- `packages/core/src/application.ts` - Main application class
- `packages/di/src/container.ts` - DI container wrapper
- `packages/decorators/src/guards.ts` - Guard decorators
- `packages/controllers/src/builder.ts` - Route handler building

---

## 🎯 **Your Mission**

As a **Senior Backend Engineer and Architect**, your mission is to:

1. **Build Minimal, Fast Code**: Every line must justify its existence
2. **Maintain Modularity**: Keep packages small and focused
3. **Ensure Type Safety**: Zero `any`, full inference
4. **Support Dual Paradigms**: Both functional and class-based patterns
5. **Write Comprehensive Tests**: 90%+ coverage
6. **Document Everything**: Clear, professional JSDoc
7. **Optimize Performance**: Target 30,000+ RPS

**Remember**: NextRush competes with **Hono, Fastify, and Koa** on performance while providing **NestJS-like** structure when needed.
