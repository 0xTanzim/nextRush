<!-- This is a reference file for the NextRush skill. Do not edit unless updating for new APIs. -->

# Ecosystem

Plugins, adapters, dev tools, and runtime utilities for NextRush.

---

## Plugins

NextRush has no `Plugin` interface. Extending an app falls into three kinds:
**Middleware** (`app.use(fn())`, ~99% of packages), **Registrar** (a plain
function you call directly, ~1%), and **Extension** (`app.extend(ext)` +
`await app.ready()`, rare — for long-lived services like an event bus). The
sections below use the correct idiom for each package.

### 1. Controllers (`@nextrush/controllers`)

A **registrar**. `registerControllers` auto-discovers `@Controller` classes,
integrates DI, and registers routes on `app.router`. It reads `app.router`
and `app.container` directly — no `router` option, no `app.plugin()`.

```typescript
import { registerControllers, registerController } from '@nextrush/controllers';
// Or via nextrush/class subpath:
import { registerControllers } from 'nextrush/class';

const app = createApp(); // owns a router (batteries-included)

// Auto-discovery (recommended) — must be awaited before serve()
await registerControllers(app, {
  root: './src', // Scan for @Controller classes
  prefix: '/api', // Prefix all routes
  include: ['**/*.controller.ts'],
  debug: true, // Log discovered controllers
});

// Manual registration
registerController(app.router!, UserController);
```

**Error types:**

- `GuardRejectionError` — guard returned false (403)
- `MissingParameterError` — required parameter missing (400)
- `ParameterInjectionError` — parameter extraction failed
- `ControllerResolutionError` — DI container can't resolve controller
- `DiscoveryError` — file scan/import failed
- `NoRoutesError` — controller has no route decorators
- `RouteRegistrationError` — route could not be registered

Re-exports: `@Controller`, `@Get`, `@Post`, `@Put`, `@Patch`, `@Delete`, `@Body`, `@Param`, `@Query`, `@Header`, `@Ctx`, `@UseGuard` from `@nextrush/decorators`; `Service`, `Repository`, `container`, `inject` from `@nextrush/di`.

### 2. Events (`@nextrush/events`)

An **Extension** — a long-lived service registered with `app.extend()` and
booted at `app.ready()`. Not a plugin; there is no `eventsPlugin()`.

```typescript
import { events, createEvents, EventEmitter } from '@nextrush/events';

// As an Extension (attaches to app.events)
app.extend(events());
await app.ready(); // adapters call this automatically before start()
app.events.on('user:created', (data) => console.log(data));
app.events.emit('user:created', { id: '1', name: 'Alice' });

// Standalone (no app involved)
interface AppEvents {
  'server:started': { port: number };
}
const emitter = createEvents<AppEvents>();
emitter.on('server:started', ({ port }) => console.log(`Port ${port}`));
await emitter.emit('server:started', { port: 8080 });
// API: on(), off(), emit(), once()
```

### 3. Logger (`@nextrush/logger`)

Request logging **middleware**. Wraps `@nextrush/log`.

```typescript
import { logger, createLogger, attachLogger } from '@nextrush/logger';
app.use(logger()); // Request logging
app.use(logger({ level: 'info', namespace: 'http' }));
const log = createLogger('MyService'); // Direct logging
log.info('Server starting');
// In handlers: ctx.log.info('Processing request');
```

Transports: `createConsoleTransport`, `createBatchTransport`, `createFilteredTransport`. Formatters: `formatJSON`, `formatPrettyTerminal`. Features: AsyncLocalStorage context, sensitive data redaction.

### 4. Static (`@nextrush/static`)

High-performance static file serving **middleware**.

```typescript
import { serveStatic, staticFiles, sendFile } from '@nextrush/static';
app.use(serveStatic({ root: './public' }));
app.use(
  serveStatic({
    root: './public',
    prefix: '/assets',
    maxAge: 86400,
    etag: true,
    lastModified: true,
    dotfiles: 'ignore',
    extensions: ['.html'],
    index: 'index.html',
    acceptRanges: true,
  })
);
// staticFiles is an alias for serveStatic
```

### 5. Template (`@nextrush/template`)

Universal template engine **middleware** with adapter pattern. There is no
separate `templatePlugin()` — `template()` is the only entry point.

