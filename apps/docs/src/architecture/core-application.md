---
title: Core & Application
description: How NextRush Application works — lifecycle, middleware composition, plugin system, and context management.
---

# Core & Application Architecture

> Understanding the Application class, middleware composition, and plugin system that form the heart of NextRush.

## Overview

The `@nextrush/core` package contains:

- **Application** — Main entry point, middleware registration, plugin management
- **Middleware composition** — Koa-style onion model execution
- **Error handling** — Centralized error processing

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Application                                  │
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │ Middleware Stack │  │ Plugin Registry  │  │ Error Handler    │   │
│  │                  │  │                  │  │                  │   │
│  │ [mw1, mw2, ...]  │  │ Map<name, plugin>│  │ onError()        │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘   │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                      callback()                                 │ │
│  │                                                                 │ │
│  │  compose(middlewareStack) → (ctx) => Promise<void>              │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Application Lifecycle

### 1. Creation

```typescript
import { createApp } from '@nextrush/core';

const app = createApp({
  env: 'production',  // 'development' | 'production' | 'test'
  proxy: true,        // Trust proxy headers
});
```

**What happens:**
1. `Application` instance created
2. Empty middleware stack initialized
3. Empty plugin registry initialized
4. Options stored with defaults applied

### 2. Configuration

```typescript
// Register middleware
app.use(cors());
app.use(json());
app.use(helmet());

// Install plugins
app.plugin(loggerPlugin());
await app.pluginAsync(databasePlugin());

// Set error handler
app.onError((error, ctx) => {
  // Custom error handling
});
```

**What happens:**
1. Middleware functions added to stack (order preserved)
2. Plugins installed and registered by name
3. Custom error handler stored

### 3. Running

```typescript
// Adapter calls app.callback() to get handler
const handler = app.callback();

// For each request:
await handler(ctx);
```

**What happens:**
1. `callback()` composes all middleware into single function
2. Composed function called for each request
3. Errors caught and handled

### 4. Shutdown

```typescript
await app.close();
```

**What happens:**
1. `isRunning` set to `false`
2. Plugins destroyed in reverse order (LIFO)
3. Resources cleaned up

---

## Middleware Composition

### The Onion Model

NextRush uses Koa's "onion" middleware model:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Request enters                                                      │
│       │                                                              │
│       ▼                                                              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Middleware 1 (before next)                                   │    │
│  │  ┌─────────────────────────────────────────────────────┐    │    │
│  │  │ Middleware 2 (before next)                           │    │    │
│  │  │  ┌─────────────────────────────────────────────┐    │    │    │
│  │  │  │ Middleware 3 (before next)                   │    │    │    │
│  │  │  │  ┌─────────────────────────────────────┐    │    │    │    │
│  │  │  │  │       Handler (innermost)            │    │    │    │    │
│  │  │  │  └─────────────────────────────────────┘    │    │    │    │
│  │  │  │ Middleware 3 (after next)                    │    │    │    │
│  │  │  └─────────────────────────────────────────────┘    │    │    │
│  │  │ Middleware 2 (after next)                            │    │    │
│  │  └─────────────────────────────────────────────────────┘    │    │
│  │ Middleware 1 (after next)                                    │    │
│  └─────────────────────────────────────────────────────────────┘    │
│       │                                                              │
│       ▼                                                              │
│  Response exits                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### How `compose()` Works

```typescript
export function compose(middleware: Middleware[]): ComposedMiddleware {
  return function composedMiddleware(ctx: Context, next?: Next): Promise<void> {
    let index = -1;

    async function dispatch(i: number): Promise<void> {
      // Prevent multiple next() calls
      if (i <= index) {
        throw new Error('next() called multiple times');
      }
      index = i;

      // Get middleware at index i, or final next
      let fn = middleware[i] ?? (i === middleware.length ? next : undefined);

      if (!fn) return;

      // Set ctx.next() for modern syntax
      if (typeof ctx.setNext === 'function') {
        ctx.setNext(() => dispatch(i + 1));
      }

      // Call middleware
      await fn(ctx, () => dispatch(i + 1));
    }

    return dispatch(0);
  };
}
```

