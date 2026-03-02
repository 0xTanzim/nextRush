# RFC-0005: Package Publishing, Versioning, and Facade Strategy

## Status

**Approved** (supersedes RFC-0001, RFC-0002 from rfc-v2)

## Author

NextRush Core Team

## Created

January 2026

---

## Executive Summary

This RFC defines **exactly** how NextRush publishes, versions, and organizes its 25+ packages. It resolves confusion about:

1. What goes in the `nextrush` facade package?
2. How do we version tightly-coupled packages?
3. How do we support dual paradigm (functional + class-based)?
4. How do we handle multiple runtimes (Node, Bun, Deno, Edge)?
5. What's the user installation experience?

**TL;DR:**

- Core packages are **LINKED** (always same version)
- Middleware/plugins are **INDEPENDENT**
- Facade includes **core + Node adapter only**
- DI/decorators are **separate** (for class-based users)
- Subpath exports are **NOT used** (direct re-exports instead)

---

## Table of Contents

1. [The Confusion Clarified](#1-the-confusion-clarified)
2. [Package Tier System](#2-package-tier-system)
3. [Versioning Strategy](#3-versioning-strategy)
4. [Facade Package Design](#4-facade-package-design)
5. [Dual Paradigm Support](#5-dual-paradigm-support)
6. [Multi-Runtime Support](#6-multi-runtime-support)
7. [User Installation Matrix](#7-user-installation-matrix)
8. [Changesets Configuration](#8-changesets-configuration)
9. [Package.json Standards](#9-packagejson-standards)
10. [Release Workflow](#10-release-workflow)
11. [Why NOT Subpath Exports](#11-why-not-subpath-exports)
12. [Evaluation of Previous RFCs](#12-evaluation-of-previous-rfcs)

---

## 1. The Confusion Clarified

### What is the "Hybrid Approach"?

The hybrid approach means:

1. **Core packages** → Always version together (LINKED)
2. **Peripheral packages** → Version independently

This is NOT about subpath exports vs direct re-exports.
This is about VERSIONING STRATEGY.

### What goes in the Facade?

The `nextrush` facade contains **what 80% of users need for their first app**:

- ✅ Application creation (`createApp`)
- ✅ Routing (`createRouter`)
- ✅ Server start (`listen`)
- ✅ Essential types
- ❌ NOT middleware (install separately)
- ❌ NOT DI/decorators (class-based users install separately)
- ❌ NOT non-Node adapters (install separately)

### Why NOT include everything?

| Include Everything    | Include Essentials Only |
| --------------------- | ----------------------- |
| Large package size    | Small package size      |
| Slow install          | Fast install            |
| Confusing API surface | Focused API surface     |
| Forces opinions       | Allows choice           |

**We choose: Essentials Only**

---

## 2. Package Tier System

### Tier 1: Core Foundation (LINKED VERSIONING)

These packages form the framework's foundation. They **MUST** always have the same version.

| Package             | Description                      | In Facade?               |
| ------------------- | -------------------------------- | ------------------------ |
| `@nextrush/types`   | Shared TypeScript types          | ✅ YES                   |
| `@nextrush/errors`  | HTTP error classes               | ✅ YES                   |
| `@nextrush/core`    | Application, Context, Middleware | ✅ YES                   |
| `@nextrush/router`  | Radix tree routing               | ✅ YES                   |
| `@nextrush/runtime` | Runtime detection utilities      | ✅ YES                   |
| `nextrush`          | Facade meta-package              | N/A (this IS the facade) |

**Why linked?** A change to `@nextrush/types` affects ALL other packages. Users must know that `@nextrush/core@3.2.0` works with `@nextrush/router@3.2.0`.

### Tier 2: Class-Based System (LINKED VERSIONING)

These packages enable the class-based/decorator paradigm. They are also linked because they're tightly integrated.

| Package                 | Description                         | In Facade? |
| ----------------------- | ----------------------------------- | ---------- |
| `@nextrush/di`          | Dependency injection container      | ❌ NO      |
| `@nextrush/decorators`  | @Controller, @Get, @Post, etc.      | ❌ NO      |
| `@nextrush/controllers` | Controller plugin, handler building | ❌ NO      |

**Why NOT in facade?**

- Not everyone needs class-based controllers
- Requires `reflect-metadata` as peer dependency
- Functional users shouldn't pay for what they don't use

### Tier 3: Adapters (SEMI-LINKED)

Runtime-specific adapters. Same major.minor as core, independent patch.

| Package                  | Description          | In Facade?       |
| ------------------------ | -------------------- | ---------------- |
| `@nextrush/adapter-node` | Node.js HTTP adapter | ✅ YES (default) |
| `@nextrush/adapter-bun`  | Bun adapter          | ❌ NO            |
| `@nextrush/adapter-deno` | Deno adapter         | ❌ NO            |
| `@nextrush/adapter-edge` | Edge runtime adapter | ❌ NO            |

**Why Node in facade?**

- 90%+ of users start with Node.js
- "Just works" experience for the common case
- Bun/Deno users are advanced enough to install separately

### Tier 4: Middleware (INDEPENDENT)

Each middleware package versions independently.

| Package                 | Description            |
| ----------------------- | ---------------------- |
| `@nextrush/body-parser` | JSON/form body parsing |
| `@nextrush/cors`        | CORS headers           |
| `@nextrush/helmet`      | Security headers       |
| `@nextrush/rate-limit`  | Rate limiting          |
| `@nextrush/cookies`     | Cookie parsing         |
| `@nextrush/compression` | Response compression   |
| `@nextrush/request-id`  | Request ID generation  |
| `@nextrush/timer`       | Response timing        |

**Why independent?**

- Loosely coupled (don't depend on each other)
- Can fix/improve without coordinating with core
- Users only install what they need

### Tier 5: Plugins (INDEPENDENT)

Extension packages that add major functionality.

| Package               | Description               |
| --------------------- | ------------------------- |
| `@nextrush/logger`    | Structured logging        |
| `@nextrush/static`    | Static file serving       |
| `@nextrush/events`    | Event emitter integration |
| `@nextrush/template`  | Template engine support   |
| `@nextrush/websocket` | WebSocket support         |

### Tier 6: Dev Tools (INDEPENDENT)

Developer experience tooling.

| Package         | Description                 |
| --------------- | --------------------------- |
| `@nextrush/dev` | CLI, hot reload, dev server |

---

## 3. Versioning Strategy

### 3.1 Linked Packages

**Packages:** types, errors, core, router, runtime, nextrush, di, decorators, controllers

**Rule:** When ANY of these packages changes:

- If PATCH: All get PATCH bump
- If MINOR: All get MINOR bump
- If MAJOR: All get MAJOR bump

**Example:**

```
Before: @nextrush/core@3.2.0, @nextrush/router@3.2.0
Change: Add feature to core
After:  @nextrush/core@3.3.0, @nextrush/router@3.3.0 (both bump)
```

### 3.2 Semi-Linked Packages (Adapters)

**Packages:** adapter-node, adapter-bun, adapter-deno, adapter-edge

**Rule:**

- MAJOR.MINOR matches core
- PATCH is independent (for platform-specific fixes)

**Example:**

```
Core: 3.2.0
adapter-node: 3.2.1 (has a Node-specific fix)
adapter-bun: 3.2.0 (no changes)
```

**User guarantee:** "3.2.x adapters work with 3.2.x core"

### 3.3 Independent Packages

**Packages:** All middleware and plugins

**Rule:** Standard SemVer, no coordination required

**Peer dependency:** Use `@nextrush/types` as peer dependency with range:

```json
{
  "peerDependencies": {
    "@nextrush/types": "^3.0.0"
  }
}
```

---

## 4. Facade Package Design

### 4.1 What the Facade Exports

```typescript
// packages/nextrush/src/index.ts

// ============================================
// CORE: Application & Middleware
// ============================================
export { Application, createApp, compose } from '@nextrush/core';

export type { ApplicationOptions, ComposedMiddleware } from '@nextrush/core';

// ============================================
// ROUTER
// ============================================
export { Router, createRouter } from '@nextrush/router';

export type { RouterOptions } from '@nextrush/router';

// ============================================
// ADAPTER: Node.js (Default Runtime)
// ============================================
export { listen, serve, createHandler } from '@nextrush/adapter-node';

export type { ServeOptions, ServerInstance } from '@nextrush/adapter-node';

// ============================================
// ERRORS: HTTP Error Classes
// ============================================
export {
  HttpError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  InternalServerError,
  createHttpError,
} from '@nextrush/errors';

// ============================================
// TYPES: Essential Types Only
// ============================================
export type {
  Context,
  Middleware,
  Next,
  Plugin,
  RouteHandler,
  HttpMethod,
  HttpStatusCode,
  Runtime,
} from '@nextrush/types';

export { HttpStatus, ContentType } from '@nextrush/types';

// ============================================
// VERSION
// ============================================
export const VERSION = '3.0.0-alpha.2';
```

### 4.2 What the Facade Does NOT Export

| Not Exported              | Reason                    | How to Get It                 |
| ------------------------- | ------------------------- | ----------------------------- |
| DI (Service, container)   | Class-based paradigm only | `@nextrush/di`                |
| Decorators (@Controller)  | Class-based paradigm only | `@nextrush/decorators`        |
| Middleware (cors, helmet) | Optional, user choice     | `@nextrush/cors`, etc.        |
| Non-Node adapters         | Different runtime         | `@nextrush/adapter-bun`, etc. |
| Dev tools                 | Development only          | `@nextrush/dev`               |

### 4.3 Facade package.json

```json
{
  "name": "nextrush",
  "version": "3.0.0-alpha.2",
  "description": "Minimal, modular, blazing fast Node.js framework",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist", "README.md"],
  "dependencies": {
    "@nextrush/core": "workspace:*",
    "@nextrush/router": "workspace:*",
    "@nextrush/errors": "workspace:*",
    "@nextrush/types": "workspace:*",
    "@nextrush/runtime": "workspace:*",
    "@nextrush/adapter-node": "workspace:*"
  },
  "publishConfig": {
    "access": "public"
  },
  "engines": {
    "node": ">=22.0.0"
  }
}
```

---

## 5. Dual Paradigm Support

NextRush supports TWO programming paradigms:

### 5.1 Functional Paradigm (Default)

**Target:** Most users, simple APIs, quick prototypes

**Installation:**

```bash
pnpm add nextrush
```

**Usage:**

```typescript
import { createApp, createRouter, listen } from 'nextrush';

const app = createApp();
const router = createRouter();

router.get('/users', (ctx) => {
  ctx.json([{ id: 1, name: 'Alice' }]);
});

router.post('/users', async (ctx) => {
  const user = await createUser(ctx.body);
  ctx.status = 201;
  ctx.json(user);
});

app.use(router.routes());
listen(app, 3000);
```

### 5.2 Class-Based Paradigm (Opt-In)

**Target:** Enterprise apps, DI-heavy architectures, NestJS refugees

**Installation:**

```bash
pnpm add nextrush @nextrush/decorators @nextrush/di @nextrush/controllers
```

**Usage:**

```typescript
import 'reflect-metadata';
import { createApp, listen } from 'nextrush';
import { Controller, Get, Post, Body, Param, UseGuard } from '@nextrush/decorators';
import { Service, container } from '@nextrush/di';
import { controllersPlugin } from '@nextrush/controllers';

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
  async findAll() {
    return this.userService.findAll();
  }

  @Post()
  async create(@Body() data: CreateUserDto) {
    return this.userService.create(data);
  }
}

const app = createApp();
app.plugin(
  controllersPlugin({
    controllers: [UserController],
  })
);
listen(app, 3000);
```

### 5.3 Why Separate?

| Aspect         | Functional  | Class-Based      |
| -------------- | ----------- | ---------------- |
| Dependencies   | None extra  | reflect-metadata |
| Bundle size    | Smaller     | Larger           |
| Learning curve | Lower       | Higher           |
| Use case       | Simple APIs | Complex apps     |

By keeping them separate, functional users don't pay for class-based features.

---

## 6. Multi-Runtime Support

### 6.1 Runtime Architecture

```
nextrush (facade)
    └── @nextrush/adapter-node (bundled, default)

@nextrush/adapter-bun (separate, opt-in)
@nextrush/adapter-deno (separate, opt-in)
@nextrush/adapter-edge (separate, opt-in)
```

### 6.2 Node.js (Default)

```bash
pnpm add nextrush
```

```typescript
import { createApp, listen } from 'nextrush';

const app = createApp();
listen(app, 3000); // Uses Node.js HTTP
```

### 6.3 Bun

```bash
pnpm add nextrush @nextrush/adapter-bun
```

```typescript
import { createApp } from 'nextrush';
import { listen } from '@nextrush/adapter-bun';

const app = createApp();
listen(app, 3000); // Uses Bun.serve
```

### 6.4 Deno

```bash
# Deno has different package management
deno add npm:nextrush npm:@nextrush/adapter-deno
```

```typescript
import { createApp } from 'nextrush';
import { listen } from '@nextrush/adapter-deno';

const app = createApp();
listen(app, 3000); // Uses Deno.serve
```

### 6.5 Edge (Cloudflare Workers, Vercel Edge)

```bash
pnpm add nextrush @nextrush/adapter-edge
```

```typescript
import { createApp } from 'nextrush';
import { createHandler } from '@nextrush/adapter-edge';

const app = createApp();

export default {
  fetch: createHandler(app),
};
```

---

## 7. User Installation Matrix

### Quick Reference

| Use Case              | Install Command                                                             | Imports                                            |
| --------------------- | --------------------------------------------------------------------------- | -------------------------------------------------- |
| Basic API (Node)      | `pnpm add nextrush`                                                         | `from 'nextrush'`                                  |
| With CORS             | `pnpm add nextrush @nextrush/cors`                                          | `from 'nextrush'` + `from '@nextrush/cors'`        |
| With body parsing     | `pnpm add nextrush @nextrush/body-parser`                                   | Same pattern                                       |
| Class-based           | `pnpm add nextrush @nextrush/decorators @nextrush/di @nextrush/controllers` | `from 'nextrush'` + decorator packages             |
| Bun runtime           | `pnpm add nextrush @nextrush/adapter-bun`                                   | `from 'nextrush'` + `from '@nextrush/adapter-bun'` |
| Full production setup | See below                                                                   |                                                    |

### Full Production Setup Example

```bash
pnpm add nextrush \
  @nextrush/body-parser \
  @nextrush/cors \
  @nextrush/helmet \
  @nextrush/rate-limit \
  @nextrush/logger
```

```typescript
import { createApp, createRouter, listen } from 'nextrush';
import { json } from '@nextrush/body-parser';
import { cors } from '@nextrush/cors';
import { helmet } from '@nextrush/helmet';
import { rateLimit } from '@nextrush/rate-limit';
import { logger } from '@nextrush/logger';

const app = createApp();

// Security
app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS }));
app.use(rateLimit({ max: 100, window: '15m' }));

// Utilities
app.use(logger());
app.use(json({ limit: '1mb' }));

// Routes
const router = createRouter();
router.get('/health', (ctx) => ctx.json({ status: 'ok' }));
app.use(router.routes());

listen(app, 3000);
```

---

## 8. Changesets Configuration

### Required Configuration

```json
// .changeset/config.json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [
    [
      "@nextrush/types",
      "@nextrush/errors",
      "@nextrush/core",
      "@nextrush/router",
      "@nextrush/runtime",
      "nextrush",
      "@nextrush/di",
      "@nextrush/decorators",
      "@nextrush/controllers"
    ]
  ],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": ["@nextrush/dev"]
}
```

### How `linked` Works

When you run `pnpm changeset` and select `@nextrush/core` with a `minor` bump:

**Before:**

```
@nextrush/types: 3.1.0
@nextrush/core: 3.1.0
@nextrush/router: 3.1.0
nextrush: 3.1.0
```

**After (all linked packages bump together):**

```
@nextrush/types: 3.2.0
@nextrush/core: 3.2.0
@nextrush/router: 3.2.0
nextrush: 3.2.0
```

### What About Adapters?

Adapters are NOT in the `linked` array because they need independent patch versions.

But they should use peer dependencies to ensure compatibility:

```json
// packages/adapters/bun/package.json
{
  "peerDependencies": {
    "@nextrush/core": "^3.0.0",
    "@nextrush/types": "^3.0.0"
  }
}
```

---

## 9. Package.json Standards

### Every Package Must Have

```json
{
  "name": "@nextrush/[package-name]",
  "version": "3.0.0-alpha.1",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist", "README.md"],
  "publishConfig": {
    "access": "public"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/0xTanzim/nextrush.git",
    "directory": "packages/[package-path]"
  },
  "engines": {
    "node": ">=22.0.0"
  }
}
```

### Internal Dependencies

Use `workspace:*` for linked packages:

```json
{
  "dependencies": {
    "@nextrush/types": "workspace:*"
  }
}
```

Changesets will convert to actual versions on publish.

---

## 10. Release Workflow

### Developer Workflow

```bash
# 1. Make changes to packages
git checkout -b feat/new-feature

# 2. Create changeset (describes what changed)
pnpm changeset
# Answer: Which packages? What type (major/minor/patch)? Summary?

# 3. Commit everything
git add .
git commit -m "feat(core): add new feature"

# 4. Create PR
gh pr create
```

### Automated Release (GitHub Actions)

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    branches: [main]

concurrency: ${{ github.workflow }}-${{ github.ref }}

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
          registry-url: 'https://registry.npmjs.org'

      - run: pnpm install
      - run: pnpm build
      - run: pnpm test

      - name: Create Release PR or Publish
        uses: changesets/action@v1
        with:
          publish: pnpm release
          version: pnpm version
          title: 'chore: version packages'
          commit: 'chore: version packages'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### What Happens on Merge

1. **PR with changeset merges to main**
2. **GitHub Action runs:**
   - Collects all changesets
   - Calculates new versions (respecting `linked` config)
   - Creates "Version Packages" PR
3. **"Version Packages" PR contains:**
   - Updated package.json versions
   - Updated CHANGELOG.md files
4. **When "Version Packages" PR merges:**
   - All packages publish to npm
   - Git tags created

---

## 11. Why NOT Subpath Exports

RFC-0001 (rfc-v2) suggested:

```typescript
import { createApp } from 'nextrush';
import cors from 'nextrush/middleware/cors';
```

**We reject this for NextRush.** Here's why:

### Problems with Subpath Exports

| Issue                      | Explanation                                |
| -------------------------- | ------------------------------------------ |
| Package.json complexity    | Need to declare every subpath in `exports` |
| Version coupling           | Middleware versions coupled to facade      |
| Can't update independently | Bug in cors? Whole facade needs release    |
| Breaks npm ecosystem       | `npm info @nextrush/cors` doesn't work     |
| IDE confusion              | TypeScript sometimes struggles             |

### Our Approach: Direct Package Imports

```typescript
// This is clearer and more flexible
import { createApp } from 'nextrush';
import { cors } from '@nextrush/cors';
```

**Benefits:**

- Each package has own version, changelog, npm page
- IDE auto-import works perfectly
- Users can pin exact versions
- Bug fixes don't require facade update

---

## 12. Evaluation of Previous RFCs

### RFC-0001 (rfc-v2): Package Management

**Verdict: PARTIALLY ADOPTED**

| Aspect                 | RFC-0001 Said      | Our Decision      |
| ---------------------- | ------------------ | ----------------- |
| Hybrid model           | ✅ Yes             | ✅ Adopted        |
| Facade package         | ✅ Yes             | ✅ Adopted        |
| Subpath exports        | ✅ Use them        | ❌ Rejected       |
| Independent versioning | ✅ All independent | ❌ Core is LINKED |
| No auto-loading        | ✅ Yes             | ✅ Adopted        |

### RFC-0002 (rfc-v2): Public API Surface

**Verdict: FULLY ADOPTED**

| Aspect             | RFC-0002 Said               | Our Decision |
| ------------------ | --------------------------- | ------------ |
| Public vs Internal | ✅ Clear boundaries         | ✅ Adopted   |
| `internal/` folder | ✅ Required                 | ✅ Adopted   |
| Stability levels   | ✅ Stable/Semi/Experimental | ✅ Adopted   |
| Docs as contract   | ✅ Yes                      | ✅ Adopted   |

---

## 13. Summary: The Complete Picture

```
┌─────────────────────────────────────────────────────────────────┐
│                         nextrush (FACADE)                        │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────────┐ │
│  │  core   │ │ router  │ │ errors  │ │  types  │ │adapter-node│ │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └───────────┘ │
│                     ALL VERSION 3.x.x (LINKED)                   │
└─────────────────────────────────────────────────────────────────┘
                               │
           ┌───────────────────┼───────────────────┐
           │                   │                   │
           ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  CLASS-BASED    │  │    ADAPTERS     │  │   MIDDLEWARE    │
│  ┌──────────┐   │  │  ┌───────────┐  │  │  ┌──────────┐   │
│  │    di    │   │  │  │adapter-bun│  │  │  │   cors   │   │
│  ├──────────┤   │  │  ├───────────┤  │  │  ├──────────┤   │
│  │decorators│   │  │  │adapter-deno│ │  │  │  helmet  │   │
│  ├──────────┤   │  │  ├───────────┤  │  │  ├──────────┤   │
│  │controllers│  │  │  │adapter-edge│ │  │  │body-parser│  │
│  └──────────┘   │  │  └───────────┘  │  │  └──────────┘   │
│  VERSION LINKED │  │  SEMI-LINKED   │  │   INDEPENDENT   │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### Installation Cheat Sheet

```bash
# 🚀 Quick Start (90% of users)
pnpm add nextrush

# 🔧 With middleware
pnpm add nextrush @nextrush/cors @nextrush/body-parser

# 🏗️ Class-based architecture
pnpm add nextrush @nextrush/decorators @nextrush/di @nextrush/controllers

# ⚡ Different runtime
pnpm add nextrush @nextrush/adapter-bun

# 🏢 Production-ready
pnpm add nextrush @nextrush/body-parser @nextrush/cors @nextrush/helmet @nextrush/rate-limit @nextrush/logger
```

---

## Appendix A: Version Compatibility Table

Users should reference this table:

| nextrush | @nextrush/core | Adapters | Middleware  |
| -------- | -------------- | -------- | ----------- |
| 3.0.x    | 3.0.x          | 3.0.x    | ^3.0.0 peer |
| 3.1.x    | 3.1.x          | 3.1.x    | ^3.0.0 peer |
| 3.2.x    | 3.2.x          | 3.2.x    | ^3.0.0 peer |

**Rule:** If facade is 3.x.x, all core packages are 3.x.x. Middleware just needs peer dep satisfied.

---

## Appendix B: Checklist for New Package

When adding a new package:

- [ ] Decide tier (Core/Middleware/Plugin)
- [ ] Set correct version (linked packages: same as core)
- [ ] Add to `.changeset/config.json` if linked
- [ ] Add `publishConfig: { access: "public" }`
- [ ] Add `repository` field
- [ ] Add `peerDependencies` for @nextrush/types
- [ ] Write README with install instructions
- [ ] Add to documentation site

---

**This RFC supersedes RFC-0001 and RFC-0002 from `draft/rfc-v2/`.**

Those RFCs had good ideas but lacked specificity on:

- Linked versioning for core
- Dual paradigm handling
- Multi-runtime support
- Subpath export decision

This RFC provides the complete, actionable strategy.
