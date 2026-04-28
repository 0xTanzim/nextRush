# Core Concepts

The NextRush core (`@nextrush/core`) provides three building blocks: the **Application**, the **Context API**, and the **Middleware** composition system.

---

## Application

`createApp()` returns an `Application` instance that manages middleware registration, router mounting, plugin installation, and error handling.

```typescript
import { createApp, listen } from 'nextrush';

const app = createApp({
  env: 'production',  // 'development' | 'production' | 'test'
  proxy: false,       // Trust X-Forwarded-* headers
  logger: console,    // Logger: { error, warn, info, debug }
});
```

### Middleware Registration

```typescript
// Single middleware
app.use(async (ctx, next) => {
  console.log(`${ctx.method} ${ctx.path}`);
  await next();
});

// Multiple middleware at once
app.use(cors(), helmet(), json());
```

### Router Mounting

```typescript
const users = createRouter();
users.get('/', listUsers);
users.post('/', createUser);

// Mount at /api/users — Hono-style
app.route('/api/users', users);
```

### Plugin Installation

```typescript
// Sync plugin
app.plugin(loggerPlugin({ level: 'info' }));

// Async plugin
await app.plugin(databasePlugin({ uri: '...' }));
```

### Error Handler

```typescript
app.setErrorHandler((error, ctx) => {
  if (error instanceof ValidationError) {
    ctx.status = 400;
    ctx.json({ error: error.message });
    return;
  }
  ctx.status = 500;
  ctx.json({ error: 'Internal Server Error' });
});
```

### Lifecycle

```typescript
// Configuration is frozen after the server starts listening.
// You cannot call use(), route(), or plugin() after listen().
listen(app, 3000);

// Graceful shutdown
const errors = await app.close();  // destroys plugins in reverse order
```

---

## Context API

Every middleware and route handler receives a `ctx` (Context) object that wraps the incoming request and outgoing response.

### Request (Input)

```typescript
ctx.method;            // 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | ...
ctx.path;              // '/users/123'
ctx.params;            // { id: '123' }            — route parameters
ctx.query;             // { page: '1', limit: '20' } — query string
ctx.body;              // parsed request body (requires @nextrush/body-parser)
ctx.headers;           // Record<string, string | string[] | undefined>
ctx.get('header');     // get a specific request header (case-insensitive)
ctx.state;             // Record<string, unknown> — mutable state bag for middleware
```

### Response (Output)

```typescript
ctx.status = 201;               // set HTTP status code
ctx.json(data);                 // send JSON response
ctx.send(text);                 // send text/buffer response
ctx.html(str);                  // send HTML response
ctx.redirect(url);              // redirect (default 302)
ctx.redirect(url, 301);         // redirect with custom status
ctx.set('X-Custom', 'value');   // set a response header
```

### Middleware Control

```typescript
await ctx.next();   // call the next middleware in the stack
// or
await next();       // next is also passed as a second argument
```

---

## Middleware

NextRush uses Koa-style async middleware. Every middleware is an `async (ctx, next) => void` function.

### Writing Middleware

```typescript
import type { Middleware } from 'nextrush';

const requestLogger: Middleware = async (ctx, next) => {
  const start = Date.now();
  await next();                                    // downstream first
  const ms = Date.now() - start;
  console.log(`${ctx.method} ${ctx.path} — ${ms}ms`);
};

app.use(requestLogger);
```

### Middleware Execution Order

Middleware forms an onion: each layer wraps everything inside it.

```
→ middleware 1 (before next)
  → middleware 2 (before next)
    → route handler
  ← middleware 2 (after next)
← middleware 1 (after next)
```

### State Sharing

Use `ctx.state` to pass data between middleware:

```typescript
const authMiddleware: Middleware = async (ctx, next) => {
  const token = ctx.get('authorization');
  if (!token) {
    ctx.status = 401;
    ctx.json({ error: 'Unauthorized' });
    return;  // stop the chain — do not call next()
  }
  ctx.state.user = await verifyToken(token);
  await next();
};
```

---

## Plugin System

Plugins extend the application with optional capabilities. A plugin implements the `Plugin` interface:

```typescript
import type { Plugin, Application } from 'nextrush';

const myPlugin: Plugin = {
  name: 'my-plugin',

  install(app: Application): void | Promise<void> {
    app.use(/* middleware */);
  },
};

app.plugin(myPlugin);
```

### Lifecycle Hooks (PluginWithHooks)

Plugins can also respond to request lifecycle events:

```typescript
import type { PluginWithHooks, Context } from 'nextrush';

const observabilityPlugin: PluginWithHooks = {
  name: 'observability',

  install(app) {
    // register global middleware here if needed
  },

  extendContext(ctx: Context) {
    // add custom properties to every context
    ctx.state.requestId = crypto.randomUUID();
  },

  async onRequest(ctx: Context) {
    // runs before middleware chain
  },

  async onResponse(ctx: Context) {
    // runs after middleware chain completes
  },

  async onError(error: Error, ctx: Context) {
    // runs when middleware chain throws
  },

  destroy() {
    // cleanup when app.close() is called
  },
};
```

### Plugin Guards

```typescript
app.hasPlugin('my-plugin');         // boolean
app.getPlugin('my-plugin');         // Plugin | undefined
```
