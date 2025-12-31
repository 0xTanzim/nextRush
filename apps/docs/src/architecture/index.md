---
title: Architecture Overview
description: High-level architecture of NextRush v3 — modular design, package hierarchy, and core design principles.
---

# Architecture Overview

> Understand how NextRush is designed: modular packages, minimal core, and a clean separation of concerns.

## Design Philosophy

NextRush is built on three fundamental principles:

### 1. Minimal Core

The core framework is intentionally small (~1,500 LOC). Every feature beyond the essentials lives in a separate package.

**Why?**
- Smaller attack surface
- Faster startup time
- Pay only for what you use
- Easier to understand and contribute

### 2. Modular by Design

Each package has a single responsibility and explicit dependencies:

```
@nextrush/core   → Application, middleware composition
@nextrush/router → Route matching
@nextrush/di     → Dependency injection
@nextrush/errors → Error hierarchy
```

**Why?**
- Replace any component without framework changes
- Tree-shaking removes unused code
- Test packages in isolation
- Version independently

### 3. No Hidden Magic

Every automatic behavior is:
- Documented
- Has an escape hatch
- Can be disabled or replaced

If something feels like "magic," check the architecture docs — we explain exactly what happens.

---

## Package Hierarchy

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Your Application                              │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
            ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
            │ Middleware  │ │   Plugins   │ │ Controllers │
            │             │ │             │ │   (Class)   │
            │ body-parser │ │ logger      │ │ @nextrush/  │
            │ cors        │ │ static      │ │ controllers │
            │ helmet      │ │ websocket   │ │             │
            │ rate-limit  │ │ events      │ │             │
            └─────────────┘ └─────────────┘ └─────────────┘
                    │              │              │
                    └──────────────┼──────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        @nextrush/core                                │
│                                                                      │
│  ┌─────────────┐  ┌─────────────────┐  ┌─────────────┐              │
│  │ Application │  │ Middleware      │  │ Plugin      │              │
│  │             │  │ Composition     │  │ System      │              │
│  │ createApp() │  │ compose()       │  │ app.plugin()│              │
│  └─────────────┘  └─────────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
                    │              │
        ┌───────────┘              └───────────┐
        │                                      │
        ▼                                      ▼
┌──────────────────┐                  ┌──────────────────┐
│ @nextrush/router │                  │ @nextrush/       │
│                  │                  │ adapter-*        │
│ Radix tree       │                  │                  │
│ Route matching   │                  │ Node / Bun /     │
│ Parameters       │                  │ Deno / Edge      │
└──────────────────┘                  └──────────────────┘
                                               │
                                               ▼
                                      ┌──────────────────┐
                                      │    HTTP Layer    │
                                      │                  │
                                      │ Node.js / Bun /  │
                                      │ Deno / Workers   │
                                      └──────────────────┘
```

---

## Package Categories

### Foundation Packages

Zero-dependency packages that define types and contracts:

| Package | Purpose | Dependencies |
|---------|---------|--------------|
| `@nextrush/types` | TypeScript interfaces | None |
| `@nextrush/errors` | HTTP error hierarchy | `types` |

### Core Packages

The essential runtime components:

| Package | Purpose | Dependencies |
|---------|---------|--------------|
| `@nextrush/core` | Application & middleware | `types` |
| `@nextrush/router` | Route matching | `types` |
| `@nextrush/runtime` | Runtime detection | `types` |

### Adapter Packages

Platform-specific HTTP handling:

| Package | Platform | Dependencies |
|---------|----------|--------------|
| `@nextrush/adapter-node` | Node.js | `types` |
| `@nextrush/adapter-bun` | Bun | `types` |
| `@nextrush/adapter-deno` | Deno | `types` |
| `@nextrush/adapter-edge` | Cloudflare/Vercel | `types` |

### Middleware Packages

Request/response processing:

| Package | Purpose |
|---------|---------|
| `@nextrush/body-parser` | Parse JSON/form bodies |
| `@nextrush/cors` | Cross-origin requests |
| `@nextrush/helmet` | Security headers |
| `@nextrush/rate-limit` | Request throttling |
| `@nextrush/compression` | Response compression |
| `@nextrush/cookies` | Cookie handling |

### Plugin Packages

Feature extensions:

| Package | Purpose |
|---------|---------|
| `@nextrush/logger` | Request logging |
| `@nextrush/static` | Static file serving |
| `@nextrush/websocket` | WebSocket support |
| `@nextrush/events` | Event system |

### Class-Based Packages

Structured application development:

| Package | Purpose | Dependencies |
|---------|---------|--------------|
| `@nextrush/di` | Dependency injection | `tsyringe` |
| `@nextrush/decorators` | Route/param decorators | `types` |
| `@nextrush/controllers` | Controller plugin | `di`, `decorators` |

---

## Data Flow

### Request Lifecycle

```
HTTP Request
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Adapter: Convert platform request → Context                         │
└─────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Middleware Stack (Onion Model)                                      │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  CORS Middleware                                             │    │
│  │  ┌─────────────────────────────────────────────────────┐    │    │
│  │  │  Body Parser Middleware                              │    │    │
│  │  │  ┌─────────────────────────────────────────────┐    │    │    │
│  │  │  │  Rate Limit Middleware                       │    │    │    │
│  │  │  │  ┌─────────────────────────────────────┐    │    │    │    │
│  │  │  │  │  Router Middleware                   │    │    │    │    │
│  │  │  │  │  ┌─────────────────────────────┐    │    │    │    │    │
│  │  │  │  │  │  Route Handler              │    │    │    │    │    │
│  │  │  │  │  │  (your code)                │    │    │    │    │    │
│  │  │  │  │  └─────────────────────────────┘    │    │    │    │    │
│  │  │  │  └─────────────────────────────────────┘    │    │    │    │
│  │  │  └─────────────────────────────────────────────┘    │    │    │
│  │  └─────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Adapter: Convert Context → platform response                        │
└─────────────────────────────────────────────────────────────────────┘
     │
     ▼
