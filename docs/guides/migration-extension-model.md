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
  `declare module '@nextrush/core' { interface Application { … } }` (or, since this
  session, the `Extension<TDecorated>` generic — see §11).
- **`needs` is declare-and-assert, not auto-sorted.** At `ready()`, in registration
  order, before running each extension's `setup()`, every name in its `needs` array
  must already have completed `setup()`. If not, `ready()` throws:
  `Extension "db" needs "events", but "events" was not registered before it. Register the "events" extension before "db".`
  Register dependencies before dependents — there is no automatic reordering.

## 7a. `close()` before `ready()`

Both `app.callback()` and `app.close()` warn (via `app.logger.warn(...)`) if extensions
were registered via `extend()` but `ready()` was never called — their `setup()` never
ran, so `close()` still calls `destroy()` on them with no established state. In normal
usage (via any adapter's `serve`/`listen`) this never fires, since adapters always call
`ready()` first. It only fires if you build your own `app.callback()`/`app.close()` call
path and skip `ready()`.

## 8. DI container

The container contract lives in `@nextrush/types` (`Container`). `@nextrush/di` still
exports `Container` (the previous `ContainerInterface` alias has been removed). Each app owns its container:
`createApp({ container })`, `app.container`, and `ExtensionContext.container`.

## 9. Package locations (imports unchanged)

Folders were reorganized (`packages/middleware/*`, `packages/extensions/*`,
`packages/controllers`), but **package names and imports are unchanged** — no action needed.

## 10. `Router` interface narrowing (breaking, easy to miss)

`@nextrush/types`' structural `Router` interface's `use()` no longer accepts a
sub-router: `use(middleware: Middleware): this` only. Sub-router mounting
(`router.use(path, subRouter)`) remains on the **concrete** `@nextrush/router`
`Router` class (it needs internal tree access the structural interface can't
express) — it was never removed there, only from the public type.

If you typed a function parameter, custom router-like object, or test double
against `import type { Router } from '@nextrush/types'` and relied on
`router.use(path, subRouter)` compiling against that type, it will no longer
typecheck. Use the concrete `@nextrush/router` class directly, or
`Application.route(path, router)` for cross-package router composition.

## 11. `Extension<TDecorated>` generic inference (additive, non-breaking)

`Extension` now takes an optional type parameter describing what it decorates:
`Extension<{ events: EventEmitter<T> }>`. `Application.extend()` returns
`this & TDecorated`, so `app.extend(events<MyEvents>()).events` is statically
typed with **zero `declare module` augmentation** — this supersedes the
`declare module` pattern shown in §6/§7 above for extensions that adopt it
(`@nextrush/events` already does). Existing plain `Extension` implementations
with no generic are unaffected — `TDecorated` defaults to `{}`.

Two things to know if you write your own typed extension:

- Chain in one expression (`const app = createApp().extend(x)`), not a `let`
  reassignment (`let app = createApp(); app = app.extend(x);`) — the decorated
  type is lost on reassignment because the `let` binding's declared type
  doesn't carry the intersection.
- `TDecorated` is a phantom type — TypeScript trusts it, it never verifies the
  declared shape matches what `setup()` actually calls `ctx.decorate()` with.
  A mismatched generic will typecheck and autocomplete incorrectly.
