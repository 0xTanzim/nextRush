# NextRush v3 Package Overview

> Complete guide to all packages in the NextRush ecosystem, their responsibilities, and how they work together.

## Package Hierarchy

```
                    ┌─────────────────────────────────────────┐
                    │              nextrush                    │
                    │         (Meta Package)                   │
                    │   Re-exports all essential packages      │
                    └─────────────────────────────────────────┘
                                       │
          ┌────────────────────────────┼────────────────────────────┐
          │                            │                            │
          ▼                            ▼                            ▼
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   @nextrush/     │     │   @nextrush/     │     │   @nextrush/     │
│   core           │     │   router         │     │   adapters/*     │
│                  │     │                  │     │                  │
│   Application    │     │   Radix Tree     │     │   Node.js        │
│   Middleware     │     │   Route Matching │     │   Bun            │
│   Plugins        │     │   Parameters     │     │   Deno           │
│   Error Handling │     │   Groups         │     │   Edge           │
└──────────────────┘     └──────────────────┘     └──────────────────┘
          │                        │                        │
          └────────────────────────┼────────────────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────────────────┐
                    │            @nextrush/types              │
                    │                                         │
                    │   Context, Middleware, Plugin, etc.     │
                    │   Zero runtime dependencies             │
                    └─────────────────────────────────────────┘
```

---

## Core Packages

### @nextrush/types

**Purpose:** Shared TypeScript type definitions for the entire ecosystem.

**Key Exports:**
- `Context` - Request/response context interface
- `Middleware` - Middleware function type
- `Plugin` - Plugin interface
- `HttpMethod` - HTTP method union type
- `BodySource` - Cross-runtime body reading interface
- `Runtime` - Runtime identifier type

**Dependencies:** None (zero runtime dependencies)

**Example:**
```typescript
import type { Context, Middleware, Plugin } from '@nextrush/types';
```

---

### @nextrush/errors

**Purpose:** HTTP error classes with proper status codes and error handling.

**Key Exports:**
- `HttpError` - Base HTTP error class
- `NotFoundError` (404)
- `BadRequestError` (400)
- `UnauthorizedError` (401)
- `ForbiddenError` (403)
- `InternalServerError` (500)
- `createHttpError()` - Factory function

**Dependencies:** `@nextrush/types`

**Example:**
```typescript
import { NotFoundError, BadRequestError } from '@nextrush/errors';

if (!user) {
  throw new NotFoundError('User not found');
}

if (!email) {
  throw new BadRequestError('Email is required');
}
```

---

### @nextrush/core

**Purpose:** Application class, middleware composition, and plugin system.

**Key Exports:**
- `Application` - Main application class
- `createApp()` - Factory function
- `compose()` - Middleware composition

**Dependencies:** `@nextrush/types`

**Example:**
```typescript
import { createApp } from '@nextrush/core';

const app = createApp();

app.use(async (ctx) => {
  console.log(`${ctx.method} ${ctx.path}`);
  await ctx.next();
});

app.plugin(loggerPlugin);
```

---

### @nextrush/router

**Purpose:** High-performance radix tree router with O(k) route matching.

**Key Exports:**
- `Router` - Router class
- `createRouter()` - Factory function

**Dependencies:** `@nextrush/types` (core is optional peer dep)

**Features:**
- Named parameters (`:id`)
- Wildcard routes (`*`)
- Route groups with middleware
- Sub-router mounting
- Redirects

**Example:**
```typescript
import { createRouter } from '@nextrush/router';

const router = createRouter();

router.get('/users', listUsers);
router.get('/users/:id', getUser);
router.post('/users', createUser);

router.group('/api/v1', [authMiddleware], (r) => {
  r.get('/posts', listPosts);
  r.post('/posts', createPost);
});

app.use(router.routes());
```

---

### @nextrush/runtime

**Purpose:** Runtime detection and cross-runtime abstractions.