HTTP Response
```

### Middleware Execution Order

```typescript
// Registration order
app.use(cors());       // 1st registered
app.use(bodyParser()); // 2nd registered
app.use(logger());     // 3rd registered
app.use(router());     // 4th registered

// Execution order (down then up)
Request → CORS → BodyParser → Logger → Router → Handler
                                                    ↓
Response ← CORS ← BodyParser ← Logger ← Router ← Handler
```

---

## Key Design Decisions

### Why Koa-style Middleware?

NextRush uses Koa's `async/await` middleware pattern:

```typescript
app.use(async (ctx) => {
  console.log('Before handler');
  await ctx.next();
  console.log('After handler');
});
```

**Benefits:**
- Natural async/await flow
- Easy to understand timing
- Clean error propagation
- No callback hell

### Why Radix Tree Router?

Route matching uses a radix tree (compact trie):

```
Routes: /users, /users/:id, /users/:id/posts

Tree:
└── /users
    ├── (end) → handler1
    └── /
        └── :id
            ├── (end) → handler2
            └── /posts
                └── (end) → handler3
```

**Benefits:**
- O(k) lookup where k = path length
- Route count doesn't affect performance
- Memory efficient for similar paths
- Supports parameters and wildcards

### Why Adapters?

Adapters abstract platform differences:

```typescript
// Same code, different runtimes
import { createApp } from '@nextrush/core';

const app = createApp();
app.get('/', (ctx) => ctx.json({ hello: 'world' }));

// Node.js
import { serve } from '@nextrush/adapter-node';
serve(app, { port: 3000 });

// Bun
import { serve } from '@nextrush/adapter-bun';
serve(app, { port: 3000 });

// Edge
import { createHandler } from '@nextrush/adapter-edge';
export default { fetch: createHandler(app) };
```

### Why Separate DI?

Dependency injection is optional:

```typescript
// Without DI (functional style)
app.get('/users', (ctx) => {
  const users = findAllUsers();
  ctx.json(users);
});

// With DI (class-based style)
@Controller('/users')
class UserController {
  constructor(private userService: UserService) {}

  @Get()
  findAll() {
    return this.userService.findAll();
  }
}
```

**Benefits:**
- Use what fits your project
- No DI overhead for simple apps
- Full DI power for complex apps
- Testability with mock injection

---

## Size Targets

Each package has a size budget:

| Package | Target LOC | Actual |
|---------|------------|--------|
| `@nextrush/core` | ≤ 1,500 | ~1,200 |
| `@nextrush/router` | ≤ 1,000 | ~800 |
| `@nextrush/di` | ≤ 400 | ~300 |
| `@nextrush/decorators` | ≤ 800 | ~600 |
| `@nextrush/controllers` | ≤ 800 | ~700 |
| Middleware packages | ≤ 300 each | varies |

**Why size limits?**
- Forces focused design
- Easier to audit
- Faster to load
- Simpler to maintain

---

## Architecture Documentation

Dive deeper into specific subsystems:

| Document | Topic |
|----------|-------|
| [Core & Application](./core-application) | Application lifecycle, middleware composition, plugins |
| [Router Internals](./routing) | Radix tree, route matching, parameters |
| [Adapter Architecture](./adapters) | Multi-runtime support, context implementation |
| [DI & Decorators](./di-and-decorators) | Dependency injection, decorator metadata, controllers |
| [Error Handling](./error-handling) | Error hierarchy, propagation, custom errors |
| [Runtime Compatibility](./runtime-compatibility) | Cross-runtime APIs, capability detection |

---

## For Contributors

### Adding a Package

1. Create package in appropriate category folder
2. Define explicit dependencies in `package.json`
3. Export types in `src/index.ts`
4. Add tests with 90%+ coverage
5. Document in `/packages/[name].md`

### Package Guidelines

- Single responsibility per package
- Explicit dependencies only
- No circular dependencies
- TypeScript strict mode
- JSDoc for public APIs

### Testing Requirements

- Unit tests for all functions
- Integration tests for package interactions
- Mock adapters for runtime-specific code
- Performance benchmarks for critical paths
