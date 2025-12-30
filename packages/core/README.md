# @nextrush/core

> The minimal core of NextRush: Application, middleware composition, and plugin system.

## The Problem

Backend frameworks often bundle everything together. You pay for features you don't use:
- Routing logic when you only need middleware composition
- Body parsing when you're building a proxy
- Complex plugin systems when you need simple extensibility

This creates bloat. Cold starts suffer. Memory usage grows. Debugging becomes harder.

## How NextRush Approaches This

`@nextrush/core` provides **only the essentials**:

- **Application**: Middleware registration and plugin management
- **Middleware Composition**: Koa-style `compose()` for async middleware chains
- **Plugin System**: Simple, typed plugin interface
- **Error Handling**: Configurable error handlers with production/development modes

Everything else (routing, body parsing, authentication) lives in separate packages. You install what you use.

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
import { createApp } from '@nextrush/core';
import { listen } from '@nextrush/adapter-node';

const app = createApp();

// Logging middleware
app.use(async (ctx, next) => {
  console.log(`→ ${ctx.method} ${ctx.path}`);
  await next();
  console.log(`← ${ctx.status}`);
});

// Handler
app.use(async (ctx) => {
  ctx.json({ message: 'Hello World' });
});

listen(app, { port: 3000 });
```

## Application

### Creating an Application

```typescript
import { createApp, Application } from '@nextrush/core';

// Factory function (recommended)
const app = createApp();

// With options
const app = createApp({
  env: 'production',  // 'development' | 'production' | 'test'
  proxy: true,        // Trust proxy headers (X-Forwarded-*)
});
```

### Application Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `env` | `'development' \| 'production' \| 'test'` | `process.env.NODE_ENV` | Environment mode |
| `proxy` | `boolean` | `false` | Trust proxy headers |

### Application Properties

```typescript
app.isProduction;    // boolean - true if env === 'production'
app.isRunning;       // boolean - true after app.start() called
app.middlewareCount; // number - count of registered middleware
app.options;         // ApplicationOptions - readonly config
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
app.use(cors())
   .use(helmet())
   .use(json());
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

## Context

The Context (`ctx`) object provides access to request data and response methods.

### Request Properties (Read-only)

| Property | Type | Description |
|----------|------|-------------|
| `ctx.method` | `HttpMethod` | HTTP method (GET, POST, etc.) |
| `ctx.url` | `string` | Full URL with query string |
| `ctx.path` | `string` | Path without query string |
| `ctx.query` | `QueryParams` | Parsed query parameters |
| `ctx.headers` | `IncomingHeaders` | Request headers |
| `ctx.ip` | `string` | Client IP address |
| `ctx.runtime` | `Runtime` | Current JS runtime |
| `ctx.raw` | `RawHttp` | Raw platform objects |
| `ctx.bodySource` | `BodySource` | Body stream for parsers |

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

| Property/Method | Description |
|-----------------|-------------|
| `ctx.status` | Set HTTP status code (default: 200) |
| `ctx.json(data)` | Send JSON response |
| `ctx.send(data)` | Send text, buffer, or stream |
| `ctx.html(content)` | Send HTML response |
| `ctx.redirect(url, status?)` | Redirect to URL |
| `ctx.set(field, value)` | Set response header |
| `ctx.get(field)` | Get request header |

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
ctx.raw.req;  // IncomingMessage
ctx.raw.res;  // ServerResponse

// Bun/Deno/Edge adapters
ctx.raw.req;  // Request (Web API)
```

## Error Handling

### Custom Error Handler

```typescript
app.onError((error, ctx) => {
  console.error('Request failed:', error);

  if (error.status) {
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

## Plugins

### Using Plugins

```typescript
import { createApp } from '@nextrush/core';
import { eventsPlugin } from '@nextrush/events';
import { loggerPlugin } from '@nextrush/logger';

const app = createApp();

// Synchronous plugins
app.plugin(eventsPlugin());
app.plugin(loggerPlugin({ level: 'info' }));

// Async plugins
await app.pluginAsync(databasePlugin({ uri: '...' }));
```

### Plugin API

```typescript
app.plugin(plugin);              // Install sync plugin
await app.pluginAsync(plugin);   // Install async plugin
app.hasPlugin('plugin-name');    // Check if installed
app.getPlugin('plugin-name');    // Get plugin instance
```

### Creating Plugins

```typescript
import type { Plugin } from '@nextrush/types';

interface MyPluginOptions {
  debug: boolean;
}

function myPlugin(options: MyPluginOptions): Plugin {
  return {
    name: 'my-plugin',

    install(app) {
      // Add middleware
      app.use(async (ctx, next) => {
        if (options.debug) {
          console.log(`${ctx.method} ${ctx.path}`);
        }
        await next();
      });
    },

    destroy() {
      // Cleanup on app.close()
    },
  };
}

// Usage
app.plugin(myPlugin({ debug: true }));
```

## Middleware Composition

### compose()

Combine multiple middleware into one:

```typescript
import { compose } from '@nextrush/core';

const security = compose([
  cors(),
  helmet(),
  rateLimit(),
]);

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

## Lifecycle

### Starting

```typescript
// Adapters call app.start() internally
app.start();
console.log(app.isRunning); // true
```

### Shutdown

```typescript
// Graceful shutdown
await app.close();

// This:
// 1. Sets isRunning = false
// 2. Calls destroy() on all plugins (reverse order)
// 3. Clears plugin registry
```

## Request Handler

Get the callback for HTTP server integration:

```typescript
const callback = app.callback();

// Use with Node.js http
import http from 'http';
http.createServer(callback).listen(3000);

// Or use an adapter (recommended)
import { listen } from '@nextrush/adapter-node';
listen(app, { port: 3000 });
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
  ComposedMiddleware,

  // Context & Middleware (from @nextrush/types)
  Context,
  ContextState,
  Middleware,
  Next,
  Plugin,
  RouteHandler,
  RouteParams,
  QueryParams,
  HttpMethod,
  HttpStatusCode,
} from '@nextrush/core';
```

## Runtime Compatibility

| Runtime | Supported |
|---------|-----------|
| Node.js 20+ | ✅ |
| Bun 1.0+ | ✅ |
| Deno 2.0+ | ✅ |
| Cloudflare Workers | ✅ |
| Vercel Edge Runtime | ✅ |

The core package uses only standard JavaScript APIs. Runtime-specific code lives in adapters.

## Package Size

- **Bundle**: ~10 KB
- **Types**: ~8 KB
- **Dependencies**: Only `@nextrush/types`

## License

MIT
