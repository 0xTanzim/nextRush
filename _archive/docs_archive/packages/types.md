# @nextrush/types

> Shared TypeScript type definitions for the NextRush framework.

## The Problem

Backend frameworks often have types scattered across packages:
- Circular dependencies between packages
- Inconsistent interfaces across the ecosystem
- Difficulty extending or augmenting types
- Runtime code mixed with type definitions

## Why NextRush Exists Here

`@nextrush/types` is the **single source of truth** for all NextRush types:

| Principle | Benefit |
|-----------|---------|
| Zero dependencies | No transitive dependency issues |
| Zero runtime code | Safe to import anywhere |
| Foundation package | All packages share these types |
| Well-documented | JSDoc comments on every interface |

When you understand these types, you understand NextRush.

## Mental Model

Think of types as contracts:

```
┌─────────────────────────────────────────────────┐
│                 @nextrush/types                  │
│  Context · Middleware · Plugin · Router · HTTP  │
└─────────────────────────────────────────────────┘
         ▲           ▲           ▲           ▲
         │           │           │           │
    @nextrush/   @nextrush/  @nextrush/   Your
       core        router      plugins      App
```

All packages import types from here. No circular dependencies. One source of truth.

## Installation

```bash
pnpm add @nextrush/types
```

## Context Interface

The `Context` interface is the heart of NextRush. It represents a single HTTP request/response cycle.

### Request Properties (Input)

```typescript
import type { Context } from '@nextrush/types';

app.use(async (ctx: Context) => {
  ctx.method;   // 'GET' | 'POST' | 'PUT' | etc.
  ctx.url;      // '/users/123?page=1'
  ctx.path;     // '/users/123'
  ctx.query;    // { page: '1' }
  ctx.headers;  // { 'content-type': 'application/json' }
  ctx.ip;       // '192.168.1.1'
  ctx.params;   // { id: '123' } - set by router
  ctx.body;     // unknown - set by body parser
});
```

### Response Methods (Output)

```typescript
app.use(async (ctx) => {
  // Set status
  ctx.status = 201;

  // Send responses
  ctx.json({ created: true });
  ctx.send('plain text');
  ctx.html('<h1>Hello</h1>');
  ctx.redirect('/new-url', 301);

  // Headers
  ctx.set('X-Request-Id', '123');
  const auth = ctx.get('Authorization');
});
```

### Error Helpers

```typescript
app.use(async (ctx) => {
  // Throw HTTP error
  ctx.throw(404, 'User not found');

  // Assert condition
  ctx.assert(user, 404, 'User not found');
  ctx.assert(user.isAdmin, 403, 'Forbidden');
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
app.use(async (ctx) => {
  ctx.json({ user: ctx.state.user });
});
```

### Raw Access

When you need platform-specific objects:

```typescript
app.use(async (ctx) => {
  // Node.js
  ctx.raw.req;   // IncomingMessage
  ctx.raw.res;   // ServerResponse

  // Bun/Deno/Edge
  ctx.raw.req;   // Request (Web API)

  // Runtime detection
  ctx.runtime;   // 'node' | 'bun' | 'deno' | 'edge'

  // Body source for parsers
  ctx.bodySource.text();
  ctx.bodySource.json();
});
```

## HTTP Types

### Methods

```typescript
import type { HttpMethod, CommonHttpMethod } from '@nextrush/types';
import { HTTP_METHODS } from '@nextrush/types';

const method: HttpMethod = 'GET';
// 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS' | 'TRACE' | 'CONNECT'

const common: CommonHttpMethod = 'POST';
// 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

// Iterate over methods
for (const m of HTTP_METHODS) {
  router.route(m, '/all-methods', handler);
}
```

### Status Codes

