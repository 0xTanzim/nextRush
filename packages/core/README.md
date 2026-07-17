# @nextrush/core

> The minimal core of NextRush: Application, middleware composition, and the extension model.

**Support tier:** Public — core (stable, semver-guarded). See [ADR-0005](../../docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md).

## The Problem

Backend frameworks often bundle everything together. You pay for features you don't use:

- Routing logic when you only need middleware composition
- Body parsing when you're building a proxy
- A heavyweight plugin system when almost every feature is just middleware

This creates bloat. Cold starts suffer. Memory usage grows. Debugging becomes harder.

## How NextRush Approaches This

`@nextrush/core` provides **only the essentials**:

- **Application**: Middleware registration, an optional app-owned router, and lifecycle (`ready()`/`close()`)
- **Middleware Composition**: Koa-style `compose()` for async middleware chains
- **Extension Model**: A rare, explicit primitive (`app.extend()`) for long-lived services — most features are middleware, not extensions
- **Error Handling**: Configurable error handlers with production/development modes

Everything else (routing, body parsing, authentication) lives in separate packages. You install what you use.

`@nextrush/core`'s `createApp()` is a minimal engine — routing is bring-your-own (`createApp({ router })`, or mount one later with `app.route()`). If you want a router wired in automatically, use `nextrush`'s `createApp()` (the meta package) instead; most user-facing docs and examples in this README use that batteries-included form.

## Mental Model

Think of the core as a **middleware pipeline manager**:

```
Request → [Middleware 1] → [Middleware 2] → [Handler] → [Middleware 2] → [Middleware 1] → Response
              ↓                ↓              ↓             ↑                ↑
          Before           Before          Execute       After            After
```

Each middleware can:

1. Do something before calling `ctx.next()` or `next()`
2. Call `await ctx.next()` to pass control downstream
3. Do something after `ctx.next()` returns

This is the "onion model" - requests flow inward, responses flow outward.

## Installation

```bash
pnpm add @nextrush/core
```

## Quick Start

```typescript
import { createApp, createRouter } from '@nextrush/core';
import { listen } from '@nextrush/adapter-node';

const router = createRouter();
router.get('/', (ctx) => ctx.json({ message: 'Hello World' }));

// @nextrush/core's createApp() is bring-your-own-router — pass one explicitly.
const app = createApp({ router });

app.use(async (ctx, next) => {
  console.log(`→ ${ctx.method} ${ctx.path}`);
  await next();
  console.log(`← ${ctx.status}`);
});

listen(app, 8080);
```

> **Note:** `createRouter` is exported by `@nextrush/router`, not `@nextrush/core`. The import above works because `nextrush` (the meta package) re-exports both — using `@nextrush/core` directly, install `@nextrush/router` separately.

## Application

### Creating an Application

```typescript
import { createApp, Application } from '@nextrush/core';

// Factory function (recommended)
const app = createApp();

// With options
const app = createApp({
  env: 'production', // 'development' | 'production' | 'test'
  proxy: true, // Trust proxy headers (X-Forwarded-*)
});
```

### Application Options

| Option   | Type                                      | Default         | Description                                             |
| -------- | ----------------------------------------- | --------------- | ------------------------------------------------------- |
| `env`    | `'development' \| 'production' \| 'test'` | `'development'` | Environment mode                                        |
| `proxy`  | `boolean`                                 | `false`         | Trust proxy headers                                     |
| `logger` | `Logger`                                  | No-op (silent)  | Pluggable logger. Pass `console` for quick dev logging. |

### Application Properties

```typescript
app.isProduction; // boolean - true if env === 'production'
app.isRunning; // boolean - true after app.start() called
app.isReady; // boolean - true after app.ready() has booted the app
app.middlewareCount; // number - count of registered middleware
app.extensionCount; // number - count of registered extensions
app.options; // ApplicationOptions - readonly config
app.logger; // Logger - readonly configured logger instance
app.router; // Router | undefined - the app-owned router, if configured
app.container; // Container | undefined - the app-owned DI container, if configured
```

## Middleware

### Registration

```typescript
// Single middleware
app.use(async (ctx, next) => {
  await next();
});

// Multiple middleware
app.use(middleware1, middleware2, middleware3);

// Method chaining
app.use(cors()).use(helmet()).use(json());
```

### Two Syntax Styles

