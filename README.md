# NextRush

> Minimal, modular, high-performance Node.js framework

[![npm version](https://badge.fury.io/js/nextrush.svg)](https://www.npmjs.com/package/nextrush)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-≥22-339933?logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)

<details>
<summary><strong>Table of contents</strong></summary>

<br>

[Why NextRush?](#why-nextrush) ·
[Module Format](#module-format-policy) ·
[Dependency Footprint](#dependency-footprint) ·
[Performance](#performance) ·
[Quick Start](#quick-start) ·
[Modules](#modules) ·
[Packages](#packages) ·
[Documentation](#documentation) ·
[Contributing](#contributing)

</details>

## Why NextRush?

- **Minimal Core** — Under 3,000 lines of code
- **Modular** — Install only what you need
- **Fast** — #3 overall vs Fastify / Hono / Koa / Express on a parity-validated suite
  (~85–92% of raw Node on like-for-like scenarios) — see [Performance](#performance)
- **Type-Safe** — Full TypeScript with zero `any`
- **ESM-only, permanently** — No package ever publishes a `require` condition; CommonJS output
  is not supported and will not be added. This is a ratified architectural decision, not a
  temporary state — see [Module Format Policy](#module-format-policy) below.
- **Lean install** — Functional core has **no third-party runtime deps**; class/DI
  (`nextrush/class`) opts into `tsyringe` + `reflect-metadata` only when you need it — see
  [Dependency Footprint](#dependency-footprint)
- **Modern DX** — Clean context API, async/await native

## Module Format Policy

**NextRush is ESM-only. Permanently.** No `@nextrush/*` package's `exports` map will ever
declare a `require` condition. CommonJS output is not supported and will not be added.

**Enforced in CI:** `pnpm validate:esm-only` fails the build if any package gains a `require`
condition.

<details>
<summary><strong>Why ESM-only (and not dual-publish)</strong></summary>

<br>

Node ≥22 already gives CommonJS consumers native `require(esm)` for synchronous import graphs on
current LTS (22.12+) — the strongest historical reason to dual-publish is covered by the engine
floor NextRush requires.

Dual-publishing would also reintroduce the ESM/CJS dual-package hazard on the `@nextrush/di`
path (`reflect-metadata`'s global patch + a `tsyringe` singleton can silently split into two
instances if both a CJS and an ESM copy load), at the cost of a doubled build/test/publish matrix
across ~35 packages.

Full rationale:
[Module Format & Compatibility](https://github.com/0xTanzim/nextRush/blob/main/apps/website/content/docs/internals/versioning.mdx).

</details>

## Dependency Footprint

NextRush is modular on purpose: **what lands on disk depends on which API path you use.** There
is no single “zero dependencies” claim for the whole framework — only for the functional core.

| Path | How you import it | Third-party runtime deps | What you install |
| ---- | ----------------- | ------------------------ | ---------------- |
| **Functional core** | `createApp`, `createRouter`, `listen` from `nextrush` | **None** | `pnpm add nextrush` |
| **Class / DI** | `@Controller`, `@Service`, guards… from `nextrush/class` | `tsyringe@^4.10.0`, `reflect-metadata@^0.2.2` | `pnpm add nextrush @nextrush/class` (or a class/full scaffold) |

**Functional path** is backed by pure `@nextrush/*` packages (`core`, `router`, `types`, `errors`,
`adapter-node`, …) with **no** `tsyringe` / `reflect-metadata` in their dependency graphs.

**Class path** pulls DI only when you opt in: `@nextrush/class` → `@nextrush/di` → those two
third-party packages.

```bash
# Functional-only — class/DI packages stay off disk (optional peers)
pnpm add nextrush

# Class / DI — brings in the DI stack
pnpm add nextrush @nextrush/class
```

<details>
<summary><strong>Why class deps are optional peers (install-level, not just import-level)</strong></summary>

<br>

The `nextrush` meta-package declares `@nextrush/class`, `@nextrush/di`, and `reflect-metadata` as
**optional peer dependencies**. A functional-only install never resolves them. `create-nextrush`
class-based and full templates add `@nextrush/class` for you.

Verified in-repo with `pnpm -r why reflect-metadata tsyringe`: both packages resolve only through
`@nextrush/di` (consumed by `@nextrush/class` / `nextrush/class`). They do **not** appear under
`@nextrush/core`, `@nextrush/router`, or `@nextrush/runtime`.

| Package | Role | External runtime deps |
| ------- | ---- | --------------------- |
| `@nextrush/types` | Shared types | none |
| `@nextrush/errors` | HTTP errors | none (→ types) |
| `@nextrush/core` | App + middleware composition | none (→ types, errors) |
| `@nextrush/router` | Segment-trie router | none (→ types) |
| `@nextrush/di` | DI container | `tsyringe`, `reflect-metadata` |
| `@nextrush/class` | Controllers, guards, modules | via `@nextrush/di` |

Middleware and adapters (`cors`, `helmet`, `body-parser`, edge adapters, …) are **separate
packages** — install only what you use.

</details>

## Performance

NextRush ranks **#3 overall** among popular Node frameworks in our parity-validated suite —
ahead of Hono, Koa, and Express; behind Fastify and a raw Node.js baseline (the zero-framework
yardstick). Serialization-heavy routes sit at **~90–92% of baseline**.

### Headline scoreboard

9 like-for-like scenarios × 2 concurrency levels × 6 frameworks = **108 points**. Win = 6 pts,
last = 1. Ties inside measurement noise split points.

| Rank | Framework | Score | Scenario wins |
| ---- | --------- | ----- | ------------- |
| 🥇 | **Raw Node.js** *(baseline)* | **105.5** / 108 | 18 |
| 🥈 | **Fastify** | **90.5** / 108 | 5 |
| 🥉 | **NextRush v3** | **68.1** / 108 | 0 |
| 4 | Hono | 60.1 / 108 | 0 |
| 5 | Koa | 34.0 / 108 | 0 |
| 6 | Express | 20.0 / 108 | 0 |

### Throughput @ 256 connections (req/s)

Mean of 6 runs · **wrk** · CPU-pinned. **Bold** = fastest in row.

| Scenario | Raw Node | NextRush | Fastify | Hono | Express |
| -------- | -------- | -------- | ------- | ---- | ------- |
| Hello World | **35,503** | 31,343 | 32,703 | 31,073 | 22,508 |
| JSON Serialization | **34,466** | 31,242 | 33,570 | 29,515 | 22,567 |
| Route Parameters | **33,672** | 28,847 | 30,743 | 27,911 | 20,889 |
| Large JSON | **22,589** | 20,717 | 21,748 | 19,416 | 15,558 |
| Send Object | **35,329** | 31,751 | 31,456 | 29,849 | 21,570 |
| POST JSON | **25,420** | 19,144 | 20,508 | 19,953 | 15,617 |

**NextRush vs baseline (this run):** Hello 88% · JSON 91% · Params 86% · Large JSON **92%** ·
Send Object 90% · POST 75% (body-parser safety work differs per framework).

> **Full interactive dashboard** (heatmap, scenario explorer, scaling charts, methodology):
> **[Benchmarks on the docs site](https://0xtanzim.github.io/nextRush/docs/getting-started/benchmarking)** ·
> [suite source](./apps/benchmark) · [latest report](./apps/benchmark/results/latest/REPORT.md)

<details>
<summary><strong>Measurement environment (this run)</strong></summary>

<br>

| | |
| --- | --- |
| **Run ID** | `2026-07-31T18-15-15` |
| **Tool** | wrk 4.2.0 (process-isolated C client) |
| **Profile** | `standard` · 30s · 6 runs · connections 1 · 64 · 256 |
| **Node** | v26.5.1 |
| **CPU** | Intel Core i5-8300H · 8 logical cores · pin server 2–7 · client 0–1 |
| **Timed cells** | 1,404 × 30s |
| **Frameworks** | Raw Node · NextRush v3 (`4.0.0-beta.0`) · Fastify 5.10 · Hono 4.12 · Koa 3.2 · Express 5.2 |

Absolute RPS is machine-specific (loopback, shared host). Use **relative rankings on identical
hardware** — re-run the suite on your box before capacity planning.

</details>

<details>
<summary><strong>What the harness guarantees</strong></summary>

<br>

- **Fairness is validated, not assumed** — `pnpm bench:validate` asserts byte-identical bodies,
  statuses, content types, framing, and headers across all six servers before any timing.
- **Multi-run statistics** — mean ± sample stddev + CV%; adjacent gaps smaller than combined
  stddev are scored as **ties**, never as leads.
- **Identical runtime config** — same Node flags, `NODE_ENV=production`, keep-alive, backlog,
  listen address, and shared payloads. Deviations from stock defaults are **disclosed** in the report.
- **Honest scope** — like-for-like measures identical *output*, not always identical *work*
  (query/body parser safety differs). Middleware, error handling, and static file are
  **idiomatic** (per-framework mechanism) and excluded from the 108-point headline.
- **Process isolation** — wrk does not share the server’s event loop (autocannon is the optional
  in-process fallback for quick local checks).

Full methodology: [`apps/benchmark/README.md`](./apps/benchmark/README.md).

</details>

<details>
<summary><strong>Run the suite yourself</strong></summary>

<br>

```bash
cd apps/benchmark
pnpm install
pnpm bench:validate   # abort if any server breaks parity
# Multi-run compare (CPU pin when you have cores to spare)
node scripts/run.js --compare --profile standard --runs 6 --pin 2-7 --client-pin 0-1
pnpm report           # regenerate REPORT.md + tables from results.json
```

| Profile | Duration | Connections | Runs | Notes |
| ------- | -------- | ----------- | ---- | ----- |
| `quick` | 10s | 64, 128 | 1 | Dev smoke only — not publishable |
| `standard` | 30s | 1, 64, 256 | 3+ | CI / daily comparison |
| `full` | 60s | 1, 64, 256, 512 | 5 | Release-grade |

</details>

## Quick Start

### Scaffold a Project (Recommended)

```bash
pnpm create nextrush my-api
cd my-api && pnpm dev
```

The `create nextrush` form (with a space) installs the `create-nextrush` package. You can also use `npx create-nextrush@latest` or `pnpm dlx create-nextrush@latest`. See the [create-nextrush docs](https://github.com/0xTanzim/nextRush/tree/main/packages/create-nextrush#usage).

The interactive scaffolder lets you choose between functional, class-based, or full style, pick a middleware preset, and select your runtime target.

### Manual Setup

```bash
pnpm add nextrush
```

```typescript
import { createApp, createRouter, listen } from 'nextrush';

const app = createApp();

// Create feature routers
const users = createRouter();
users.get('/', (ctx) => ctx.json([]));
users.get('/:id', (ctx) => ctx.json({ id: ctx.params.id }));
users.post('/', (ctx) => ctx.json({ received: ctx.body }));

// Mount routers — Hono-style composition
app.route('/users', users);

// Simple routes directly on app
const router = createRouter();
router.get('/', (ctx) => ctx.json({ message: 'Hello NextRush!' }));
app.route('/', router);

listen(app, 8080);
```

### Class-Based Controllers

```bash
pnpm add nextrush
```

```typescript
import { Controller, Get, Post, Body, Param, Service } from 'nextrush/class';

@Service()
class UserService {
  async findAll() {
    return [{ id: 1, name: 'Alice' }];
  }
}

@Controller('/users')
class UserController {
  constructor(private userService: UserService) {}

  @Get()
  findAll() {
    return this.userService.findAll();
  }

  @Get('/:id')
  findOne(@Param('id') id: string) {
    return { id };
  }

  @Post()
  create(@Body() data: unknown) {
    return data;
  }
}
```

### Service Scopes

Services are singletons by default. Pass `scope` for other lifecycles:

```typescript
import { Service } from 'nextrush/class';

@Service()                        // singleton — one shared instance
class ConfigService {}

@Service({ scope: 'transient' })  // a fresh instance on every resolve
class Formatter {}

@Service({ scope: 'request' })    // one instance per request, shared within it
class RequestId {
  readonly id = crypto.randomUUID();
}
```

Request scope is backed by a per-request child container. When a controller (or anything in its
dependency graph) is request-scoped, `registerControllers` resolves it fresh per request; a
purely-singleton controller keeps the memoized fast path with zero added per-request cost. This
bubbling is automatic — see the class-based guide and `docs/RFC/class-runtime/008-request-scope.md`.
Services read the request via the controller's `@Ctx` parameter, not constructor injection.

## Modules

As an app grows, a **module** groups a feature's controllers, providers, and the
sub-features it composes behind one declaration. `registerModule` wires the whole
graph in one call — it reuses the same pipeline as `registerControllers` (route
building, DI validation, lifecycle hooks, request scope).

```typescript
import { createApp, listen } from 'nextrush';
import { Module, Controller, Get, Service, registerModule } from 'nextrush/class';

@Service()
class UserService {
  findAll() { return [{ id: 1, name: 'Alice' }]; }
}

@Controller('/users')
class UserController {
  constructor(private users: UserService) {}
  @Get() findAll() { return this.users.findAll(); }
}

@Module({
  controllers: [UserController],
  providers: [UserService],
})
class UserModule {}

// Compose feature modules through `imports`
@Module({ imports: [UserModule] })
class AppModule {}

const app = createApp();
await registerModule(app, AppModule, { prefix: '/api' });
listen(app, 8080);
```

`@Module` takes four optional fields:

| Field         | Purpose                                                     |
| ------------- | ----------------------------------------------------------- |
| `imports`     | Other `@Module` classes this module composes                |
| `controllers` | `@Controller` classes owned by this module                  |
| `providers`   | Services/values/factories registered with DI                |
| `exports`     | Providers made visible to importers (recorded, not yet enforced) |

Providers are either a bare class (registered with its declared `@Service`
scope) or a config binding a token: `{ provide, useClass }`, `{ provide,
useValue }`, or `{ provide, useFactory, inject, scope }`. Imports are walked
safely — diamond/duplicate imports register once and import cycles are guarded.

> **Modules group, they do not yet encapsulate.** Every provider in the graph is
> visible to every module through the shared DI container; `exports` is recorded
> but not enforced. True per-module encapsulation (module-private providers) is
> planned follow-up work — see `docs/RFC/class-runtime/012-modules.md`.

## Context API

NextRush uses a unified context object for clean, intuitive code:

```typescript
// Request (Input)
ctx.method; // GET, POST, etc.
ctx.path; // /users/123
ctx.params; // { id: '123' }
ctx.query; // { page: '1' }
ctx.body; // Parsed request body
ctx.headers; // Request headers
ctx.get('header'); // Get specific header

// Response (Output)
ctx.status = 201; // Set status code
ctx.json(data); // Send JSON
ctx.send(text); // Send text
ctx.html(content); // Send HTML
ctx.redirect(url); // Redirect
ctx.set('header', 'value'); // Set header

// Middleware
ctx.next(); // Call next middleware
ctx.state; // Share data between middleware
```

## Packages

### Core (included in `nextrush`)

| Package                  | Description                          |
| ------------------------ | ------------------------------------ |
| `@nextrush/core`         | Application & middleware composition |
| `@nextrush/router`       | High-performance segment trie router   |
| `@nextrush/adapter-node` | Node.js HTTP adapter                 |
| `@nextrush/types`        | Shared TypeScript types              |
| `@nextrush/errors`       | HTTP error classes                   |
| `@nextrush/runtime`      | Runtime detection & cross-runtime abstractions (ships with `@nextrush/adapter-node`) |
| `@nextrush/stream`       | Response streaming — SSE, NDJSON, built for AI/agentic apps (ships with `@nextrush/adapter-node`; add as a direct dependency only to import its API yourself) |

### Middleware (install separately)

| Package                 | Description                 |
| ----------------------- | --------------------------- |
| `@nextrush/body-parser` | JSON/form/text body parsing |
| `@nextrush/form-data`   | File upload (multipart) parsing |
| `@nextrush/cors`        | CORS headers                |
| `@nextrush/helmet`      | Security headers            |
| `@nextrush/csrf`        | CSRF protection              |
| `@nextrush/rate-limit`  | Rate limiting               |
| `@nextrush/compression` | Response compression        |
| `@nextrush/cookies`     | Cookie handling             |
| `@nextrush/validation`  | Standard Schema request validation (Zod/Valibot/ArkType) |
| `@nextrush/request-id`  | Request ID generation       |
| `@nextrush/timer`       | Response time tracking      |
| `@nextrush/health`      | Liveness/readiness endpoints for orchestrator probes |

### Extensions (install separately)

Long-lived, stateful services — registered with `app.extend()`, booted at `app.ready()`.

| Package               | Description             |
| --------------------- | ------------------------ |
| `@nextrush/events`    | Type-safe event emitter (Extension) |
| `@nextrush/websocket` | WebSocket support (factory + middleware) |

### More Middleware & Registrars (install separately)

| Package               | Description             |
| --------------------- | ----------------------- |
| `@nextrush/static`    | Static file serving     |
| `@nextrush/template`  | Template rendering      |
| `@nextrush/logger`    | Structured logging      |
| `@nextrush/openapi`   | Zero-config OpenAPI 3.1 generation from route metadata |

### Class-Based Development (install separately)

| Package                 | Description                 |
| ----------------------- | --------------------------- |
| `@nextrush/class`       | Class runtime — decorators, controllers, guards, filters, interceptors, lifecycle, request scope, modules (import via `nextrush/class`) |
| `@nextrush/di`          | Dependency injection (independent) |
| `@nextrush/testing`     | Test harness — `createTestModule().override().compile()` |

### Development

| Package           | Description                                                   |
| ----------------- | ------------------------------------------------------------- |
| `@nextrush/dev`   | Hot reload dev server, production builds, and code generators |
| `create-nextrush` | Project scaffolder — `pnpm create nextrush`, `npx create-nextrush` ([usage](https://github.com/0xTanzim/nextRush/blob/main/packages/create-nextrush/README.md)) |

## Adding Middleware

```bash
pnpm add @nextrush/cors @nextrush/body-parser @nextrush/helmet
```

```typescript
import { createApp, listen } from 'nextrush';
import { cors } from '@nextrush/cors';
import { json } from '@nextrush/body-parser';
import { helmet } from '@nextrush/helmet';

const app = createApp();

app.use(helmet());
app.use(cors());
app.use(json());

app.post('/api/users', (ctx) => {
  const { name, email } = ctx.body;
  ctx.status = 201;
  ctx.json({ id: Date.now(), name, email });
});

listen(app, 8080);
```

## Error Handling

```typescript
import { NotFoundError, BadRequestError } from 'nextrush';

app.get('/users/:id', async (ctx) => {
  const user = await db.findUser(ctx.params.id);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  ctx.json(user);
});

// Or use ctx.throw()
app.get('/users/:id', (ctx) => {
  ctx.throw(404, 'User not found');
});
```

## CLI Tools

### Dev Server & Build

```bash
nextrush dev                    # Hot reload dev server
nextrush build                  # Production build with decorator metadata
```

### Code Generators

```bash
nextrush generate controller user    # Class-based controller
nextrush g service user-profile      # Injectable service
nextrush g middleware request-logger # Async middleware
nextrush g guard auth               # Guard function
nextrush g route product            # Functional route
```

## Development

```bash
# Install dependencies (does not run a full compile — use build/verify when you need artifacts)
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run benchmarks
cd apps/benchmark && pnpm benchmark

# Type check
pnpm typecheck
```

## Project Structure

```
nextrush/
├── packages/
│   ├── nextrush/        # Meta package (what you npm install)
│   ├── core/            # App + middleware composition
│   ├── router/          # Segment-trie router
│   ├── class/           # Controllers, modules, guards (optional)
│   ├── di/              # Dependency injection (optional)
│   ├── adapters/        # node, bun, deno, edge, …
│   ├── middleware/      # cors, helmet, body-parser, validation, …
│   ├── extensions/      # events, websocket
│   ├── dev/             # CLI: dev server, build, generators
│   └── create-nextrush/ # Project scaffolder
├── apps/
│   ├── website/         # Documentation site (Fumadocs)
│   ├── benchmark/       # Parity-validated HTTP benchmark suite
│   └── playground/      # Local experiments
└── docs/                # RFCs, ADRs, architecture notes
```

## Documentation

- [Docs site](https://0xtanzim.github.io/nextRush/docs) — full guides, concepts, production ops
- [Benchmarks dashboard](https://0xtanzim.github.io/nextRush/docs/production/benchmarking) — interactive charts + methodology
- [Performance tuning](https://0xtanzim.github.io/nextRush/docs/production/performance-tuning)
- [Benchmark suite](./apps/benchmark) — reproduce every number in this README
- [GitHub Wiki](https://github.com/0xTanzim/nextRush/wiki) — concise guides (source in [`wiki/`](./wiki); publish with `./scripts/publish-github-wiki.sh`)

## Versioning

NextRush follows [Semantic Versioning](https://semver.org/). We use [Changesets](https://github.com/changesets/changesets) to manage releases.

- **Major** (x.0.0) — Breaking API changes
- **Minor** (0.x.0) — New features, backward-compatible
- **Patch** (0.0.x) — Bug fixes, security patches
- **Pre-release** (`-alpha.x`, `-beta.x`) — Unstable, API may change

See [CHANGELOG.md](CHANGELOG.md) for release history and [PUBLISHING.md](PUBLISHING.md) for release process.

## Contributing

Contributions are welcome! Please read the [contribution guidelines](CONTRIBUTING.md) first.

## License

MIT © [Tanzim Hossain](https://github.com/0xTanzim)
