# Changelog

All notable changes to the NextRush framework will be documented in this file.

This project follows [Semantic Versioning](https://semver.org/) and uses a unified version across all `@nextrush/*` packages.

## [3.0.2]

### Changed

- **Unified semver**: All `@nextrush/*` packages, **`nextrush`**, **`create-nextrush`**, and **`nextrush-benchmark`** are released at **3.0.2**.
- **Documentation**: Landing badge, FAQs, roadmap, and benchmark methodology tables reference **3.0.2** and stable **v3** messaging (replacing outdated **alpha** copy where users first encounter the framework).

### Added / Fixed

- **`create-nextrush`**: Published **`bin/create-nextrush.js`** so `pnpm create nextrush`, `npm create nextrush`, `npx create-nextrush`, and `pnpm dlx create-nextrush` execute the CLI from the npm tarball.
- **Package metadata**: Homepage and repository URLs aligned across packages; `@nextrush/dev` CLI reports **3.0.2**.
- **`@nextrush/events`** / **`@nextrush/template`**: Plugin `version` metadata aligned with npm releases.

## [3.0.0-alpha.2]

Historical aggregate changelog for early **v3** prereleases. **Current npm releases use the stable `3.0.x` line** — see **[3.0.2]** above.

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