NextRush supports both modern and traditional Koa-style middleware:

```typescript
// Modern syntax (ctx.next)
app.use(async (ctx) => {
  console.log('Before');
  await ctx.next();
  console.log('After');
});

// Traditional Koa syntax (next parameter)
app.use(async (ctx, next) => {
  console.log('Before');
  await next();
  console.log('After');
});
```

Both styles work identically. Use whichever you prefer.

### Middleware Order

Middleware executes in registration order (onion model):

```typescript
app.use(async (ctx, next) => {
  console.log('1: Start');
  await next();
  console.log('1: End');
});

app.use(async (ctx, next) => {
  console.log('2: Start');
  await next();
  console.log('2: End');
});

app.use(async (ctx) => {
  console.log('3: Handler');
  ctx.json({ ok: true });
});

// Output:
// 1: Start
// 2: Start
// 3: Handler
// 2: End
// 1: End
```

### Conditional Middleware

```typescript
app.use(async (ctx, next) => {
  // Skip middleware for health checks
  if (ctx.path === '/health') {
    return next();
  }

  // Apply logic to other routes
  const start = Date.now();
  await next();
  console.log(`${ctx.path} took ${Date.now() - start}ms`);
});
```

### Early Termination

Skip remaining middleware by not calling `next()`:

```typescript
app.use(async (ctx, next) => {
  if (!ctx.get('Authorization')) {
    ctx.status = 401;
    ctx.json({ error: 'Unauthorized' });
    return; // Don't call next()
  }
  await next();
});
```

## Routing

The app-owned router (`app.router`) powers verb methods directly on `Application` — no
separate router mounting step required when one is configured:

```typescript
app.get('/users', (ctx) => ctx.json([]));
app.get('/users/:id', (ctx) => ctx.json({ id: ctx.params.id }));
app.post('/users', (ctx) => ctx.json({ created: true }));
app.put('/users/:id', handler);
app.patch('/users/:id', handler);
app.delete('/users/:id', handler);
app.head('/users/:id', handler);
app.all('/webhook', handler); // matches every HTTP method
```

`@nextrush/core`'s `createApp()` has no router by default — calling `app.get()` without one
throws `"No router configured"`. Pass a router explicitly (`createApp({ router: createRouter() })`)
or mount one with `app.route()`. The `nextrush` meta package's `createApp()` injects a router
automatically.

> **Note:** there is intentionally no `app.options()` verb method — it would collide with the
> `app.options` configuration property. Register `OPTIONS` routes via `app.all()`, the router
> directly, or let CORS middleware handle preflight.

Routes registered via `app.get`/`app.post`/etc. always run **after** all middleware — the
app-owned router is mounted last, at `app.ready()`.

## Context

The Context (`ctx`) object provides access to request data and response methods.

### Request Properties (Read-only)

| Property         | Type              | Description                   |
| ---------------- | ----------------- | ----------------------------- |
| `ctx.method`     | `HttpMethod`      | HTTP method (GET, POST, etc.) |
| `ctx.url`        | `string`          | Full URL with query string    |
| `ctx.path`       | `string`          | Path without query string     |
| `ctx.query`      | `QueryParams`     | Parsed query parameters       |
| `ctx.headers`    | `IncomingHeaders` | Request headers               |
| `ctx.ip`         | `string`          | Client IP address             |
| `ctx.runtime`    | `Runtime`         | Current JS runtime            |
| `ctx.raw`        | `RawHttp`         | Raw platform objects          |
| `ctx.bodySource` | `BodySource`      | Body stream for parsers       |

### Request Body

```typescript
// ctx.body is set by body parser middleware
import { json } from '@nextrush/body-parser';

app.use(json());

app.post('/users', async (ctx) => {
  const { name, email } = ctx.body as CreateUserDto;
  ctx.json({ name, email });
});
```

### Route Parameters

```typescript
// Set by router when route matches
app.get('/users/:id', (ctx) => {
  const { id } = ctx.params;
  ctx.json({ id });
});
```

### Response

| Property/Method              | Description                         |
| ---------------------------- | ----------------------------------- |
| `ctx.status`                 | Set HTTP status code (default: 200) |
| `ctx.json(data)`             | Send JSON response                  |
| `ctx.send(data)`             | Send text, buffer, or stream        |
| `ctx.html(content)`          | Send HTML response                  |
| `ctx.redirect(url, status?)` | Redirect to URL                     |
| `ctx.set(field, value)`      | Set response header                 |
| `ctx.get(field)`             | Get request header                  |

