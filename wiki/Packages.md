# Packages

Complete reference for all NextRush packages.

---

## Meta Package

| Package | Description | Install |
|---|---|---|
| `nextrush` | Meta package — functional API, Node.js adapter, core errors | `pnpm add nextrush` |

The `nextrush` package re-exports everything from `@nextrush/core`, `@nextrush/router`, `@nextrush/adapter-node`, `@nextrush/errors`, and `@nextrush/types`.

```typescript
import { createApp, createRouter, listen } from 'nextrush';
import { NotFoundError, errorHandler } from 'nextrush';
import type { Context, Middleware, Plugin } from 'nextrush';
```

For the class-based API:

```typescript
// Functional core + class entry points live in separate entry
import { Controller, Get, Service, controllersPlugin } from 'nextrush/class';
// or install packages individually (recommended)
```

---

## Core Packages

These are included in `nextrush` and rarely need to be installed separately.

| Package | Description | LOC limit |
|---|---|---|
| `@nextrush/types` | Shared TypeScript interfaces and type definitions | 500 |
| `@nextrush/errors` | HTTP error hierarchy, factory functions, error middleware | 600 |
| `@nextrush/core` | `Application`, middleware composition, plugin system | 1,500 |
| `@nextrush/router` | High-performance segment-trie router | 1,000 |
| `@nextrush/runtime` | Runtime detection (Node.js, Bun, Deno, Edge) | — |

### `@nextrush/types`

```typescript
import type {
  Context, Middleware, Next, Plugin, PluginWithHooks,
  RouteHandler, HttpMethod, HttpStatusCode,
  QueryParams, RouteParams, ContextState, Runtime,
} from '@nextrush/types';

import { ContentType, HttpStatus } from '@nextrush/types';
```

### `@nextrush/errors`

```typescript
import {
  HttpError, NextRushError,
  // 4xx
  BadRequestError, UnauthorizedError, ForbiddenError, NotFoundError,
  MethodNotAllowedError, ConflictError, UnprocessableEntityError,
  TooManyRequestsError,
  // 5xx
  InternalServerError, NotImplementedError, BadGatewayError,
  ServiceUnavailableError, GatewayTimeoutError,
  // Validation
  ValidationError, RequiredFieldError, TypeMismatchError,
  // Factories
  notFound, badRequest, unauthorized, createError, isHttpError,
  // Middleware
  errorHandler, notFoundHandler, catchAsync,
} from '@nextrush/errors';
```

### `@nextrush/core`

```typescript
import { createApp, Application, compose } from '@nextrush/core';
import type { ApplicationOptions, ErrorHandler, Logger } from '@nextrush/core';
```

### `@nextrush/router`

```typescript
import { createRouter, Router } from '@nextrush/router';
import type { RouterOptions } from '@nextrush/router';
```

---

## Adapters

| Package | Runtime | Install |
|---|---|---|
| `@nextrush/adapter-node` | Node.js ≥22 (included in `nextrush`) | `pnpm add nextrush` |
| `@nextrush/adapter-bun` | Bun | `pnpm add @nextrush/adapter-bun` |
| `@nextrush/adapter-deno` | Deno | `pnpm add @nextrush/adapter-deno` |
| `@nextrush/adapter-edge` | Cloudflare Workers, Vercel Edge | `pnpm add @nextrush/adapter-edge` |

```typescript
// Node.js
import { listen, serve, createHandler } from '@nextrush/adapter-node';

// Bun
import { listen } from '@nextrush/adapter-bun';

// Deno
import { listen } from '@nextrush/adapter-deno';

// Edge (Cloudflare Workers / Vercel)
import { toFetchHandler } from '@nextrush/adapter-edge';
const handler = toFetchHandler(app);
export default { fetch: handler };
```

---

## Middleware

All middleware is installed and imported separately.

| Package | Description | Install |
|---|---|---|
| `@nextrush/body-parser` | JSON, URL-encoded, text, raw body parsing | `pnpm add @nextrush/body-parser` |
| `@nextrush/cors` | OWASP-compliant CORS with presets | `pnpm add @nextrush/cors` |
| `@nextrush/helmet` | Security headers (CSP, HSTS, X-Frame-Options, …) | `pnpm add @nextrush/helmet` |
| `@nextrush/csrf` | CSRF protection (Signed Double-Submit Cookie) | `pnpm add @nextrush/csrf` |
| `@nextrush/rate-limit` | Token Bucket, Sliding Window, Fixed Window | `pnpm add @nextrush/rate-limit` |
| `@nextrush/cookies` | Cookie parsing and serialization | `pnpm add @nextrush/cookies` |
| `@nextrush/compression` | Gzip/Deflate/Brotli response compression | `pnpm add @nextrush/compression` |
| `@nextrush/multipart` | Multipart form-data with memory/disk storage | `pnpm add @nextrush/multipart` |
| `@nextrush/request-id` | Request ID generation and propagation | `pnpm add @nextrush/request-id` |
| `@nextrush/timer` | Request timing (X-Response-Time, Server-Timing) | `pnpm add @nextrush/timer` |

---

## Plugins

| Package | Description | Install |
|---|---|---|
| `@nextrush/controllers` | Decorator-based controllers with auto-discovery | `pnpm add @nextrush/controllers` |
| `@nextrush/di` | Dependency injection container (wraps tsyringe) | `pnpm add @nextrush/di` |
| `@nextrush/decorators` | `@Controller`, `@Get`, `@Body`, `@UseGuard`, … | `pnpm add @nextrush/decorators` |
| `@nextrush/logger` | Structured logging plugin | `pnpm add @nextrush/logger` |
| `@nextrush/static` | Static file serving | `pnpm add @nextrush/static` |
| `@nextrush/websocket` | WebSocket plugin | `pnpm add @nextrush/websocket` |
| `@nextrush/template` | Template rendering (multiple engine support) | `pnpm add @nextrush/template` |
| `@nextrush/events` | Type-safe application event emitter | `pnpm add @nextrush/events` |

---

## Development Tools

| Package | Description | Install |
|---|---|---|
| `@nextrush/dev` | Hot reload dev server, production build, code generators | `pnpm add -D @nextrush/dev` |
| `create-nextrush` | Project scaffolder (`pnpm create nextrush`) | `pnpm create nextrush` |

### CLI — `@nextrush/dev`

```bash
npx nextrush dev                          # Hot reload dev server
npx nextrush build                        # Production build

# Code generators
npx nextrush generate controller user     # @Controller class
npx nextrush g service user-profile       # @Service class
npx nextrush g middleware request-logger  # Middleware function
npx nextrush g guard auth                 # Guard function/class
npx nextrush g route product             # Functional route
```

---

## Package Dependency Graph

```
@nextrush/types
    ↓
@nextrush/errors
    ↓
@nextrush/core ─────────────────────┐
    ↓                                │
@nextrush/router                    │
    ↓                                │
@nextrush/di                        │
    ↓                                │
@nextrush/decorators                │
    ↓                                │
@nextrush/controllers ──────────────┤
    ↓                                │
@nextrush/adapter-*                 │
    ↓                                │
@nextrush/middleware/*              │
    ↓                                │
nextrush (meta) ─────────────────────┘
```
