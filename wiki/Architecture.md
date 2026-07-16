# Architecture

NextRush ships as one repo with many publishable packages. The **`nextrush`** meta package bundles what most Node apps need; everything else stays optional.

---

## Repository layout

```
nextrush/
├── packages/
│   ├── types/           @nextrush/types
│   ├── errors/          @nextrush/errors
│   ├── core/            @nextrush/core
│   ├── router/          @nextrush/router
│   ├── di/              @nextrush/di
│   ├── class/           @nextrush/class (decorators, controllers, DI-facing API)
│   ├── runtime/         @nextrush/runtime
│   ├── nextrush/        nextrush (meta)
│   ├── adapters/        node, bun, deno, edge
│   ├── middleware/      body-parser, cors, helmet, …
│   └── plugins/         controllers, logger, static, …
├── apps/
│   ├── docs/            Fumadocs site (GitHub Pages)
│   ├── benchmark/
│   └── playground/
└── draft/               Design notes / RFCs
```

---

## Dependency direction

Imports flow **down** only. No cycles.

```mermaid
flowchart TD
  T["@nextrush/types"]
  E["@nextrush/errors"]
  C["@nextrush/core"]
  R["@nextrush/router"]
  RT["@nextrush/runtime"]
  D["@nextrush/di"]
  CL["@nextrush/class"]

  T --> E --> C --> R --> RT --> D --> CL
```

**Rule:** No package below may import from any package above. All cross-package imports use published barrel exports. **Exception:** `import type` allows type-only imports across any boundary.

---

## Package summary

| Package | Role |
|---------|------|
| `@nextrush/types` | HTTP types, interfaces, constants |
| `@nextrush/errors` | Error hierarchy, factory functions |
| `@nextrush/core` | Application, middleware composition, Extension host |
| `@nextrush/router` | Segment-trie routing |
| `@nextrush/runtime` | Multi-runtime detection and abstractions |
| `@nextrush/di` | Dependency injection (tsyringe wrapper) |
| `@nextrush/class` | Class runtime — decorators, controller discovery/registration, guards, filters, interceptors, modules, lifecycle |
| `@nextrush/adapter-node` | Node.js HTTP adapter |
| `@nextrush/adapter-bun` | Bun HTTP adapter |
| `@nextrush/adapter-deno` | Deno HTTP adapter |
| `@nextrush/adapter-edge` | Edge/Workers (fetch) adapter |
| `@nextrush/middleware/*` | CORS, auth, compression, rate-limit, etc. |
| `@nextrush/extensions/*` | Events, WebSocket, and other long-lived app-scoped services |
| `nextrush` | Meta package (re-exports core + Node adapter; class API via the `nextrush/class` subpath) |

---

## Package size budgets

| Package | Max LOC |
|---------|---------|
| `@nextrush/types` | 500 |
| `@nextrush/errors` | 600 |
| `@nextrush/core` | 1,500 |
| `@nextrush/router` | 1,000 |
| `@nextrush/di` | 400 |
| `@nextrush/class` | — (no fixed cap) |
| `@nextrush/adapter-*` | 500 |
| `@nextrush/middleware/*` | 300 |

---

## Design constraints

**Small core** — Application bootstrap, middleware composition, Extension wiring, and route mounting live in `@nextrush/core`. No business logic, no extras.

**Zero external deps** — types, errors, core, router, adapters, and middleware stay slim. Approved exceptions: `reflect-metadata` (decorator metadata, DI), `tsyringe` (`@nextrush/di` only), `@clack/prompts` (`create-nextrush` only).

**Strict TypeScript** — No `any`; use `unknown` at system boundaries. Full strict mode in CI.

**Two paradigms** — Functional routing (`createRouter`) for services; class-based with DI for larger codebases. Both are first-class.

**Platform agnostic** — `@nextrush/core` has no `process`, `Deno`, or `Bun` calls. Adapters isolate platform specifics.

**Middleware, registrars, and Extensions** — Logging, static files, and WebSockets ship as middleware; controller discovery (`registerControllers`) ships as a registrar (a plain async function you call and await); long-lived app-scoped services like the event bus ship as the rare Extension (`app.extend()` + `await app.ready()`). There is no `Plugin` interface and no `app.plugin()`.

---

## Integration flow

```mermaid
flowchart LR
  A["@nextrush/types<br/>shared defs"]
  B["@nextrush/core<br/>app + middleware"]
  C["@nextrush/router<br/>trie matching"]
  D["adapters<br/>Node/Bun/Deno"]
  E["@nextrush/di<br/>@nextrush/class"]
  F["middleware/*<br/>plugins/*"]

  A --> B
  B --> C
  C --> D
  B --> E
  B --> F
  E --> B
```

App wires together **router** + **middleware** + **plugins**. Adapters and DI are optional layers on top.

---

## Tooling

| Tool | Role |
|------|------|
| Turborepo | Build orchestration, caching |
| pnpm workspaces | Package linking |
| TypeScript 5.x | Strict compilation |
| tsup | Bundle packages |
| Vitest | Unit + integration tests (90%+ coverage target) |
| ESLint + Prettier | Style enforcement |
| Changesets | Version management, changelogs |

---

## For deeper dives

- [Core Concepts](Core-Concepts) — how Application, Context, and Middleware work
- [Request Lifecycle](Request-Lifecycle) — complete flow from HTTP to response
- [Plugins](Plugins) — extension system and lifecycle hooks
- [Performance](Performance) — optimization strategies and benchmarks
- [Contributing](Contributing) — development setup and conventions
