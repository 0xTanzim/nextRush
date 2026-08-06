# Packages

NextRush is a monorepo of small packages: a **meta-package** you install, a **functional core**
it re-exports, a **class runtime** you opt into, and then middleware, extensions, adapters, and
tooling you install only when you need them. Nothing is "installed but unused" — what lands on
disk depends on which API path you import.

## Install profile

```bash
pnpm add nextrush                          # functional core — zero third-party runtime deps
pnpm add nextrush @nextrush/class          # add class/DI: tsyringe + reflect-metadata
pnpm add @nextrush/cors @nextrush/helmet   # middleware, as needed
```

Two invariants govern every package:

- **ESM-only, permanently.** No `@nextrush/*` package's `exports` map declares a `require`
  condition; CommonJS output is not supported. Enforced in CI by `pnpm validate:esm-only`.
- **Node.js >= 22** (`engines.node >= 22.0.0` on every package).

## The meta-package

```js
import { createApp, createRouter, listen, serve } from 'nextrush';
import { Controller, Get, Service } from 'nextrush/class'; // subpath, opt-in
```

`nextrush` (the package you `pnpm add`) is the single import surface:

| Export path | Contents |
| ----------- | -------- |
| `nextrush` | Functional API: `createApp`, `createRouter`, `endpoint`, `compose`, HTTP errors, `listen` / `serve` / `createHandler` (node adapter), types |
| `nextrush/class` | Class runtime: decorators, controllers, guards, filters, DI, modules (re-exports `@nextrush/class`) |
| `nextrush/nextjs` | Next.js adapter entry (`@nextrush/adapter-nextjs`) |

It declares `@nextrush/class` and `@nextrush/di` as **optional peer dependencies**, so a
functional-only install never resolves them.

## Core (included in `nextrush`)

| Package | Description | Key exports |
| ------- | ----------- | ----------- |
| `@nextrush/core` | Application & middleware composition | `createApp`, `compose`, `Application` |
| `@nextrush/router` | High-performance segment-trie router | `createRouter`, `Router`, `endpoint` |
| `@nextrush/adapter-node` | Node.js HTTP adapter | `createHandler`, `listen`, `serve`, `ServerInstance` |
| `@nextrush/types` | Shared TypeScript types | `Context`, `Middleware`, `HttpMethod`, `Runtime`, `ServerAdapter`, `FetchAdapter` |
| `@nextrush/errors` | HTTP error classes | `HttpError`, `NotFoundError`, `BadRequestError`, `errorHandler` |
| `@nextrush/runtime` | Runtime detection & cross-runtime abstractions | `detectRuntime`, `capabilitiesFor`, `getRuntime`, `BodySource` |
| `@nextrush/stream` | Response streaming — SSE, NDJSON, built for AI/agentic apps | `sse`, `ndjson`, stream helpers |

`@nextrush/runtime` and `@nextrush/stream` ship with `@nextrush/adapter-node`; add them as
direct dependencies only to import their APIs yourself.

## Runtime adapters (install separately)

| Package | Target |
| ------- | ------ |
| `@nextrush/adapter-bun` | Bun (`Bun.serve`) |
| `@nextrush/adapter-deno` | Deno (`Deno.serve`) |
| `@nextrush/adapter-edge` | Cloudflare Workers / edge (`createCloudflareHandler`) |
| `@nextrush/adapter-serverless` | AWS Lambda (Function URL + API Gateway v1/v2), Google Cloud Functions, Azure Functions |
| `@nextrush/adapter-nextjs` | Next.js (prepends to the Next app) |

`@nextrush/adapter-conformance` is an **internal, unpublished** harness that proves these
behave identically on real runtimes — see [Adapters](Adapters).

## Middleware (install separately)

| Package | Description |
| ------- | ----------- |
| `@nextrush/body-parser` | JSON/form/text body parsing |
| `@nextrush/form-data` | File upload (multipart) parsing |
| `@nextrush/cors` | CORS headers |
| `@nextrush/helmet` | Security headers |
| `@nextrush/csrf` | CSRF protection |
| `@nextrush/rate-limit` | Rate limiting |
| `@nextrush/compression` | Response compression |
| `@nextrush/cookies` | Cookie handling |
| `@nextrush/validation` | Schema request validation (Zod / Valibot / ArkType) |
| `@nextrush/request-id` | Request ID generation |
| `@nextrush/timer` | Response time tracking |
| `@nextrush/health` | Liveness/readiness endpoints for orchestrator probes |
| `@nextrush/static` | Static file serving |
| `@nextrush/template` | Template rendering |
| `@nextrush/logger` | Structured logging |
| `@nextrush/security` | Additional security headers / hardening |
| `@nextrush/openapi` | Zero-config OpenAPI 3.1 generation from route metadata |

## Extensions (install separately)

Long-lived, stateful services — registered with `app.extend()`, booted at `app.ready()`. See
[Extensions](Extensions).

| Package | Description |
| ------- | ----------- |
| `@nextrush/events` | Type-safe event emitter (Extension) |
| `@nextrush/websocket` | WebSocket support (factory + middleware) |

## Class-based development (install separately)

| Package | Description | Key exports |
| ------- | ----------- | ----------- |
| `@nextrush/class` | Class runtime — decorators, controllers, guards, filters, interceptors, lifecycle, request scope, modules (import via `nextrush/class`) | `@Controller`, `@Get`, `@Service`, `registerControllers`, `registerModule`, `@Module`, `container` |
| `@nextrush/di` | Dependency injection (independent) | `container`, `inject`, `resolve`, scopes |
| `@nextrush/testing` | Test harness | `createTestModule().override().compile()` |

`@nextrush/di` is the only package with third-party runtime deps: `tsyringe@^4.10.0` and
`reflect-metadata@^0.2.2`, pulled only on the class path.

## Development

| Package | Description |
| ------- | ----------- |
| `@nextrush/dev` | Hot reload dev server, production builds, code generators (`nextrush dev` / `nextrush build` / `nextrush generate`) |
| `create-nextrush` | Project scaffolder — `pnpm create nextrush`, `npx create-nextrush@latest` |

## Versioning and governance

Packages follow [Semantic Versioning](https://semver.org/) via Changesets. The functional core
ships on `4.x`; `@nextrush/class`, `@nextrush/stream`, and `@nextrush/testing` lead their own
`1.x` lines. Package tiers, the sealed public surface, and deprecation rules are recorded in
`docs/adr/` (notably ADR-0005); new packages and public-API changes are RFC-gated — see
[Architecture](Architecture).

## Next steps

- [Core Concepts](Core-Concepts) — the functional API the meta-package re-exports
- [Controllers and Decorators](Controllers-and-Decorators) — the `nextrush/class` surface
- [Adapters](Adapters) — which adapter package to install per runtime
- [Extensions](Extensions) — stateful services vs stateless middleware
- [Performance](Performance) — why a zero-dependency core matters
- Docs-site package reference: https://0xtanzim.github.io/nextRush/docs/reference