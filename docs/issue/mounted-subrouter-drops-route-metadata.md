# Issue: Mounted sub-router routes lose `validate()`/`endpoint()` metadata

**Status:** Open
**Area:** `packages/router` (composition / registration)
**Affects:** `@nextrush/openapi` — request bodies and parameters missing from generated spec for mounted routes
**Reported:** 2026-08-21

## Summary

Routes mounted into a parent router via `router.mount(prefix, subRouter)` (or
`router.use(prefix, subRouter)`) lose the metadata contributions attached by
`validate()` (request schemas) and `endpoint()` (responses/summary/tags). The
copied routes still *work* at runtime (validation and docs metadata middleware
still runs), but `router.getRoutes()` returns definitions with **no metadata**,
so `@nextrush/openapi` generates operations with empty request bodies and no
parameters for those routes.

## Repro

```ts
import { createRouter, createApp } from 'nextrush';
import { validate } from '@nextrush/validation';
import { openapi } from '@nextrush/openapi';
import { z } from 'zod';

const authRouter = createRouter();
const body = z.object({ email: z.string().email(), password: z.string().min(6) });

authRouter.post('/register', validate(body), (ctx) => ctx.json({ ok: true }));

const router = createRouter();
const app = createApp({ router });

router.mount('/auth', authRouter); // runtime route: POST /auth/register works
app.use(openapi({ router }));

await listen(app, 8080);
```

Expected: `GET /openapi.json` contains `/auth/register` with a `requestBody`
schema derived from `body`.

Actual: `/auth/register` appears with only a default response — no
`requestBody`, no parameters.

## Root cause

Metadata contributions are transported two ways:

- **Route entries** (`endpoint()` markers, or a middleware function like
  `validate()` that carries the hidden `ROUTE_METADATA` symbol) — read by
  `addRoute()` from the `entries` array.
- **Middleware list** — `router.mount()`'s `copyRoutes()` re-registers each
  copied route as:

  ```ts
  addRoute(method, path, [entry.handler], combined);
  ```

  It passes only the handler as the route entry, and every contributing
  middleware (`validate()`) lands in the `middleware` array instead.

`addRoute()` (in `packages/router/src/registration.ts`) only collects metadata
contributions from `entries`, never from `middleware`, so the introspection row
pushed into `state.routeDefinitions` has `metadata: undefined`.

## Proposed fix

In `packages/router/src/registration.ts`, `addRoute()`, collect contributions
from the `middleware` array as well as from `entries`:

```ts
// after the existing entries loop:
for (const mw of middleware) {
  const contribution = readContribution(mw);
  if (contribution) contributions.push(contribution);
}
```

Add a regression test in `packages/router/src/__tests__/route-metadata.test.ts`
asserting that a route mounted from a sub-router (whose middleware carries a
`ROUTE_METADATA` contribution) retains its metadata in `getRoutes()`.

## Notes / considerations

- Runtime behavior is unaffected — the middleware still executes; only
  introspection metadata is lost.
- `subRouterMiddleware` (registered via `sub.use(mw)` before mounting) is
  prepended to the copied middleware list in `copyRoutes()`; reading
  contributions from the whole middleware list would also pick up any
  contribution such middleware carries. That matches the semantics of
  registering a contributing middleware directly on a route, and is safe: a
  middleware that contributes metadata should contribute it wherever it is
  attached.
- The `endpoint()` marker cannot appear in the middleware list (it is a pure
  marker, never middleware), so this fix covers the `validate()`/contributing-
  middleware case; `endpoint()` on a sub-router route is lost the same way and
  would need a separate change to `copyRoutes()` (e.g. carrying the sub-router
  entry's contributions through the copy).
