# TODO — Extension Model v4 Migration

Implementation of `docs/RFC/RFC-NEXTRUSH-PLUGIN-SYSTEM.md` (**APPROVED**). Breaking change, single major version. Branch: `feat/extension-model`.

**North star:** *Keep an extension concept, kill the plugin ceremony.* Composition-First — middleware (99%) / registrars (0.9%) / Extensions (0.1%).

**Process:** TDD (RED → GREEN → REFACTOR) per repo iron law. The core contract (M1) is frozen before the independent package migrations (M5) fan out.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done

---

## M0 — Prep & inventory
- [x] Approve RFC (v4), create branch `feat/extension-model`
- [x] Blast-radius inventory (32 files reference the old plugin surface)
- [x] Write this `TODO.md`

## M1 — Core extension model (types + core)  ✅ DONE (core 87 tests green)
**`@nextrush/types`**
- [ ] Add `Extension` (`name`, `needs?: readonly string[]`, `setup(ctx)`, `destroy?`)
- [ ] Add `ExtensionContext` (`app: ExtensionHost`, `logger`, `env`, `name`, `decorate`) + `ExtensionHost`
- [ ] Move `Logger` interface into `@nextrush/types` (shared contract); core re-exports
- [ ] Delete `Plugin`, `PluginWithHooks`, `PluginMeta`, `PluginFactory`, `ApplicationLike`
- [ ] Update `types/src/index.ts` exports

**`@nextrush/core`**
- [ ] `extend(ext): this` — sync, queues, dup-name error, throws after `ready()`
- [ ] `ready(): Promise<this>` — idempotent boot barrier; assert `needs`; run `setup(ctx)` in order; freeze
- [ ] Internal `decorate(name, value)` via `ExtensionContext` + public `hasDecorator(name)` (collision detection)
- [ ] `close()` — reverse-order `destroy`, `allSettled`, aggregated errors (keep behavior, rename plugins→extensions)
- [ ] Remove `plugin()`, `pluginAsync()`, `getPlugin()`, `hasPlugin()`, `onError()` setter, `hookPlugins` machinery
- [ ] `assertNotReady()` replaces `assertNotRunning()` semantics for config-freeze
- [ ] Rewrite `application.test.ts` to the extension model (TDD)
- [ ] **Verify:** `@nextrush/types` build + `@nextrush/core` test green in isolation

## M2 — Adapters + meta wiring  ✅ DONE (4 adapters typecheck; meta Plugin→Extension)
- [ ] node/bun/deno/edge adapters: `await app.ready()` before `callback()` / `start()`
- [ ] `nextrush` meta: drop `Plugin` export, add `Extension`/`ExtensionContext`; update `class.ts`
- [ ] Prepare batteries-included `createApp` seam (finalized in M3)

## M3 — App-owned router (R1, validated)  ✅ DONE (delegation + batteries createApp)
- [ ] `ApplicationOptions.router?: Router` (type-only import from `@nextrush/types`); auto-mount `router.routes()`
- [ ] Delegating `app.get/post/put/patch/delete/head/options/all/route`; clear error if no router
- [ ] Extend `ExtensionHost` with routing methods
- [ ] `nextrush` meta `createApp` injects `createRouter()` by default

## M4 — Per-app DI container  ✅ DONE core plumbing (di 83 tests; consumer de-globalization in M5)
- [ ] `Application` owns a container; `createApp({ container })`; remove global-singleton reliance
- [ ] Add `container` to `ExtensionContext`
- [ ] `@nextrush/di`: deprecate/gate the global `container` export
- [ ] Controllers resolve from `app.container`

## M5 — Package reclassification & migration  ✅ CODE DONE (events/openapi/template/controllers migrated & green; directory moves deferred — see note)
- [ ] `events` → `Extension` (`setup(ctx){ ctx.decorate('events', …) }`); remove local `Plugin` redefinition
- [ ] `openapi` → middleware factory: `app.use(openapi(app.router, opts))`; delete the plugin wrapper
- [ ] `template` → delete `templatePlugin()`; keep `template()` middleware only
- [ ] `controllers` → `registerControllers(app, opts)` registrar; delete `ControllersPlugin`
- [ ] `websocket` → keep factory; optional `attach` Extension
- [ ] Move `plugins/logger` + `plugins/static` → `packages/middleware/`
- [ ] Decide + apply directory taxonomy: `packages/plugins/` → `packages/extensions/` (events; ws-attach); registrars (`controllers`) home TBD (`packages/controllers`)
- [ ] Update every package `README.md`

## M6 — Consumers  ✅ DONE (playground, example, create-nextrush 122 tests, dev generators)
- [ ] `apps/playground` → `await registerControllers(app, …)`, `app.get`, awaited boot
- [ ] `examples/*` (openapi-basic, etc.)
- [ ] `create-nextrush` templates (`class-based.ts`, `full.ts`) — emit new API, not `app.plugin(`
- [ ] `@nextrush/dev` generators — emit new API

## M7 — Docs  ✅ DONE (parallel sub-agent rewrite + manual scrub; docs build 0 errors; zero unambiguous old-API references outside historical files)
- [ ] Rewrite `concepts` + `api-reference/plugins` → extension model, middleware-first taxonomy
- [ ] Before/after migration guide (`guides/migration.mdx`)
- [ ] Update `package-hierarchy` doc (core/router are siblings; app-owned router)

## M8 — Verify & release
- [ ] Full workspace `pnpm build && pnpm typecheck && pnpm test` green
- [ ] Changeset (major bump)
- [ ] Final migration guide + CHANGELOG

---

### Notes / decisions
- **R1 (app-owned router) validated** against the real dep graph: `core`→`errors`+`types` only; `router`→`types` only; they are siblings, wired by the `nextrush` meta-package. Batteries-included `createApp` lives in the meta-package.
- `ExtensionContext` grows additively: M1 ships `{ app, logger, env, name, decorate }`; `runtime` + `container` added in M3/M4 when their sources are wired.
- Workspace-wide build stays red between M1 and M5 (contract deleted, consumers not yet migrated) — expected; each milestone verifies its own packages in isolation.

---

## Class-based framework — RFC-required enhancements

Net-new capabilities intentionally **not** implemented in the class-based remediation
(Waves 1–5). Each is a public-API addition, so each needs its own approved RFC before work
starts (repo iron law: *RFC before implementation* for public APIs). The remediation waves
fixed correctness, DX, and doc-accuracy defects only — they did not add new surface.

- [ ] **Request-scoped DI** — add a `request` value to `Scope` (`'singleton' | 'transient'` today) for a fresh controller/service instance per request. Removes the singleton-state footgun documented in `packages/controllers/README.md` (§ Controller lifecycle).
- [ ] **Interceptors** — before/after-handler wrapping (transform result, timing, caching). An `INTERCEPTORS` metadata key exists in `@nextrush/decorators` with no implementation behind it.
- [ ] **Exception filters** — declarative per-controller/route error mapping, as an alternative to a global error-handling middleware.
- [ ] **Service lifecycle hooks** — `onModuleInit` / `onApplicationBootstrap` / `onShutdown`-style hooks for DI-managed services.
- [ ] **Module system / encapsulation** — group controllers + providers into modules with their own provider scope and explicit exports.
- [ ] **`@HttpCode()` decorator** — set a route's success status code declaratively (today: route `statusCode` option, `ctx.status`, or a thrown `HttpError`).
- [ ] **Full per-app DI isolation** — genuine per-app child containers so two `createApp()` instances have fully isolated service singletons. See `docs/RFC/RFC-NEXTRUSH-DI-CONTAINER-OWNERSHIP.md`.
