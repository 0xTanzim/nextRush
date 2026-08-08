---
name: nextrush
description: >
  Build backend APIs with NextRush — runtime-independent, web-standards-first TypeScript framework.
  Use whenever the user mentions NextRush, nextrush, createApp, createRouter, @Controller, @Get/@Post,
  registerControllers, nextrush/class, nextrush/nextjs, adapter-edge, adapter-serverless, adapter-nextjs,
  createLambdaHandler, createCloudflareHandler, ctx.sse, ctx.ndjson, websocket rooms, create-nextrush,
  or asks to build/debug/deploy a NextRush app on Node, Bun, Deno, Cloudflare Workers, Vercel Edge,
  Netlify Edge, AWS Lambda, GCF, Azure Functions, or inside a Next.js App Router route.ts.
  Also use for NextRush middleware (cors, helmet, body-parser, validation, rate-limit, openapi),
  DI/guards/interceptors, streaming SSE/NDJSON, testing with createTestModule, or scaffold CLI.
license: MIT
metadata:
  framework: nextrush
  version: "1.1"
---

# NextRush Framework Skill

Teach agents how to build, configure, test, and deploy NextRush applications across every supported runtime and host — including Next.js App Router, edge, and serverless.

> **Also present: `AGENTS.md` in this folder.** Many agent hosts auto-load `AGENTS.md` into
> context when the skill is installed. That file is the short standing-orders layer; this
> `SKILL.md` is the full body. Keep both files in sync on public-API changes.

## Framework Identity

NextRush is a **runtime-independent, web-standards-first** TypeScript backend framework.

- **Web Platform foundation**: `Request` / `Response` / `ReadableStream` / `AbortSignal` / `URL` / `crypto.subtle`
- **Core imports no runtime API**: no `node:*`, `process`, `Buffer`, `Deno`, or `Bun` in core/router/middleware
- **Behavior by capability, never runtime identity**: do not branch on `if (runtime === 'x')` for features
- **Dual paradigm**: functional API (`nextrush`) + class-based DI/decorators (`nextrush/class`)
- **Adapters own the host**: Node, Bun, Deno, Edge, Serverless, Next.js — same app code

## Which Surface? (decision table)

| Goal | Package / entry |
|------|-----------------|
| Standalone API (Node default) | `nextrush` → `serve` / `listen` |
| Bun / Deno process | `@nextrush/adapter-bun` / `@nextrush/adapter-deno` |
| Cloudflare / Vercel Edge / Netlify Edge | `@nextrush/adapter-edge` |
| AWS Lambda / GCF / Azure Functions | `@nextrush/adapter-serverless` |
| Mount inside Next.js App Router | `nextrush/nextjs` → `handle(app)` |
| Controllers + DI | `nextrush/class` |
| SSE / NDJSON / text stream | `ctx.sse` / `ctx.ndjson` / `ctx.stream` (`@nextrush/stream`) |
| Bidirectional realtime (Node only) | `@nextrush/websocket` |
| Typed app events | `@nextrush/events` |
| Class-module unit tests | `@nextrush/testing` |
| Scaffold project | `pnpm create nextrush` |

**Next.js is NOT a separate skill.** It is one adapter. Keep Next.js work in this skill via `references/nextjs.md`.

## Scaffold First

```bash
pnpm create nextrush my-api
# or: npx create-nextrush@latest my-api
cd my-api && pnpm dev
```

