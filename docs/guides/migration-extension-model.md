# Migration Guide — Plugin System → Extension Model

This is a **breaking major**. NextRush replaced the plugin system with a
**Composition-First** extension model. See `docs/RFC/RFC-NEXTRUSH-PLUGIN-SYSTEM.md`
for the rationale.

**The one-line summary:** *middleware for the request pipeline; a plain function
when you already hold the object it configures; an Extension only for a
long-lived service that lives on the app.*

---

## 1. `app.plugin(...)` is gone

There is no `app.plugin()`, `app.pluginAsync()`, `app.getPlugin()`, `app.hasPlugin()`,
`Plugin`, `PluginWithHooks`, `PluginMeta`, or `PluginFactory`. What each old plugin
becomes:

| Old | New | Kind |
| --- | --- | --- |
| `app.plugin(openapi({ router }))` | `app.use(openapi({ router }))` | middleware |
| `app.plugin(templatePlugin(...))` | `app.use(template(...))` | middleware |
| `app.plugin(eventsPlugin())` | `app.extend(events())` + `await app.ready()` | Extension |
| `app.plugin(controllersPlugin({ router, root }))` | `await registerControllers(app, { root })` | registrar |

## 2. Events

```ts
// Before
import { eventsPlugin } from '@nextrush/events';
app.plugin(eventsPlugin());

// After
import { events } from '@nextrush/events';
app.extend(events());
await app.ready();           // adapters (serve/listen) call this for you
app.events.emit('user:created', { id: '1' });
```

## 3. OpenAPI (now middleware)

```ts
// Before: app.plugin(openapi({ router }))
// After:
import { openapi } from '@nextrush/openapi';
app.use(openapi({ router, info: { title: 'API', version: '1.0.0' } }));
```

## 4. Controllers (now a registrar)

```ts
// Before
app.plugin(controllersPlugin({ router, root: './src', prefix: '/api' }));

// After — reads app.router + app.container; must be awaited before serve()
import { registerControllers } from 'nextrush/class';
await registerControllers(app, { root: './src', prefix: '/api' });
```

`ControllersPluginOptions` is renamed `ControllersOptions`.

## 5. App-owned router

`createApp()` from `nextrush` now owns a router, so `app.get/post/...` work directly:

```ts
import { createApp, serve } from 'nextrush';

const app = createApp();
app.get('/hello', (ctx) => ctx.json({ ok: true }));  // delegates to app.router
await serve(app, { port: 8080 });
```

To share one router with `openapi`/`registerControllers`, pass it explicitly:

```ts
import { createApp, createRouter } from 'nextrush';
const router = createRouter();
const app = createApp({ router });
app.use(openapi({ router }));
await registerControllers(app, { root: './src' });
```

Importing `createApp` from `@nextrush/core` directly gives a minimal engine with
**no** default router — inject one (`createApp({ router })`) or use `app.route(path, router)`.

> There is no `app.options()` route method — it collides with the `app.options`
> config property. Register OPTIONS via `app.all()`, the router, or CORS middleware.

## 6. Error handler

```ts
// Before: app.onError(handler)   (removed)
// After:
app.setErrorHandler((error, ctx) => { /* ... */ });
```

## 7. Lifecycle & adapters

- Register everything, then boot: `app.extend(...)` / `app.use(...)` → `await app.ready()`.
  `serve()`/`listen()` call `ready()` automatically before accepting traffic.
- `app.extend()`, `app.use()`, and `app.route()` throw after `ready()` — configuration
  is frozen once booted.
- **Bun and Deno `serve()`/`listen()` are now `async`** — `await` them.
- Writing an Extension: `{ name, needs?, setup(ctx), destroy? }`. Attach app state with
  `ctx.decorate(name, value)` (collision-checked) and type it with
  `declare module '@nextrush/core' { interface Application { … } }`.

## 8. DI container

The container contract lives in `@nextrush/types` (`Container`). `@nextrush/di` still
exports `ContainerInterface` (now a deprecated alias). Each app owns its container:
`createApp({ container })`, `app.container`, and `ExtensionContext.container`.

## 9. Package locations (imports unchanged)

Folders were reorganized (`packages/middleware/*`, `packages/extensions/*`,
`packages/controllers`), but **package names and imports are unchanged** — no action needed.