**Key Exports:**
- `detectRuntime()` - Detect current runtime
- `getRuntime()` - Get cached runtime (faster)
- `getRuntimeCapabilities()` - Check runtime features
- `isNode()`, `isBun()`, `isDeno()`, `isEdge()` - Runtime checks
- `WebBodySource` - Cross-runtime body reading
- `EmptyBodySource` - Empty body placeholder

**Dependencies:** `@nextrush/types`

**Example:**
```typescript
import { getRuntime, getRuntimeCapabilities } from '@nextrush/runtime';

const runtime = getRuntime(); // 'node' | 'bun' | 'deno' | 'edge'

const caps = getRuntimeCapabilities();
if (caps.fileSystem) {
  // Safe to use fs operations
}
```

---

## Adapter Packages

### @nextrush/adapter-node

**Purpose:** Connect NextRush to Node.js HTTP server.

**Key Exports:**
- `serve()` - Start HTTP server
- `listen()` - Shorthand with default logging
- `createHandler()` - Create request handler

**Dependencies:** `@nextrush/core`, `@nextrush/types`, `@nextrush/runtime`

**Example:**
```typescript
import { createApp } from '@nextrush/core';
import { serve } from '@nextrush/adapter-node';

const app = createApp();
// ... configure app

await serve(app, {
  port: 3000,
  onListen: ({ port }) => console.log(`Listening on ${port}`)
});
```

---

### @nextrush/adapter-bun

**Purpose:** Connect NextRush to Bun.serve().

**Key Exports:**
- `serve()` - Start Bun server
- `listen()` - Shorthand with default logging
- `createHandler()` - Create Bun fetch handler

**Dependencies:** `@nextrush/core`, `@nextrush/types`, `@nextrush/runtime`

**Example:**
```typescript
import { createApp } from '@nextrush/core';
import { serve } from '@nextrush/adapter-bun';

const app = createApp();
// ... configure app

serve(app, { port: 3000 });
```

---

### @nextrush/adapter-deno

**Purpose:** Connect NextRush to Deno.serve().

**Key Exports:**
- `serve()` - Start Deno server
- `listen()` - Shorthand with default logging
- `createHandler()` - Create Deno request handler

**Dependencies:** `@nextrush/core`, `@nextrush/types`, `@nextrush/runtime`

**Example:**
```typescript
import { createApp } from '@nextrush/core';
import { serve } from '@nextrush/adapter-deno';

const app = createApp();
// ... configure app

await serve(app, { port: 3000 });
```

---

### @nextrush/adapter-edge

**Purpose:** Connect NextRush to Edge runtimes (Cloudflare Workers, Vercel Edge).

**Key Exports:**
- `createHandler()` - Create Edge-compatible handler
- `createFetchHandler()` - Create standard fetch handler

**Dependencies:** `@nextrush/core`, `@nextrush/types`, `@nextrush/runtime`

**Example (Cloudflare Workers):**
```typescript
import { createApp } from '@nextrush/core';
import { createHandler } from '@nextrush/adapter-edge';

const app = createApp();
// ... configure app

export default {
  fetch: createHandler(app)
};
```

---

## Middleware Packages

### @nextrush/body-parser

**Purpose:** Parse request bodies (JSON, URL-encoded, text, raw).

**Key Exports:**
- `bodyParser()` - Combined parser
- `json()` - JSON parser
- `urlencoded()` - URL-encoded parser
- `text()` - Text parser
- `raw()` - Raw binary parser

**Dependencies:** `@nextrush/types`

**Runtime Compatibility:** ✅ All (uses `ctx.bodySource`)

**Example:**
```typescript
import { bodyParser, json } from '@nextrush/body-parser';

// Combined parser (recommended)
app.use(bodyParser());

// Individual parsers
app.use(json({ limit: '10mb', strict: true }));
app.use(urlencoded({ extended: true }));
```

---

### @nextrush/cors

**Purpose:** Cross-Origin Resource Sharing headers.

**Key Exports:**
- `cors()` - Main middleware
- `simpleCors()` - Permissive preset
- `strictCors()` - Secure preset with credentials
- `devCors()` - Development preset