```typescript
app.use(async (ctx) => {
  // Set status
  ctx.status = 201;

  // Set headers
  ctx.set('X-Request-Id', '12345');
  ctx.set('Cache-Control', 'no-cache');

  // Send JSON
  ctx.json({ created: true });
});
```

### Error Helpers

```typescript
app.use(async (ctx) => {
  // Throw HTTP error
  ctx.throw(404, 'User not found');
  ctx.throw(401); // Uses default message

  // Assert condition
  ctx.assert(user, 404, 'User not found');
  ctx.assert(user.isAdmin, 403, 'Admin required');
});
```

### State

Share data between middleware:

```typescript
// Auth middleware
app.use(async (ctx, next) => {
  ctx.state.user = await validateToken(ctx.get('Authorization'));
  await next();
});

// Handler
app.get('/profile', (ctx) => {
  const user = ctx.state.user;
  ctx.json({ user });
});
```

### Raw Access

Access platform-specific objects:

```typescript
// Node.js adapter
ctx.raw.req; // IncomingMessage
ctx.raw.res; // ServerResponse

// Bun/Deno/Edge adapters
ctx.raw.req; // Request (Web API)
```

## Error Handling

### Custom Error Handler

```typescript
app.setErrorHandler((error, ctx) => {
  console.error('Request failed:', error);

  if ('status' in error && typeof error.status === 'number') {
    ctx.status = error.status;
  } else {
    ctx.status = 500;
  }

  ctx.json({
    error: error.message,
    code: error.code || 'UNKNOWN',
  });
});
```

> **Note:** `app.onError()` was removed, not deprecated. Use `app.setErrorHandler()`.

### Default Behavior

Without a custom handler:

- **Development**: Error message exposed, stack logged
- **Production**: Generic "Internal Server Error" message

```typescript
// Production mode hides sensitive details
const app = createApp({ env: 'production' });

app.use(async () => {
  throw new Error('Database connection failed'); // User sees "Internal Server Error"
});
```

### Error Classes

```typescript
import {
  HttpError,
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  InternalServerError,
} from '@nextrush/core';

app.use(async (ctx) => {
  throw new NotFoundError('User not found');
  throw new BadRequestError('Invalid email');
  throw new UnauthorizedError('Token expired');
});
```

## Extensions

Most NextRush features are **middleware** (`app.use(fn())`) — cors, helmet, body-parser,
logger, static, rate-limit, template, and openapi all work this way, and cover roughly 99%
of application code. A handful of framework/runtime-infrastructure packages need something
with a longer lifecycle — a boot step, app-level state, and a teardown hook. That rare case
(roughly 0.1% of packages, e.g. `@nextrush/events`) is an **Extension**.

If you're deciding how to package a feature: is it "does something on each request"? Use
middleware. Is it "wires up a long-lived service the whole app depends on"? Use an extension.

### Registering an Extension

```typescript
import { createApp } from '@nextrush/core';
import { events } from '@nextrush/events';

const app = createApp({ router });

app.extend(events()); // queues — setup() runs later, at ready()
await app.ready(); // boots every registered extension, in registration order

app.events.emit('server:started', {}); // decorated onto the app by events()'s setup()
```

`app.extend()` is synchronous and chainable (`app.extend(a).extend(b)`). The extension's
`setup()` does not run immediately — it runs once, in registration order, when `app.ready()`
is called. Adapters (`listen`, `serve`) call `app.ready()` for you before the server starts;
call it yourself only if you're driving the request handler without an adapter.

After `ready()` resolves, the app's configuration is frozen — `use()`, `route()`, and
`extend()` all throw if called again.

### Writing an Extension

```typescript
import type { Extension } from '@nextrush/types';

export function myExtension(): Extension {
  return {
    name: 'my-extension',
    needs: [], // optional: other extension names that must be registered first
    setup(ctx) {
      // ctx: { app, logger, env, name, container?, decorate }
      ctx.decorate('myThing', someValue); // throws on name collision
      ctx.app.use(someMiddleware);
    },
    destroy() {
      // cleanup, runs in reverse registration order at app.close()
    },
  };
}
```

