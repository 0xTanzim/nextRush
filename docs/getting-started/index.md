# Introduction

> NextRush is a minimal, modular, blazing-fast backend framework for Node.js.

## The Problem

Building backend applications in Node.js today means choosing between two frustrating options:

**Option 1: Minimal frameworks (Express, Koa)**
- Fast to start, but you're on your own for structure
- No dependency injection, no standard patterns
- Large codebases become unmaintainable
- Teams reinvent the wheel constantly

**Option 2: Full frameworks (NestJS, AdonisJS)**
- Great structure and patterns
- But they're heavy — hundreds of dependencies
- Slow startup times
- Forced into their way of doing things

Neither option is satisfying.

## How NextRush Approaches This

NextRush takes a **modular-first** approach:

1. **Start minimal** — The core is under 3,000 lines of code
2. **Add what you need** — Each feature is a separate package
3. **Choose your style** — Functions OR classes, both work equally well
4. **No hidden magic** — Every behavior is documented and overridable

This means:
- Small APIs stay small (no framework overhead)
- Large applications get structure (controllers, DI, guards)
- You understand everything that happens
- You pay only for what you use

## Mental Model

Think of NextRush as **building blocks**:

```
┌─────────────────────────────────────────────────────────┐
│                    Your Application                      │
├─────────────────────────────────────────────────────────┤
│  @nextrush/controllers  (if you want class-based)       │
│  ├── @nextrush/decorators                               │
│  └── @nextrush/di                                       │
├─────────────────────────────────────────────────────────┤
│  @nextrush/middleware/* (CORS, Helmet, Body Parser...)  │
├─────────────────────────────────────────────────────────┤
│  @nextrush/router                                       │
├─────────────────────────────────────────────────────────┤
│  @nextrush/core (Application, Context, Middleware)      │
├─────────────────────────────────────────────────────────┤
│  @nextrush/adapter-node (or bun, deno, edge)           │
└─────────────────────────────────────────────────────────┘
```

Each layer is optional. Use what you need.

## Two Programming Styles

### Functional Style

Best for:
- Small to medium APIs
- Microservices
- Developers who prefer functions
- Quick prototypes

```typescript
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';

const app = createApp();
const router = createRouter();

router.get('/users', async (ctx) => {
  const users = await db.users.findMany();
  ctx.json(users);
});

router.post('/users', async (ctx) => {
  const user = await db.users.create(ctx.body);
  ctx.status = 201;
  ctx.json(user);
});

app.use(router.routes());
app.listen(3000);
```

### Class-Based Style

Best for:
- Large applications
- Teams with shared patterns
- Developers who prefer structure
- Applications needing dependency injection

```typescript
import { createApp } from '@nextrush/core';
import {
  Controller, Get, Post, Body, Service,
  controllersPlugin
} from '@nextrush/controllers';

@Service()
class UserService {
  async findAll() {
    return db.users.findMany();
  }

  async create(data: CreateUserDto) {
    return db.users.create(data);
  }
}

@Controller('/users')
class UserController {
  constructor(private userService: UserService) {}

  @Get()
  findAll() {
    return this.userService.findAll();
  }

  @Post()
  create(@Body() data: CreateUserDto) {
    return this.userService.create(data);
  }
}

const app = createApp();
app.plugin(controllersPlugin({
  controllers: [UserController],
}));
app.listen(3000);
```

**Key insight**: Notice that `@nextrush/controllers` gives you EVERYTHING — `Controller`, `Get`, `Service`, `Body`, and the plugin. One package, one import.

## What NextRush Is NOT

- **Not an opinionated monolith** — You choose the structure
- **Not a copy of NestJS** — Simpler, faster, more flexible
- **Not just another Express clone** — Modern async/await design from the ground up
- **Not locked to Node.js** — Runs on Bun, Deno, and Edge runtimes

## Performance

NextRush was designed for performance from day one:

| Metric | Target | Achieved |
|--------|--------|----------|
| Requests/sec | 30,000+ | ✅ |
| Cold start | < 30ms | ✅ |
| Memory footprint | < 200KB | ✅ |
| Core size | < 3,000 LOC | ✅ |

How? By doing less:
- No reflection at runtime (just at startup)
- Radix tree routing (O(k) lookup, where k = path length)
- No middleware overhead for unused features
- Efficient async middleware composition

## Next Steps

Ready to build something?

1. **[Quick Start](/getting-started/quick-start)** — Your first NextRush app in 5 minutes
2. **[Installation Guide](/getting-started/installation)** — Detailed setup with all options
3. **[First Real App](/getting-started/first-app)** — Build a complete CRUD API

Or dive into concepts:

- **[Context](/concepts/context)** — Understanding the `ctx` object
- **[Controllers](/controllers/)** — Class-based development guide
