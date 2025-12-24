# 🔬 NextRush v3 Edge Cases, Breaking Changes & DX Considerations

> **Document Type**: Technical Reference
> **Date**: December 24, 2025
> **Purpose**: Comprehensive list of edge cases, breaking changes, and DX improvements for v3

---

## Table of Contents

1. [Breaking Changes](#1-breaking-changes)
2. [Edge Cases](#2-edge-cases)
3. [DX Improvements](#3-dx-improvements)
4. [Migration Helpers](#4-migration-helpers)
5. [Compatibility Matrix](#5-compatibility-matrix)
6. [FAQ](#6-faq)

---

## 1. Breaking Changes

### 1.1 Import Path Changes

#### v2 → v3 Import Mapping

```typescript
// ❌ v2 - Everything from main package
import {
  createApp,
  cors,
  helmet,
  bodyParser,
  LoggerPlugin,
  WebSocketPlugin,
  EventSystem
} from 'nextrush';

// ✅ v3 - Explicit imports (recommended)
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { cors } from '@nextrush/cors';
import { helmet } from '@nextrush/helmet';
import { json } from '@nextrush/body-parser';
import { LoggerPlugin } from '@nextrush/logger';
import { WebSocketPlugin } from '@nextrush/websocket';
import { EventsPlugin } from '@nextrush/events';

// ✅ v3 - Meta package (for convenience)
import { createApp, cors, helmet, json, listen } from 'nextrush';
```

### 1.2 Application API Changes

#### v2 Application Methods (Removed)

```typescript
// ❌ v2 - Middleware factory methods on app
const app = createApp();
app.use(app.cors());           // Factory method
app.use(app.helmet());         // Factory method
app.use(app.json());           // Factory method
app.use(app.rateLimit());      // Factory method

// ✅ v3 - Direct middleware imports
import { cors } from '@nextrush/cors';
import { helmet } from '@nextrush/helmet';
import { json } from '@nextrush/body-parser';
import { rateLimit } from '@nextrush/rate-limit';

const app = createApp();
app.use(cors());
app.use(helmet());
app.use(json());
app.use(rateLimit());
```

#### v2 Listen Method (Changed)

```typescript
// ❌ v2 - listen on Application
app.listen(3000, () => console.log('Running'));

// ✅ v3 - Adapter function (explicit)
import { listen } from '@nextrush/adapter-node';
listen(app, { port: 3000 }, () => console.log('Running'));

// ✅ v3 - Meta package (convenience, adds listen to prototype)
import { createApp, listen } from 'nextrush';
const app = createApp();
app.listen(3000);  // Works with meta package
```

### 1.3 Context API Changes

#### Response Methods (Updated DX)

```typescript
// ❌ v2 - ctx.res.json() pattern (verbose)
app.get('/users', async (ctx) => {
  ctx.res.json({ users: [] });
  ctx.res.status(201).json({ created: true });
  ctx.res.send('Hello');
});

// ✅ v3 - Clean, action-oriented API
app.get('/users', async (ctx) => {
  // ctx.body = Request body (input)
  const userData = ctx.body;  // Parsed request body

  // ctx.json() = Send JSON response (output)
  ctx.json({ users: [] });

  // ctx.send() = Send any response (text/buffer/stream)
  ctx.send('Hello World');

  // ctx.html() = Send HTML response
  ctx.html('<h1>Hello</h1>');

  // ctx.status = Set status code
  ctx.status = 201;
  ctx.json({ created: true });

  // ctx.redirect() = Redirect
  ctx.redirect('/new-location');
  ctx.redirect('/permanent', 301);
});
```

#### Clear Naming Convention (v3 DX)

```typescript
// ✅ v3 Context API - Clear distinction between input/output

// ===== INPUT (Request) =====
ctx.body          // Request body (parsed JSON/form)
ctx.query         // URL query parameters
ctx.params        // Route parameters (:id)
ctx.headers       // Request headers
ctx.method        // HTTP method
ctx.path          // Request path
ctx.ip            // Client IP

// ===== OUTPUT (Response) =====
ctx.json(data)    // Send JSON response
ctx.send(data)    // Send text/buffer/stream
ctx.html(content) // Send HTML response
ctx.redirect(url) // Redirect to URL
ctx.status        // Set/get status code
ctx.set(k, v)     // Set response header

// ===== MIDDLEWARE =====
ctx.next()        // Call next middleware (modern syntax)
```

#### Request Enhancements (Moved)

```typescript
// ❌ v2 - Enhanced request methods
app.get('/info', async (ctx) => {
  const ip = ctx.req.getIp();
  const ua = ctx.req.getUserAgent();
  const browser = ctx.req.getBrowser();
  const isBot = ctx.req.isBot();
});

// ✅ v3 - Separate utilities
import { getIp, parseUserAgent, isBot } from '@nextrush/helpers';

app.get('/info', async (ctx) => {
  const ip = getIp(ctx);
  const ua = parseUserAgent(ctx.headers['user-agent']);
  const isBot = isBot(ctx);
});
```

### 1.4 Router API Changes

#### Built-in vs Separate

```typescript
// ❌ v2 - Router built into app
const app = createApp();
app.get('/users', handler);        // Routes on app directly
app.router();                      // Create sub-router

// ✅ v3 - Explicit router
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';

const app = createApp();
const router = createRouter();

router.get('/users', handler);
app.use(router.routes());          // Mount router
```

### 1.5 Event System Changes

```typescript
// ❌ v2 - Built-in events
const app = createApp();
app.events.emit('user.created', data);
app.events.on('user.created', handler);
app.eventSystem.dispatch(command);

// ✅ v3 - Plugin-based
import { EventsPlugin } from '@nextrush/events';

const events = new EventsPlugin();
app.plugin(events);

events.emit('user.created', data);
events.on('user.created', handler);
```

### 1.6 Error Handling Changes

```typescript
// ❌ v2 - Exception filter manager
app.use(app.exceptionFilter([
  new ValidationExceptionFilter(),
  new GlobalExceptionFilter(),
]));

// ✅ v3 - Simpler error middleware
import { errorHandler } from '@nextrush/core';

app.use(errorHandler({
  onValidationError: (err, ctx) => { ... },
  onNotFound: (ctx) => { ... },
  onError: (err, ctx) => { ... },
}));
```

---

## 2. Edge Cases

### 2.1 Context Lifetime

#### v2 Behavior
```typescript
// ❌ v2 - Context may leak between requests (pooling issues)
let savedCtx;
app.get('/save', (ctx) => {
  savedCtx = ctx;  // BAD: Holding reference
  ctx.body = 'ok';
});

app.get('/use', (ctx) => {
  console.log(savedCtx.path);  // May show wrong path
});
```

#### v3 Behavior
```typescript
// ✅ v3 - Context is properly isolated
// Context pooling is internal and safe
// savedCtx would be reset before reuse
```

**Recommendation**: Never store context references outside request scope.

### 2.2 Middleware Order

#### v2 Behavior
```typescript
// ❌ v2 - Order sometimes unclear with factories
const app = createApp();
app.use(app.cors());      // When does this run?
app.use(app.json());      // Before or after cors?
app.use(myMiddleware);
```

#### v3 Behavior
```typescript
// ✅ v3 - Explicit order
app.use(cors());          // 1st
app.use(json());          // 2nd
app.use(myMiddleware);    // 3rd
// Order is exactly as written
```

### 2.2.1 Modern Middleware Syntax (ctx.next())

```typescript
// ✅ v3 - Modern: next() on context
app.use(async (ctx) => {
  console.log('Before');
  await ctx.next();       // Modern, cleaner, one parameter
  console.log('After');
});

// ✅ v3 - Traditional: also supported
app.use(async (ctx, next) => {
  console.log('Before');
  await next();           // Koa-style still works
  console.log('After');
});
```

**Why `ctx.next()` is better:**
- Single parameter signature
- Discoverable via IDE autocomplete
- Consistent with other ctx methods
- Modern syntax preferred by newer developers

### 2.3 Router Mounting Order

```typescript
// ⚠️ Edge Case: Route shadowing
const router1 = createRouter();
router1.get('/users/:id', handler1);

const router2 = createRouter();
router2.get('/users/profile', handler2);

// ❌ Wrong order - /users/profile matches :id first
app.use(router1.routes());
app.use(router2.routes());

// ✅ Correct order - specific routes first
app.use(router2.routes());  // /users/profile
app.use(router1.routes());  // /users/:id
```

### 2.4 Async Error Handling

```typescript
// ⚠️ Edge Case: Unhandled promise rejection
app.get('/danger', async (ctx) => {
  setTimeout(() => {
    throw new Error('Async error');  // NOT CAUGHT!
  }, 100);
  ctx.body = 'ok';
});

// ✅ Correct: Keep errors in async flow
app.get('/safe', async (ctx) => {
  await new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Async error')), 100);
  });  // This IS caught
});
```

### 2.5 Body Parser Edge Cases

#### Large Bodies
```typescript
// ⚠️ Edge Case: Large request body
import { json } from '@nextrush/body-parser';

// ❌ Default limit might be too small
app.use(json());

// ✅ Explicit limit for large payloads
app.use(json({ limit: '10mb' }));
```

#### Multiple Parsers
```typescript
// ⚠️ Edge Case: Multiple body parsers
app.use(json());
app.use(urlencoded());

// Body parsed by first matching parser
// If Content-Type doesn't match either, body is undefined
// This is correct behavior, but can be confusing
```

### 2.6 CORS Preflight

```typescript
// ⚠️ Edge Case: CORS preflight not handled
import { cors } from '@nextrush/cors';

// ❌ OPTIONS routes defined AFTER cors
app.use(cors());
app.options('/api/*', myHandler);  // This shadows CORS preflight!

// ✅ Let CORS handle all OPTIONS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
// Don't define OPTIONS routes manually
```

### 2.7 Static Files vs Routes

```typescript
// ⚠️ Edge Case: Static files shadow routes
import { staticFiles } from '@nextrush/static';

// ❌ Static might shadow /api
app.use(staticFiles({ root: './public' }));  // Checks public/api
app.get('/api/users', handler);

// ✅ Mount static with prefix or after API
app.get('/api/users', handler);
app.use('/static', staticFiles({ root: './public' }));
```

### 2.8 WebSocket Path Collision

```typescript
// ⚠️ Edge Case: WS path matches HTTP route
import { WebSocketPlugin } from '@nextrush/websocket';

app.get('/ws', httpHandler);  // HTTP handler
app.plugin(new WebSocketPlugin({ path: '/ws' }));  // WS handler

// Result: HTTP requests to /ws work, WS upgrade requests work
// But this can be confusing - use different paths
```

### 2.9 Memory Leaks

```typescript
// ⚠️ Edge Case: Event listener leak
import { EventsPlugin } from '@nextrush/events';

const events = new EventsPlugin();
app.plugin(events);

app.get('/subscribe', (ctx) => {
  // ❌ New listener every request - MEMORY LEAK!
  events.on('update', (data) => {
    // Handler accumulates
  });
  ctx.body = 'subscribed';
});

// ✅ Use once() or manage subscriptions
app.get('/subscribe', (ctx) => {
  const handler = (data) => { ... };
  events.once('update', handler);  // Auto-removed after first call
  ctx.body = 'subscribed';
});
```

### 2.10 Streaming Responses

```typescript
// ⚠️ Edge Case: Stream errors after headers sent
app.get('/stream', async (ctx) => {
  const stream = fs.createReadStream('/large/file');
  ctx.body = stream;

  // If stream errors after response starts,
  // we can't change status code
  // Error is logged but response may be incomplete
});

// ✅ Validate before streaming
app.get('/stream', async (ctx) => {
  const path = '/large/file';

  // Check file exists before streaming
  await fs.promises.access(path, fs.constants.R_OK);

  ctx.body = fs.createReadStream(path);
});
```

---

## 3. DX Improvements

### 3.1 Better Error Messages

#### v2 Errors
```
Error: Cannot read property 'json' of undefined
    at /app/routes/user.js:15:10
```

#### v3 Errors
```
NextRushError: Response body not set for GET /users

  Hint: Set ctx.body before the middleware chain completes.

  Example:
    app.get('/users', (ctx) => {
      ctx.body = { users: [] };  // ← Set response body
    });

  at UserHandler (/app/routes/user.js:15:10)
  at Router.dispatch (/node_modules/@nextrush/router/dist/router.js:42:8)
```

### 3.2 TypeScript Improvements

#### v2 Types
```typescript
// ❌ v2 - Limited inference
app.get('/users/:id', (ctx) => {
  const id = ctx.params.id;  // string | undefined
  // No way to know params exist
});
```

#### v3 Types
```typescript
// ✅ v3 - Full type inference
import { createRouter, RouteParams } from '@nextrush/router';

const router = createRouter();

// Option 1: Generic parameter
router.get<{ id: string }>('/users/:id', (ctx) => {
  const id = ctx.params.id;  // string (not undefined!)
});

// Option 2: Inferred from path
router.get('/users/:id', (ctx) => {
  ctx.params.id;  // Inferred as string from path pattern
});

// Option 3: Validated
import { z } from 'zod';
const ParamsSchema = z.object({ id: z.string().uuid() });

router.get('/users/:id', validate({ params: ParamsSchema }), (ctx) => {
  ctx.params.id;  // string & UUID validated
});
```

### 3.3 Auto-Complete Support

```typescript
// ✅ v3 - Full autocomplete in IDE

// Routes autocomplete
router.get('/users', handler);
router.post //  ← IDE suggests: post, put, patch, delete

// Context autocomplete
(ctx) => {
  ctx.  // ← IDE shows: body, status, params, query, headers, etc.
  ctx.headers['']  // ← IDE suggests common headers
}

// Options autocomplete
cors({
  origin: //  ← IDE shows: string | string[] | RegExp | function
});
```

### 3.4 Development Mode

```typescript
// ✅ v3 - Development helpers
import { createApp, devMode } from 'nextrush';

const app = createApp();

if (process.env.NODE_ENV === 'development') {
  app.use(devMode({
    // Pretty error pages
    prettyErrors: true,

    // Request logging
    logRequests: true,

    // Route list on 404
    showRoutes: true,

    // Performance warnings
    slowRequestWarning: 100,  // ms

    // Memory usage
    memoryWarning: 100,  // MB
  }));
}
```

### 3.5 Hot Reload Support

```typescript
// ✅ v3 - Clean HMR support
import { createApp } from '@nextrush/core';
import { listen } from '@nextrush/adapter-node';

let app = createApp();
setupRoutes(app);

const server = listen(app, { port: 3000 });

// HMR support (e.g., with Vite)
if (import.meta.hot) {
  import.meta.hot.accept('./routes', (newRoutes) => {
    // Create new app with updated routes
    app = createApp();
    newRoutes.setupRoutes(app);
  });

  import.meta.hot.dispose(() => {
    server.close();
  });
}
```

### 3.6 Testing Helpers

```typescript
// ✅ v3 - Built-in test utilities
import { createTestApp, mockContext } from '@nextrush/testing';

describe('UserRoutes', () => {
  it('should return users', async () => {
    const app = createTestApp();
    app.use(userRoutes);

    const response = await app.inject({
      method: 'GET',
      url: '/users',
      headers: { 'Authorization': 'Bearer token' },
    });

    expect(response.status).toBe(200);
    expect(response.json()).toEqual({ users: [] });
  });

  it('should validate params', async () => {
    const ctx = mockContext({
      method: 'GET',
      url: '/users/123',
      params: { id: '123' },
    });

    await userHandler(ctx);

    expect(ctx.body).toEqual({ id: '123' });
  });
});
```

### 3.7 Debug Mode

```typescript
// ✅ v3 - DEBUG environment variable
DEBUG=nextrush:* node app.js

// Output:
// nextrush:router GET /users matched in 0.02ms
// nextrush:middleware cors executed in 0.01ms
// nextrush:middleware bodyParser skipped (no body)
// nextrush:handler UserHandler executed in 1.23ms
// nextrush:response 200 OK sent in 0.05ms
```

---

## 4. Migration Helpers

### 4.1 Automatic Codemod

```bash
# Install migration tool
npx @nextrush/migrate

# Run migration
npx @nextrush/migrate ./src

# Preview changes
npx @nextrush/migrate ./src --dry-run
```

**Codemod transformations**:

```typescript
// Before
import { createApp } from 'nextrush';
const app = createApp();
app.use(app.cors());
app.use(app.json());
app.get('/users', handler);
app.listen(3000);

// After
import { createApp, cors, json, listen } from 'nextrush';
import { createRouter } from '@nextrush/router';
const app = createApp();
const router = createRouter();
app.use(cors());
app.use(json());
router.get('/users', handler);
app.use(router.routes());
listen(app, { port: 3000 });
```

### 4.2 Compatibility Layer

```typescript
// For gradual migration
import { createCompatApp } from '@nextrush/compat';

// Works like v2
const app = createCompatApp();
app.use(app.cors());  // Old API works
app.use(app.json());  // Old API works
app.get('/users', handler);  // Routes on app
app.listen(3000);  // Old listen

// Shows deprecation warnings in console:
// ⚠️ DEPRECATED: app.cors() - use import { cors } from '@nextrush/cors'
// ⚠️ DEPRECATED: app.listen() - use import { listen } from '@nextrush/adapter-node'
```

### 4.3 Migration Checklist

```markdown
## NextRush v2 → v3 Migration Checklist

### Phase 1: Dependencies
- [ ] Update `nextrush` to v3
- [ ] Or install individual packages:
  - [ ] `@nextrush/core`
  - [ ] `@nextrush/router`
  - [ ] `@nextrush/cors` (if using)
  - [ ] `@nextrush/helmet` (if using)
  - [ ] `@nextrush/body-parser` (if using)
  - [ ] `@nextrush/compression` (if using)
  - [ ] `@nextrush/logger` (if using)
  - [ ] `@nextrush/static` (if using)
  - [ ] `@nextrush/websocket` (if using)
  - [ ] `@nextrush/events` (if using)

### Phase 2: Imports
- [ ] Update import statements
- [ ] Run: `npx @nextrush/migrate ./src --dry-run`
- [ ] Review changes
- [ ] Run: `npx @nextrush/migrate ./src`

### Phase 3: Application Setup
- [ ] Change `app.use(app.middleware())` to `app.use(middleware())`
- [ ] Create explicit router with `createRouter()`
- [ ] Move routes to router
- [ ] Mount router with `app.use(router.routes())`
- [ ] Change `app.listen()` to `listen(app, options)`

### Phase 4: Context Usage
- [ ] Change `ctx.res.json()` to `ctx.body = `
- [ ] Change `ctx.res.send()` to `ctx.body = `
- [ ] Change `ctx.res.status(n).json()` to `ctx.status = n; ctx.body = `
- [ ] Update any `ctx.req` enhanced methods

### Phase 5: Events (if using)
- [ ] Import `EventsPlugin` from `@nextrush/events`
- [ ] Create plugin instance
- [ ] Install with `app.plugin()`
- [ ] Update event access

### Phase 6: Testing
- [ ] Update test imports
- [ ] Run test suite
- [ ] Fix any failing tests
- [ ] Verify all routes work

### Phase 7: Cleanup
- [ ] Remove any `@nextrush/compat` usage
- [ ] Update documentation
- [ ] Update README examples
```

---

## 5. Compatibility Matrix

### 5.1 Node.js Compatibility

| Node Version | v2 Support | v3 Support |
|--------------|------------|------------|
| 16.x | ✅ Yes | ❌ No |
| 18.x | ✅ Yes | ✅ Yes |
| 20.x | ✅ Yes | ✅ Yes |
| 22.x | ✅ Yes | ✅ Yes |

### 5.2 TypeScript Compatibility

| TypeScript | v2 Support | v3 Support |
|------------|------------|------------|
| 4.7+ | ✅ Yes | ❌ No |
| 5.0+ | ✅ Yes | ✅ Yes |
| 5.4+ | ✅ Yes | ✅ Yes (recommended) |

### 5.3 Package Manager Compatibility

| Package Manager | v2 Support | v3 Support |
|-----------------|------------|------------|
| npm 8+ | ✅ Yes | ✅ Yes |
| pnpm 8+ | ✅ Yes | ✅ Yes |
| yarn 3+ | ✅ Yes | ✅ Yes |
| bun | ⚠️ Partial | ✅ Yes |

### 5.4 Runtime Compatibility (v3)

| Runtime | Support | Adapter |
|---------|---------|---------|
| Node.js | ✅ Full | `@nextrush/adapter-node` |
| Bun | ⚠️ Planned | `@nextrush/adapter-bun` |
| Deno | ⚠️ Planned | `@nextrush/adapter-deno` |
| Edge (Cloudflare) | ⚠️ Planned | `@nextrush/adapter-edge` |

---

## 6. FAQ

### Q: Will my v2 code work with v3?

**A:** Not directly. v3 has breaking changes. However:
- Use `@nextrush/compat` for temporary compatibility
- Use `@nextrush/migrate` for automatic code transformation
- The meta `nextrush` package provides similar DX

### Q: Do I need to install all packages?

**A:** No. Options:
1. `npm install nextrush` - Installs common packages
2. Install only what you need - Smaller bundle

### Q: Is v3 faster than v2?

**A:** Yes. Significantly.
- Core is ~10x smaller
- Only used code is loaded
- Optimized hot paths

### Q: Will v2 still receive updates?

**A:** Critical security fixes only. No new features.

### Q: Can I use v2 middleware with v3?

**A:** No. The middleware signature is compatible, but imports must change.

### Q: How do I report migration issues?

**A:**
1. Check migration guide
2. Search existing issues
3. Open GitHub issue with v2 code and v3 error

---

*End of Edge Cases Document*
