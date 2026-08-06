# Changelog

Release history and upgrade notes. NextRush follows [Semantic Versioning](https://semver.org/); all `@nextrush/*` packages share one version line. The repo keeps a fuller changelog in [`CHANGELOG.md`](https://github.com/0xTanzim/nextRush/blob/main/CHANGELOG.md) — this page is the migration-oriented summary.

## v4.0.x — stable (current)

**Released 2026-08-01** (`nextrush` 4.0.1, `@nextrush/core` 4.0.1, `@nextrush/class` 1.0.1). The v4 line is the current, supported release. Key facts:

- **ESM-only, permanently.** No `require` condition in any published package; enforced in CI. CommonJS consumers use dynamic `import()` or Node ≥ 22.12 native `require(esm)`. Rationale: see https://0xtanzim.github.io/nextRush/docs/internals/versioning
- **Runtime adapters** for Node, Bun, Deno, and edge (Cloudflare Workers / Vercel Edge). Core speaks only Web-standard primitives; behavior parity is proven by the conformance suite, not assumed. See [Adapters](Adapters).
- **Class layer consolidated into `nextrush/class`** — controllers, decorators, DI, modules, guards, filters. The old `@nextrush/decorators` and `@nextrush/controllers` packages are gone; their surface now lives in `nextrush/class`.
- **"Plugin" terminology retired → "Extension".** Long-lived app-scoped services are now [Extensions](Extensions).
- **Router is a segment trie**, not a radix tree. See [Routing](Routing).
- **Node ≥ 22 required** (meta-package). Bun and Deno have their own adapters.
- New packages along the way: `@nextrush/stream` (text/SSE/NDJSON), `@nextrush/validation` (Standard Schema validation), `@nextrush/openapi` (OpenAPI 3.1 generation), `@nextrush/health`, `@nextrush/testing`.

### Upgrading from v3

The framework was rewritten around a functional core for v4; most application code changes are import-path changes plus the response model change.

1. **Handlers write through `ctx`, never return a `Response`.** `ctx.body = value` (or `ctx.send`/`ctx.json`); status via `ctx.status = 201` or `@HttpCode`. If you returned `Response` objects in v3 handlers, that no longer works — return data, write through `ctx`.
2. **Consolidate imports.** `@nextrush/controllers`, `@nextrush/decorators` → `nextrush/class`. Run the codemod: `nextrush codemod consolidate-imports`.
3. **Plugins → Extensions.** Rename registrations and adapt to the extension lifecycle (`setup` / `destroy`, `app.extensions`). See [Extensions](Extensions).
4. **Radix-tree → segment-trie routing.** The matching semantics you rely on (static > dynamic > wildcard precedence, `:param` and `*` wildcards) are preserved; check the [Routing](Routing) page if you relied on subtle radix-tree ordering.
5. **Decorator config.** Class apps need `experimentalDecorators` + `emitDecoratorMetadata` in `tsconfig.json`, and must build with `nextrush dev` / `nextrush build` (esbuild/tsx/swc skip decorator-metadata emission). See [Controllers & Decorators](Controllers-and-Decorators).
6. **Port 8080 default** (v3 examples often used 3000; the framework default is 8080 — pass your own port to `listen` if you need another).

## v3.x — legacy

The v3 line introduced the modular package family (`@nextrush/router`, `@nextrush/errors`, `@nextrush/di`, middleware packages such as `@nextrush/cors`, `@nextrush/helmet`, `@nextrush/rate-limit`, adapters for bun/deno/edge, `create-nextrush`, `@nextrush/dev`). v3.0.4 and later unified all packages on one semver line. v3 is superseded by v4; no new features land there.

## Before v3

Pre-v3 alphas (`3.0.0-alpha.x`) were the earliest modular releases and are not supported. Upgrade to v4 for current APIs, security, and performance work.

## Versioning policy

- One version line across `nextrush`, all `@nextrush/*` packages, `create-nextrush`, and benchmarks.
- Breaking changes land only in major versions, with a migration path (like this page).
- ESM-only is permanent policy, not a roadmap item.

See [Packages](Packages) for the package index and [Contributing](Contributing) for the release workflow.