```typescript
import { template } from '@nextrush/template';
app.use(template()); // Built-in Mustache-like
app.use(template('ejs', { root: './views' })); // Or: handlebars, nunjucks, pug, eta
// In handlers — extends Context with ctx.render()
await ctx.render('home', { title: 'Welcome', user: ctx.state.user });
```

Supported engines: `builtin` (default), `ejs`, `handlebars`, `nunjucks`, `pug`, `eta`.

### 6. WebSocket (`@nextrush/websocket`)

A **registrar**-style factory: call it directly, then register its upgrade
handler as middleware. WebSocket support with rooms and broadcasting.

```typescript
import { createWebSocket } from '@nextrush/websocket';
import { listen } from '@nextrush/adapter-node';
const wss = createWebSocket({ heartbeatInterval: 30000, maxPayload: 1024 * 1024 });
wss.on('/chat', (conn) => {
  conn.join('general');
  conn.on('message', (msg) => conn.broadcast('general', msg));
});
app.use(wss.upgrade());
const { server } = await listen(app, 8080);
wss.attach(server);
```

Options: `heartbeatInterval`, `maxPayload`, `maxConnections`, `verifyClient`. Advanced: `Connection`, `RoomManager`, `WebSocketServer`.

---

## Adapters

### Node.js (`@nextrush/adapter-node`) — default, bundled in `nextrush`

```typescript
import { createApp, listen } from 'nextrush';
listen(app, 8080); // Quick start
serve(app, { port: 8080, hostname: '0.0.0.0' }); // With options
const handler = createHandler(app); // Raw handler
```

### Bun (`@nextrush/adapter-bun`) / Deno (`@nextrush/adapter-deno`)

```typescript
// Same API: listen, serve, createHandler
import { listen, serve } from '@nextrush/adapter-bun'; // or adapter-deno
listen(app, 8080);
```

### Edge (`@nextrush/adapter-edge`)

Universal edge adapter for Cloudflare Workers, Vercel Edge, Netlify Edge.

```typescript
import {
  createFetchHandler,
  createCloudflareHandler,
  createVercelHandler,
  createNetlifyHandler,
} from '@nextrush/adapter-edge';
const handler = createFetchHandler(app); // Generic Fetch API
export default { fetch: createCloudflareHandler(app) }; // Cloudflare Workers
export default createVercelHandler(app); // Vercel Edge (+ config: { runtime: 'edge' })
export default createNetlifyHandler(app); // Netlify Edge (+ config: { path: '/api/*' })
```

---

## Dev Tools (`@nextrush/dev`)

CLI and programmatic dev tools.

### CLI Commands

```bash
nextrush dev                          # Dev server (auto-restart)
nextrush dev ./src/app.ts --port 4000
nextrush build --minify --outDir dist  # Production build
nextrush generate controller user      # Code generators
nextrush generate service auth         # Types: controller, service, middleware, guard, route
```

### Programmatic API

```typescript
import { dev, build, generate, detectRuntime, isNode } from '@nextrush/dev';
await dev('./src/index.ts', { port: 8080 });
await build('./src/index.ts', { outDir: 'dist', minify: true });
await generate('controller', 'user');
const runtime = detectRuntime(); // 'node' | 'bun' | 'deno'
```

---

## Runtime (`@nextrush/runtime`)

Cross-runtime abstractions and detection.

### Runtime Detection

```typescript
import {
  detectRuntime,
  getRuntime,
  getRuntimeInfo,
  getRuntimeCapabilities,
  isNode,
  isBun,
  isDeno,
  isEdge,
} from '@nextrush/runtime';
const runtime = detectRuntime(); // 'node' | 'bun' | 'deno' | 'edge'
const info = getRuntimeInfo(); // { runtime, version, features }
const caps = getRuntimeCapabilities(); // { streams, crypto, asyncLocalStorage, ... }
```

### Utilities

```typescript
import { parseQueryString, getClientIp, headersToRecord } from '@nextrush/runtime';
const params = parseQueryString('foo=bar&baz=qux');
const ip = getClientIp(request); // Respects X-Forwarded-For, X-Real-IP
const headers = headersToRecord(req.headers);
```

### Body Source Abstraction

```typescript
import {
  AbstractBodySource,
  EmptyBodySource,
  WebBodySource,
  createWebBodySource,
} from '@nextrush/runtime';
const body = createWebBodySource(request.body, { limit: '1mb' });
const json = await body.json();
const text = await body.text();
```

Error classes: `BodyConsumedError` (body already read), `BodyTooLargeError` (exceeds limit).
