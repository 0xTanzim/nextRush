# 🚀 NextRush v3 Architecture Vision & Design Document

> **Document Type**: Technical Architecture Specification
> **Version**: v3.0.0 (Planning Phase)
> **Author**: Senior Backend Engineer & Architect
> **Date**: December 24, 2025
> **Status**: RFC (Request for Comments)

---

## Table of Contents

1. [Vision Statement](#1-vision-statement)
2. [Design Principles](#2-design-principles)
3. [Architecture Overview](#3-architecture-overview)
4. [Package Structure](#4-package-structure)
5. [Core Package Design](#5-core-package-design)
6. [Monorepo Setup](#6-monorepo-setup)
7. [API Design](#7-api-design)
8. [Performance Targets](#8-performance-targets)
9. [Migration Strategy](#9-migration-strategy)
10. [Implementation Phases](#10-implementation-phases)

---

## 1. Vision Statement

### 1.1 The Problem We're Solving

NextRush v2 proved we can build a full-featured framework. Now we need to prove we can build a **fast, modular, professional-grade** framework.

### 1.2 The v3 Vision

> **"Minimal core, maximum power, zero compromise."**

NextRush v3 will be:
- **Minimal**: Core under 3,000 LOC
- **Modular**: Every feature is opt-in
- **Fast**: Target 30,000+ RPS
- **Type-Safe**: Full TypeScript with zero `any`
- **Zero Dependencies**: Still no external runtime deps
- **Tree-Shakable**: Only ship what you use

### 1.3 Target Audience

```
Primary:
├── Performance-conscious developers
├── TypeScript-first teams
├── Serverless/Edge deployments
└── Production-grade applications

Secondary:
├── Enterprise teams needing extensibility
├── Framework learners wanting clean code
└── Contributors to open source
```

### 1.4 Success Metrics

| Metric | v2 Current | v3 Target | Industry Best |
|--------|------------|-----------|---------------|
| Core Size | 25,000 LOC | <3,000 LOC | ~2,500 (Koa) |
| Cold Start | ~150ms | <30ms | ~20ms (Hono) |
| Memory | ~1.5MB | <200KB | ~100KB (Koa) |
| RPS | ~13,000 | >30,000 | ~40,000 (Fastify) |
| Time to First Route | ~50ms | <10ms | ~5ms |

---

## 2. Design Principles

### 2.1 Core Principles

#### Principle 1: Minimal Core
```
The core should do ONE thing: handle HTTP requests with middleware.
Everything else is an extension.
```

#### Principle 2: Opt-In Complexity
```
Simple by default, powerful when needed.
A hello world should be 3 lines, not 30.
```

#### Principle 3: Zero-Cost Abstractions
```
If you don't use a feature, you pay nothing.
Not in bundle size, not in memory, not in CPU.
```

#### Principle 4: Composition Over Configuration
```
Build applications by composing small, focused packages.
No magic, no hidden behavior.
```

#### Principle 5: TypeScript First
```
Types are not afterthoughts. They guide the API design.
Inference should work naturally.
```

### 2.2 Anti-Patterns to Avoid

```
❌ God objects (Application class doing everything)
❌ Feature flags (if/else everywhere)
❌ Implicit loading (loading code that isn't used)
❌ Runtime type checking (trust the types)
❌ Configuration over code (prefer explicit code)
```

---

## 3. Architecture Overview

### 3.1 Layer Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER APPLICATION                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    nextrush (meta)                        │   │
│  │         Convenience package - bundles defaults            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│  ┌───────────────────────────┼───────────────────────────────┐  │
│  │                     PLUGIN LAYER                          │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────┐  │  │
│  │  │ logger  │ │  static │ │ template│ │    websocket    │  │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────┼───────────────────────────────┐  │
│  │                  MIDDLEWARE LAYER                         │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐         │  │
│  │  │  cors   │ │ helmet  │ │  body   │ │compress │ ...     │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────┼───────────────────────────────┐  │
│  │                    CORE LAYER                              │  │
│  │  ┌──────────────────┐  ┌───────────────────────────────┐  │  │
│  │  │   @nextrush/core │  │     @nextrush/router          │  │  │
│  │  │  - Application   │  │  - Radix Tree                 │  │  │
│  │  │  - Context       │  │  - Route Matching             │  │  │
│  │  │  - Middleware    │  │  - Param Extraction           │  │  │
│  │  │  - Plugin Hooks  │  │  - Static Fast Path           │  │  │
│  │  └──────────────────┘  └───────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────┼───────────────────────────────┐  │
│  │                  ADAPTER LAYER                             │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────┐  │  │
│  │  │  node   │ │   bun   │ │  deno   │ │      edge       │  │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Package Dependency Graph

```
                         nextrush (meta)
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
   @nextrush/core      @nextrush/router     @nextrush/http-node
        │                     │                     │
        └─────────────────────┴─────────────────────┘
                              │
                       @nextrush/types
                       (shared types)

Middleware packages:          Plugin packages:
@nextrush/cors               @nextrush/logger
@nextrush/helmet             @nextrush/static
@nextrush/body-parser        @nextrush/template
@nextrush/compression        @nextrush/websocket
@nextrush/rate-limit         @nextrush/events
```

### 3.3 Request Flow (v3)

```
HTTP Request
     │
     ▼
┌─────────────────────┐
│   HTTP Adapter      │  ← Only loaded adapter
│   (Node/Bun/Edge)   │
└─────────────────────┘
     │
     ▼
┌─────────────────────┐
│   Context Creation  │  ← Minimal context
│   (Pooled)          │
└─────────────────────┘
     │
     ▼
┌─────────────────────┐
│   Middleware Chain  │  ← Only registered middleware
│   (Composed once)   │
└─────────────────────┘
     │
     ▼
┌─────────────────────┐
│   Router Match      │  ← O(1) static / O(k) dynamic
└─────────────────────┘
     │
     ▼
┌─────────────────────┐
│   Route Handler     │  ← User code
└─────────────────────┘
     │
     ▼
┌─────────────────────┐
│   Response Send     │  ← Direct to adapter
└─────────────────────┘
```

---

## 4. Package Structure

### 4.1 Monorepo Layout

```
nextrush/
├── packages/
│   │
│   ├── core/                    # @nextrush/core
│   │   ├── src/
│   │   │   ├── application.ts   # Main Application class
│   │   │   ├── context.ts       # Context interface & factory
│   │   │   ├── middleware.ts    # Middleware chain composer
│   │   │   ├── plugin.ts        # Plugin interface & registry
│   │   │   ├── errors.ts        # Base error classes
│   │   │   └── index.ts         # Public exports
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── router/                  # @nextrush/router
│   │   ├── src/
│   │   │   ├── router.ts        # Router class
│   │   │   ├── tree.ts          # Radix tree implementation
│   │   │   ├── matcher.ts       # Route matching logic
│   │   │   ├── cache.ts         # LRU route cache
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── types/                   # @nextrush/types (internal)
│   │   ├── src/
│   │   │   ├── context.ts       # Context types
│   │   │   ├── http.ts          # HTTP types
│   │   │   ├── middleware.ts    # Middleware types
│   │   │   ├── plugin.ts        # Plugin types
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── adapters/
│   │   ├── node/                # @nextrush/adapter-node
│   │   ├── bun/                 # @nextrush/adapter-bun (future)
│   │   └── edge/                # @nextrush/adapter-edge (future)
│   │
│   ├── middleware/
│   │   ├── cors/                # @nextrush/cors
│   │   ├── helmet/              # @nextrush/helmet
│   │   ├── body-parser/         # @nextrush/body-parser
│   │   ├── compression/         # @nextrush/compression
│   │   ├── rate-limit/          # @nextrush/rate-limit
│   │   └── request-id/          # @nextrush/request-id
│   │
│   ├── plugins/
│   │   ├── logger/              # @nextrush/logger
│   │   ├── static/              # @nextrush/static
│   │   ├── template/            # @nextrush/template
│   │   ├── websocket/           # @nextrush/websocket
│   │   └── events/              # @nextrush/events
│   │
│   └── nextrush/                # nextrush (meta package)
│       ├── src/
│       │   └── index.ts         # Re-exports core + node adapter
│       └── package.json
│
├── apps/
│   ├── docs/                    # Documentation site
│   ├── playground/              # Testing playground
│   └── benchmarks/              # Performance benchmarks
│
├── tools/
│   ├── scripts/                 # Build scripts
│   └── templates/               # Package templates
│
├── turbo.json                   # Turborepo config
├── pnpm-workspace.yaml          # pnpm workspace
├── package.json                 # Root package.json
└── tsconfig.base.json           # Shared TypeScript config
```

### 4.2 Package Responsibilities

| Package | Responsibility | Size Target |
|---------|---------------|-------------|
| `@nextrush/core` | Application, Context, Middleware chain | <1,500 LOC |
| `@nextrush/router` | Route matching, Radix tree | <1,000 LOC |
| `@nextrush/types` | Shared TypeScript types | <500 LOC |
| `@nextrush/adapter-node` | Node.js HTTP binding | <500 LOC |
| `@nextrush/cors` | CORS headers | <200 LOC |
| `@nextrush/helmet` | Security headers | <200 LOC |
| `@nextrush/body-parser` | Request body parsing | <800 LOC |
| `@nextrush/compression` | Response compression | <400 LOC |
| `@nextrush/rate-limit` | Rate limiting | <300 LOC |
| `@nextrush/logger` | Advanced logging plugin | <600 LOC |
| `@nextrush/static` | Static file serving | <400 LOC |
| `@nextrush/websocket` | WebSocket support | <500 LOC |
| `@nextrush/events` | Event system (CQRS) | <1,500 LOC |
| `nextrush` | Meta package (re-exports) | <100 LOC |

---

## 5. Core Package Design

### 5.1 `@nextrush/core` - The Heart

```typescript
// @nextrush/core/src/index.ts
// This is ALL that core exports

export { Application, createApp } from './application';
export { createContext } from './context';
export { compose } from './middleware';
export { NextRushError } from './errors';

export type {
  App,
  Context,
  Middleware,
  Next,
  Plugin,
  PluginContext,
} from './types';
```

### 5.2 Application Class (v3)

```typescript
// @nextrush/core/src/application.ts
import type { Context, Middleware, Next, Plugin } from './types';
import { compose } from './middleware';
import { createContext } from './context';

export class Application {
  private middleware: Middleware[] = [];
  private plugins: Plugin[] = [];

  /**
   * Register middleware
   */
  use(middleware: Middleware): this {
    this.middleware.push(middleware);
    return this;
  }

  /**
   * Install a plugin
   */
  plugin(plugin: Plugin): this {
    plugin.install(this);
    this.plugins.push(plugin);
    return this;
  }

  /**
   * Create request handler callback
   * Used by adapters (node, bun, edge)
   */
  callback(): (ctx: Context) => Promise<void> {
    const fn = compose(this.middleware);
    return async (ctx: Context) => {
      await fn(ctx);
    };
  }

  /**
   * Get plugin by name
   */
  getPlugin<T extends Plugin>(name: string): T | undefined {
    return this.plugins.find(p => p.name === name) as T | undefined;
  }
}

export function createApp(): Application {
  return new Application();
}
```

**Total: ~50 lines.** That's the entire core application.

### 5.3 Context Interface (v3)

```typescript
// @nextrush/core/src/types.ts
import type { IncomingMessage, ServerResponse } from 'node:http';

export interface Context {
  // ===== REQUEST (Input - Read-only) =====
  readonly method: string;
  readonly url: string;
  readonly path: string;
  readonly query: Record<string, string>;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly ip: string;

  // Request body (populated by body parser)
  body: unknown;

  // Route params (set by router)
  params: Record<string, string>;

  // ===== RESPONSE (Output) =====
  status: number;

  // Response methods (action-oriented DX)
  json(data: unknown): void;      // Send JSON response
  send(data: unknown): void;      // Send text/buffer/stream
  html(content: string): void;    // Send HTML response
  redirect(url: string, status?: number): void;

  // Header helpers
  set(field: string, value: string): void;
  get(field: string): string | undefined;

  // ===== MIDDLEWARE =====
  next(): Promise<void>;          // Modern syntax: ctx.next()

  // ===== STATE =====
  state: Record<string, unknown>;

  // ===== RAW ACCESS =====
  readonly raw: {
    req: IncomingMessage;
    res: ServerResponse;
  };
}

// Middleware supports both syntaxes
export type Next = () => Promise<void>;
export type Middleware =
  | ((ctx: Context) => Promise<void>)                    // Modern: ctx.next()
  | ((ctx: Context, next: Next) => Promise<void>);       // Traditional
```

### 5.4 Middleware Composition (v3)

```typescript
// @nextrush/core/src/middleware.ts
import type { Context, Middleware, Next } from './types';

/**
 * Compose middleware functions into a single function
 * Koa-style composition with async/await
 */
export function compose(middleware: Middleware[]): Middleware {
  return async function(ctx: Context, next?: Next): Promise<void> {
    let index = -1;

    async function dispatch(i: number): Promise<void> {
      if (i <= index) {
        throw new Error('next() called multiple times');
      }
      index = i;

      const fn = i < middleware.length ? middleware[i] : next;
      if (!fn) return;

      await fn(ctx, () => dispatch(i + 1));
    }

    await dispatch(0);
  };
}
```

**Total: ~25 lines.** Simple, fast, correct.

### 5.5 Plugin Interface (v3)

```typescript
// @nextrush/core/src/plugin.ts
import type { Application } from './application';

export interface Plugin {
  /** Unique plugin name */
  readonly name: string;

  /** Plugin version */
  readonly version?: string;

  /** Install plugin into application */
  install(app: Application): void | Promise<void>;

  /** Optional cleanup */
  destroy?(): void | Promise<void>;
}

export interface PluginContext {
  app: Application;
}
```

---

## 6. Monorepo Setup

### 6.1 Root `package.json`

```json
{
  "name": "nextrush-monorepo",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "dev": "turbo run dev",
    "clean": "turbo run clean",
    "typecheck": "turbo run typecheck",
    "changeset": "changeset",
    "version": "changeset version",
    "release": "turbo run build && changeset publish"
  },
  "devDependencies": {
    "@changesets/cli": "^2.27.0",
    "turbo": "^2.0.0",
    "typescript": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

### 6.2 `pnpm-workspace.yaml`

```yaml
packages:
  - 'packages/*'
  - 'packages/middleware/*'
  - 'packages/plugins/*'
  - 'packages/adapters/*'
  - 'apps/*'
```

### 6.3 `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": []
    },
    "lint": {
      "outputs": []
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "clean": {
      "cache": false
    }
  }
}
```

### 6.4 Shared `tsconfig.base.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true
  }
}
```

---

## 7. API Design

### 7.1 User-Facing API (Minimal Usage)

```typescript
// Simplest possible usage - 3 lines!
import { createApp } from 'nextrush';

const app = createApp();

app.get('/', (ctx) => {
  ctx.json({ message: 'Hello World' });  // Clean response
});

app.listen(3000);
```

### 7.2 User-Facing API (Full Featured)

```typescript
// Full-featured usage with modern DX
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { listen } from '@nextrush/adapter-node';
import { cors } from '@nextrush/cors';
import { helmet } from '@nextrush/helmet';
import { json } from '@nextrush/body-parser';
import { LoggerPlugin } from '@nextrush/logger';

// Create application
const app = createApp();

// Install plugins
app.plugin(new LoggerPlugin({ level: 'info' }));

// Register middleware (modern ctx.next() syntax)
app.use(cors());
app.use(helmet());
app.use(json());

// Logging middleware example
app.use(async (ctx) => {
  const start = Date.now();
  await ctx.next();  // Modern syntax!
  console.log(`${ctx.method} ${ctx.path} - ${Date.now() - start}ms`);
});

// Create router
const router = createRouter();

router.get('/users', async (ctx) => {
  const users = await db.users.findAll();
  ctx.json({ users });  // Send JSON response
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
  // ctx.body = parsed request body (input)
  const user = await db.users.create(ctx.body);
  ctx.status = 201;
  ctx.json({ user });  // ctx.json() = send response (output)
});

// Mount router
app.use(router.routes());

// Start server
listen(app, { port: 3000 }, () => {
  console.log('Server running on http://localhost:3000');
});
```

### 7.3 DX-Focused Context API

```typescript
// Clear distinction between input and output

// ===== REQUEST (Input) =====
ctx.body          // Request body (parsed JSON/form) - INPUT
ctx.query         // URL query params
ctx.params        // Route params (:id)
ctx.headers       // Request headers
ctx.method        // GET, POST, etc.
ctx.path          // Request path
ctx.ip            // Client IP

// ===== RESPONSE (Output) =====
ctx.json(data)    // Send JSON - OUTPUT
ctx.send(data)    // Send text/buffer
ctx.html(content) // Send HTML
ctx.redirect(url) // Redirect
ctx.status        // Set status code
ctx.set(k, v)     // Set response header

// ===== MIDDLEWARE =====
ctx.next()        // Call next middleware
```

### 7.4 Meta Package API

```typescript
// packages/nextrush/src/index.ts
// Re-exports for convenience

// Core
export { createApp, Application } from '@nextrush/core';
export { createRouter } from '@nextrush/router';

// Node adapter (default)
export { listen } from '@nextrush/adapter-node';

// Types
export type {
  Context,
  Middleware,
  Next,
  Plugin,
} from '@nextrush/core';

// Extend Application with listen method for convenience
import { Application } from '@nextrush/core';
import { listen as nodeListen } from '@nextrush/adapter-node';

declare module '@nextrush/core' {
  interface Application {
    listen(port: number, callback?: () => void): void;
  }
}

Application.prototype.listen = function(port: number, callback?: () => void) {
  nodeListen(this, { port }, callback);
};
```

### 7.4 Router API

```typescript
// @nextrush/router API
import { createRouter, Router } from '@nextrush/router';

const router = createRouter();

// HTTP methods
router.get('/path', handler);
router.post('/path', handler);
router.put('/path', handler);
router.delete('/path', handler);
router.patch('/path', handler);

// With middleware
router.get('/path', middleware1, middleware2, handler);

// Param routes
router.get('/users/:id', handler);
router.get('/posts/:postId/comments/:commentId', handler);

// Wildcard
router.get('/files/*', handler);

// Prefix groups
const api = createRouter({ prefix: '/api/v1' });
api.get('/users', handler); // /api/v1/users

// Mount sub-router
router.use('/admin', adminRouter.routes());

// Get middleware function
app.use(router.routes());
```

---

## 8. Performance Targets

### 8.1 Benchmark Targets

| Metric | v2 | v3 Target | Stretch Goal |
|--------|-----|-----------|--------------|
| Hello World RPS | 13,000 | 30,000 | 40,000 |
| JSON Response RPS | 11,000 | 25,000 | 35,000 |
| Param Route RPS | 10,000 | 22,000 | 30,000 |
| 5 Middleware Chain | 9,000 | 20,000 | 28,000 |
| Cold Start | 150ms | 30ms | 15ms |
| Memory (baseline) | 1.5MB | 200KB | 100KB |
| Memory (1000 routes) | 10MB | 2MB | 1MB |

### 8.2 Performance Optimizations

#### 8.2.1 Zero-Allocation Hot Path
```typescript
// Reuse objects in hot path
const contextPool: Context[] = [];
const paramObjectPool: Record<string, string>[] = [];

function acquireContext(): Context { /* from pool */ }
function releaseContext(ctx: Context): void { /* to pool */ }
```

#### 8.2.2 Pre-Compiled Routes
```typescript
// Compile middleware chain at startup
const compiledRoutes = new Map<string, CompiledRoute>();

router.on('route:added', (route) => {
  compiledRoutes.set(route.key, compileRoute(route));
});
```

#### 8.2.3 Static Route Fast Path
```typescript
// O(1) lookup for static routes
const staticRoutes = new Map<string, Handler>();
const dynamicTree = new RadixTree();

function match(method: string, path: string): Match | null {
  // Check static first (most common case)
  const staticKey = `${method}:${path}`;
  const staticMatch = staticRoutes.get(staticKey);
  if (staticMatch) return staticMatch;

  // Fall back to tree
  return dynamicTree.find(method, path);
}
```

---

## 9. Migration Strategy

### 9.1 Breaking Changes from v2

| Change | v2 | v3 | Migration |
|--------|-----|-----|-----------|
| Import path | `import { createApp } from 'nextrush'` | Same (meta package) | No change needed |
| Router | Built-in | Separate package | `import { createRouter } from '@nextrush/router'` |
| Middleware | `app.cors()` | `import { cors } from '@nextrush/cors'` | Explicit imports |
| Events | Built-in | Plugin | `import { EventsPlugin } from '@nextrush/events'` |
| Context | Heavy | Minimal | Some methods move to helpers |

### 9.2 Migration Guide Preview

```typescript
// v2 code
import { createApp } from 'nextrush';

const app = createApp();
app.use(app.cors());
app.use(app.helmet());
app.use(app.json());

app.get('/users', async (ctx) => {
  ctx.res.json({ users: [] });
});

app.listen(3000);

// v3 code (minimal changes with meta package)
import { createApp, cors, helmet, json, listen } from 'nextrush';

const app = createApp();
app.use(cors());
app.use(helmet());
app.use(json());

app.get('/users', async (ctx) => {
  ctx.body = { users: [] };  // Simplified response
});

listen(app, 3000);
```

---

## 10. Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
- [ ] Set up monorepo with Turborepo + pnpm
- [ ] Create `@nextrush/types` package
- [ ] Create `@nextrush/core` package (minimal)
- [ ] Create `@nextrush/router` package
- [ ] Achieve 30,000 RPS on hello world

### Phase 2: Adapters (Weeks 3-4)
- [ ] Create `@nextrush/adapter-node`
- [ ] Port context creation
- [ ] Port request handling
- [ ] Benchmark and optimize

### Phase 3: Essential Middleware (Weeks 5-6)
- [ ] Create `@nextrush/cors`
- [ ] Create `@nextrush/helmet`
- [ ] Create `@nextrush/body-parser`
- [ ] Create `@nextrush/compression`

### Phase 4: Plugins (Weeks 7-8)
- [ ] Create `@nextrush/logger`
- [ ] Create `@nextrush/static`
- [ ] Create `@nextrush/websocket`

### Phase 5: Advanced Features (Weeks 9-10)
- [ ] Create `@nextrush/events` (CQRS)
- [ ] Create `@nextrush/rate-limit`
- [ ] Create `@nextrush/template`

### Phase 6: Meta Package & Docs (Weeks 11-12)
- [ ] Create `nextrush` meta package
- [ ] Write comprehensive documentation
- [ ] Create migration guide
- [ ] Performance benchmarks
- [ ] Beta release

---

## 11. Success Criteria

### 11.1 Technical Success
- [ ] Core under 3,000 LOC
- [ ] 30,000+ RPS on hello world
- [ ] <30ms cold start
- [ ] <200KB memory baseline
- [ ] 100% TypeScript, zero `any`
- [ ] 90%+ test coverage

### 11.2 DX Success
- [ ] 3-line hello world
- [ ] Full type inference
- [ ] Clear error messages
- [ ] Comprehensive docs
- [ ] Migration guide works

### 11.3 Ecosystem Success
- [ ] All v2 features available as packages
- [ ] Easy to extend with custom packages
- [ ] Active community contributions

---

## Appendix A: Package Dependencies

```
@nextrush/core
├── (no dependencies)

@nextrush/router
├── @nextrush/types

@nextrush/adapter-node
├── @nextrush/core
├── @nextrush/types

@nextrush/cors
├── @nextrush/types

@nextrush/helmet
├── @nextrush/types

@nextrush/body-parser
├── @nextrush/types

@nextrush/compression
├── @nextrush/types

@nextrush/logger
├── @nextrush/core
├── @nextrush/types

@nextrush/static
├── @nextrush/core
├── @nextrush/types

@nextrush/websocket
├── @nextrush/core
├── @nextrush/types

@nextrush/events
├── @nextrush/core
├── @nextrush/types

nextrush (meta)
├── @nextrush/core
├── @nextrush/router
├── @nextrush/adapter-node
```

---

## Appendix B: Decision Log

| Decision | Choice | Reason |
|----------|--------|--------|
| Monorepo tool | Turborepo | Fast, simple, works with pnpm |
| Package manager | pnpm | Fast, strict, workspace support |
| Build tool | tsup | Fast, zero-config, ESM support |
| Test framework | Vitest | Fast, ESM native, good DX |
| Versioning | Changesets | Monorepo versioning support |

---

*End of Architecture Vision Document*