```typescript
import { HttpStatus } from '@nextrush/types';
import type { HttpStatusCode } from '@nextrush/types';

// Use constants for clarity
ctx.status = HttpStatus.OK;              // 200
ctx.status = HttpStatus.CREATED;         // 201
ctx.status = HttpStatus.NO_CONTENT;      // 204
ctx.status = HttpStatus.BAD_REQUEST;     // 400
ctx.status = HttpStatus.UNAUTHORIZED;    // 401
ctx.status = HttpStatus.FORBIDDEN;       // 403
ctx.status = HttpStatus.NOT_FOUND;       // 404
ctx.status = HttpStatus.CONFLICT;        // 409
ctx.status = HttpStatus.UNPROCESSABLE_ENTITY;  // 422
ctx.status = HttpStatus.TOO_MANY_REQUESTS;     // 429
ctx.status = HttpStatus.INTERNAL_SERVER_ERROR; // 500
```

### Content Types

```typescript
import { ContentType } from '@nextrush/types';

ctx.set('Content-Type', ContentType.JSON);      // 'application/json'
ctx.set('Content-Type', ContentType.HTML);      // 'text/html'
ctx.set('Content-Type', ContentType.TEXT);      // 'text/plain'
ctx.set('Content-Type', ContentType.FORM);      // 'application/x-www-form-urlencoded'
ctx.set('Content-Type', ContentType.MULTIPART); // 'multipart/form-data'
```

### Headers

```typescript
import type { IncomingHeaders, OutgoingHeaders } from '@nextrush/types';

// Request headers (read-only)
const incoming: IncomingHeaders = ctx.headers;
// Record<string, string | string[] | undefined>

// Response headers (writable)
const outgoing: OutgoingHeaders = {
  'Content-Type': 'application/json',
  'X-Request-Id': '123',
  'Set-Cookie': ['a=1', 'b=2'],
};
```

### Body Types

```typescript
import type { ParsedBody, ResponseBody } from '@nextrush/types';

// After body parser middleware
const body: ParsedBody = ctx.body;
// string | Buffer | Record<string, unknown> | unknown[] | null | undefined

// What you can send back
const response: ResponseBody = { data: 'value' };
// string | Buffer | Readable | Record<string, unknown> | unknown[] | null | undefined
```

## Middleware Types

```typescript
import type { Middleware, Next, RouteHandler } from '@nextrush/types';

// Standard middleware signature
const middleware: Middleware = async (ctx, next) => {
  console.log('Before');
  await next();
  console.log('After');
};

// Route handler (alias for Middleware)
const handler: RouteHandler = async (ctx) => {
  ctx.json({ ok: true });
};
```

## Plugin Types

### Basic Plugin

```typescript
import type { Plugin, ApplicationLike } from '@nextrush/types';

const myPlugin: Plugin = {
  name: 'my-plugin',
  version: '1.0.0',

  install(app: ApplicationLike) {
    app.use(async (ctx, next) => {
      console.log(ctx.path);
      await next();
    });
  },

  destroy() {
    // Cleanup on shutdown
  },
};
```

### Plugin Factory Pattern

```typescript
import type { PluginFactory } from '@nextrush/types';

interface LoggerOptions {
  level: 'debug' | 'info' | 'warn' | 'error';
}

const createLogger: PluginFactory<LoggerOptions> = (options) => ({
  name: 'logger',

  install(app) {
    app.use(async (ctx, next) => {
      if (options?.level === 'debug') {
        console.log(`${ctx.method} ${ctx.path}`);
      }
      await next();
    });
  },
});

// Usage
app.plugin(createLogger({ level: 'debug' }));
```

### Plugin with Hooks

```typescript
import type { PluginWithHooks } from '@nextrush/types';

const advancedPlugin: PluginWithHooks = {
  name: 'advanced',
  install(app) {},

  onRequest(ctx) {
    // Before middleware chain
  },

  onResponse(ctx) {
    // After middleware chain
  },

  onError(error, ctx) {
    // On error
  },

  extendContext(ctx) {
    // Add custom properties
  },
};
```

## Router Types