`ctx.decorate(name, value)` is the only way to attach app-level state — there is
intentionally **no public `app.decorate()`**; it exists only inside `setup()` via
`ExtensionContext`. `app.hasDecorator(name)` is the public, read-only collision check.
Give consumers a typed surface with module augmentation:

```typescript
declare module '@nextrush/core' {
  interface Application {
    myThing: Foo;
  }
}
```

An extension can declare `needs: ['other-extension-name']` to assert (not auto-sort) that
another extension was registered earlier — `ready()` throws if the dependency is missing.

## Middleware Composition

### compose()

Combine multiple middleware into one:

```typescript
import { compose } from '@nextrush/core';

const security = compose([cors(), helmet(), rateLimit()]);

app.use(security);
```

### Utilities

```typescript
import { isMiddleware, flattenMiddleware } from '@nextrush/core';

// Check if value is middleware
isMiddleware(fn); // true/false

// Flatten nested arrays
flattenMiddleware([mw1, [mw2, mw3]]); // [mw1, mw2, mw3]
```

## Router Composition

Mount routers directly on the application using `app.route()` — Hono-style composition:

```typescript
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';

const app = createApp();

// Create feature routers
const users = createRouter();
users.get('/', (ctx) => ctx.json([]));
users.get('/:id', (ctx) => ctx.json({ id: ctx.params.id }));

const posts = createRouter();
posts.get('/', (ctx) => ctx.json([]));

// Mount directly — clean like Hono!
app.route('/api/users', users);
app.route('/api/posts', posts);
```

### Benefits over Classic Pattern

| Classic Pattern                                                     | Hono-Style Composition       |
| ------------------------------------------------------------------- | ---------------------------- |
| `router.use('/users', usersRouter)` then `app.use(router.routes())` | `app.route('/users', users)` |
| Requires main router                                                | Direct mounting              |
| Extra `.routes()` call                                              | No extra calls               |

### Classic Pattern Still Works

```typescript
// The traditional approach still works
const router = createRouter();
router.use('/users', usersRouter);
router.use('/posts', postsRouter);
app.route('/', router);
```

## Lifecycle

### Starting

```typescript
// Adapters call app.ready() then app.start() internally
await app.ready();
app.start();
console.log(app.isRunning); // true
```

### Shutdown

```typescript
// Graceful shutdown — returns errors from extensions that failed to destroy
const errors = await app.close();

// What happens:
// 1. Sets isRunning = false
// 2. Calls destroy() on all extensions (reverse registration order), via Promise.allSettled
// 3. Removes decorations so the instance can be re-booted (e.g. in tests)
// 4. Clears the extension registry and resets isReady
// 5. Returns Error[] (empty on success)
```

## Request Handler

Get the callback for HTTP server integration:

```typescript
const callback = app.callback();

// Use with Node.js http
import http from 'http';
http.createServer(callback).listen(8080);

// Or use an adapter (recommended)
import { listen } from '@nextrush/adapter-node';
listen(app, 8080);
```

## API Reference

### Exports

```typescript
import {
  // Application
  createApp,
  Application,

  // Middleware
  compose,
  isMiddleware,
  flattenMiddleware,

  // Errors
  HttpError,
  NextRushError,
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  InternalServerError,
  createHttpError,

  // Re-exports from @nextrush/types
  HttpStatus,
  ContentType,
} from '@nextrush/core';
```

### Types

```typescript
import type {
  // Application
  ApplicationOptions,
  ErrorHandler,
  ListenCallback,
  Logger,
  Routable,
  ComposedMiddleware,

  // Context & Middleware (from @nextrush/types)
  Context,
  ContextState,
  Middleware,
  Next,
  Extension,
  ExtensionContext,
  RouteHandler,
  RouteParams,
  QueryParams,
  HttpMethod,
  HttpStatusCode,
} from '@nextrush/core';
```

## Runtime Compatibility

| Runtime             | Supported |
| ------------------- | --------- |
| Node.js 22+         | ✅        |
| Bun 1.0+            | ✅        |
| Deno 2.0+           | ✅        |
| Cloudflare Workers  | ✅        |
| Vercel Edge Runtime | ✅        |

The core package uses only standard JavaScript APIs. Runtime-specific code lives in adapters.

## Package Size

- **Bundle**: ~10 KB
- **Types**: ~8 KB
- **Dependencies**: `@nextrush/types`, `@nextrush/errors`

## License

MIT