### Execution Example

```typescript
app.use(async (ctx) => {
  console.log('1: before');
  await ctx.next();
  console.log('1: after');
});

app.use(async (ctx) => {
  console.log('2: before');
  await ctx.next();
  console.log('2: after');
});

app.use(async (ctx) => {
  console.log('3: handler');
  ctx.json({ ok: true });
});

// Request execution:
// 1: before
// 2: before
// 3: handler
// 2: after
// 1: after
```

### Middleware Signatures

Both signatures are supported:

```typescript
// Modern (ctx.next())
app.use(async (ctx) => {
  await ctx.next();
});

// Traditional (next parameter)
app.use(async (ctx, next) => {
  await next();
});
```

### Short-Circuiting

Middleware can stop the chain by not calling `next()`:

```typescript
app.use(async (ctx) => {
  if (!ctx.get('authorization')) {
    ctx.status = 401;
    ctx.json({ error: 'Unauthorized' });
    return; // Don't call next() - stops here
  }
  await ctx.next();
});
```

---

## Plugin System

### Plugin Interface

```typescript
interface Plugin {
  /** Unique plugin name */
  name: string;

  /**
   * Install the plugin
   * Can be sync or async
   */
  install(app: Application): void | Promise<void>;

  /**
   * Optional cleanup on shutdown
   */
  destroy?(): void | Promise<void>;
}
```

### Plugin Installation

**Synchronous plugins:**

```typescript
app.plugin(myPlugin);
```

**Asynchronous plugins:**

```typescript
await app.pluginAsync(databasePlugin);
```

### How Plugins Extend the App

Plugins typically:
1. Add middleware
2. Extend context
3. Register routes
4. Add lifecycle hooks

```typescript
const loggerPlugin: Plugin = {
  name: 'logger',

  install(app: Application) {
    // Add middleware
    app.use(async (ctx) => {
      const start = Date.now();
      await ctx.next();
      console.log(`${ctx.method} ${ctx.path} - ${Date.now() - start}ms`);
    });
  }
};
```

### Plugin Order

Plugins are destroyed in reverse installation order:

```typescript
app.plugin(pluginA); // Installed 1st, destroyed last
app.plugin(pluginB); // Installed 2nd, destroyed 2nd
app.plugin(pluginC); // Installed 3rd, destroyed first

// On close():
// pluginC.destroy()
// pluginB.destroy()
// pluginA.destroy()
```

---

## Error Handling

### Error Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        try { await fn(ctx) }                         │
│                                │                                     │
│                                │ throws                              │
│                                ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              catch (error)                                   │    │
│  │                     │                                        │    │
│  │     ┌───────────────┴───────────────┐                        │    │
│  │     │                               │                        │    │
│  │     ▼                               ▼                        │    │
│  │ Custom handler?               Default handler                │    │
│  │     │                               │                        │    │
│  │     ▼                               ▼                        │    │
│  │ app._errorHandler(err, ctx)   defaultErrorHandler()          │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### Custom Error Handler

```typescript
app.onError(async (error, ctx) => {
  // Log error
  console.error(error);

  // Check error type
  if (error instanceof ValidationError) {
    ctx.status = 400;
    ctx.json({ error: error.message, details: error.details });
    return;
  }

  if (error instanceof NotFoundError) {
    ctx.status = 404;
    ctx.json({ error: 'Not found' });
    return;
  }

  // Default
  ctx.status = 500;
  ctx.json({ error: 'Internal server error' });
});
```

### Default Error Handler

When no custom handler is set:

```typescript
private defaultErrorHandler(error: Error, ctx: Context): void {
  // Log in development
  if (!this.isProduction) {
    console.error('Request error:', error);
  }

  // Use error.status if available (HttpError)
  if ('status' in error && typeof error.status === 'number') {
    ctx.status = error.status;
  } else {
    ctx.status = 500;
  }

  // Only expose message in development
  const message = !this.isProduction
    ? error.message
    : 'Internal Server Error';

  ctx.json({ error: message });
}
```