> ⚠️ pnpm 11.x / Deno can resolve `@latest` to an old version for version-gap packages
> ([pnpm#8659](https://github.com/pnpm/pnpm/issues/8659)). If the scaffold looks stale,
> use `npm create nextrush` or `bun create nextrush` instead.

Templates: functional | class-based | full. Runtimes: node | bun | deno. Flags: `--yes --no-git --no-install`.

Dev toolkit (`@nextrush/dev`):

```bash
nextrush dev                 # multi-runtime dev server
nextrush build               # production build
nextrush g controller user   # also: service, middleware, guard, route
```

## Functional Quickstart

```typescript
import { createApp, createRouter, serve, errorHandler } from 'nextrush';
import { bodyParser } from '@nextrush/body-parser';

const app = createApp();
const router = createRouter();

app.use(errorHandler()); // outermost
app.use(bodyParser());

router.get('/', (ctx) => ctx.json({ message: 'Hello NextRush!' }));
router.get('/users/:id', (ctx) => {
  ctx.assert(ctx.params.id, 400, 'id required');
  ctx.json({ id: ctx.params.id });
});
router.post('/users', (ctx) => {
  ctx.status = 201;
  ctx.json({ created: true, data: ctx.body });
});

// Routes registered on the app's default router auto-mount — no app.route() needed
// if you passed the same router into createApp, or use createApp()'s built-in router via app.get:

app.get('/health', (ctx) => ctx.json({ ok: true }));

await serve(app, { port: 8080 });
```

`createApp()` from `nextrush` wires a default router so `app.get` / `app.post` work out of the box. Import `createApp` from `@nextrush/core` only when you want a bare engine (bring-your-own router).

## Class-Based Quickstart

```typescript
import { createApp, serve, errorHandler } from 'nextrush';
import { bodyParser } from '@nextrush/body-parser';
import {
  Controller, Get, Post, Body, Param, Service,
  registerControllers, UseGuard,
} from 'nextrush/class';
import { NotFoundError } from 'nextrush';

@Service()
class UserService {
  findById(id: number) { return { id, name: 'Alice' }; }
  create(data: { name: string }) { return { id: 1, ...data }; }
}

@Controller('/users')
class UserController {
  constructor(private users: UserService) {}

  @Get('/:id')
  findById(@Param('id', { transform: Number }) id: number) {
    const user = this.users.findById(id);
    if (!user) throw new NotFoundError('User not found');
    return user; // auto-JSON
  }

  @Post()
  create(@Body() data: { name: string }) {
    return this.users.create(data);
  }
}

const app = createApp();
app.use(errorHandler());
app.use(bodyParser());
await registerControllers(app, { root: './src', prefix: '/api' });
await serve(app, { port: 8080 });
```

Class exports live under `nextrush/class` (or `@nextrush/class`). Functional entry does **not** pull DI/`reflect-metadata`.

## Context (accurate surface)

```typescript
// Request
ctx.method, ctx.path, ctx.url, ctx.query, ctx.params, ctx.body
ctx.headers, ctx.get('authorization'), ctx.ip
ctx.runtime   // 'node' | 'bun' | 'deno' | 'edge' | 'cloudflare-workers' | 'vercel-edge' | ...
ctx.platform  // 'lambda' | 'gcf' | 'azure' | 'cloudflare-workers' | 'vercel-edge' | 'netlify-edge' | undefined
ctx.signal    // AbortSignal (client disconnect + timeout)
ctx.state      // per-request bag
ctx.env       // edge bindings (Cloudflare KV/D1/R2 when using createCloudflareHandler)

// Response
ctx.status = 201
ctx.set('X-Custom', 'v')
ctx.json(data) | ctx.send(data) | ctx.html(html) | ctx.redirect(url, 302)
ctx.stream(async (w) => { await w.write('chunk'); })
ctx.sse(async (w) => { await w.write({ data: token }); })
ctx.ndjson(async (w) => { await w.write({ event: 'step', data }); })
ctx.sendStream(readableStream)

// Errors
ctx.throw(404, 'missing')
ctx.assert(user, 404, 'User not found')

// Edge / serverless background work
ctx.waitUntil?.(promise)  // when platform provides execution context
```

**Never invent helpers** like `ctx.ok()` / `ctx.created()` — use `ctx.status` + `ctx.json`.

Full detail: `references/context.md`.

## Adapter Decision Guide

```
Need listen()/own process?
  Node → nextrush (adapter-node re-export)
  Bun  → @nextrush/adapter-bun
  Deno → @nextrush/adapter-deno

Fetch API host (no listen)?
  Cloudflare Workers → createCloudflareHandler(app)
  Vercel Edge        → createVercelHandler(app)
  Netlify Edge       → createNetlifyHandler(app)
  Generic Fetch      → createFetchHandler(app)

FaaS event shapes?
  AWS Lambda (URL / APIGW v1/v2) → createLambdaHandler(app)
  Lambda response streaming      → createLambdaStreamingHandler(app)
  Google Cloud Functions         → createGoogleHandler(app)
  Azure Functions v4             → createAzureHandler(app)

Inside Next.js App Router?
  app/api/[[...route]]/route.ts → handle(app) from 'nextrush/nextjs'
```

### Critical adapter rules

1. **Build app at module scope** on serverless (once per cold start), never inside the handler.
2. On serverless/edge via these adapters, `ctx.runtime` is often `'edge'` — use **`ctx.platform`** to know provider (`'lambda' | 'gcf' | 'azure' | ...`).
3. Next.js: only App Router. Pages Router unsupported. Mount paths live on the **app** (`app.route('/api', router)`), not the bridge.
4. WebSocket package is **Node-only**. Edge/Bun/Deno: use platform native WS or SSE via `@nextrush/stream`.

Details: `references/adapters.md`, `references/nextjs.md`, `references/serverless-edge.md`.

## Next.js (in this skill)

```typescript
// src/server/app.ts
import { createApp, createRouter } from 'nextrush';
const app = createApp();
const api = createRouter();
api.get('/hello', (ctx) => ctx.json({ ok: true }));
app.route('/api', api);
export { app };

// app/api/[[...route]]/route.ts
import { app } from '@/server/app';
import { handle } from 'nextrush/nextjs';
export const { GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS } = handle(app);
```

Class/DI apps: pass async factory to `handle(() => bootApp())` so boot is memoized. See `references/nextjs.md`.

## Middleware (install separately)

```typescript
import { cors } from '@nextrush/cors';
import { helmet } from '@nextrush/helmet';
import { bodyParser } from '@nextrush/body-parser';
import { validate } from '@nextrush/validation';
import { rateLimit } from '@nextrush/rate-limit';
import { compression } from '@nextrush/compression';
import { cookies } from '@nextrush/cookies';
import { csrf } from '@nextrush/csrf';
import { logger } from '@nextrush/logger';
import { requestId } from '@nextrush/request-id';
import { timer } from '@nextrush/timer';
import { health } from '@nextrush/health';
import { openapi } from '@nextrush/openapi';
import { staticMiddleware } from '@nextrush/static';
import { z } from 'zod';

app.use(errorHandler());
app.use(requestId());
app.use(timer());
app.use(logger());
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(bodyParser());
app.use(rateLimit({ windowMs: 60_000, max: 100 }));

const CreateUser = z.object({ name: z.string().min(1), email: z.string().email() });
app.post('/users', validate(CreateUser), (ctx) => {
  ctx.status = 201;
  ctx.json(ctx.body);
});

app.use(openapi({ router: app.router /* or your router */, info: { title: 'API', version: '1.0' } }));
```

Order rule: **errorHandler outermost**; bodyParser before anything reading `ctx.body`; validation after bodyParser. Full catalog: `references/middleware.md`.

## Streaming vs WebSocket vs Events

| Need | Use |
|------|-----|
| One-way server→client (LLM tokens, logs) | `ctx.sse` / `ctx.ndjson` / `ctx.stream` |
| Bidirectional chat/rooms (Node process) | `@nextrush/websocket` Extension |
| In-process typed pub/sub | `@nextrush/events` Extension |

```typescript
// SSE
app.post('/chat', async (ctx) => {
  await ctx.sse(async (writer) => {
    for await (const token of tokens) {
      await writer.write({ data: token });
    }
  });
});

// WebSocket (Node)
import { createWebSocketExtension } from '@nextrush/websocket';
const app = createApp().extend(createWebSocketExtension());
await app.ready();
app.wss.on('/chat', (conn) => {
  conn.join('general');
  conn.on('message', (msg) => conn.broadcast('general', msg));
});
app.use(app.wss.upgrade());
const { server } = await listen(app, 8080);
await app.wss.attach(server);
```

See `references/streaming.md`, `references/websocket-events.md`.

## Errors

```typescript
import { NotFoundError, createError, errorHandler, isHttpError } from 'nextrush';

app.use(errorHandler({ includeStack: process.env.NODE_ENV !== 'production' }));

app.get('/x/:id', (ctx) => {
  if (!found) throw new NotFoundError('missing');
  // or: ctx.throw(404, 'missing'); createError(418, "teapot");
});
```

Classes: `BadRequestError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `UnprocessableEntityError`, `TooManyRequestsError`, `InternalServerError`, `ValidationError`, … Full list: `references/errors.md`.

## Testing (class modules)

```typescript
import { createTestModule } from '@nextrush/testing';

const ref = await createTestModule({
  controllers: [UserController],
  providers: [UserService],
})
  .override(UserService)
  .useValue(fakeUsers)
  .compile();

const res = await ref.request('GET', '/users/1');
// res.status, res.body
await ref.close();
```

See `references/testing.md`.

## Architecture Mental Model

```
Your routes / controllers / services
        ↓
   Application (compose middleware + router)
        ↓
   Context (WebContextBase) — Request/Response wrapper
        ↓
   Adapter (node | bun | deno | edge | serverless | nextjs)
        ↓
   Host runtime
```

Request path: middleware chain → match route → handler → build Response. Errors bubble to outermost `errorHandler`. Class path inserts guards → interceptors → handler → filters.

Deeper diagrams & package hierarchy: `references/architecture.md`.

## Best Practices (agents MUST follow)

1. **Prefer golden path**: `createApp` + middleware + routes + `serve` / `handle` / `createLambdaHandler` — minimal config.
2. **Thin handlers**: validate at boundary, call one service, return data. No business logic in controllers/route files.
3. **errorHandler first**, bodyParser before body use, specific routes before wildcards.
4. **Same app, many hosts**: write against Context; pick adapter only at the entry file.
5. **Capability over identity**: branch on `ctx.platform` / explicit options, not `ctx.runtime === 'node'`.
6. **Serverless**: module-scope app; no per-request mutable globals; per-request data on `ctx.state`.
7. **Next.js**: one `src/server/app.ts` export; route.ts is only the bridge; App Router catch-all.
8. **Class vs functional**: small/service = functional; growing domain + DI/guards = class. Hybrid OK.
9. **Do not import Node APIs into shared app code** destined for edge.
10. **ESM-only** packages — use `"type": "module"`.
11. **OpenAPI**: attach `endpoint({...})` + `validate(schema)`; mount `openapi({ router })`.
12. **Test with `@nextrush/testing`** for class modules; `app.callback()` with a mock `Context` for
    functional (no `app.handle()`).

Expanded checklist: `references/best-practices.md`.

## Package Map

```
nextrush                 # functional meta: createApp, router, listen/serve, errors, types
nextrush/class           # @Controller, DI, guards, interceptors, modules
nextrush/nextjs          # handle(app) → Next App Router exports

@nextrush/core           # Application engine
@nextrush/router         # segment-trie router
@nextrush/di             # container
@nextrush/types          # Context, Middleware, Runtime, PlatformId
@nextrush/errors         # HttpError hierarchy
@nextrush/runtime        # WebContextBase, detection, IP, body helpers
@nextrush/stream         # stream/sse/ndjson runners
@nextrush/testing        # createTestModule
@nextrush/dev            # CLI: dev/build/generate
create-nextrush          # project scaffolder

@nextrush/adapter-node | adapter-bun | adapter-deno
@nextrush/adapter-edge | adapter-serverless | adapter-nextjs

middleware: cors helmet body-parser form-data validation rate-limit
            compression cookies csrf static template logger timer
            request-id health openapi

extensions: @nextrush/websocket  @nextrush/events
```

## Common Gotchas

1. `errorHandler` must be outermost.
2. `ctx.body` empty without body-parser (or multipart for uploads).
3. Route order: `/users/list` before `/users/:id`.
4. `registerControllers({ root })` is cwd-relative.
5. Functional `createApp` is DI-free by design — class path uses `nextrush/class`.
6. Serverless: never `createApp()` inside the exported handler.
7. `ctx.runtime === 'node'` false on Lambda/edge adapters — use `ctx.platform`.
8. Next.js mount mismatch: routes registered without the `/api` prefix the URL has (or vice versa) → 404 + dev warning from `handle()`.
9. WebSocket needs both `app.use(wss.upgrade())` **and** `wss.attach(server)`.
10. `validate()` throws `ValidationError` (400) — needs `errorHandler`.
11. Do not double-import `reflect-metadata` (class package already loads it).
12. Edge: no filesystem, no long sockets; prefer SSE over WS.

## When to load references

| Topic | File |
|-------|------|
| Functional API surface | `references/functional-api.md` |
| Class/DI/guards/modules | `references/class-api.md` |
| Middleware catalog + order | `references/middleware.md` |
| Context methods | `references/context.md` |
| Errors | `references/errors.md` |
| All adapters + decision tree | `references/adapters.md` |
| Edge + serverless deep dive | `references/serverless-edge.md` |
| Next.js App Router | `references/nextjs.md` |
| SSE/NDJSON/stream | `references/streaming.md` |
| WebSocket + events | `references/websocket-events.md` |
| Testing | `references/testing.md` |
| Scaffold + CLI | `references/scaffolding.md` |
| Architecture lifecycle | `references/architecture.md` |
| Best practices | `references/best-practices.md` |
