# Middleware

Cross-cutting concerns — auth, logging, timing, body parsing, CORS — apply to many routes, not one. Copy them into each handler and a new handler can silently forget one. NextRush solves this by letting you register **middleware**: async functions that wrap your handlers and run on every matched request.

## The onion model

Think of middleware as concentric layers wrapped around your handler, not a straight line of steps. A request travels inward through each layer to reach the handler; the response travels back outward through the same layers in reverse. Every middleware gets two moments — one on the way in (before `ctx.next()`) and one on the way out (after it).

```ts
import { createApp, createRouter, listen } from 'nextrush';

const app = createApp();

app.use(async (ctx) => {
  const start = Date.now();
  await ctx.next();                                    // hand off, then wait
  ctx.set('X-Response-Time', `${Date.now() - start}ms`); // runs on the way out
});

const router = createRouter();
router.get('/', (ctx) => ctx.json({ ok: true }));
app.route('/', router);

await listen(app, 8080);
```

The header is set *after* `await ctx.next()` — the timing middleware wraps everything downstream and finishes last. Without `await`, the "after" half runs before the response is ready and the request can settle out from under you. Always `await ctx.next()`.

## Execution order

"Before" code runs in registration order; "after" code runs in reverse. The outermost middleware opens first and closes last:

```ts
app.use(async (ctx) => { console.log('1: before'); await ctx.next(); console.log('1: after'); });
app.use(async (ctx) => { console.log('2: before'); await ctx.next(); console.log('2: after'); });

const router = createRouter();
router.get('/', (ctx) => { console.log('3: handler'); ctx.json({ ok: true }); });
app.route('/', router);

// 1: before → 2: before → 3: handler → 2: after → 1: after
```

Because a mounted router is itself a middleware, anything registered **after** the routes never runs before them. **Registration order is a security boundary**: an auth guard added after a route it should protect has no effect on that route at all. Register security middleware (auth, CORS, rate limiting) before your routes.

## The signature

A middleware is any async function with this shape — both forms call the same dispatch:

```ts
import type { Middleware } from 'nextrush';

const a: Middleware = async (ctx) => { await ctx.next(); };
const b: Middleware = async (ctx, next) => { await next(); };
```

Pick one style and stay consistent. Short-circuit the chain deliberately by **not** calling `next()` — send a response and return:

```ts
app.use(async (ctx) => {
  if (!ctx.state.user) {
    ctx.status = 401;
    return ctx.json({ error: 'Unauthorized' }); // no ctx.next() → downstream never runs
  }
  await ctx.next();
});
```

Calling `ctx.next()` twice in one middleware rejects with `next() called multiple times` — the pipeline fails loudly rather than corrupting the chain.

## Sharing data

`ctx.state` is the shared scratch space middleware and handlers pass along. Auth middleware writes it, the handler reads it — one object, no extra bag:

```ts
import { createApp } from 'nextrush';

declare function verifyToken(token: string): Promise<{ id: string }>;

const app = createApp();

app.use(async (ctx) => {
  const token = ctx.get('Authorization')?.replace('Bearer ', '');
  if (token) ctx.state.user = await verifyToken(token);
  await ctx.next();
});
```

Treat anything in `ctx.state` as only as trustworthy as whatever put it there.

## Composing middleware

`compose()` folds an array into one middleware you can register as a unit. It snapshots the array at call time, so later mutations change nothing:

```ts
import { createApp, compose } from 'nextrush';
import type { Middleware } from 'nextrush';

const app = createApp();

const requestId: Middleware = async (ctx) => {
  ctx.set('X-Request-Id', crypto.randomUUID());
  await ctx.next();
};

const timer: Middleware = async (ctx) => {
  const start = Date.now();
  await ctx.next();
  ctx.set('X-Response-Time', `${Date.now() - start}ms`);
};

app.use(compose([requestId, timer]));
```

## Built-in middleware packages

Middleware ships as separate packages — install only what you use:

| Package | Export |
|---|---|
| `@nextrush/body-parser` | `json()`, `urlencoded()`, `text()`, `raw()`, `bodyParser()` |
| `@nextrush/cors` | `cors()` |
| `@nextrush/helmet` | `helmet()` |
| `@nextrush/rate-limit` | `rateLimit()` |
| `@nextrush/logger` | `logger()`, `attachLogger()` |
| `@nextrush/request-id` | `requestId()`, `correlationId()`, `traceId()` |
| `@nextrush/cookies`, `@nextrush/csrf`, `@nextrush/compression`, `@nextrush/static`, `@nextrush/template`, `@nextrush/health`, `@nextrush/timer` | one factory each |

```ts
import { createApp, listen } from 'nextrush';
import { cors } from '@nextrush/cors';
import { json } from '@nextrush/body-parser';

const app = createApp();
app.use(cors());
app.use(json());
await listen(app, 8080);
```

## Errors in middleware

A throw from anywhere downstream propagates back up the onion to one boundary — an outer `try/catch` (the error handler) catches every error inside it. Put the error handler **first** so it wraps everything:

```ts
import { createApp, errorHandler, listen } from 'nextrush';

const app = createApp();
app.use(errorHandler()); // outermost — catches everything below

// ...auth, routes, everything else...
await listen(app, 8080);
```

See [Error-Handling](Error-Handling) for the full error story.
