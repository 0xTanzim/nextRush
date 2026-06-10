# NextRush CLI & Ecosystem Plan

> Comprehensive plan for `create-nextrush`, `nextrush generate`, and ecosystem packages.
> Generated from deep analysis of the monorepo, Hono/Fastify/NestJS CLI patterns, and NextRush's dual-paradigm architecture.

---

## Table of Contents

1. [Meta Package Audit Results](#1-meta-package-audit-results)
2. [create-nextrush — Project Scaffolding](#2-create-nextrush--project-scaffolding)
3. [nextrush generate — Code Generators](#3-nextrush-generate--code-generators)
4. [Ecosystem Packages Roadmap](#4-ecosystem-packages-roadmap)
5. [Implementation Timeline](#5-implementation-timeline)

---

## 1. Meta Package Audit Results

### Current State (Verified)

The `nextrush` meta package re-exports from **8 workspace packages**:

| Package                  | Category                    | Status      |
| ------------------------ | --------------------------- | ----------- |
| `@nextrush/core`         | Application, Middleware     | ✅ Included |
| `@nextrush/router`       | Radix tree routing          | ✅ Included |
| `@nextrush/adapter-node` | Node.js HTTP adapter        | ✅ Included |
| `@nextrush/errors`       | HTTP error hierarchy        | ✅ Included |
| `@nextrush/types`        | TypeScript types            | ✅ Included |
| `@nextrush/di`           | Dependency injection        | ✅ Included |
| `@nextrush/decorators`   | Controller/route decorators | ✅ Included |
| `@nextrush/controllers`  | Auto-discovery plugin       | ✅ Included |

### Fixes Applied

1. **Stale JSDoc** — Updated `controllers: [UserController]` → `root: './src'` auto-discovery pattern
2. **Misleading install instructions** — Removed "install separately" for DI/decorators/controllers (they're bundled)
3. **Class-based example** — Now imports from `nextrush` directly, not individual packages
4. **`reflect-metadata` peer dependency** — Added as optional peer dep for class-based features
5. **Build verified** — 68/68 tests pass, clean build output

### Decision: Runtime Package

`@nextrush/runtime` was evaluated for inclusion in the meta package.

**Verdict: Skip.** The runtime package exports internal utilities (`detectRuntime`, `parseQueryString`, `getClientIp`, `BodySource`). Users import their adapter explicitly — they already know their runtime. Users who need runtime detection can import from `@nextrush/runtime` directly.

### Meta Package Design Philosophy

The meta package acts as a **"batteries included" starter** — everything needed for both functional and class-based styles ships in one `npm install nextrush`. Middleware and alternative adapters remain separate to keep the install lean.

```
nextrush (meta)
├── @nextrush/core           ← createApp, compose
├── @nextrush/router         ← createRouter
├── @nextrush/adapter-node   ← listen, serve
├── @nextrush/errors         ← HttpError, errorHandler
├── @nextrush/types          ← Context, Middleware, Plugin
├── @nextrush/di             ← container, @Service, @inject
├── @nextrush/decorators     ← @Controller, @Get, @Body
└── @nextrush/controllers    ← controllersPlugin (auto-discovery)
```

---

## 2. create-nextrush — Project Scaffolding

### Overview

`create-nextrush` is a standalone package that scaffolds a new NextRush project via interactive prompts or CLI flags.

**Usage:**

```bash
pnpm create nextrush my-app
npm create nextrush@latest my-app
yarn create nextrush my-app
bun create nextrush my-app
```

### Design Decisions

| Decision          | Choice                      | Rationale                                                         |
| ----------------- | --------------------------- | ----------------------------------------------------------------- |
| Package name      | `create-nextrush`           | Standard npm `create` convention — `npm create X` runs `create-X` |
| Location          | `packages/create-nextrush/` | Inside monorepo, versioned with framework                         |
| Prompting library | `@clack/prompts`            | Beautiful DX, used by SvelteKit/Astro, 15KB                       |
| Template strategy | Embedded (in-package)       | Offline-first, fast, version-locked                               |
| External deps     | Allowed (dev-time tool)     | Zero-dep rule applies to framework runtime, not scaffolding       |

### Interactive Flow

```
$ pnpm create nextrush my-app

  ◆ NextRush — Minimal, Modular, Blazing Fast

  ◇ Project name: my-app
  ◇ Style:
      ● Functional — Routes + middleware, no decorators
      ○ Class-based — Decorators, DI, controllers
      ○ Full — Both paradigms together
  ◇ Language:
      ● TypeScript
      ○ JavaScript
  ◇ Runtime:
      ● Node.js
      ○ Bun
      ○ Deno
  ◇ Middleware preset:
      ○ Minimal — No middleware
      ● API — cors + body-parser + helmet
      ○ Full — cors + body-parser + helmet + rate-limit + compression + logger
  ◇ Package manager: pnpm (auto-detected)

  ✓ Created project in ./my-app

  Next steps:
    cd my-app
    pnpm install
    pnpm dev
```

### CLI Flags (Non-Interactive)

```
create-nextrush <directory> [options]

Options:
  -s, --style <style>         functional | class-based | full     (default: functional)
  -l, --lang <lang>           ts | js                             (default: ts)
  -r, --runtime <runtime>     node | bun | deno                   (default: node)
  -m, --middleware <preset>    minimal | api | full                (default: api)
  -p, --pm <manager>          pnpm | npm | yarn | bun             (auto-detect)
      --install               Install dependencies after scaffold
      --git                   Initialize git repo                  (default: true)
      --no-git                Skip git initialization
  -y, --yes                   Use all defaults, skip prompts
  -h, --help                  Show help
  -v, --version               Show version
```

### Template Matrix

3 source templates generate all variants:

| Source Template | + Language | + Runtime | Output            |
| --------------- | ---------- | --------- | ----------------- |
| `functional/`   | TypeScript | Node.js   | Default starter   |
| `functional/`   | JavaScript | Node.js   | JS variant        |
| `functional/`   | TypeScript | Bun       | Bun starter       |
| `class-based/`  | TypeScript | Node.js   | Decorator starter |
| `class-based/`  | TypeScript | Bun       | Decorator + Bun   |
| `full/`         | TypeScript | Node.js   | Full paradigm     |

JavaScript variants are generated by stripping TypeScript types from the TS templates.
Runtime variants swap the adapter import and package.json dependency.

### Generated Project Structures

**Functional + TypeScript + Node.js:**

```
my-app/
├── src/
│   ├── index.ts
│   └── routes/
│       └── health.ts
├── package.json
├── tsconfig.json
└── .gitignore
```

**Class-based + TypeScript + Node.js:**

```
my-app/
├── src/
│   ├── index.ts
│   ├── controllers/
│   │   └── health.controller.ts
│   └── services/
│       └── health.service.ts
├── package.json
├── tsconfig.json
└── .gitignore
```

**Full + TypeScript + Node.js:**

```
my-app/
├── src/
│   ├── index.ts
│   ├── routes/
│   │   └── health.ts
│   ├── controllers/
│   │   └── app.controller.ts
│   └── services/
│       └── app.service.ts
├── package.json
├── tsconfig.json
└── .gitignore
```

### Generated `src/index.ts` (Functional + API preset)

```typescript
import { createApp, createRouter, listen } from 'nextrush';
import { cors } from '@nextrush/cors';
import { json } from '@nextrush/body-parser';
import { helmet } from '@nextrush/helmet';
import health from './routes/health.js';

const app = createApp();

// Middleware
app.use(cors());
app.use(helmet());
app.use(json());

// Routes
app.route('/health', health);

listen(app, 3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

### Generated `src/index.ts` (Class-based + API preset)

```typescript
import 'reflect-metadata';
import { createApp, listen, controllersPlugin } from 'nextrush';
import { cors } from '@nextrush/cors';
import { json } from '@nextrush/body-parser';
import { helmet } from '@nextrush/helmet';

const app = createApp();

// Middleware
app.use(cors());
app.use(helmet());
app.use(json());

// Auto-discover controllers
app.plugin(controllersPlugin({ root: './src' }));

listen(app, 3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

### Generated `package.json`

```json
{
  "name": "my-app",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "nextrush dev",
    "build": "nextrush build",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "nextrush": "^3.0.0",
    "@nextrush/cors": "^3.0.0",
    "@nextrush/body-parser": "^3.0.0",
    "@nextrush/helmet": "^3.0.0"
  },
  "devDependencies": {
    "@nextrush/dev": "^3.0.0",
    "typescript": "^5.9.0"
  }
}
```

For class-based, add `"reflect-metadata": "^0.2.0"` to dependencies.
For JavaScript, remove `typescript` from devDependencies and `tsconfig.json`.

### Generated `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": ["src"]
}
```

`experimentalDecorators` and `emitDecoratorMetadata` are included for all styles (enables future migration to class-based, and `nextrush dev` validates their presence).

### Package Structure

```
packages/create-nextrush/
├── bin/
│   └── create-nextrush.js          # #!/usr/bin/env node
├── src/
│   ├── index.ts                     # Main orchestrator
│   ├── cli.ts                       # Arg parsing (util.parseArgs)
│   ├── prompts.ts                   # Interactive prompts (@clack/prompts)
│   ├── generator.ts                 # File generation engine
│   ├── types.ts                     # ProjectOptions, TemplateConfig
│   ├── templates/
│   │   ├── shared/
│   │   │   ├── tsconfig.ts          # tsconfig.json generator
│   │   │   ├── gitignore.ts         # .gitignore content
│   │   │   └── package-json.ts      # package.json generator
│   │   ├── functional/
│   │   │   ├── index-ts.ts          # src/index.ts template
│   │   │   └── routes/
│   │   │       └── health.ts        # src/routes/health.ts template
│   │   ├── class-based/
│   │   │   ├── index-ts.ts          # src/index.ts with reflect-metadata
│   │   │   ├── controllers/
│   │   │   │   └── health.ts        # Controller template
│   │   │   └── services/
│   │   │       └── health.ts        # Service template
│   │   └── full/
│   │       ├── index-ts.ts
│   │       ├── routes/
│   │       ├── controllers/
│   │       └── services/
│   └── utils/
│       ├── fs.ts                    # Safe file writing
│       └── detect-pm.ts            # Package manager detection
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── README.md
```

### Dependencies

```json
{
  "dependencies": {
    "@clack/prompts": "^0.10.0"
  }
}
```

Single dependency. Everything else uses Node.js built-ins (`util.parseArgs`, `fs`, `path`, `child_process`).

---

## 3. nextrush generate — Code Generators

> **Target release: v3.1** — Not blocking for v3.0 GA.

### Commands

```bash
nextrush generate controller <name>     # or: nextrush g controller <name>
nextrush generate service <name>
nextrush generate middleware <name>
nextrush generate guard <name>
nextrush generate route <name>
```

### Options

```
--style <functional|class-based>     Auto-detected from project
--path <directory>                   Output directory (default: src/<type>s/)
--dry-run                            Preview without writing
--no-test                            Skip test file generation
```

### Auto-Detection Logic

When a user runs `nextrush generate controller user`:

1. Check `package.json` for `reflect-metadata` dependency
2. Scan `src/` for `@Controller` decorator usage
3. If class-based patterns found → generate decorated controller
4. If only functional patterns found → generate route file
5. If ambiguous → prompt the user

### Generated Output Examples

**`nextrush g controller user` (class-based detected):**

Creates `src/controllers/user.controller.ts`:

```typescript
import { Controller, Get, Post, Body, Param } from 'nextrush';

@Controller('/users')
export class UserController {
  @Get()
  async findAll() {
    return [];
  }

  @Get('/:id')
  async findOne(@Param('id') id: string) {
    return { id };
  }

  @Post()
  async create(@Body() data: unknown) {
    return data;
  }
}
```

**`nextrush g route user` (functional):**

Creates `src/routes/user.ts`:

```typescript
import { createRouter } from 'nextrush';

const router = createRouter();

router.get('/', (ctx) => {
  ctx.json([]);
});

router.get('/:id', (ctx) => {
  ctx.json({ id: ctx.params.id });
});

router.post('/', (ctx) => {
  ctx.json(ctx.body);
});

export default router;
```

**`nextrush g service user` (class-based):**

Creates `src/services/user.service.ts`:

```typescript
import { Service } from 'nextrush';

@Service()
export class UserService {
  async findAll() {
    return [];
  }

  async findOne(id: string) {
    return { id };
  }

  async create(data: unknown) {
    return data;
  }
}
```

**`nextrush g middleware logger`:**

Creates `src/middleware/logger.ts`:

```typescript
import type { Middleware } from 'nextrush';

export const logger: Middleware = async (ctx) => {
  const start = Date.now();
  await ctx.next();
  const duration = Date.now() - start;
  console.log(`${ctx.method} ${ctx.path} ${ctx.status} ${duration}ms`);
};
```

**`nextrush g guard auth`:**

Creates `src/guards/auth.guard.ts`:

```typescript
import type { GuardFn } from 'nextrush';

export const authGuard: GuardFn = async (ctx) => {
  const token = ctx.get('authorization');
  if (!token) return false;
  // TODO: Validate token
  return true;
};
```

### Integration with @nextrush/dev

Add to `packages/dev/src/commands/`:

- `generate.ts` — Command router for generators
- `generators/` — Individual generator implementations

Update `packages/dev/src/cli.ts` to route `generate` and `g` aliases.

### `nextrush init` — Existing Project Integration

```bash
nextrush init
```

For **existing** projects (like Fastify's `--integrate`):

1. Detect existing `package.json`
2. Add `nextrush` dependency
3. Generate `src/index.ts` with basic setup
4. Add scripts (`dev`, `build`, `start`)
5. Generate `tsconfig.json` if TypeScript project

This is lighter than `create-nextrush` — no prompts for project name, no directory creation.

---

## 4. Ecosystem Packages Roadmap

### Priority Tiers

#### Tier 1 — v3.0 GA (Ship With Release)

| Package           | Purpose             | Effort   |
| ----------------- | ------------------- | -------- |
| `create-nextrush` | Project scaffolding | 2-3 days |

#### Tier 2 — v3.1 (First Feature Release)

| Package                | Purpose                                         | Effort   |
| ---------------------- | ----------------------------------------------- | -------- |
| `@nextrush/testing`    | Mock context, test helpers, assertion utils     | 2 days   |
| `@nextrush/validation` | Zod/class-validator integration with decorators | 2 days   |
| `nextrush generate`    | Code generators in dev CLI                      | 1-2 days |

#### Tier 3 — v3.2

| Package             | Purpose                                    | Effort   |
| ------------------- | ------------------------------------------ | -------- |
| `@nextrush/config`  | Typed env config with schema validation    | 1-2 days |
| `@nextrush/openapi` | Auto-generate OpenAPI spec from decorators | 3 days   |
| `@nextrush/session` | Session management (cookie/token)          | 2 days   |

#### Tier 4 — v3.3+

| Package               | Purpose                                      | Effort |
| --------------------- | -------------------------------------------- | ------ |
| `@nextrush/auth`      | Auth primitives (JWT, API keys, OAuth hooks) | 3 days |
| `@nextrush/multipart` | File upload / multipart handling             | 2 days |
| `@nextrush/sse`       | Server-Sent Events                           | 1 day  |
| `@nextrush/health`    | Health check endpoints                       | 1 day  |
| `@nextrush/cache`     | Caching layer (in-memory + Redis adapter)    | 2 days |

#### Future (v4.0+)

| Package             | Purpose                   |
| ------------------- | ------------------------- |
| `@nextrush/queue`   | Background job processing |
| `@nextrush/graphql` | GraphQL integration       |
| `@nextrush/trpc`    | tRPC integration          |
| `@nextrush/i18n`    | Internationalization      |
| `@nextrush/mailer`  | Email sending             |

### Package Details

#### `@nextrush/testing`

Test utilities for NextRush applications:

```typescript
import { createTestContext, createTestApp } from '@nextrush/testing';

// Mock context for unit tests
const ctx = createTestContext({
  method: 'GET',
  path: '/users',
  headers: { authorization: 'Bearer token' },
});

// Test app for integration tests
const app = createTestApp();
app.route('/users', usersRouter);

const res = await app.inject({ method: 'GET', url: '/users' });
expect(res.status).toBe(200);
```

Location in hierarchy: depends on `@nextrush/core`, `@nextrush/types`.
Dev dependency only — never a runtime dep.

#### `@nextrush/validation`

Request validation with schema libraries:

```typescript
import { z } from 'zod';
import { Controller, Post, Body } from 'nextrush';

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

@Controller('/users')
class UserController {
  @Post()
  async create(
    @Body({ transform: CreateUserSchema.parseAsync }) data: z.infer<typeof CreateUserSchema>
  ) {
    return data;
  }
}
```

The `@Body({ transform })` pattern already exists. `@nextrush/validation` would provide:

- Pre-built transforms for Zod, Valibot, and class-validator
- Standardized validation error formatting
- Integration with NextRush error hierarchy (`ValidationError`)

#### `@nextrush/config`

Typed environment configuration:

```typescript
import { defineConfig, env } from '@nextrush/config';

const config = defineConfig({
  port: env.number('PORT', 3000),
  dbUrl: env.string('DATABASE_URL'),
  debug: env.boolean('DEBUG', false),
  allowedOrigins: env.array('ALLOWED_ORIGINS', []),
});

// config.port → number (type-safe)
// Throws at startup if DATABASE_URL is missing
```

#### `@nextrush/openapi`

Auto-generate OpenAPI 3.1 spec from decorator metadata:

```typescript
import { openapiPlugin } from '@nextrush/openapi';

app.plugin(
  openapiPlugin({
    info: { title: 'My API', version: '1.0.0' },
    path: '/docs/openapi.json',
  })
);
// Reads @Controller, @Get/@Post, @Body, @Param metadata
// Generates OpenAPI spec served at /docs/openapi.json
```

### Where New Packages Fit in the Hierarchy

```
types → errors → core → router → di → decorators → controllers → adapters → middleware
                  ↓                                    ↓
              @nextrush/config                   @nextrush/openapi
              @nextrush/testing                  @nextrush/validation
                  ↓
              @nextrush/session
              @nextrush/auth
              @nextrush/cache
              @nextrush/multipart
              @nextrush/sse
              @nextrush/health
```

All new ecosystem packages depend on `types` + `core` at minimum. None depend upward.

---

## 5. Implementation Timeline

### Phase 1: Meta Package Polish (DONE ✅)

- [x] Fix stale JSDoc (`controllers: [UserController]` → auto-discovery)
- [x] Remove misleading "install separately" for bundled packages
- [x] Add `reflect-metadata` as optional peer dependency
- [x] Build and test (68/68 pass)

### Phase 2: create-nextrush (v3.0-beta)

- [ ] Initialize `packages/create-nextrush/` package
- [ ] Implement CLI arg parser (`util.parseArgs`)
- [ ] Implement interactive prompts (`@clack/prompts`)
- [ ] Create embedded templates (functional, class-based, full)
- [ ] Implement file generation engine
- [ ] Handle JavaScript variant generation
- [ ] Handle runtime variant (adapter swap)
- [ ] Handle middleware preset injection
- [ ] Package manager detection
- [ ] Git initialization
- [ ] Auto-install option
- [ ] Write README
- [ ] Test with real project creation

### Phase 3: Code Generators (v3.1)

- [ ] Add `nextrush generate` command router to `@nextrush/dev`
- [ ] Implement controller generator (class-based + functional)
- [ ] Implement service generator
- [ ] Implement middleware generator
- [ ] Implement guard generator
- [ ] Implement route generator
- [ ] Auto-detection logic (class-based vs functional)
- [ ] `nextrush init` for existing projects
- [ ] Write documentation

### Phase 4: Ecosystem Packages (v3.1 → v3.3)

- [ ] `@nextrush/testing` — Mock context, test app, inject
- [ ] `@nextrush/validation` — Zod/Valibot transforms
- [ ] `@nextrush/config` — Typed env config
- [ ] `@nextrush/openapi` — Auto-generate OpenAPI spec
- [ ] `@nextrush/session` — Session management
- [ ] Remaining packages per roadmap

---

## Research References

- **Hono**: `create-hono` — Template-based scaffolding, `--template`, `--pm`, `--offline` flags
- **Fastify**: `create-fastify` — Minimal, `--integrate` for existing projects
- **NestJS**: `@nestjs/cli` — Full CLI with `nest new`, `nest generate`, heavy DI focus
- **SvelteKit**: `create-svelte` — `@clack/prompts`, beautiful interactive experience
- **NextRush philosophy**: Lean like Hono, dual-paradigm like no other, DX like SvelteKit
