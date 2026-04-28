# NextRush v3 Copilot Instructions

## Project Overview

**NextRush v3** is a minimal, modular, high-performance Node.js framework.

| Attribute       | Value                                     |
| --------------- | ----------------------------------------- |
| Version         | 3.0.4 (unified `@nextrush/*` releases)    |
| Architecture    | Modular monorepo (Turborepo + pnpm)       |
| Node.js         | >=22.0.0                                  |
| Package Manager | pnpm                                      |
| TypeScript      | 5.x, strict mode, ES2022 target           |
| Runtime Deps    | Zero (except `reflect-metadata` for DI)   |
| Paradigms       | Functional + class-based (decorators, DI) |

### Core Principles

1. **Minimal Core** — under 3,000 LOC
2. **Modular** — every feature is a separate package
3. **Zero Dependencies** — no external runtime deps
4. **Type Safe** — zero `any`, full TypeScript strict mode
5. **Fast** — target 30,000+ RPS, <200KB memory, <30ms cold start
6. **Dual Paradigm** — functional routes and decorator-based controllers

---

## Package Hierarchy

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
@nextrush/decorators   → @Controller, @Get, @UseGuard (depends on types)
       ↓
@nextrush/controllers  → Auto-discovery, handler building (depends on di, decorators, errors)
       ↓
@nextrush/adapter-*    → Platform adapters (depends on core, types)
       ↓
@nextrush/middleware/*  → cors, helmet, body-parser (depends on types)
       ↓
nextrush               → Meta package (re-exports all essentials)
```

**Rule**: Lower packages never import from higher packages. No circular dependencies.

---

## Project Structure

```
nextrush/
├── packages/
│   ├── types/           # @nextrush/types
│   ├── errors/          # @nextrush/errors
│   ├── core/            # @nextrush/core
│   ├── router/          # @nextrush/router
│   ├── di/              # @nextrush/di
│   ├── decorators/      # @nextrush/decorators
│   ├── runtime/         # @nextrush/runtime
│   ├── nextrush/        # nextrush (meta package)
│   ├── dev/             # @nextrush/dev (dev tools)
│   ├── adapters/        # node, bun, deno, edge
│   ├── middleware/       # cors, helmet, body-parser, etc.
│   └── plugins/         # controllers, logger, static, etc.
├── apps/
│   ├── docs/            # Documentation site
│   └── playground/      # Testing playground
├── draft/               # Architecture RFCs and plans
└── _archive/            # Old v2 code (reference only)
```

---

## Context API

```typescript
// Request (Input)
ctx.body; // Parsed request body
ctx.query; // Query parameters
ctx.params; // Route parameters
ctx.headers; // Request headers
ctx.method; // HTTP method
ctx.path; // Request path
ctx.state; // Mutable state bag for middleware

// Response (Output)
ctx.json(data); // Send JSON
ctx.send(data); // Send text/buffer
ctx.html(str); // Send HTML
ctx.redirect(url); // Redirect
ctx.status; // Status code

// Middleware
ctx.next(); // Call next middleware
```

---

## Dual Paradigm Usage

### Functional Style

```typescript
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';

const app = createApp();
const users = createRouter();

users.get('/', (ctx) => ctx.json([{ id: 1, name: 'Alice' }]));
users.get('/:id', (ctx) => ctx.json({ id: ctx.params.id }));

app.route('/users', users);
app.listen(3000);
```

### Class-Based Style

```typescript
import 'reflect-metadata';
import { Controller, Get, Post, Body, UseGuard } from '@nextrush/decorators';
import { Service } from '@nextrush/di';
import { controllersPlugin } from '@nextrush/controllers';
import type { GuardFn } from '@nextrush/decorators';

@Service()
class UserService {
  async findAll() {
    return [{ id: 1, name: 'Alice' }];
  }
}

const AuthGuard: GuardFn = async (ctx) => Boolean(ctx.get('authorization'));

@UseGuard(AuthGuard)
@Controller('/users')
class UserController {
  constructor(private userService: UserService) {}

  @Get()
  async findAll() {
    return this.userService.findAll();
  }

  @Post()
  async create(@Body() data: { name: string }) {
    return data;
  }
}

const app = createApp();
app.plugin(controllersPlugin({ root: './src', prefix: '/api' }));
app.listen(3000);
```

---

## Package Imports

```typescript
// ✅ Package-based imports
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { cors } from '@nextrush/cors';
import { Service, container } from '@nextrush/di';
import { Controller, Get, UseGuard } from '@nextrush/decorators';
import { controllersPlugin } from '@nextrush/controllers';
import { HttpError, NotFoundError } from '@nextrush/errors';
import type { Context, Middleware, Plugin } from '@nextrush/types';
```

---

## Package Size Limits

| Package       | Max LOC |
| ------------- | ------- |
| types         | 500     |
| errors        | 600     |
| core          | 1,500   |
| router        | 1,000   |
| di            | 400     |
| decorators    | 800     |
| controllers   | 800     |
| adapter-\*    | 500     |
| middleware/\* | 300     |
| plugin/\*     | 600     |

---

## Commands

```bash
pnpm install                          # Install dependencies
pnpm build                            # Build all packages
pnpm test                             # Run all tests
pnpm --filter @nextrush/<pkg> test    # Test specific package
pnpm typecheck                        # Type check all packages
pnpm lint                             # Lint all packages
pnpm clean                            # Clean build artifacts
```

---

## Instruction Files

Detailed standards are maintained in `.github/instructions/`:

| File                                 | Scope                                      |
| ------------------------------------ | ------------------------------------------ |
| `typescript.instructions.md`         | TypeScript standards, code style, patterns |
| `v3-architecture.instructions.md`    | Architecture overview, package hierarchy   |
| `v3-testing.instructions.md`         | Testing strategy, coverage targets         |
| `docs-standards.instructions.md`     | Documentation philosophy and writing       |
| `docs-mdx-ui.instructions.md`        | MDX components and visual rules            |
| `docs-api-reference.instructions.md` | API reference documentation                |
| `instructions.instructions.md`       | How to write instruction files             |

---

## Reference Documents

- `draft/plan/V3-ARCHITECTURE-VISION.md` — Architecture overview
- `draft/plan/V3-DX-AND-EXTENSIBILITY.md` — DX guidelines
- `draft/rfc/RFC-0001-ARCHITECTURE-V3.md` — Architecture RFC
- `draft/rfc/RFC-0002-DI-AND-DECORATORS.md` — DI and decorators RFC
