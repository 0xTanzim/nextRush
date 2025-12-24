# 🎯 NextRush v3 DX Guidelines & Future Extensibility

> **Document Type**: Developer Experience & Extensibility Specification
> **Date**: December 24, 2025
> **Status**: Planning Phase
> **Focus**: API Design, DX, Decorator Support, Future Patterns

---

## Table of Contents

1. [DX Philosophy](#1-dx-philosophy)
2. [Context API Design](#2-context-api-design)
3. [Modern Middleware Syntax](#3-modern-middleware-syntax)
4. [Future: Decorator Support](#4-future-decorator-support)
5. [Future: Controller Pattern](#5-future-controller-pattern)
6. [Extensibility Architecture](#6-extensibility-architecture)
7. [API Comparison](#7-api-comparison)

---

## 1. DX Philosophy

### 1.1 Core Principle

> **"Code should read like English, not like documentation."**

Every API should be:
- **Intuitive** - What you expect is what happens
- **Discoverable** - IDE autocomplete guides you
- **Consistent** - Same patterns everywhere
- **Minimal** - Do more with less typing

### 1.2 Design Goals

| Goal | Description |
|------|-------------|
| **Zero Learning Curve** | If you know Express/Koa, you know NextRush |
| **Type-First** | Full autocomplete, zero guessing |
| **Progressive Complexity** | Simple by default, powerful when needed |
| **Error Prevention** | Types prevent mistakes before runtime |

---

## 2. Context API Design

### 2.1 Simplified Naming Convention

The context (`ctx`) should have **clear, action-oriented** method names:

```typescript
// ✅ NextRush v3 Context API

// ============ REQUEST (Input) ============
ctx.body          // Request body (parsed JSON/form/etc.)
ctx.query         // URL query parameters
ctx.params        // Route parameters (:id, etc.)
ctx.headers       // Request headers
ctx.method        // HTTP method (GET, POST, etc.)
ctx.path          // Request path
ctx.url           // Full URL
ctx.ip            // Client IP address

// ============ RESPONSE (Output) ============
ctx.json()        // Send JSON response
ctx.send()        // Send text/buffer/stream response
ctx.html()        // Send HTML response
ctx.redirect()    // Redirect to URL
ctx.status        // Set/get status code

// ============ MIDDLEWARE ============
ctx.next()        // Call next middleware (modern syntax)

// ============ STATE ============
ctx.state         // Request-scoped state object
ctx.set()         // Set response header
ctx.get()         // Get request header
```

### 2.2 API Examples

#### Sending Responses

```typescript
// JSON Response
app.get('/users', async (ctx) => {
  const users = await db.users.findAll();
  ctx.json({ users });  // Automatically sets Content-Type: application/json
});

// Text Response
app.get('/hello', async (ctx) => {
  ctx.send('Hello World');  // Content-Type: text/plain
});

// HTML Response
app.get('/page', async (ctx) => {
  ctx.html('<h1>Hello</h1>');  // Content-Type: text/html
});

// With Status Code
app.post('/users', async (ctx) => {
  const user = await createUser(ctx.body);
  ctx.status = 201;
  ctx.json({ user });
});

// Redirect
app.get('/old', async (ctx) => {
  ctx.redirect('/new');  // 302 by default
  ctx.redirect('/new', 301);  // Permanent redirect
});
```

#### Reading Request Data

```typescript
app.post('/users/:id', async (ctx) => {
  // Route params
  const { id } = ctx.params;  // { id: '123' }

  // Query string: /users/123?include=posts
  const { include } = ctx.query;  // { include: 'posts' }

  // Request body (auto-parsed)
  const { name, email } = ctx.body;  // Parsed JSON/form

  // Headers
  const auth = ctx.get('Authorization');

  // Full example
  ctx.json({
    id,
    name,
    email,
    include,
  });
});
```

### 2.3 Modern Middleware Syntax

```typescript
// ✅ v3 Modern Syntax - ctx.next()
app.use(async (ctx) => {
  console.log('Before');
  await ctx.next();  // Modern, cleaner
  console.log('After');
});

// Also supported: Traditional Koa-style
app.use(async (ctx, next) => {
  console.log('Before');
  await next();  // Still works
  console.log('After');
});
```

### 2.4 Context Type Definition

```typescript
// @nextrush/types/context.ts

export interface Context {
  // ===== REQUEST (Read-only) =====
  readonly method: HttpMethod;
  readonly path: string;
  readonly url: string;
  readonly query: Record<string, string>;
  readonly headers: IncomingHeaders;
  readonly ip: string;

  // ===== REQUEST BODY =====
  body: unknown;  // Populated by body parser

  // ===== ROUTE PARAMS =====
  params: Record<string, string>;

  // ===== RESPONSE =====
  status: number;

  // Response methods
  json(data: unknown): void;
  send(data: string | Buffer | Readable): void;
  html(content: string): void;
  redirect(url: string, status?: number): void;

  // Header helpers
  set(field: string, value: string): void;
  get(field: string): string | undefined;

  // ===== MIDDLEWARE =====
  next(): Promise<void>;

  // ===== STATE =====
  state: Record<string, unknown>;

  // ===== RAW ACCESS =====
  readonly raw: {
    req: IncomingMessage;
    res: ServerResponse;
  };
}
```

---

## 3. Modern Middleware Syntax

### 3.1 Why `ctx.next()` is Better

```typescript
// ❌ Traditional - next is a separate parameter
app.use(async (ctx, next) => {
  await next();
});

// ✅ Modern - next is on context
app.use(async (ctx) => {
  await ctx.next();
});
```

**Benefits of `ctx.next()`**:
1. **One parameter** instead of two - simpler signature
2. **Discoverable** - IDE shows `next()` in autocomplete
3. **Consistent** - everything is on `ctx`
4. **Modern** - aligns with newer frameworks

### 3.2 Implementation

```typescript
// Internal implementation
function createContext(req, res, middlewareChain): Context {
  let currentIndex = 0;

  const ctx: Context = {
    // ... other properties

    async next() {
      currentIndex++;
      if (currentIndex < middlewareChain.length) {
        await middlewareChain[currentIndex](ctx);
      }
    },
  };

  return ctx;
}
```

### 3.3 Backward Compatibility

```typescript
// Both syntaxes work
type Middleware =
  | ((ctx: Context) => Promise<void>)  // Modern
  | ((ctx: Context, next: Next) => Promise<void>);  // Traditional

// Router accepts both
app.use(async (ctx) => {
  await ctx.next();  // Works
});

app.use(async (ctx, next) => {
  await next();  // Also works
});
```

---

## 4. Future: Decorator Support

### 4.1 The Vision

NextRush v3 architecture is designed to support **decorators as a future plugin**.

```typescript
// @nextrush/decorators - Future package (v3.1+)

import { Controller, Get, Post, Body, Param } from '@nextrush/decorators';

@Controller('/users')
class UserController {

  @Get('/')
  async getAll(ctx: Context) {
    const users = await userService.findAll();
    ctx.json({ users });
  }

  @Get('/:id')
  async getOne(@Param('id') id: string, ctx: Context) {
    const user = await userService.findById(id);
    ctx.json({ user });
  }

  @Post('/')
  async create(@Body() body: CreateUserDto, ctx: Context) {
    const user = await userService.create(body);
    ctx.status = 201;
    ctx.json({ user });
  }
}
```

### 4.2 How Decorators Will Work

#### Architecture Layer

```
┌─────────────────────────────────────────┐
│         @nextrush/decorators            │  ← v3.1+ plugin
│  (@Controller, @Get, @Post, @Service)   │
├─────────────────────────────────────────┤
│           @nextrush/core                │  ← v3.0 core
│    (Application, Context, Middleware)   │
└─────────────────────────────────────────┘
```

#### Decorator Implementation Strategy

```typescript
// Decorators compile to router registrations

// This decorator code:
@Controller('/users')
class UserController {
  @Get('/:id')
  getUser(@Param('id') id: string) { }
}

// Compiles to:
const router = createRouter();
const controller = new UserController();

router.get('/users/:id', async (ctx) => {
  const id = ctx.params.id;
  await controller.getUser(id, ctx);
});
```

### 4.3 Decorator Types (Planned)

```typescript
// ===== ROUTE DECORATORS =====
@Controller(prefix: string)     // Class-level route prefix
@Get(path: string)              // GET route
@Post(path: string)             // POST route
@Put(path: string)              // PUT route
@Delete(path: string)           // DELETE route
@Patch(path: string)            // PATCH route

// ===== PARAMETER DECORATORS =====
@Param(name: string)            // Route parameter
@Query(name: string)            // Query parameter
@Body()                         // Request body
@Headers(name?: string)         // Request headers
@Ctx()                          // Full context

// ===== MIDDLEWARE DECORATORS =====
@Use(middleware)                // Apply middleware
@Guard(guard)                   // Authorization guard
@Validate(schema)               // Validation

// ===== SERVICE DECORATORS =====
@Service()                      // Injectable service
@Inject(token)                  // Dependency injection
```

### 4.4 Why Not Now?

Decorators require:
1. **TypeScript 5.0+ decorator support** (Stage 3 decorators)
2. **Metadata reflection** (emitDecoratorMetadata)
3. **Build step** for decorator transformation

For v3.0, we focus on the **functional API** first. Decorators come as opt-in plugin in v3.1+.

---

## 5. Future: Controller Pattern

### 5.1 NestJS-Style Controllers (v3.1+)

```typescript
// @nextrush/controllers package (future)

import {
  Controller,
  Get,
  Post,
  Injectable,
  Inject
} from '@nextrush/controllers';

// ===== SERVICE =====
@Injectable()
class UserService {
  async findAll() {
    return db.users.findAll();
  }

  async create(data: CreateUserDto) {
    return db.users.create(data);
  }
}

// ===== CONTROLLER =====
@Controller('/api/users')
class UserController {
  constructor(
    @Inject(UserService) private userService: UserService
  ) {}

  @Get('/')
  async list(ctx: Context) {
    const users = await this.userService.findAll();
    ctx.json({ users });
  }

  @Post('/')
  @Validate(CreateUserSchema)
  async create(ctx: Context) {
    const user = await this.userService.create(ctx.body);
    ctx.status = 201;
    ctx.json({ user });
  }
}

// ===== REGISTRATION =====
import { createApp, registerControllers } from '@nextrush/controllers';

const app = createApp();
registerControllers(app, [UserController]);
app.listen(3000);
```

### 5.2 Module System (v3.2+)

```typescript
// Future: NestJS-style modules

import { Module, createModule } from '@nextrush/modules';

@Module({
  controllers: [UserController, PostController],
  providers: [UserService, PostService],
  imports: [DatabaseModule, AuthModule],
  exports: [UserService],
})
class UserModule {}

// App bootstrap
const app = await createModuleApp(AppModule);
app.listen(3000);
```

---

## 6. Extensibility Architecture

### 6.1 Plugin Extension Points

The v3 architecture has these extension points for future features:

```typescript
// Extension Points in @nextrush/core

export interface Plugin {
  name: string;
  version?: string;

  // Lifecycle hooks
  install(app: Application): void | Promise<void>;
  destroy?(): void | Promise<void>;

  // Extension points (optional)
  extendContext?(ctx: Context): void;
  extendApplication?(app: Application): void;
  onRequest?(ctx: Context): void | Promise<void>;
  onResponse?(ctx: Context): void | Promise<void>;
  onError?(error: Error, ctx: Context): void | Promise<void>;
}
```

### 6.2 How Future Features Hook In

```
┌─────────────────────────────────────────────────────────────┐
│                    FUTURE PACKAGES                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  @nextrush/decorators (v3.1)                                │
│  └── Uses: Plugin.extendContext, Plugin.install             │
│                                                              │
│  @nextrush/controllers (v3.1)                               │
│  └── Uses: Plugin.extendApplication, Router                 │
│                                                              │
│  @nextrush/modules (v3.2)                                   │
│  └── Uses: Plugin.install, DI Container                     │
│                                                              │
│  @nextrush/graphql (v3.2)                                   │
│  └── Uses: Plugin.install, Router                           │
│                                                              │
│  @nextrush/trpc (v3.2)                                      │
│  └── Uses: Plugin.extendContext, Router                     │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                    CORE LAYER (v3.0)                         │
│  @nextrush/core - Application, Context, Middleware, Plugin  │
│  @nextrush/router - Routing                                 │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 Adding New Features Without Breaking Core

```typescript
// Example: How @nextrush/decorators would work

// decorators/src/index.ts
import type { Plugin, Application, Context } from '@nextrush/core';
import { createRouter } from '@nextrush/router';

export class DecoratorPlugin implements Plugin {
  name = 'decorators';

  private controllers: Map<Function, ControllerMeta> = new Map();

  install(app: Application) {
    const router = createRouter();

    // Convert decorated controllers to routes
    for (const [Controller, meta] of this.controllers) {
      const instance = new Controller();

      for (const route of meta.routes) {
        router[route.method](route.path, async (ctx) => {
          // Extract parameters from decorators
          const args = this.extractArgs(ctx, route.params);
          await instance[route.handler](...args, ctx);
        });
      }
    }

    app.use(router.routes());
  }

  // Register controller (called by @Controller decorator)
  registerController(target: Function, meta: ControllerMeta) {
    this.controllers.set(target, meta);
  }
}

// Usage
import { createApp } from '@nextrush/core';
import { DecoratorPlugin, Controller, Get } from '@nextrush/decorators';

const decorators = new DecoratorPlugin();

@Controller('/users')
class UserController {
  @Get('/')
  list(ctx) { ctx.json([]); }
}

const app = createApp();
app.plugin(decorators);
app.listen(3000);
```

---

## 7. API Comparison

### 7.1 Express vs Koa vs NextRush v3

```typescript
// ===== EXPRESS =====
app.get('/users/:id', (req, res, next) => {
  const { id } = req.params;
  const { name } = req.body;
  res.status(201).json({ id, name });
});

// ===== KOA =====
router.get('/users/:id', async (ctx, next) => {
  const { id } = ctx.params;
  const { name } = ctx.request.body;
  ctx.status = 201;
  ctx.body = { id, name };
});

// ===== NEXTRUSH v3 =====
router.get('/users/:id', async (ctx) => {
  const { id } = ctx.params;
  const { name } = ctx.body;
  ctx.status = 201;
  ctx.json({ id, name });
});
```

### 7.2 Middleware Comparison

```typescript
// ===== EXPRESS =====
app.use((req, res, next) => {
  console.log('Before');
  next();
  // Can't do "after" easily
});

// ===== KOA =====
app.use(async (ctx, next) => {
  console.log('Before');
  await next();
  console.log('After');
});

// ===== NEXTRUSH v3 =====
app.use(async (ctx) => {
  console.log('Before');
  await ctx.next();  // Cleaner!
  console.log('After');
});
```

### 7.3 Full Application Comparison

```typescript
// ===== NEXTRUSH v3 - COMPLETE EXAMPLE =====

import { createApp, listen } from 'nextrush';
import { createRouter } from '@nextrush/router';
import { cors } from '@nextrush/cors';
import { json } from '@nextrush/body-parser';

const app = createApp();
const router = createRouter();

// Middleware
app.use(cors());
app.use(json());

// Logging middleware (modern syntax)
app.use(async (ctx) => {
  const start = Date.now();
  await ctx.next();
  console.log(`${ctx.method} ${ctx.path} - ${Date.now() - start}ms`);
});

// Routes
router.get('/health', (ctx) => {
  ctx.json({ status: 'ok' });
});

router.get('/users', async (ctx) => {
  const users = await db.users.findAll();
  ctx.json({ users });
});

router.get('/users/:id', async (ctx) => {
  const user = await db.users.findById(ctx.params.id);
  if (!user) {
    ctx.status = 404;
    ctx.json({ error: 'User not found' });
    return;
  }
  ctx.json({ user });
});

router.post('/users', async (ctx) => {
  const user = await db.users.create(ctx.body);
  ctx.status = 201;
  ctx.json({ user });
});

// Mount router
app.use(router.routes());

// Start server
listen(app, { port: 3000 }, () => {
  console.log('Server running on http://localhost:3000');
});
```

---

## 8. Roadmap: Feature Timeline

```
v3.0.0 (Initial Release)
├── Core: Application, Context, Middleware
├── Router: Functional router
├── Middleware: cors, helmet, body-parser, etc.
├── DX: ctx.json(), ctx.send(), ctx.next()
└── Plugins: logger, static, websocket

v3.1.0 (Decorator Support)
├── @nextrush/decorators
├── @Controller, @Get, @Post, etc.
├── @Param, @Body, @Query decorators
└── @Service, @Inject (basic DI)

v3.2.0 (Module System)
├── @nextrush/modules
├── NestJS-style module system
├── Advanced DI container
└── Guards, Pipes, Interceptors

v3.3.0 (Advanced Integrations)
├── @nextrush/graphql
├── @nextrush/trpc
├── @nextrush/openapi
└── Auto-generated docs
```

---

## 9. Summary: The v3 Promise

### For Users Who Want Simple

```typescript
import { createApp } from 'nextrush';

const app = createApp();

app.get('/hello', (ctx) => {
  ctx.json({ message: 'Hello World' });
});

app.listen(3000);
```

### For Users Who Want NestJS-Style (v3.1+)

```typescript
import { Controller, Get, createApp } from '@nextrush/decorators';

@Controller('/api')
class AppController {
  @Get('/hello')
  hello(ctx) {
    ctx.json({ message: 'Hello World' });
  }
}

const app = createApp();
registerControllers(app, [AppController]);
app.listen(3000);
```

### For Users Who Want Maximum Control

```typescript
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { listen } from '@nextrush/adapter-node';
import { cors } from '@nextrush/cors';

const app = createApp();
const router = createRouter();

router.get('/hello', (ctx) => ctx.json({ message: 'Hello' }));

app.use(cors());
app.use(router.routes());

listen(app, { port: 3000 });
```

---

**All approaches use the same core. Choose your style.** 🚀

---

*End of DX & Extensibility Document*
