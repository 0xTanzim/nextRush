<!-- This is a reference file for the NextRush skill. Do not edit unless updating for new APIs. -->

# Ecosystem

Plugins, adapters, dev tools, and runtime utilities for NextRush.

---

## Plugins

### 1. Controllers (`@nextrush/controllers`)

Auto-discovers `@Controller` classes, integrates DI, and registers routes.

```typescript
import { controllersPlugin, registerController } from '@nextrush/controllers';
// Or via nextrush/class subpath:
import { controllersPlugin } from 'nextrush/class';

const app = createApp();
const router = createRouter();

// Auto-discovery (recommended)
app.plugin(
  controllersPlugin({
    router,
    root: './src', // Scan for @Controller classes
    prefix: '/api', // Prefix all routes
    include: ['**/*.controller.ts'],
    debug: true, // Log discovered controllers
  })
);

// Manual registration
registerController(router, UserController);

app.route('/', router);
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

Type-safe async event emitter.

```typescript
import { eventsPlugin, createEvents, EventEmitter } from '@nextrush/events';
// As plugin (attaches to app.events)
app.plugin(eventsPlugin());
app.events.on('user:created', (data) => console.log(data));
app.events.emit('user:created', { id: '1', name: 'Alice' });
// Standalone
interface AppEvents {
  'server:started': { port: number };
}
const events = createEvents<AppEvents>();
events.on('server:started', ({ port }) => console.log(`Port ${port}`));
await events.emit('server:started', { port: 3000 });
// API: on(), off(), emit(), once()
```

### 3. Logger (`@nextrush/logger`)

Request logging middleware. Wraps `@nextrush/log`.

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

High-performance static file serving.

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

Universal template engine with adapter pattern.

```typescript
import { template, templatePlugin } from '@nextrush/template';
app.use(template()); // Built-in Mustache-like
app.use(template('ejs', { root: './views' })); // Or: handlebars, nunjucks, pug, eta
app.plugin(templatePlugin('ejs', { root: './views' })); // As plugin
// In handlers — extends Context with ctx.render()
await ctx.render('home', { title: 'Welcome', user: ctx.state.user });
```

Supported engines: `builtin` (default), `ejs`, `handlebars`, `nunjucks`, `pug`, `eta`.

### 6. WebSocket (`@nextrush/websocket`)

WebSocket support with rooms and broadcasting.

```typescript
import { createWebSocket, withWebSocket } from '@nextrush/websocket';
const wss = createWebSocket({ heartbeatInterval: 30000, maxPayload: 1024 * 1024 });
wss.on('/chat', (conn) => {
  conn.join('general');
  conn.on('message', (msg) => conn.broadcast('general', msg));
});
app.use(wss.upgrade());
const server = app.listen(3000);
wss.attach(server);
// Or: await withWebSocket(app, wss, 3000);
```

Options: `heartbeatInterval`, `maxPayload`, `maxConnections`, `verifyClient`. Advanced: `Connection`, `RoomManager`, `WebSocketServer`.

---

## Adapters

### Node.js (`@nextrush/adapter-node`) — default, bundled in `nextrush`

```typescript
import { createApp, listen } from 'nextrush';
listen(app, 3000); // Quick start
serve(app, { port: 3000, hostname: '0.0.0.0' }); // With options
const handler = createHandler(app); // Raw handler
```

### Bun (`@nextrush/adapter-bun`) / Deno (`@nextrush/adapter-deno`)

```typescript
// Same API: listen, serve, createHandler
import { listen, serve } from '@nextrush/adapter-bun'; // or adapter-deno
listen(app, 3000);
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
await dev('./src/index.ts', { port: 3000 });
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
