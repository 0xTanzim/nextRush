# @nextrush/core

The core module of the NextRush framework. Provides the application instance, middleware composition, and foundational APIs.

## Installation

```bash
npm install @nextrush/core
# or
pnpm add @nextrush/core
```

## Quick Start

```typescript
import { createApp } from '@nextrush/core';
import { serve } from '@nextrush/adapter-node';

const app = createApp();

app.use(async (ctx) => {
  ctx.json({ message: 'Hello World' });
});

serve(app, 3000);
```

## Features

- **Minimal Core**: Under 1,500 LOC
- **Middleware Pipeline**: Koa-style async middleware
- **Plugin System**: Extensible via plugins
- **Zero Dependencies**: Pure TypeScript
- **Type Safe**: Full TypeScript support

## Application

### Creating an Application

```typescript
import { createApp, Application } from '@nextrush/core';

// Factory function
const app = createApp();

// With options
const app = createApp({
  proxy: true,           // Trust proxy headers
  env: 'production',     // Environment
  keys: ['secret1'],     // Signing keys
});
```

### Application Options

```typescript
interface AppOptions {
  // Trust X-Forwarded-* headers
  proxy?: boolean;

  // Environment (default: process.env.NODE_ENV)
  env?: string;

  // Keys for signing cookies
  keys?: string[];

  // Maximum listeners for events
  maxListeners?: number;
}
```

## Middleware

### Basic Middleware

```typescript
// Modern syntax
app.use(async (ctx) => {
  console.log(`${ctx.method} ${ctx.path}`);
  await ctx.next();
  console.log(`Response: ${ctx.status}`);
});

// Traditional Koa syntax
app.use(async (ctx, next) => {
  console.log('Before');
  await next();
  console.log('After');
});
```

### Middleware Order

```typescript
app.use(async (ctx) => {
  console.log('1: Start');
  await ctx.next();
  console.log('1: End');
});

app.use(async (ctx) => {
  console.log('2: Start');
  await ctx.next();
  console.log('2: End');
});

app.use(async (ctx) => {
  console.log('3: Handler');
  ctx.body = 'Hello';
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
// Skip middleware based on condition
app.use(async (ctx) => {
  if (ctx.path === '/health') {
    return ctx.next(); // Skip this middleware
  }

  // Do something
  await ctx.next();
});
```

## Context

The context object encapsulates the request and response:

### Request Properties

```typescript
app.use(async (ctx) => {
  ctx.method;         // HTTP method
  ctx.path;           // Request path
  ctx.url;            // Full URL
  ctx.originalUrl;    // Original URL before modifications
  ctx.headers;        // Request headers
  ctx.query;          // Parsed query string
  ctx.querystring;    // Raw query string
  ctx.host;           // Host header
  ctx.hostname;       // Hostname
  ctx.protocol;       // http or https
  ctx.ip;             // Client IP
  ctx.ips;            // Proxy IPs
  ctx.secure;         // Is HTTPS?
  ctx.fresh;          // Is response fresh?
});
```

### Request Methods

```typescript
app.use(async (ctx) => {
  ctx.get('Content-Type');      // Get header
  ctx.accepts('json', 'html');  // Content negotiation
  ctx.acceptsEncodings();       // Accept-Encoding
  ctx.acceptsCharsets();        // Accept-Charset
  ctx.acceptsLanguages();       // Accept-Language
  ctx.is('json');               // Check content type
});
```

### Response Properties

```typescript
app.use(async (ctx) => {
  ctx.status = 200;             // Set status
  ctx.message = 'OK';           // Status message
  ctx.body = 'Hello';           // Response body
  ctx.length = 5;               // Content length
  ctx.type = 'text/plain';      // Content type
});
```

### Response Methods

