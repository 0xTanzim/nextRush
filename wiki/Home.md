# NextRush

**NextRush is a TypeScript web framework built to eliminate accidental complexity from backend development.** Applications get a small, explicit core, a runtime-independent execution model, and a class-based layer on top for teams that prefer declarative APIs — with no framework lock-in in either direction.

**v4 is current** — ESM-only, Node ≥ 22, TypeScript 5.x. See [Getting Started](Getting-Started) to start a server in under a minute.

## What NextRush looks like

Two layers, one core. **Functional** — small and explicit:

```ts
import { createApp, listen } from 'nextrush';

const app = createApp();

app.get('/hello/:name', (ctx) => {
  ctx.body = { message: `Hello, ${ctx.params.name}!` };
});

await listen(app, 8080);
```

Handlers write through the [`Context`](Core-Concepts) — no returned `Response` objects, no hidden global state.

**Class-based — module-first** for larger apps that prefer controllers and DI. Declare a feature as a `@Module`, compose features into an `AppModule`, and `registerModule` wires the whole graph:

```ts
import { createApp, listen } from 'nextrush';
import { Controller, Get, Module, registerModule } from 'nextrush/class';

@Controller('/users')
class UsersController {
  @Get()
  list() { return [{ id: 1, name: 'Ada' }]; }
}

@Module({ controllers: [UsersController] })
class UsersModule {}

@Module({ imports: [UsersModule] })
class AppModule {}

const app = createApp();
await registerModule(app, AppModule);
await listen(app, 8080);
```

Same `app`, same runtime — the class layer just declares routes and dependencies instead of wiring them by hand. See [Controllers & Decorators](Controllers-and-Decorators) and [Modules](Modules).

## Why NextRush

- **One obvious golden path** — copy-paste-runnable, working out of the box.
- **Runtime independent** — the same app runs on Node, Bun, Deno, and edge runtimes via [adapters](Adapters); core speaks only Web-standard primitives.
- **Small core, two layers** — a functional core (routes, middleware, context) and an optional [class runtime](Controllers-and-Decorators) (controllers, DI, modules) that is a registrar on top of the core, not a rewrite.
- **Zero-dependency core** — the framework owns complexity; applications stay lean and fast. See [Performance](Performance) for the benchmark scoreboard.
- **Excellent DX** — strict types, actionable errors, autocomplete-friendly APIs, [testing](Testing) built around real objects, not mocks.

## Explore

- [Getting Started](Getting-Started) — install, scaffold, first server
- [Core Concepts](Core-Concepts) — application, context, handlers, middleware
- [Routing](Routing) — the segment-trie router, params, mounting
- [Middleware](Middleware) — composition and ordering
- [Error Handling](Error-Handling) — error hierarchy and handlers
- [Controllers & Decorators](Controllers-and-Decorators) — the class-based layer
- [Dependency Injection](Dependency-Injection) — the container and scopes
- [Request Scope](Request-Scope) — per-request services and scope bubbling
- [Modules](Modules) — an `AppModule` composing feature modules
- [Lifecycle](Lifecycle) — `onInit` / `onShutdown` boot and shutdown hooks
- [Discovery](Discovery) — auto-discovering controllers
- [Diagnostics](Diagnostics) — introspection report for your routes and providers
- [Extensions](Extensions) — long-lived app-scoped services
- [Streaming](Streaming) — text, SSE, and NDJSON responses
- [Request Lifecycle](Request-Lifecycle) — how a request flows through the pipeline
- [Adapters](Adapters) — runtime abstraction and parity
- [Testing](Testing) — unit, integration, and E2E patterns
- [Performance](Performance) — benchmarks and tuning
- [Packages](Packages) — package index and exports
- [Architecture](Architecture) — monorepo design and invariants
- [Contributing](Contributing) — development setup and conventions
- [Changelog](Changelog) — release history and upgrade notes

## External

- [Documentation site](https://0xtanzim.github.io/nextRush/docs) — full API reference, guides, and tutorials
- [Repository](https://github.com/0xTanzim/nextRush)
- [npm](https://www.npmjs.com/package/nextrush)
