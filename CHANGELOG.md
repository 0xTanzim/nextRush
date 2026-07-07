# Changelog

All notable changes to the NextRush framework will be documented in this file.

This project follows [Semantic Versioning](https://semver.org/) and uses a unified version across all `@nextrush/*` packages.

## [3.0.7]

### Changed

- **`create-nextrush`**: Simplified scaffold template code; the scaffolder now auto-installs `@nextrush/dev` so generated projects have a working `nextrush dev`/`nextrush build` out of the box.

## [3.0.6]

### Fixed

- **CLI install reliability**: The `nextrush` meta-package no longer declares a `bin` entry (prevents pnpm bin-link conflicts with `@nextrush/dev`'s own binaries).
- **`@nextrush/dev`**: Always builds before publish, so the `nextrush`/`nextrush-dev` binaries are present in the published package.
- **`create-nextrush`**: Scaffolded projects use `nextrush dev` / `nextrush build` scripts directly (no `npx` indirection) and include `@nextrush/dev` in scaffolded dev dependencies.
- Added a repo-wide bin validator (`scripts/validate-bins.ts`) to catch missing `bin` targets during release verification.

## [3.0.5]

### Added

- **`@nextrush/validation`**: New package — Standard Schema request validation middleware. `validate(schema)` validates and coerces `ctx.body`; `validate({ body, query, params })` validates any combination of targets. Works with any [Standard Schema](https://standardschema.dev) library (Zod, Valibot, ArkType). Failures throw the existing `ValidationError` from `@nextrush/errors` — no new error shape.
- **`@nextrush/openapi`**: New package — zero-config OpenAPI 3.1 generation, the first renderer of the Route Metadata System. `app.plugin(openapi({ router }))` reads route metadata contributed by `validate()` and `endpoint()`, generates a cached OpenAPI 3.1 document once (lazily, on first request), and serves it at `/openapi.json` plus a Swagger UI at `/docs`.
- **Route Metadata System**: New framework-level foundation (`@nextrush/types`, `@nextrush/router`) that lets tooling read a route's request/response shapes without duplicating schemas. `@nextrush/router` exports `endpoint()` (a pure metadata marker) and `Router.getRoutes(): readonly RouteDefinition[]`. `@nextrush/validation`'s `validate()` and `@nextrush/controllers`' decorators (`@Controller({ tags })`, `@Get/@Post({ description, deprecated })`) both contribute to it automatically. Additive and backward-compatible — the request hot path is unaffected; an interleaved A/B benchmark confirmed dispatch throughput is unchanged.
- **`nextrush`**: Re-exports `endpoint()` and the `RouteDefinition`/`RouteMetadata` types, so `import { endpoint } from 'nextrush'` sits next to `createRouter`.

### Fixed

- **`@nextrush/di`**: `container.reset()` clears internal resolution tracking; Vitest runs test files sequentially (`fileParallelism: false`) so the global singleton container is not raced by parallel test files — fixes flaky or timing-out circular-dependency tests in CI and locally.

## [3.0.4]

### Changed

- **Unified semver**: All `@nextrush/*` packages, **`nextrush`**, **`create-nextrush`**, and **`nextrush-benchmark`** are released at **3.0.4**.

### Fixed

- **`@nextrush/di`**: **`container.reset()`** clears internal resolution tracking; Vitest runs **test files sequentially** (`fileParallelism: false`) so the global singleton container is not raced by parallel files—fixes flaky or timing-out circular-dependency tests in CI.

## [3.0.3]

### Changed

- **Unified semver**: All `@nextrush/*` packages, **`nextrush`**, **`create-nextrush`**, and **`nextrush-benchmark`** are released at **3.0.3**.

### Fixed / Added

- **`@nextrush/dev`**: Startup `tsconfig.json` checks skip noisy decorator warnings for functional (no-decorator) projects; warn only when decorator flags are partly enabled.
- **`nextrush`**: Ships the **`nextrush` CLI** via dependency on **`@nextrush/dev`** (`bin/nextrush.js`).
- **Documentation**: Installation, dev tools, create-nextrush, and versioning notes aligned with **3.0.3**.

## [3.0.2]

### Changed

- **Unified semver**: All `@nextrush/*` packages, **`nextrush`**, **`create-nextrush`**, and **`nextrush-benchmark`** were released at **3.0.2**.
- **Documentation**: Landing badge, FAQs, roadmap, and benchmark methodology tables reference **3.0.2** and stable **v3** messaging (replacing outdated **alpha** copy where users first encounter the framework).

### Added / Fixed

- **`create-nextrush`**: Published **`bin/create-nextrush.js`** so `pnpm create nextrush`, `npm create nextrush`, `npx create-nextrush`, and `pnpm dlx create-nextrush` execute the CLI from the npm tarball.
- **Package metadata**: Homepage and repository URLs aligned across packages; `@nextrush/dev` CLI reports **3.0.2**.
- **`@nextrush/events`** / **`@nextrush/template`**: Plugin `version` metadata aligned with npm releases.

## [3.0.0-alpha.2]

Historical aggregate changelog for early **v3** prereleases. **Current npm releases use the stable `3.0.x` line** — see **[3.0.4]** above.

### Added

- **@nextrush/csrf** — CSRF protection middleware with double-submit cookie, signed tokens, HMAC validation, and origin checking
- **@nextrush/helmet** — Security headers middleware with CSP, HSTS, X-Frame-Options, and 11 configurable policies
- **@nextrush/cookies** — Cookie parsing and serialization middleware
- **@nextrush/compression** — Response compression with gzip/deflate/brotli support
- **@nextrush/multipart** — Multipart form-data parsing with pluggable storage (memory/disk)
- **@nextrush/rate-limit** — Rate limiting middleware with sliding window algorithm
- **@nextrush/request-id** — Request ID generation and propagation
- **@nextrush/timer** — Request timing middleware
- **@nextrush/body-parser** — JSON and URL-encoded body parsing
- **@nextrush/cors** — Cross-Origin Resource Sharing middleware
- **@nextrush/events** — Event emitter plugin for application lifecycle hooks
- **@nextrush/logger** — Structured logging plugin
- **@nextrush/static** — Static file serving plugin
- **@nextrush/template** — Template rendering plugin with multiple engine support
- **@nextrush/websocket** — WebSocket plugin
- **@nextrush/controllers** — Decorator-based controller auto-discovery and handler building
- **@nextrush/decorators** — `@Controller`, `@Get`, `@Post`, `@Body`, `@Param`, `@UseGuard` decorators
- **@nextrush/di** — Dependency injection container wrapping tsyringe
- **@nextrush/adapter-bun** — Bun runtime adapter
- **@nextrush/adapter-deno** — Deno runtime adapter
- **@nextrush/adapter-edge** — Edge runtime adapter (Cloudflare Workers, Vercel Edge)
- **@nextrush/adapter-node** — Node.js HTTP adapter
- **@nextrush/runtime** — Runtime detection and normalization
- **create-nextrush** — CLI scaffolding tool
- **@nextrush/dev** — Development tools and hot reload
- Set-Cookie header accumulation (append instead of overwrite) on all web adapters
- `sideEffects: false` in all packages for tree-shaking
- `trustProxy` support in Bun adapter `serve()` path

### Fixed

- `@nextrush/decorators` — moved `@nextrush/types` from `devDependencies` to `dependencies` (was missing in consumer installs)
- Set-Cookie headers were being overwritten instead of accumulated on Bun, Deno, and Edge adapters
- Bun adapter `serve()` was not passing `trustProxy` option to context
- TypeScript strict mode compliance across all packages

## [3.0.0-alpha.1]

### Added

- **@nextrush/core** — Application class, middleware composition, plugin system
- **@nextrush/router** — High-performance radix tree routing
- **@nextrush/types** — Shared TypeScript type definitions
- **@nextrush/errors** — HTTP error hierarchy with status codes

---

_NextRush is a minimal, modular, high-performance Node.js framework._