---

## Context Management

### Context Interface

The `Context` object is created by adapters and passed through middleware:

```typescript
interface Context {
  // Request (read-only)
  readonly method: HttpMethod;
  readonly path: string;
  readonly url: string;
  readonly query: Record<string, string>;
  readonly headers: Record<string, string>;
  readonly ip: string;
  body: unknown;
  params: Record<string, string>;

  // Response (writable)
  status: number;
  json(data: unknown): void;
  send(data: string | Buffer): void;
  html(content: string): void;
  redirect(url: string, status?: number): void;
  set(field: string, value: string): void;
  get(field: string): string | undefined;

  // Middleware
  next(): Promise<void>;
  state: Record<string, unknown>;

  // Platform access
  readonly raw: RawHttp;
}
```

### Context Flow

```
Adapter creates Context
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Middleware 1 reads ctx.headers, writes ctx.state                    │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Middleware 2 reads ctx.body, validates                              │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Handler reads ctx.params, calls ctx.json()                          │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
Adapter sends response
```

### State Bag

`ctx.state` is a mutable object for passing data between middleware:

```typescript
// Auth middleware
app.use(async (ctx) => {
  const user = await verifyToken(ctx.get('authorization'));
  ctx.state.user = user;
  await ctx.next();
});

// Handler
app.get('/profile', (ctx) => {
  const user = ctx.state.user;
  ctx.json({ user });
});
```

---

## Performance Considerations

### Middleware Stack Size

Each middleware adds a function call. Keep the stack reasonable:

| Stack Size | Overhead |
|------------|----------|
| 5 middleware | ~0.01ms |
| 20 middleware | ~0.04ms |
| 50 middleware | ~0.1ms |

### Async Overhead

Every `await ctx.next()` creates a promise. For hot paths, consider:

```typescript
// Instead of many small middleware
app.use(cors());
app.use(helmet());
app.use(json());
app.use(compress());

// Consider combining if performance critical
app.use(async (ctx) => {
  setCorsHeaders(ctx);
  setSecurityHeaders(ctx);
  await parseBody(ctx);
  await ctx.next();
  compressResponse(ctx);
});
```

### Plugin Initialization

Plugins with async initialization should use `pluginAsync()`:

```typescript
// ❌ This will throw
app.plugin(databasePlugin); // async install()

// ✅ Correct
await app.pluginAsync(databasePlugin);
```

---

## Internal API

### Application Class

| Property/Method | Type | Description |
|-----------------|------|-------------|
| `options` | `ApplicationOptions` | Readonly configuration |
| `isProduction` | `boolean` | `env === 'production'` |
| `isRunning` | `boolean` | Server is active |
| `middlewareCount` | `number` | Stack size |
| `use(...mw)` | `this` | Register middleware |
| `plugin(p)` | `this` | Install sync plugin |
| `pluginAsync(p)` | `Promise<this>` | Install async plugin |
| `getPlugin(name)` | `Plugin \| undefined` | Get installed plugin |
| `hasPlugin(name)` | `boolean` | Check if installed |
| `onError(handler)` | `this` | Set error handler |
| `callback()` | `(ctx) => Promise<void>` | Get request handler |
| `start()` | `void` | Mark as running |
| `close()` | `Promise<void>` | Graceful shutdown |

### Middleware Composition

| Function | Description |
|----------|-------------|
| `compose(mw[])` | Compose middleware into single function |
| `isMiddleware(fn)` | Type guard for middleware |
| `flattenMiddleware(arr)` | Flatten nested arrays |

---

## See Also

- [Router Internals](./routing) — Route matching architecture
- [Adapter Architecture](./adapters) — Platform bridging
- [Error Handling](./error-handling) — Error hierarchy
