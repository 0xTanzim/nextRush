---
layout: home
title: NextRush - Modern Backend Framework for Node.js
description: A minimal, modular, blazing-fast backend framework with zero dependencies and full TypeScript support.
---

# NextRush

> The minimal backend framework that scales with your needs.

## What is NextRush?

NextRush is a **modern Node.js backend framework** built for developers who want:

- **Speed**: 30,000+ requests per second out of the box
- **Simplicity**: Core under 3,000 lines of code
- **Flexibility**: Use functions OR classes — your choice
- **Type Safety**: Full TypeScript with zero `any`
- **Zero Lock-in**: Every feature is an opt-in package

## Two Ways to Build

NextRush supports **both programming styles**. Pick what fits your project:

### Functional Style

For small services, APIs, and developers who prefer functions:

```typescript
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';

const app = createApp();
const router = createRouter();

router.get('/hello', (ctx) => {
  ctx.json({ message: 'Hello, World!' });
});

app.use(router.routes());
app.listen(3000);
```

### Class-Based Style

For large applications, teams, and developers who prefer structure:

```typescript
import { createApp } from '@nextrush/core';
import {
  Controller, Get, Service,
  controllersPlugin
} from '@nextrush/controllers';

@Service()
class GreetingService {
  getGreeting() {
    return 'Hello, World!';
  }
}

@Controller('/hello')
class HelloController {
  constructor(private greetingService: GreetingService) {}

  @Get()
  sayHello() {
    return { message: this.greetingService.getGreeting() };
  }
}

const app = createApp();
app.plugin(controllersPlugin({
  controllers: [HelloController],
}));
app.listen(3000);
```

**Same framework. Same performance. Your choice.**

## Why NextRush?

### Minimal Core

The entire framework core is under 3,000 lines of code. No hidden complexity. No magic you can't understand.

### Modular Architecture

Every feature is a separate package:

| Need | Install |
|------|---------|
| Routing | `@nextrush/router` |
| Body parsing | `@nextrush/body-parser` |
| CORS | `@nextrush/cors` |
| Controllers + DI | `@nextrush/controllers` |

Install only what you use. Pay only for what you need.

### Blazing Fast

Built on a radix tree router and async middleware composition:

| Framework | Requests/sec |
|-----------|-------------|
| NextRush | 30,000+ |
| Fastify | 28,000 |
| Koa | 18,000 |
| Express | 8,000 |

### Full TypeScript

Not "TypeScript compatible" — **TypeScript first**:

- Zero `any` types in the codebase
- Full inference for routes and middleware
- Type-safe parameter decorators
- Compile-time error detection

### Multi-Runtime

One codebase, multiple runtimes:

- **Node.js** — Production-ready
- **Bun** — Fastest runtime
- **Deno** — Secure by default
- **Edge** — Cloudflare Workers, Vercel Edge

## Quick Start

### Functional (2 packages)

```bash
pnpm add @nextrush/core @nextrush/adapter-node
```

```typescript
import { createApp } from '@nextrush/core';
import { nodeAdapter } from '@nextrush/adapter-node';

const app = createApp();

app.get('/', (ctx) => ctx.json({ status: 'ok' }));

nodeAdapter(app).listen(3000);
```

### Class-Based (2 packages)

```bash
pnpm add @nextrush/controllers @nextrush/adapter-node
```

```typescript
import 'reflect-metadata';
import { createApp } from '@nextrush/core';
import { Controller, Get, controllersPlugin } from '@nextrush/controllers';
import { nodeAdapter } from '@nextrush/adapter-node';

@Controller('/')
class AppController {
  @Get()
  health() {
    return { status: 'ok' };
  }
}

const app = createApp();
app.plugin(controllersPlugin({
  controllers: [AppController],
}));
nodeAdapter(app).listen(3000);
```

## Documentation

<div class="doc-links">

### Getting Started
- [Introduction](/getting-started/) — What is NextRush?
- [Quick Start](/getting-started/quick-start) — Your first app in 5 minutes
- [Installation](/getting-started/installation) — Detailed setup guide

### Core Concepts
- [Context](/concepts/context) — The `ctx` object
- [Middleware](/concepts/middleware) — Request/response pipeline
- [Routing](/concepts/routing) — Route patterns and parameters

### Class-Based Development
- [Controllers Overview](/controllers/) — Why and when to use controllers
- [Getting Started](/controllers/getting-started) — Quick start with controllers
- [Auto-Discovery](/controllers/auto-discovery) — Automatic controller registration
- [Guards](/controllers/guards) — Route protection patterns

### Packages
- [Core](/packages/core) — Application and middleware
- [Router](/packages/router) — Radix tree routing
- [Controllers](/packages/controllers) — Class-based development
- [Middleware](/middleware/) — CORS, Helmet, Body Parser, etc.

</div>

## Community

- [GitHub](https://github.com/nextrush/nextrush) — Source code and issues
- [Discord](https://discord.gg/nextrush) — Community chat
- [Twitter](https://twitter.com/nextrushjs) — Updates and announcements

## License

MIT © NextRush Contributors
