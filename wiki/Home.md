# NextRush

> Minimal, modular, high-performance Node.js framework — **v3** (`3.0.x` on npm)

NextRush is a TypeScript-first HTTP framework built around **zero runtime dependencies in core**, **modular opt-in packages**, and a **clear Context API** with Koa-style middleware.

**Canonical docs:** The full documentation site (search, versioning, guides) lives at **[Documentation site](https://0xtanzim.github.io/nextRush/docs)**. This wiki mirrors high-level guides for readers who prefer GitHub only.

---

## Feature Highlights

| Feature | Description |
|---|---|
| **Zero runtime deps** | Core has no external dependencies (except `reflect-metadata` for DI) |
| **Modular** | Install only what you need — middleware and plugins are separate packages |
| **Type-safe** | Full TypeScript strict mode, zero `any` |
| **Dual paradigm** | Functional routes and class-based controllers in the same framework |
| **Radix-tree routing** | O(k) route matching by path depth, O(1) static-route fast path |
| **Runtime-agnostic** | Adapters for Node.js, Bun, Deno, and Edge runtimes |
| **Koa-style middleware** | Composable `async/await` middleware with `ctx.next()` |
| **Plugin system** | Extend the app with lifecycle hooks via `app.plugin()` |

---

## Performance

Benchmark snapshot (Intel i5-8300H, Node.js v25.1.0):

| Framework | Hello World | POST JSON | Mixed Workload |
|---|---|---|---|
| Fastify | 48,045 RPS | 21,412 RPS | 48,493 RPS |
| **NextRush v3** | **43,268 RPS** | **20,438 RPS** | **43,283 RPS** |
| Hono | 37,476 RPS | 12,625 RPS | 38,759 RPS |
| Koa | 34,683 RPS | 17,664 RPS | 35,566 RPS |
| Express | 23,739 RPS | 14,417 RPS | 23,783 RPS |

Run `pnpm benchmark` from `apps/benchmark` to reproduce on your machine.

---

## Quick Start

### Functional style

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

### Class-based style

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

## Wiki Pages

| Page | Description |
|---|---|
| [Getting Started](Getting-Started) | Installation and first application |
| [Architecture](Architecture) | Monorepo structure, package hierarchy, design principles |
| [Core Concepts](Core-Concepts) | Application, Context API, Middleware, Plugin system |
| [Routing](Routing) | Router creation, parameters, nesting |
| [Dependency Injection](Dependency-Injection) | DI container, `@Service`, `@Repository`, scopes |
| [Controllers and Decorators](Controllers-and-Decorators) | `@Controller`, route decorators, parameter decorators, guards |
| [Middleware](Middleware) | Built-in middleware packages, writing custom middleware |
| [Error Handling](Error-Handling) | HttpError hierarchy, global error handler, factory functions |
| [Packages](Packages) | Complete package reference |
| [Contributing](Contributing) | Development setup, conventions, PR process |
| [Changelog](Changelog) | Release history |

---

## Links

- [GitHub Repository](https://github.com/0xTanzim/nextRush)
- [npm Package](https://www.npmjs.com/package/nextrush)
- [Documentation Site](https://0xtanzim.github.io/nextRush/docs)
- [Issue Tracker](https://github.com/0xTanzim/nextRush/issues)
- [License: MIT](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)
