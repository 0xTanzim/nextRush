---
layout: home
title: NextRush - Zero Dependency Backend Framework
description: A minimal, modular, blazing-fast backend framework with zero runtime dependencies and full TypeScript support.

hero:
  name: NextRush
  text: Zero Dependency Backend Framework
  tagline: Blazing fast, modular, type-safe. Works on Node.js, Bun, Deno, and Edge runtimes.
  image:
    src: /logo.svg
    alt: NextRush
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started/
    - theme: alt
      text: View on GitHub
      link: https://github.com/0xtanzim/nextrush

features:
  - icon: 🚫
    title: Zero Runtime Dependencies
    details: The core framework has NO external dependencies. No supply chain risks. No bloat. Just pure, auditable code.
  - icon: ⚡
    title: Blazing Fast
    details: 52% faster than Express, competitive with Hono. Built on radix tree routing and async middleware composition.
  - icon: 🌐
    title: Multi-Runtime
    details: One codebase runs everywhere — Node.js, Bun, Deno, and Edge (Cloudflare Workers, Vercel Edge).
  - icon: 📦
    title: Modular by Design
    details: Install only what you need. Routing, CORS, body parser, DI — each is a separate, tree-shakeable package.
  - icon: 🎯
    title: TypeScript First
    details: Zero 'any' types. Full inference for routes, middleware, and decorators. Catch errors at compile time.
  - icon: 🔀
    title: Dual Paradigm
    details: Use functional handlers for simple APIs, or class-based controllers with dependency injection for enterprise apps.
---

<script setup>
import { VPTeamMembers } from 'vitepress/theme'
</script>

## Quick Overview

Get a NextRush API running in seconds:

::: code-group

```typescript [Functional Style]
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { serve } from '@nextrush/adapter-node';

const app = createApp();
const router = createRouter();

router.get('/hello/:name', (ctx) => {
  ctx.json({ message: `Hello, ${ctx.params.name}!` });
});

app.use(router.routes());
serve(app, { port: 3000 });
```

```typescript [Class-Based Style]
import 'reflect-metadata';
import { createApp } from '@nextrush/core';
import { serve } from '@nextrush/adapter-node';
import { Controller, Get, ParamProp } from '@nextrush/decorators';
import { controllersPlugin } from '@nextrush/controllers';

@Controller('/hello')
class HelloController {
  @Get(':name')
  hello(@ParamProp('name') name: string) {
    return { message: `Hello, ${name}!` };
  }
}

const app = createApp();
app.plugin(controllersPlugin({ controllers: [HelloController] }));
serve(app, { port: 3000 });
```

:::

**Same framework. Same performance. Your choice of style.**

---

## Runtime Compatibility

NextRush runs everywhere JavaScript runs:

| Runtime | Status | Adapter |
|---------|--------|---------|
| **Node.js 20+** | ✅ Full Support | `@nextrush/adapter-node` |
| **Bun 1.0+** | ✅ Full Support | `@nextrush/adapter-bun` |
| **Deno 2.0+** | ✅ Full Support | `@nextrush/adapter-deno` |
| **Cloudflare Workers** | ✅ Full Support | `@nextrush/adapter-edge` |
| **Vercel Edge** | ✅ Full Support | `@nextrush/adapter-edge` |

---

## Why NextRush?

### Zero Dependencies

The core framework has **zero runtime dependencies**. This means:

| Benefit | Impact |
|---------|--------|
| **No supply chain attacks** | Nothing to compromise except your own code |
| **No dependency conflicts** | Works with any project, any Node.js 20+ |
| **Minimal attack surface** | Only your code and the runtime |
| **Fast installs** | No dependency tree to resolve |

### Performance

Built on architectural decisions that matter:

| vs Framework | Speed Improvement |
|--------------|-------------------|
| Express | **52% faster** |
| Koa | **5% faster** |
| Hono | **Competitive** |

*Fastify trades simplicity for raw speed. NextRush prioritizes DX + performance balance.*

### Modular Architecture

Every feature is a separate package. Install only what you use:

| Need | Install |
|------|---------|
| Routing | `@nextrush/router` |
| Body parsing | `@nextrush/body-parser` |
| CORS | `@nextrush/cors` |
| Security headers | `@nextrush/helmet` |
| Controllers + DI | `@nextrush/controllers` |
| Rate limiting | `@nextrush/rate-limit` |

### Full TypeScript

Not "TypeScript compatible" — **TypeScript first**:

- Zero `any` types in the codebase
- Full inference for routes and middleware
- Type-safe parameter decorators
- Compile-time error detection

---

## The Context API

Everything flows through the Context object (`ctx`):

```typescript
app.use(async (ctx) => {
  // Request data (input)
  ctx.method       // 'GET', 'POST', etc.
  ctx.path         // '/users/123'
  ctx.params       // { id: '123' }
  ctx.query        // { page: '1' }
  ctx.body         // Request body (with body-parser)
  ctx.headers      // Request headers
  ctx.state        // Middleware state bag

  // Response (output)
  ctx.status = 201
  ctx.json({ data: 'value' })
  ctx.send('text')
  ctx.html('<h1>Hello</h1>')
  ctx.redirect('/new-url')

  // Middleware flow
  await ctx.next()
});
```

---

## Get Started

Ready to build something?

<div class="actions">
  <a href="/getting-started/" class="action-button brand">
    Get Started →
  </a>
  <a href="/getting-started/quick-start" class="action-button alt">
    Quick Start
  </a>
  <a href="/packages/" class="action-button alt">
    Explore Packages
  </a>
</div>

<style>
.actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 24px;
}

.action-button {
  display: inline-block;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s;
}

.action-button.brand {
  background: var(--vp-c-brand-1);
  color: white;
}

.action-button.brand:hover {
  background: var(--vp-c-brand-2);
}

.action-button.alt {
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-1);
}

.action-button.alt:hover {
  background: var(--vp-c-default-3);
}
</style>
