# Extension Model — ground truth for docs rewrite (M7)

Source of truth: `docs/RFC/RFC-NEXTRUSH-PLUGIN-SYSTEM.md` (approved v4) and
`docs/guides/migration-extension-model.md`. This file is the fact sheet every
doc-rewrite pass must follow. Do not invent APIs beyond what's listed here —
verify against the referenced source files if unsure.

## The taxonomy (lead every doc with this)

Three extension kinds, one idiom each. Present as **unequal in weight**:
Middleware ~99% (application programming), Registrar ~0.9% (wiring functions),
Extension ~0.1% (framework/runtime infrastructure — rare, for framework authors).

| Kind | Idiom | Examples |
|---|---|---|
| Middleware | `app.use(fn())` | cors, helmet, body-parser, logger, static, rate-limit, compression, openapi, template |
| Registrar/Factory | direct import + call (await if async) | `registerControllers(app, opts)`, `createWebSocket()` |
| Extension | `app.extend(ext)` + `await app.ready()` | `events()` |

**There is no `Plugin`, `app.plugin()`, `PluginWithHooks`, `PluginMeta`, or
`app.plugin()`/`app.pluginAsync()`/`app.getPlugin()`/`app.hasPlugin()`. These
were REMOVED, not deprecated.** Do not document them as current API. They may
only appear in a clearly-labeled "before" block of a migration/history page.

## Core APIs (verify signatures against packages/core/src/application.ts if unsure)

```ts
import { createApp, createRouter, listen, serve } from 'nextrush';

const app = createApp();               // owns a default router (batteries-included)
app.get('/x', handler);                // delegates to app.router
app.post(...); app.put(...); app.patch(...); app.delete(...); app.head(...); app.all(...);
// NOTE: no app.options() verb — collides with the app.options config property.
// Register OPTIONS via app.all(), the router, or CORS middleware.

app.use(middleware);                   // request pipeline
app.route(path, router);               // mount a sub-router at a prefix
app.setErrorHandler((error, ctx) => {...}); // NOT app.onError() (removed)

app.extend(extension);                 // sync, queues; setup() deferred to ready()
await app.ready();                     // boot barrier — adapters call this automatically
                                        // before start(); extend()/use()/route() throw after ready()
await app.close();                     // reverse-order destroy, aggregated errors

app.container;                         // per-app DI container (optional)
app.router;                            // the app-owned router (optional on @nextrush/core's createApp)
```

`@nextrush/core`'s `createApp()` is a **minimal engine, bring-your-own router**
(`createApp({ router })` or `app.route(path, router)`; `app.get()` throws "No
router configured" otherwise). `nextrush`'s `createApp()` (the meta package) is
**batteries-included** and injects a default router automatically. Most user-facing
docs should show the `nextrush` import.

## Writing an Extension

```ts
import type { Extension } from '@nextrush/types';

export function myExtension(): Extension {
  return {
    name: 'my-extension',
    needs: [],                          // optional: other extension names required first
    setup(ctx) {
      // ctx: { app, logger, env, name, container?, decorate }
      ctx.decorate('myThing', someValue); // extension-only primitive; throws on name collision
      ctx.app.use(someMiddleware);
    },
    destroy() { /* cleanup, runs in reverse registration order at app.close() */ },
  };
}
```

Typed surface: `declare module '@nextrush/core' { interface Application { myThing: Foo } }`.
There is **no public `app.decorate()`** — only `ctx.decorate()` inside `setup()`.
`app.hasDecorator(name)` is the public read-only check.

## Package-by-package migration (what changed)

| Package | Old | New |
|---|---|---|
| `@nextrush/events` | `eventsPlugin()` → `Plugin` | `events()` → **Extension**. `app.extend(events()); await app.ready();` then `app.events.emit(...)` |
| `@nextrush/openapi` | `Plugin`, `app.plugin(openapi({router}))` | **middleware**: `app.use(openapi({ router, info }))` |
| `@nextrush/template` | `template()` middleware AND `templatePlugin()` | `template()` middleware **only** — `templatePlugin` removed |
| `@nextrush/controllers` | `ControllersPlugin`/`controllersPlugin({router,...})`, `app.plugin(...)` | **registrar**: `await registerControllers(app, { root, prefix })` — reads `app.router` + `app.container`; must be awaited before `serve()` |
| `@nextrush/websocket` | factory (unchanged) | unchanged: `createWebSocket()` + `app.use(wss.upgrade())` |
| `@nextrush/di` | global `container` singleton | per-app: `app.container`, `createApp({ container })`; `Container` type now in `@nextrush/types`; `ContainerInterface` is a deprecated alias in `@nextrush/di` |

`ControllersPluginOptions` → renamed `ControllersOptions`.

## Directory locations (imports/package names UNCHANGED — cosmetic only)

- `packages/middleware/{logger,static,openapi,template,cors,helmet,...}`
- `packages/extensions/{events,websocket}`
- `packages/controllers` (top-level)

Do not tell readers to change any `import ... from '@nextrush/x'` — package
names did not change, only their folder location in the monorepo (irrelevant to
consumers).

## Full working example (functional)

```ts
import { createApp, createRouter, listen } from 'nextrush';
import { openapi } from '@nextrush/openapi';
import { events } from '@nextrush/events';

const router = createRouter();
const app = createApp({ router });

router.get('/hello', (ctx) => ctx.json({ message: 'Hello NextRush!' }));

app.use(openapi({ router, info: { title: 'API', version: '1.0.0' } }));
app.extend(events());

await listen(app, 8080); // adapters call app.ready() for you
app.events.emit('server:started', {});
```

## Full working example (class-based)

```ts
import 'reflect-metadata';
import { createApp, listen } from 'nextrush';
import { Controller, Get, Service, registerControllers } from 'nextrush/class';

@Service()
class UserService { findAll() { return [{ id: 1, name: 'Alice' }]; } }

@Controller('/users')
class UserController {
  constructor(private users: UserService) {}
  @Get() findAll() { return this.users.findAll(); }
}

const app = createApp();
await registerControllers(app, { root: './src' });
await listen(app, 8080);
```

## Rewrite instructions for every page

1. Replace every `app.plugin(...)` / `Plugin` / `eventsPlugin` / `templatePlugin` /
   `controllersPlugin` example with the table above.
2. Do not add speculative capabilities (no auto dependency ordering, no encapsulation,
   no plugin marketplace) — the RFC explicitly rejects these.
3. Concept pages (`concepts/plugins.mdx`) should be renamed/rewritten to the
   extension-model taxonomy — lead with middleware, treat Extension as rare/advanced.
4. Follow the repo's own docs steering: `docs-standards.instructions.md`,
   `docs-mdx-ui.instructions.md`, `docs-api-reference.instructions.md` (tiering,
   forbidden words, TypeTable for API props, etc.)
5. Verify every code example is copy-paste runnable against the API above.
6. Do NOT touch: `docs/RFC/RFC-NEXTRUSH-PLUGIN-SYSTEM.md`, `docs/RFC/RFC-NEXTRUSH-*.md`,
   `report/FRAMEWORK-AUDIT-REPORT.md`, `CHANGELOG.md`, `.changeset/*.md` — these are
   historical/process artifacts that legitimately reference the old API as "before".
