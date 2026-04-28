# Changelog

All notable changes to the NextRush framework are documented here.

NextRush follows [Semantic Versioning](https://semver.org/) and uses a unified version across all `@nextrush/*` packages. Releases are managed with [Changesets](https://github.com/changesets/changesets).

**Version scheme**

| Segment | Meaning |
|---|---|
| Major (`x.0.0`) | Breaking API changes |
| Minor (`0.x.0`) | New features, backward-compatible |
| Patch (`0.0.x`) | Bug fixes, security patches |
| Pre-release (`-alpha.x`, `-beta.x`) | Unstable — API may change |

---

## [3.0.0-alpha.2] — Unreleased

### Added

**Middleware**

- **`@nextrush/csrf`** — CSRF protection middleware with double-submit cookie, signed tokens (HMAC-SHA256), and origin checking
- **`@nextrush/helmet`** — Security headers with CSP (including nonce support), HSTS, X-Frame-Options, Permissions-Policy, and 11 configurable policies
- **`@nextrush/cookies`** — Cookie parsing and serialization middleware (get, set, delete, signed cookies)
- **`@nextrush/compression`** — Response compression with Gzip/Deflate/Brotli; uses Web Compression Streams API for multi-runtime compatibility
- **`@nextrush/multipart`** — Multipart form-data parsing with pluggable memory and disk storage strategies; zero dependencies
- **`@nextrush/rate-limit`** — Rate limiting with Token Bucket (default), Sliding Window, and Fixed Window algorithms; tiered limits, IETF-compliant headers
- **`@nextrush/request-id`** — Request ID generation and propagation via `crypto.randomUUID()`; incoming ID validation to prevent header injection
- **`@nextrush/timer`** — Request timing middleware with sub-millisecond precision; `X-Response-Time` and `Server-Timing` header support
- **`@nextrush/body-parser`** — JSON and URL-encoded body parsing with configurable size limits
- **`@nextrush/cors`** — OWASP-compliant CORS middleware with null-origin protection, regex ReDoS mitigation, Private Network Access (PNA) support, and built-in presets (`strictCors`, `devCors`, `simpleCors`)

**Plugins**

- **`@nextrush/events`** — Type-safe event emitter plugin for application lifecycle hooks
- **`@nextrush/logger`** — Structured logging plugin
- **`@nextrush/static`** — Static file serving plugin
- **`@nextrush/template`** — Template rendering plugin with multiple engine support
- **`@nextrush/websocket`** — WebSocket plugin
- **`@nextrush/controllers`** — Decorator-based controller auto-discovery and handler building; supports auto-scan and manual registration modes

**Decorators & DI**

- **`@nextrush/decorators`** — `@Controller`, `@Get`, `@Post`, `@Put`, `@Patch`, `@Delete`, `@Head`, `@Options`, `@All`, `@Body`, `@Param`, `@Query`, `@Header`, `@Ctx`, `@Req`, `@Res`, `@UseGuard`, `@Redirect`, `@SetHeader`
- **`@nextrush/di`** — Dependency injection container wrapping tsyringe; `@Service`, `@Repository`, `@Injectable`, `@Optional`, `inject`, `delay`; circular dependency detection and production-quality error messages

**Adapters**

- **`@nextrush/adapter-bun`** — Bun runtime adapter
- **`@nextrush/adapter-deno`** — Deno runtime adapter
- **`@nextrush/adapter-edge`** — Edge runtime adapter (Cloudflare Workers, Vercel Edge)
- **`@nextrush/adapter-node`** — Node.js HTTP adapter (included in `nextrush` meta package)

**Tooling**

- **`@nextrush/runtime`** — Runtime detection and normalization
- **`create-nextrush`** — Interactive CLI scaffolder (`pnpm create nextrush`); supports functional, class-based, or full style; middleware presets; runtime targets
- **`@nextrush/dev`** — Development tools: hot reload dev server, production build with decorator metadata, code generators (`generate controller`, `generate service`, `generate middleware`, `generate guard`, `generate route`)

**Core improvements**

- Set-Cookie header accumulation (append instead of overwrite) on Bun, Deno, and Edge adapters
- `sideEffects: false` in all packages for tree-shaking
- `trustProxy` support in Bun adapter `serve()` path

### Fixed

- **`@nextrush/decorators`** — moved `@nextrush/types` from `devDependencies` to `dependencies` (was missing in consumer installs)
- Set-Cookie headers were being overwritten instead of accumulated on Bun, Deno, and Edge adapters
- Bun adapter `serve()` was not passing `trustProxy` option to context
- TypeScript strict mode compliance across all packages

---

## [3.0.0-alpha.1]

### Added

- **`@nextrush/core`** — Application class, Koa-style middleware composition, plugin system with lifecycle hooks (`onRequest`, `onResponse`, `onError`, `extendContext`)
- **`@nextrush/router`** — High-performance segment-trie router with O(k) path matching; named parameters (`:id`); wildcards (`*`); O(1) static route fast path; `router.redirect()`; duplicate route detection
- **`@nextrush/types`** — Shared TypeScript type definitions (`Context`, `Middleware`, `Plugin`, `PluginWithHooks`, `RouteHandler`, `HttpMethod`, `HttpStatusCode`, `ContentType`, `HttpStatus`)
- **`@nextrush/errors`** — Full HTTP error hierarchy (4xx + 5xx); validation error classes; factory functions (`notFound`, `badRequest`, etc.); `errorHandler()` and `notFoundHandler()` middleware

---

## Upgrade Notes

### alpha.1 → alpha.2

No breaking API changes. New packages are additive. The `nextrush` meta package exports are unchanged.

If you relied on Set-Cookie headers from multiple `ctx.set('Set-Cookie', ...)` calls on Bun/Deno/Edge adapters, they now accumulate correctly (previously only the last value was kept).

---

_NextRush is a minimal, modular, high-performance Node.js framework._
