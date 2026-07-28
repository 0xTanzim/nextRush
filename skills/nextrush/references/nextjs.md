# Next.js Integration (`nextrush/nextjs`)

Mount a full NextRush `Application` inside a Next.js **App Router** route file. Same app code also runs under `listen()`, edge, or serverless adapters.

## When to use

- Next.js 14 / 15 / 16 App Router (`app/api/.../route.ts`)
- You want shared middleware, routers, DI, validation — not hand-written per-method route files

## When NOT to use

- Pages Router → migrate to App Router catch-all (this package does not support Pages)
- No Next.js involved → use `@nextrush/adapter-edge` or `@nextrush/adapter-serverless` directly

## Install

```bash
pnpm add nextrush
# handle is exported from nextrush/nextjs (adapter-nextjs)
```

## One-line bridge

```typescript
// app/api/[[...route]]/route.ts
import { app } from '@/server/app';
import { handle } from 'nextrush/nextjs';

export const { GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS } = handle(app);
```

`handle()` returns all seven Next route handlers. It wraps `@nextrush/adapter-edge`'s fetch engine and wires `ctx.waitUntil()` to Next's `after()` when available.

## Recommended project layout

```text
src/server/
  app.ts                 # ONLY export that route.ts imports
  routes/users.route.ts  # HTTP only
  services/users.service.ts  # pure domain — no ctx
app/api/[[...route]]/route.ts  # bridge only
```

```typescript
// src/server/services/users.service.ts
export async function findUser(id: string) {
  return db.user.findUnique({ where: { id } });
}

// src/server/routes/users.route.ts
import { createRouter } from 'nextrush';
import { findUser } from '../services/users.service';

export const usersRouter = createRouter();
usersRouter.get('/:id', async (ctx) => {
  const user = await findUser(ctx.params.id);
  if (!user) ctx.throw(404, 'User not found');
  ctx.json(user);
});

// src/server/app.ts
import { createApp } from 'nextrush';
import { usersRouter } from './routes/users.route';

const app = createApp();
app.route('/api/users', usersRouter);
export { app };
```

Mount prefixes belong on the **application** (`app.route(prefix, router)`), never on the Next bridge. The request URL is not rewritten by `handle()`.

## Class-based / async boot

```typescript
import { createApp } from 'nextrush';
import { registerModule } from 'nextrush/class';
import { handle } from 'nextrush/nextjs';
import { AppModule } from '@/server/app.module';

export const { GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS } = handle(async () => {
  const app = createApp();
  await registerModule(app, AppModule, { prefix: '/api' });
  return app;
});
```

Factory is **memoized** after first success. Failed boots retry on the next request (not permanently poisoned).

## Options

```typescript
handle(app, {
  timeout: 24_000, // ms → 504 on exceed
  onError: (error, ctx) => new Response(JSON.stringify({ error: error.message }), { status: 500 }),
});
```

## Mount mismatch (dev only)

If the URL is `/api/users` but routes were registered at `/users` (or the reverse), you get 404. In non-production, `handle()` probes the stripped path and logs a mount-mismatch hint via `app.logger.warn`. Fix by aligning `app.route('/api', ...)` with the `app/api/` segment.

## Compatibility notes

- Fully Web-standard — no `node:*` in the adapter; works on every host Next.js runs on
- `params` accepted as Promise (Next 15+) or object (Next 14) via structural typing
- Background work: `ctx.waitUntil(promise)` → Next `after()` when present; no-op otherwise

## Same app, other hosts

```typescript
// Standalone Node (no Next)
import { serve } from 'nextrush';
import { app } from './server/app.js';
await serve(app, { port: 8080 });

// Cloudflare
import { createCloudflareHandler } from '@nextrush/adapter-edge';
export default createCloudflareHandler(app);
```