**Dependencies:** `@nextrush/types`

**Runtime Compatibility:** ✅ All (header manipulation only)

**Example:**
```typescript
import { cors, strictCors } from '@nextrush/cors';

// Basic usage
app.use(cors({ origin: 'https://example.com' }));

// Strict preset
app.use(strictCors({ origin: ['https://app.example.com'] }));

// Development
app.use(cors({ origin: '*' }));
```

---

### @nextrush/helmet

**Purpose:** Security headers (CSP, HSTS, X-Frame-Options, etc.).

**Key Exports:**
- `helmet()` - Combined security headers
- `contentSecurityPolicy()` - CSP only
- `hsts()` - HSTS only
- `frameguard()` - X-Frame-Options only
- `strictHelmet()` - Maximum security preset
- `devHelmet()` - Development preset

**Dependencies:** `@nextrush/types`

**Runtime Compatibility:** ✅ All (header manipulation only)

**Example:**
```typescript
import { helmet, strictHelmet } from '@nextrush/helmet';

// Recommended defaults
app.use(helmet());

// Maximum security
app.use(strictHelmet());

// Custom CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'cdn.example.com'],
    }
  }
}));
```

---

### @nextrush/compression

**Purpose:** Response compression (gzip, deflate, brotli).

**Key Exports:**
- `compression()` - Auto-negotiating compression
- `gzip()` - Gzip only
- `deflate()` - Deflate only
- `brotli()` - Brotli only (where supported)

**Dependencies:** `@nextrush/types`

**Runtime Compatibility:**
- ✅ Node.js: gzip, deflate, brotli
- ✅ Bun: gzip, deflate, brotli
- ✅ Deno: gzip, deflate (brotli limited)
- ✅ Edge: gzip, deflate (no brotli)

**Example:**
```typescript
import { compression } from '@nextrush/compression';

// Auto-negotiate best encoding
app.use(compression());

// With options
app.use(compression({
  level: 6,
  threshold: 1024,
  brotli: true,
}));
```

---

### @nextrush/rate-limit

**Purpose:** Rate limiting middleware.

**Key Exports:**
- `rateLimit()` - Main middleware
- `createStore()` - Custom store factory

**Dependencies:** `@nextrush/types`

**Runtime Compatibility:** ✅ All

**Example:**
```typescript
import { rateLimit } from '@nextrush/rate-limit';

app.use(rateLimit({
  max: 100,
  window: '15m',
  keyGenerator: (ctx) => ctx.ip,
}));
```

---

### @nextrush/cookies

**Purpose:** Cookie parsing and setting.

**Key Exports:**
- `cookies()` - Cookie middleware
- `parseCookies()` - Parse cookie header
- `serializeCookie()` - Create Set-Cookie header

**Dependencies:** `@nextrush/types`

**Runtime Compatibility:** ✅ All

**Example:**
```typescript
import { cookies } from '@nextrush/cookies';

app.use(cookies());

app.get('/', (ctx) => {
  const sessionId = ctx.cookies.get('session');
  ctx.cookies.set('visited', 'true', { httpOnly: true });
});
```

---

### @nextrush/request-id

**Purpose:** Unique request ID generation and propagation.

**Key Exports:**
- `requestId()` - Request ID middleware

**Dependencies:** `@nextrush/types`

**Runtime Compatibility:** ✅ All

**Example:**
```typescript
import { requestId } from '@nextrush/request-id';

app.use(requestId());

app.get('/', (ctx) => {
  console.log('Request ID:', ctx.state.requestId);
});
```

---

### @nextrush/timer

**Purpose:** Request timing middleware.

**Key Exports:**
- `timer()` - Timing middleware

**Dependencies:** `@nextrush/types`

**Runtime Compatibility:** ✅ All

**Example:**
```typescript
import { timer } from '@nextrush/timer';

app.use(timer());

// Response includes X-Response-Time header
```

---

## DI & Decorator Packages

### @nextrush/di

