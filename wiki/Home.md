# NextRush

TypeScript-first HTTP stack built around a small core, optional packages you install only when needed, and a single **context** (`ctx`) for request input and response output. Published line: **v3** (`3.0.x` on npm).

**Full documentation** (search, guides, API reference): **[Documentation site](https://0xtanzim.github.io/nextRush/docs)**.

This wiki is a GitHub-native companion: short guides and tables for people browsing the repo. Deep dives and signatures live on the docs site.

---

## What runs when a request hits the server

```mermaid
sequenceDiagram
  participant C as Client
  participant A as Adapter
  participant App as Application
  participant MW as Middleware
  participant R as Router
  participant H as Handler

  C->>A: HTTP request
  A->>App: build Context
  loop Middleware chain
    App->>MW: ctx, next
    MW->>MW: await next()
  end
  App->>R: match route
  R->>H: route handler
  H->>App: ctx.json / ctx.send / throw
  App->>C: response
```

Adapters (`@nextrush/adapter-*`) translate platform APIs into this pipeline; core stays free of Node-, Bun-, or Deno-specific calls.

---

## What you get

| Topic | Detail |
|-------|--------|
| Core footprint | No runtime npm deps in core/router/types/errors/adapters/middleware (exceptions: `reflect-metadata` + DI stack only where documented). |
| Composition | Koa-style async middleware with `await next()`. |
| Routing | Segment trie in `@nextrush/router`: practical path matching with a fast path for static routes. |
| Styles | Functional routes (`createRouter`) and class controllers (`@Controller` + plugins) in the same app. |
| Runtimes | Node.js (default meta package), Bun, Deno, Edge via separate adapters. |

---

## Benchmark snapshot

From `apps/benchmark` on sample hardware (see repo for methodology). Reproduce with `pnpm benchmark` inside `apps/benchmark`.

| Framework | Hello World | POST JSON | Mixed |
|-----------|---------------|-----------|-------|
| Fastify | 48,045 | 21,412 | 48,493 |
| **NextRush v3** | **43,268** | **20,438** | **43,283** |
| Hono | 37,476 | 12,625 | 38,759 |
| Koa | 34,683 | 17,664 | 35,566 |
| Express | 23,739 | 14,417 | 23,783 |

Numbers shift with CPU and Node version; treat these as directional, not guarantees.

---

## Minimal examples

### Functional routes

```typescript
import { createApp, createRouter, listen } from 'nextrush';

const app = createApp();
const router = createRouter();

router.get('/', (ctx) => {
  ctx.json({ message: 'Hello NextRush!' });
});

router.get('/users/:id', (ctx) => {
  ctx.json({ id: ctx.params.id });
});

app.route('/', router);
listen(app, 3000);
```

### Class controllers

```typescript
import 'reflect-metadata';
import { createApp, listen } from 'nextrush';
import { Controller, Get, Param, Service, controllersPlugin } from '@nextrush/controllers';

@Service()
class UserService {
  findAll() {
    return [{ id: 1, name: 'Alice' }];
  }
}

@Controller('/users')
class UserController {
  constructor(private users: UserService) {}

  @Get()
  findAll() {
    return this.users.findAll();
  }

  @Get('/:id')
  findOne(@Param('id') id: string) {
    return { id };
  }
}

const app = createApp();
app.plugin(controllersPlugin({ root: './src' }));
listen(app, 3000);
```

---

## Wiki map

| Page | Use it for |
|------|------------|
| **Core** | |
| [Getting Started](Getting-Started) | Install, scaffold, first server |
| [Architecture](Architecture) | Monorepo structure, dependency rules, design constraints |
| [Core Concepts](Core-Concepts) | Application, Context API, middleware, plugins |
| **Routing & Patterns** | |
| [Routing](Routing) | Router API, parameters, mounting, composition |
| [Controllers and Decorators](Controllers-and-Decorators) | Class-based routes, guards, DI integration |
| [Dependency Injection](Dependency-Injection) | Service registration, scopes, container, resolution |
| **Operations** | |
| [Middleware](Middleware) | Built-in packages, stack ordering, custom middleware |
| [Error Handling](Error-Handling) | HTTP error hierarchy, handlers, factory functions |
| [Plugins](Plugins) | Plugin interface, lifecycle hooks, built-in plugins |
| **Under the hood** | |
| [Request Lifecycle](Request-Lifecycle) | How requests flow through the system, timing breakdown |
| [Adapters](Adapters) | Runtime adapters (Node, Bun, Deno, Edge), platform abstraction |
| [Performance](Performance) | Benchmarks, optimization strategies, production checklist |
| [Testing](Testing) | Test patterns, mocking, coverage targets |
| **Reference** | |
| [Packages](Packages) | Package index and export reference |
| [Contributing](Contributing) | Development setup, conventions, PR process |
| [Changelog](Changelog) | Release history and upgrade notes |

---

## Architecture at a glance

```mermaid
flowchart TB
  subgraph core["Core (no external deps)"]
    T["types"]
    E["errors"]
    C["core"]
    R["router"]
    T --> E --> C --> R
  end

  subgraph ext["Extensions"]
    D["di"]
    DEC["decorators"]
    CTRL["controllers"]
    D --> DEC --> CTRL
    R --> D
  end

  subgraph platform["Platform"]
    AN["adapter-node"]
    AB["adapter-bun"]
    AD["adapter-deno"]
    AE["adapter-edge"]
    AN -.-> C
    AB -.-> C
    AD -.-> C
    AE -.-> C
  end

  subgraph optional["Optional"]
    MW["middleware/*"]
    PL["plugins/*"]
    MW -.-> C
    PL -.-> C
  end
```

Imports flow downward; nothing below imports from above. Each layer stays focused.

---

## Links

- **[GitHub](https://github.com/0xTanzim/nextRush)** — source, issues
- **[npm — nextrush](https://www.npmjs.com/package/nextrush)** — install
- **[Documentation site](https://0xtanzim.github.io/nextRush/docs)** — API reference, guides
- **[MIT License](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)**
