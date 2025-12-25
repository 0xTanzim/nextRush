# @nextrush/types

Shared TypeScript type definitions for the NextRush framework. This package provides all core interfaces and types used across NextRush packages.

## Installation

```bash
npm install @nextrush/types
# or
pnpm add @nextrush/types
```

## Overview

This package is the foundation of NextRush's type system. It provides:

- **Context types**: Request/response context interfaces
- **HTTP types**: Methods, status codes, headers
- **Middleware types**: Middleware function signatures
- **Plugin types**: Plugin system interfaces
- **Router types**: Route matching and parameters

## Core Types

### Context

The `Context` interface represents the request/response lifecycle:

```typescript
import type { Context, State } from '@nextrush/types';

const handler = async (ctx: Context) => {
  // Request properties
  ctx.method;      // HTTP method
  ctx.path;        // Request path
  ctx.url;         // Full URL
  ctx.headers;     // Request headers
  ctx.query;       // Query parameters
  ctx.params;      // Route parameters
  ctx.body;        // Request body (parsed)
  ctx.ip;          // Client IP

  // Response methods
  ctx.json(data);  // Send JSON response
  ctx.send(data);  // Send text/buffer
  ctx.html(str);   // Send HTML
  ctx.redirect(url); // Redirect

  // Response properties
  ctx.status = 200;
  ctx.set('Header', 'value');
};
```

### State

Custom state for middleware data sharing:

```typescript
import type { Context, State } from '@nextrush/types';

interface MyState extends State {
  user: { id: string; name: string };
  requestId: string;
}

const handler = async (ctx: Context<MyState>) => {
  ctx.state.user;      // Typed!
  ctx.state.requestId; // Typed!
};
```

### Middleware

```typescript
import type { Middleware, Next } from '@nextrush/types';

// Standard middleware
const middleware: Middleware = async (ctx, next) => {
  console.log('Before');
  await next();
  console.log('After');
};

// Modern syntax (ctx.next)
const modernMiddleware: Middleware = async (ctx) => {
  console.log('Before');
  await ctx.next();
  console.log('After');
};
```

### Plugin

```typescript
import type { Plugin, PluginContext } from '@nextrush/types';

interface MyPluginOptions {
  enabled: boolean;
}

const myPlugin: Plugin<MyPluginOptions> = {
  name: 'my-plugin',
  version: '1.0.0',

  install(app, options) {
    // Plugin installation logic
    app.use(async (ctx) => {
      if (options.enabled) {
        // Do something
      }
      await ctx.next();
    });
  },
};
```

### Router

```typescript
import type {
  Router,
  Route,
  RouteHandler,
  RouteParams,
  MatchResult,
} from '@nextrush/types';

const handler: RouteHandler = async (ctx) => {
  const { id } = ctx.params as { id: string };
  ctx.json({ id });
};
```

## HTTP Types

### Methods

```typescript
import type { HttpMethod } from '@nextrush/types';

const method: HttpMethod = 'GET';
// 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'
```

### Status Codes

```typescript
import { HttpStatus } from '@nextrush/types';

ctx.status = HttpStatus.OK;           // 200
ctx.status = HttpStatus.CREATED;      // 201
ctx.status = HttpStatus.NOT_FOUND;    // 404
ctx.status = HttpStatus.INTERNAL_SERVER_ERROR; // 500
```

### Headers

```typescript
import type { Headers, HeaderValue } from '@nextrush/types';

const headers: Headers = {
  'content-type': 'application/json',
  'x-custom': ['value1', 'value2'],
};
```

## Type Reference

### Request Types

```typescript
import type {
  // Core request
  Context,
  State,

  // HTTP
  HttpMethod,
  HttpStatus,
  Headers,
  HeaderValue,

  // Query and params
  QueryParams,
  RouteParams,

  // Body types
  RequestBody,
  ParsedBody,
} from '@nextrush/types';
```

### Response Types

```typescript
import type {
  // Response methods
  JsonResponse,
  HtmlResponse,
  RedirectResponse,
  SendResponse,

  // Status and headers
  StatusCode,
  ResponseHeaders,
} from '@nextrush/types';
```

### Middleware Types

```typescript
import type {
  Middleware,
  Next,
  ComposedMiddleware,
  MiddlewareStack,
} from '@nextrush/types';
```

### Plugin Types

```typescript
import type {
  Plugin,
  PluginContext,
  PluginOptions,
  PluginInstaller,
} from '@nextrush/types';
```

### Router Types

```typescript
import type {
  Router,
  Route,
  RouteHandler,
  RouteMatch,
  MatchResult,
  RouterOptions,
} from '@nextrush/types';
```

### Utility Types

```typescript
import type {
  // Helpers
  MaybePromise,
  Awaitable,
  DeepPartial,
  DeepReadonly,

  // Validation
  Validator,
  ValidationResult,
} from '@nextrush/types';
```

## Type Augmentation

Extend built-in types for your application:

```typescript
// types/nextrush.d.ts
import '@nextrush/types';

declare module '@nextrush/types' {
  interface State {
    user?: {
      id: string;
      email: string;
      role: 'admin' | 'user';
    };
    session?: {
      id: string;
      expiresAt: Date;
    };
  }
}
```

Now `ctx.state.user` and `ctx.state.session` are properly typed everywhere.

## Creating Typed Middleware

```typescript
import type { Middleware, Context, State } from '@nextrush/types';

interface AuthState extends State {
  user: { id: string };
}

// Type-safe middleware
const authMiddleware: Middleware<AuthState> = async (ctx, next) => {
  const token = ctx.get('Authorization');
  if (!token) {
    ctx.status = 401;
    ctx.json({ error: 'Unauthorized' });
    return;
  }

  ctx.state.user = await validateToken(token);
  await next();
};

// Use in handlers
const protectedHandler = async (ctx: Context<AuthState>) => {
  ctx.json({ userId: ctx.state.user.id }); // Typed!
};
```

## Creating Typed Plugins

```typescript
import type { Plugin } from '@nextrush/types';

interface LoggerOptions {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'pretty';
}

const loggerPlugin: Plugin<LoggerOptions> = {
  name: 'logger',
  version: '1.0.0',
  defaults: {
    level: 'info',
    format: 'json',
  },

  install(app, options) {
    // options is typed as LoggerOptions
    app.use(async (ctx, next) => {
      if (options.level === 'debug') {
        console.log(`${ctx.method} ${ctx.path}`);
      }
      await next();
    });
  },
};
```

## Best Practices

1. **Import types with `import type`**: Prevents runtime imports
2. **Use State generics**: For type-safe middleware data
3. **Augment module types**: Extend State globally for your app
4. **Avoid `any`**: Use `unknown` and narrow with type guards

## License

MIT
