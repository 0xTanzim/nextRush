# ADR-0002 — Extension Model (Plugin → Extension)

- **Status:** Accepted · Shipped
- **Date:** 2026-07
- **Supersedes:** the original `Plugin` / `app.plugin()` system
- **RFC:** `docs/RFC/RFC-NEXTRUSH-PLUGIN-SYSTEM.md` (approved)

## Context

The original plugin system (`Plugin`, `PluginWithHooks`, `PluginFactory`, `app.plugin()`,
`getPlugin()`, hook machinery) imposed ceremony on every extension point, whether or not it
needed lifecycle. In practice ~99% of capability is plain middleware, ~1% is one-time wiring,
and only a rare fraction needs long-lived state with boot/teardown. The plugin abstraction
taxed the common case to serve the rare one.

## Decision

Adopt a **composition-first** model with three deliberately unequal kinds:

1. **Middleware** (`app.use(fn())`) — the default; anything that processes a request.
2. **Registrar** — a plain imported function called once (e.g. `registerControllers`,
   `registerModule`, `createWebSocket`), awaited if async.
3. **Extension** (`app.extend(ext)` + `await app.ready()`) — rare; long-lived services that
   attach state to the app, run async boot, and tear down on shutdown (e.g. `events()`).

The `Extension` contract (`name`, `needs?`, `setup(ctx)`, `destroy?`) and `ExtensionContext`
live in `@nextrush/types`; `app.ready()` is an idempotent boot barrier that runs `setup` in
order, asserts `needs`, and freezes configuration. The old `Plugin` surface is deleted.

## Consequences

- **Positive:** the common case (middleware) has zero ceremony; extension authorship is a
  narrow, explicit, well-typed path; boot ordering and teardown are first-class.
- **Negative / cost:** a breaking change — this is why it lands in a single major. Existing
  `app.plugin()` callers migrate to `app.use()` / a registrar / `app.extend()`.
- **Follow-up:** decorator-collision detection (`hasDecorator`) hardens once real ecosystem
  extensions exist.
