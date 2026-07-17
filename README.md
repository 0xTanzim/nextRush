# NextRush

> Minimal, modular, high-performance Node.js framework

[![npm version](https://badge.fury.io/js/nextrush.svg)](https://www.npmjs.com/package/nextrush)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-≥22-339933?logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org)

## Why NextRush?

- **Minimal Core** — Under 3,000 lines of code
- **Modular** — Install only what you need
- **Fast** — Competes with Fastify, Hono, and Koa
- **Type-Safe** — Full TypeScript with zero `any`
- **ESM-only, permanently** — No package ever publishes a `require` condition; CommonJS output
  is not supported and will not be added. This is a ratified architectural decision, not a
  temporary state — see [Module Format Policy](#module-format-policy) below.
- **Zero-Dependency Functional Core** — `createApp`/`createRouter`/`listen` pull in no external
  runtime dependencies; the class/DI path (`nextrush/class`) depends on `tsyringe` +
  `reflect-metadata` (see [Dependency Footprint](#dependency-footprint))
- **Modern DX** — Clean context API, async/await native

## Module Format Policy

**NextRush is ESM-only. Permanently.** No `@nextrush/*` package's `exports` map will ever
declare a `require` condition, and none currently does. CommonJS output is not supported and
will not be added — this is a ratified architectural decision, not a temporary state pending
demand, and reconsidering it requires a new, deliberate decision, not a feature request.

Why: the Node ≥22 engine floor this framework already requires gives CommonJS consumers native
`require(esm)` support for synchronous import graphs on current LTS (22.12+) — the strongest
historical reason to dual-publish is already covered by the runtime NextRush mandates. Dual-
publishing would also reintroduce the ESM/CJS dual-package hazard specifically on the
`@nextrush/di` path (`reflect-metadata`'s global patch + a `tsyringe` singleton container can
silently split into two instances if both a CJS and an ESM copy load in one process), at the
cost of a doubled, permanent build/test/publish matrix across ~35 packages. See
[Module Format & Compatibility](https://github.com/0xTanzim/nextRush/blob/main/apps/docs/content/docs/internals/versioning.mdx)
for the full rationale and the documented CommonJS interop path.

**Enforced in CI**, not just documented: `pnpm validate:esm-only` fails the build if any package
ever gains a `require` condition.

## Dependency Footprint

NextRush's runtime dependencies differ by which path you use — there is no single "zero
dependencies" claim that holds for the whole framework:

| Usage path                                          | Entry point         | Runtime dependencies                |
| ---------------------------------------------------- | -------------------- | ------------------------------------ |
| Functional core (routing, middleware, context)       | `createApp`, `createRouter`, `listen` from `nextrush` | None |
| Class-based / DI (`@Controller`, `@Service`, guards…) | `nextrush/class`     | `tsyringe@^4.10.0`, `reflect-metadata@^0.2.2` |

Confirmed via `pnpm -r why reflect-metadata tsyringe` against this repo: both packages resolve
only through `@nextrush/di`, which is pulled in by `@nextrush/class` and re-exported by the
`nextrush` meta-package's `nextrush/class` subpath. `@nextrush/core`, `@nextrush/router`, and
`@nextrush/runtime` — the packages backing the functional path — do not appear anywhere in that
dependency graph.

## Performance

NextRush is built for high throughput with a zero-dependency functional core, and it benchmarks
competitively against Fastify, Hono, Koa, and Express. The suite in `apps/benchmark` compares
six servers (including a raw Node.js baseline) across 10 scenarios using **wrk** (C-based,
process-isolated) and **autocannon** (Node.js-based).

> **Published numbers are being re-measured on a clean, CPU-pinned environment with the
> hardened, parity-validated harness.** Earlier figures came from single-run sessions on a
> shared machine and were not reproducible to a publishable standard, so they have been
> withdrawn pending re-measurement. Run the suite yourself for current numbers on your hardware.

What the harness guarantees (see `apps/benchmark/README.md` and the audit reports there):

- **Fairness is validated, not assumed** — `pnpm bench:validate` asserts byte-identical response
  bodies, statuses, and middleware headers across all six servers before any timing.
- **Publishable numbers are multi-run** — only the `standard` (3 runs) and `full` (5 runs)
  profiles may back published figures; each reports mean ± stddev and CV.
- **Identical runtime config** — same Node flags, `NODE_ENV=production`, and payloads everywhere.
- **Honest scope** — 8 scenarios do byte-identical work; the middleware and error scenarios use
  each framework's idiomatic mechanism and are labeled as not like-for-like.

```bash
cd apps/benchmark
pnpm install
pnpm bench:validate                       # confirm fairness
pnpm bench:compare --profile full         # publishable comparison (5 runs)
```

> Performance varies by hardware. The only numbers that matter for your capacity planning are
> the ones you measure on your own machine.


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

### Middleware (install separately)

| Package                 | Description                 |
| ----------------------- | --------------------------- |
| `@nextrush/body-parser` | JSON/form/text body parsing |
| `@nextrush/multipart`   | File upload (multipart) parsing |
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
| `@nextrush/stream`    | Response streaming — SSE, NDJSON, built for AI/agentic apps |
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
│   ├── core/            # @nextrush/core
│   ├── router/          # @nextrush/router
│   ├── types/           # @nextrush/types
│   ├── errors/          # @nextrush/errors
│   ├── runtime/         # @nextrush/runtime
│   ├── adapters/        # Platform adapters (node, bun, deno, edge)
│   ├── middleware/       # cors, helmet, body-parser, validation, static, template, logger, openapi, etc.
│   ├── extensions/       # events, websocket
│   ├── controllers/      # @nextrush/controllers (registrar)
│   ├── di/              # Dependency injection
│   ├── dev/             # CLI: dev server, build, generators
│   ├── create-nextrush/ # Project scaffolder
│   └── nextrush/        # Meta package
├── apps/
│   ├── docs/            # Documentation site
│   ├── benchmark/       # Benchmark suite
│   └── playground/      # Testing playground
└── docs/                # Architecture docs, RFCs, migration guides
```

## Documentation

- [Getting Started](https://github.com/0xTanzim/nextRush/blob/main/apps/docs/content/docs/getting-started/index.mdx)
- [Core Concepts](https://github.com/0xTanzim/nextRush/blob/main/apps/docs/content/docs/concepts/index.mdx)
- [API Reference](https://github.com/0xTanzim/nextRush/blob/main/apps/docs/content/docs/api-reference/index.mdx)
- [Performance & benchmarks](https://github.com/0xTanzim/nextRush/blob/main/apps/docs/content/docs/performance/index.mdx)
- [Docs site (GitHub Pages)](https://0xtanzim.github.io/nextRush/docs)
- [GitHub Wiki](https://github.com/0xTanzim/nextRush/wiki) — concise guides (source in repo [`wiki/`](https://github.com/0xTanzim/nextRush/tree/main/wiki); publish with `./scripts/publish-github-wiki.sh`)

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