```typescript
import type { Router, Route, RouteMatch, RouterOptions } from '@nextrush/types';

// Route definition
const route: Route = {
  method: 'GET',
  path: '/users/:id',
  handler: async (ctx) => ctx.json({ id: ctx.params.id }),
  middleware: [],
};

// Route match result
const match: RouteMatch = {
  handler: route.handler,
  params: { id: '123' },
  middleware: [],
};

// Router options
const options: RouterOptions = {
  prefix: '/api/v1',
  caseSensitive: false,  // /Users = /users
  strict: false,          // /users/ = /users
};
```

## Runtime Types

```typescript
import type { Runtime, RuntimeCapabilities, BodySource } from '@nextrush/types';

// Supported runtimes
const runtime: Runtime = ctx.runtime;
// 'node' | 'bun' | 'deno' | 'cloudflare-workers' | 'vercel-edge' | 'edge' | 'unknown'

// Runtime capabilities
const caps: RuntimeCapabilities = {
  nodeStreams: true,
  webStreams: true,
  fileSystem: true,
  webSocket: true,
  fetch: true,
  cryptoSubtle: true,
  workers: true,
};

// Body source (for custom body parsers)
const source: BodySource = ctx.bodySource;
await source.text();    // Read as string
await source.buffer();  // Read as Uint8Array
await source.json();    // Read as JSON
source.stream();        // Get underlying stream
source.consumed;        // Already read?
source.contentLength;   // Content-Length header
source.contentType;     // Content-Type header
```

## Common Patterns

### Type-Safe Route Params

```typescript
interface UserParams extends RouteParams {
  id: string;
}

app.get('/users/:id', async (ctx) => {
  const { id } = ctx.params as UserParams;
  // id is typed as string
});
```

### Type-Safe State

```typescript
interface AuthState extends ContextState {
  user: { id: string; role: 'admin' | 'user' };
  requestId: string;
}

// In auth middleware
ctx.state.user = { id: '123', role: 'admin' };

// In handler - cast if needed
const state = ctx.state as AuthState;
```

### Type-Safe Body

```typescript
interface CreateUserDto {
  name: string;
  email: string;
}

app.post('/users', async (ctx) => {
  const data = ctx.body as CreateUserDto;
  // data.name, data.email are typed
});
```

## API Reference

### Runtime Exports (Values)

```typescript
import {
  HttpStatus,     // HTTP status code constants
  HTTP_METHODS,   // Methods tuple for iteration
  ContentType,    // Content type constants
} from '@nextrush/types';
```

### Type Exports

```typescript
import type {
  // Context
  Context,
  ContextOptions,
  ContextState,
  RouteParams,
  QueryParams,
  Middleware,
  Next,
  RouteHandler,

  // HTTP
  HttpMethod,
  CommonHttpMethod,
  HttpStatusCode,
  ContentTypeValue,
  IncomingHeaders,
  OutgoingHeaders,
  ParsedBody,
  ResponseBody,
  RawHttp,

  // Plugin
  Plugin,
  PluginWithHooks,
  PluginFactory,
  PluginMeta,
  ApplicationLike,

  // Router
  Router,
  Route,
  RouteMatch,
  RouterOptions,
  RoutePattern,
  RouteParam,

  // Runtime
  Runtime,
  RuntimeInfo,
  RuntimeCapabilities,
  BodySource,
  BodySourceOptions,
} from '@nextrush/types';
```

## Package Size

| Metric | Size |
|--------|------|
| Bundle | ~1 KB (constants only) |
| Types | ~22 KB |
| Dependencies | None |

The tiny bundle size reflects that this package is mostly type definitions. Constants (`HttpStatus`, `ContentType`, `HTTP_METHODS`) are the only runtime code.

## See Also

- [@nextrush/core](/packages/core) - Application and middleware
- [@nextrush/router](/packages/router) - Radix tree routing
- [@nextrush/errors](/packages/errors) - HTTP error classes