```typescript
app.use(async (ctx) => {
  ctx.set('X-Custom', 'value');           // Set header
  ctx.append('Set-Cookie', 'a=1');        // Append header
  ctx.remove('X-Powered-By');             // Remove header
  ctx.redirect('/new-url');               // Redirect
  ctx.json({ data: 'value' });            // Send JSON
  ctx.send('text');                       // Send text/buffer
  ctx.html('<h1>Hello</h1>');             // Send HTML
});
```

### State

Share data between middleware:

```typescript
app.use(async (ctx) => {
  ctx.state.user = await getUser(ctx);
  await ctx.next();
});

app.use(async (ctx) => {
  console.log(ctx.state.user); // Access shared state
});
```

### Throw Errors

```typescript
app.use(async (ctx) => {
  ctx.throw(404, 'User not found');
  ctx.throw(400, 'Bad request', { code: 'INVALID_INPUT' });
  ctx.assert(ctx.params.id, 400, 'ID required');
});
```

## Plugins

### Using Plugins

```typescript
import { createApp } from '@nextrush/core';
import { eventsPlugin } from '@nextrush/events';
import { loggerPlugin } from '@nextrush/logger';

const app = createApp();

app.plugin(eventsPlugin());
app.plugin(loggerPlugin({ level: 'info' }));
```

### Creating Plugins

```typescript
import type { Plugin } from '@nextrush/types';

interface MyPluginOptions {
  debug: boolean;
}

const myPlugin: Plugin<MyPluginOptions> = {
  name: 'my-plugin',
  version: '1.0.0',

  install(app, options) {
    // Add middleware
    app.use(async (ctx, next) => {
      if (options.debug) {
        console.log(ctx.path);
      }
      await next();
    });

    // Extend app
    app.myFeature = () => {
      // Custom functionality
    };
  },
};

// Usage
app.plugin(myPlugin({ debug: true }));
```

## Middleware Composition

### compose(middleware)

Compose multiple middleware into one:

```typescript
import { compose } from '@nextrush/core';

const combined = compose([
  async (ctx, next) => {
    console.log('First');
    await next();
  },
  async (ctx, next) => {
    console.log('Second');
    await next();
  },
]);

app.use(combined);
```

## Error Handling

```typescript
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    ctx.status = err.status || 500;
    ctx.json({
      error: err.message,
      code: err.code,
    });

    // Emit error event
    ctx.app.emit('error', err, ctx);
  }
});

// Listen for errors
app.on('error', (err, ctx) => {
  console.error('Error:', err);
});
```

## Application Events

```typescript
app.on('error', (err, ctx) => {
  console.error('Application error:', err);
});
```

## Request Handling

### Handle Requests

```typescript
import { createApp } from '@nextrush/core';

const app = createApp();

// Get the request handler callback
const callback = app.callback();

// Use with any HTTP server
http.createServer(callback).listen(3000);
```

## API Reference

### Exports

```typescript
import {
  createApp,     // Create application instance
  Application,   // Application class
  compose,       // Compose middleware
} from '@nextrush/core';
```

### Types

```typescript
import type {
  AppOptions,
  Callback,
  ComposedMiddleware,
} from '@nextrush/core';

interface AppOptions {
  proxy?: boolean;
  env?: string;
  keys?: string[];
  maxListeners?: number;
}
```

### Application Methods

```typescript
const app = createApp();

// Middleware
app.use(middleware);

// Plugins
app.plugin(plugin, options?);

// Events
app.on(event, handler);
app.emit(event, ...args);

// HTTP server integration
app.callback();

// Properties
app.env;           // Environment
app.proxy;         // Trust proxy
app.middleware;    // Middleware stack
```

## Best Practices

1. **Use specific middleware packages**: CORS, body-parser, etc.
2. **Handle errors globally**: Add error handling middleware first
3. **Keep middleware focused**: Single responsibility principle
4. **Use state for sharing**: Pass data via `ctx.state`
5. **Avoid mutations**: Don't modify request/response objects directly

## License

MIT
