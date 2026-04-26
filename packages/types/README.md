# @nextrush/types

> Shared TypeScript type definitions for the NextRush framework.

## The Problem

Backend frameworks often have types scattered across packages. This creates:

- Circular dependencies between packages
- Inconsistent interfaces across the ecosystem
- Difficulty extending or augmenting types

## How NextRush Approaches This

`@nextrush/types` is the **single source of truth** for all NextRush types:

- **Zero dependencies**: Pure TypeScript definitions
- **Zero runtime code**: Only exports types and constants
- **Foundation package**: All NextRush packages depend on this

## Installation

```bash
pnpm add @nextrush/types
```

## Quick Start

```typescript
import type { Context, Middleware, Plugin } from '@nextrush/types';
import { HttpStatus, ContentType } from '@nextrush/types';

const middleware: Middleware = async (ctx, next) => {
  ctx.status = HttpStatus.OK;
  await next();
};
```

## Context Types

The `Context` interface is the heart of NextRush:

```typescript
import type { Context, ContextState, RouteParams, QueryParams } from '@nextrush/types';

const handler = async (ctx: Context) => {
  // Request (read-only)
  ctx.method; // HttpMethod
  ctx.url; // Full URL with query
  ctx.path; // Path without query
  ctx.query; // QueryParams
  ctx.headers; // IncomingHeaders
  ctx.ip; // Client IP
  ctx.params; // RouteParams (from router)
  ctx.body; // unknown (from body parser)

  // Response
  ctx.status = 201;
  ctx.json({ created: true });
  ctx.send('text');
  ctx.html('<h1>Hello</h1>');
  ctx.redirect('/new-url');

  // Headers
  ctx.set('X-Custom', 'value');
  ctx.get('Authorization');

  // Error helpers
  ctx.throw(404, 'Not found');
  ctx.assert(user, 404, 'User not found');

  // State (for middleware data)
  ctx.state.user = { id: '123' };

  // Middleware flow
  await ctx.next();

  // Raw access (platform-specific)
  ctx.raw.req; // Raw request
  ctx.raw.res; // Raw response
  ctx.runtime; // 'node' | 'bun' | 'deno' | 'edge'
  ctx.bodySource; // BodySource for parsers
};
```

### Context Options

```typescript
import type { ContextOptions } from '@nextrush/types';

// Used by adapters to create contexts
const options: ContextOptions = {
  method: 'GET',
  url: '/users?page=1',
  headers: { 'content-type': 'application/json' },
  ip: '127.0.0.1',
  raw: { req, res },
};
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
  console.log(m);
}
```

### Status Codes

```typescript
import { HttpStatus } from '@nextrush/types';
import type { HttpStatusCode } from '@nextrush/types';

ctx.status = HttpStatus.OK; // 200
ctx.status = HttpStatus.CREATED; // 201
ctx.status = HttpStatus.BAD_REQUEST; // 400
ctx.status = HttpStatus.UNAUTHORIZED; // 401
ctx.status = HttpStatus.FORBIDDEN; // 403
ctx.status = HttpStatus.NOT_FOUND; // 404
ctx.status = HttpStatus.INTERNAL_SERVER_ERROR; // 500

// Type for status code values
const status: HttpStatusCode = 200;
```

### Content Types

```typescript
import { ContentType } from '@nextrush/types';
import type { ContentTypeValue } from '@nextrush/types';

ctx.set('Content-Type', ContentType.JSON); // 'application/json'
ctx.set('Content-Type', ContentType.HTML); // 'text/html'
ctx.set('Content-Type', ContentType.TEXT); // 'text/plain'
ctx.set('Content-Type', ContentType.FORM); // 'application/x-www-form-urlencoded'
ctx.set('Content-Type', ContentType.MULTIPART); // 'multipart/form-data'
```

### Headers

```typescript
import type { IncomingHeaders, OutgoingHeaders } from '@nextrush/types';

// Request headers (read-only)
const incoming: IncomingHeaders = ctx.headers;

// Response headers (writable)
const outgoing: OutgoingHeaders = {
  'Content-Type': 'application/json',
  'X-Request-Id': '123',
};
```

### Body Types

```typescript
import type { ParsedBody, ResponseBody } from '@nextrush/types';

// Request body after parsing
const body: ParsedBody = ctx.body;
// string | Uint8Array | Record<string, unknown> | unknown[] | null | undefined

// Response body types
const response: ResponseBody = { data: 'value' };
// string | Uint8Array | ArrayBuffer | NodeStreamLike | WebStreamLike | Record<string, unknown> | unknown[] | null | undefined
```

## Middleware Types

```typescript
import type { Middleware, Next, RouteHandler } from '@nextrush/types';

// Middleware function
const middleware: Middleware = async (ctx, next) => {
  console.log('Before');
  await next();
  console.log('After');
};

// Next function type
const callNext: Next = async () => {
  // ...
};

// Route handler (alias for Middleware)
const handler: RouteHandler = async (ctx) => {
  ctx.json({ ok: true });
};
```

## Plugin Types

```typescript
import type {
  Plugin,
  PluginFactory,
  PluginWithHooks,
  PluginMeta,
  ApplicationLike,
} from '@nextrush/types';

// Basic plugin
const plugin: Plugin = {
  name: 'my-plugin',
  version: '1.0.0',

  install(app: ApplicationLike) {
    app.use(async (ctx, next) => {
      await next();
    });
  },

  destroy() {
    // Cleanup on shutdown
  },
};

// Plugin with lifecycle hooks
const advancedPlugin: PluginWithHooks = {
  name: 'advanced',
  install(app) {},

  onRequest(ctx) {},
  onResponse(ctx) {},
  onError(error, ctx) {},
  extendContext(ctx) {},
};

// Plugin factory pattern
const createPlugin: PluginFactory<{ debug: boolean }> = (options) => ({
  name: 'configurable',
  install(app) {
    if (options?.debug) {
      // Debug mode
    }
  },
});
```

## Router Types

```typescript
import type {
  Router,
  Route,
  RouteMatch,
  RouterOptions,
  RoutePattern,
  RouteParam,
} from '@nextrush/types';

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
  caseSensitive: false,
  strict: false,
};
```

## Runtime Types

```typescript
import type { Runtime, RuntimeInfo, RuntimeCapabilities, BodySource } from '@nextrush/types';

// Supported runtimes
const runtime: Runtime = 'node';
// 'node' | 'bun' | 'deno' | 'deno-deploy' | 'cloudflare-workers' | 'vercel-edge' | 'edge' | 'unknown'

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

// Body source for parsers
const bodySource: BodySource = ctx.bodySource;
await bodySource.text(); // Read as string
await bodySource.buffer(); // Read as Uint8Array
await bodySource.json(); // Read as JSON
bodySource.stream(); // Get underlying stream
bodySource.consumed; // Check if already read
bodySource.contentLength; // Content-Length header
bodySource.contentType; // Content-Type header
```

## Raw HTTP Types

```typescript
import type { RawHttp } from '@nextrush/types';

// Generic raw access
const raw: RawHttp = ctx.raw;
raw.req; // Platform request
raw.res; // Platform response

// Type with generics for platform-specific typing
import type { IncomingMessage, ServerResponse } from 'http';
const nodeRaw: RawHttp<IncomingMessage, ServerResponse> = ctx.raw;
```

## API Reference

### Exports

```typescript
import {
  // Constants (runtime values)
  HttpStatus,
  HTTP_METHODS,
  ContentType,
} from '@nextrush/types';

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

- **Bundle**: ~1 KB (mostly constants)
- **Types**: ~22 KB
- **Dependencies**: None

## License

MIT
