# Architecture

NextRush v3 is built as a modular monorepo. Every feature lives in its own package; the `nextrush` meta package re-exports the essentials for convenience.

---

## Monorepo Structure

```
nextrush/
├── packages/
│   ├── types/           # @nextrush/types       — shared TypeScript types
│   ├── errors/          # @nextrush/errors       — HTTP error classes
│   ├── core/            # @nextrush/core         — Application, middleware
│   ├── router/          # @nextrush/router       — Radix-tree routing
│   ├── di/              # @nextrush/di           — Dependency injection
│   ├── decorators/      # @nextrush/decorators   — @Controller, @Get, @Body …
│   ├── runtime/         # @nextrush/runtime      — Runtime detection
│   ├── nextrush/        # nextrush               — Meta package
│   ├── adapters/
│   │   ├── node/        # @nextrush/adapter-node
│   │   ├── bun/         # @nextrush/adapter-bun
│   │   ├── deno/        # @nextrush/adapter-deno
│   │   └── edge/        # @nextrush/adapter-edge
│   ├── middleware/
│   │   ├── body-parser/ # @nextrush/body-parser
│   │   ├── cors/        # @nextrush/cors
│   │   ├── helmet/      # @nextrush/helmet
│   │   ├── csrf/        # @nextrush/csrf
│   │   ├── rate-limit/  # @nextrush/rate-limit
│   │   ├── cookies/     # @nextrush/cookies
│   │   ├── compression/ # @nextrush/compression
│   │   ├── multipart/   # @nextrush/multipart
│   │   ├── request-id/  # @nextrush/request-id
│   │   └── timer/       # @nextrush/timer
│   └── plugins/
│       ├── controllers/ # @nextrush/controllers
│       ├── events/      # @nextrush/events
│       ├── logger/      # @nextrush/logger
│       ├── static/      # @nextrush/static
│       ├── template/    # @nextrush/template
│       └── websocket/   # @nextrush/websocket
├── apps/
│   ├── docs/            # Documentation site
│   ├── benchmark/       # Benchmark suite
│   └── playground/      # Testing playground
└── draft/               # Architecture docs & RFCs
```

---

## Package Dependency Hierarchy

Dependencies flow strictly downward. **Lower packages never import from higher packages.**

```
@nextrush/types
       ↓
@nextrush/errors
       ↓
@nextrush/core
       ↓
@nextrush/router
       ↓
@nextrush/di
       ↓
@nextrush/decorators
       ↓
@nextrush/controllers
       ↓
@nextrush/adapter-*
       ↓
@nextrush/middleware/*
       ↓
nextrush  (meta package)
```

Cross-package imports use only published interfaces. Internal implementation details are never imported directly across package boundaries.

---

## Design Principles

### 1. Minimal Core

The core is under 3,000 lines of code. Application setup, middleware composition, and plugin installation are the only responsibilities of `@nextrush/core`.

### 2. Zero Runtime Dependencies

No external runtime dependencies in core, router, errors, types, adapters, or middleware packages. The only approved exceptions are:

- `reflect-metadata` — required for decorator metadata (DI)
- `tsyringe` — DI container implementation (`@nextrush/di` only)
- `@clack/prompts` — interactive CLI (`create-nextrush` scaffolder only)

### 3. Type Safety

Full TypeScript strict mode. No `any`. `unknown` is used at system boundaries. All exported types are documented.

### 4. Dual Paradigm

Functional routes and class-based controllers are first-class citizens:

- **Functional** — `createRouter()` + route handlers → zero setup overhead, great for scripts and microservices
- **Class-based** — `@Controller` + `@Service` + `controllersPlugin` → DI, testability, large codebases

### 5. Runtime Agnostic Core

The `@nextrush/core` package does not use any runtime-specific APIs (`process`, `Deno`, `Bun`). Platform coupling is isolated to adapter packages.

### 6. Plugin System

Every optional capability (logging, static files, WebSocket, controllers) is a plugin that implements the `Plugin` interface. Plugins have access to lifecycle hooks: `onRequest`, `onResponse`, `onError`, and `extendContext`.

---

## Package Size Limits

| Package | Max LOC |
|---|---|
| `@nextrush/types` | 500 |
| `@nextrush/errors` | 600 |
| `@nextrush/core` | 1,500 |
| `@nextrush/router` | 1,000 |
| `@nextrush/di` | 400 |
| `@nextrush/decorators` | 800 |
| `@nextrush/controllers` | 800 |
| `@nextrush/adapter-*` | 500 |
| `@nextrush/middleware/*` | 300 |
| `@nextrush/plugin/*` | 600 |

---

## Tooling

| Tool | Purpose |
|---|---|
| Turborepo | Monorepo build orchestration |
| pnpm | Package manager |
| TypeScript 5.x | Language |
| tsup | Package bundling |
| Vitest | Testing |
| ESLint | Linting |
| Prettier | Formatting |
| Changesets | Release management |