**Purpose:** Dependency injection container (wraps tsyringe).

**Key Exports:**
- `container` - Global DI container
- `Service()` - Service decorator
- `Repository()` - Repository decorator
- `inject()` - Manual injection
- `createContainer()` - Create child container

**Dependencies:** `tsyringe`, `reflect-metadata`

**Example:**
```typescript
import 'reflect-metadata';
import { Service, container } from '@nextrush/di';

@Service()
class UserService {
  async findAll() { /* ... */ }
}

const userService = container.resolve(UserService);
```

---

### @nextrush/decorators

**Purpose:** Controller and route decorators.

**Key Exports:**
- `@Controller()` - Controller class decorator
- `@Get()`, `@Post()`, `@Put()`, `@Delete()`, `@Patch()` - Route decorators
- `@Body()`, `@Param()`, `@Query()`, `@Headers()` - Parameter decorators
- `@UseGuard()` - Guard decorator

**Dependencies:** `@nextrush/types`, `reflect-metadata`

**Example:**
```typescript
import { Controller, Get, Post, Body, Param } from '@nextrush/decorators';

@Controller('/users')
class UserController {
  @Get()
  findAll() { /* ... */ }

  @Get('/:id')
  findOne(@Param('id') id: string) { /* ... */ }

  @Post()
  create(@Body() data: CreateUserDto) { /* ... */ }
}
```

---

### @nextrush/controllers

**Purpose:** Plugin that connects DI, decorators, and router.

**Key Exports:**
- `controllersPlugin()` - Main plugin
- `HandlerBuilder` - Builds route handlers

**Dependencies:** `@nextrush/di`, `@nextrush/decorators`, `@nextrush/errors`, `@nextrush/router`

**Example:**
```typescript
import { controllersPlugin } from '@nextrush/controllers';

app.plugin(controllersPlugin({
  controllers: [UserController, ProductController],
}));
```

---

## Plugin Packages

### @nextrush/static

**Purpose:** Serve static files.

**Dependencies:** `@nextrush/types`

**Runtime Compatibility:** ✅ Node.js, Bun, Deno (not Edge - no filesystem)

---

### @nextrush/websocket

**Purpose:** WebSocket support.

**Dependencies:** `@nextrush/types`

**Runtime Compatibility:** ✅ All (using native WebSocket APIs)

---

### @nextrush/logger

**Purpose:** Structured logging.

**Dependencies:** `@nextrush/types`

**Runtime Compatibility:** ✅ All

---

## Meta Package

### nextrush

**Purpose:** Convenience package that re-exports all essential packages.

**Re-exports:**
- `@nextrush/core`
- `@nextrush/router`
- `@nextrush/types`
- `@nextrush/errors`

**Example:**
```typescript
import { createApp, createRouter, HttpError } from 'nextrush';
```

---

## Package Size Targets

| Package | Max LOC | Actual |
|---------|---------|--------|
| @nextrush/types | 500 | ~400 |
| @nextrush/errors | 600 | ~300 |
| @nextrush/core | 1,500 | ~500 |
| @nextrush/router | 1,000 | ~600 |
| @nextrush/runtime | 500 | ~400 |
| @nextrush/di | 400 | ~200 |
| @nextrush/decorators | 800 | ~500 |
| @nextrush/controllers | 800 | ~600 |
| @nextrush/adapter-* | 500 each | ~300-400 |
| @nextrush/middleware/* | 300 each | ~200-400 |

---

## Test Coverage Summary

| Package | Tests |
|---------|-------|
| @nextrush/core | 52 |
| @nextrush/router | 95 |
| @nextrush/runtime | 45 |
| @nextrush/adapter-node | 60 |
| @nextrush/adapter-bun | 102 |
| @nextrush/adapter-deno | 101 |
| @nextrush/adapter-edge | 106 |
| @nextrush/body-parser | 124 |
| @nextrush/cors | 57 |
| @nextrush/helmet | 64 |
| @nextrush/compression | 151 |
| **Total** | **957** |
