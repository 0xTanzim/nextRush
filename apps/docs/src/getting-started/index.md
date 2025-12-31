---
title: Introduction
description: What is NextRush and why should you use it?
---

# Introduction

> The zero-dependency backend framework that runs everywhere.

## What is NextRush?

NextRush is a **modern backend framework** for JavaScript and TypeScript that gives you the best of both worlds: **the simplicity of Express** with **the structure of NestJS** — without forcing you to choose.

```mermaid
flowchart LR
    subgraph choice[" "]
        direction TB
        A["🚀 Simple API"] --> F["Functional Style"]
        B["🏢 Enterprise App"] --> C["Class-Based Style"]
    end

    F --> N["⚡ NextRush Core"]
    C --> N

    N --> R1["Node.js"]
    N --> R2["Bun"]
    N --> R3["Deno"]
    N --> R4["Edge"]

    style N fill:#3b82f6,stroke:#1d4ed8,color:#fff,stroke-width:2px
    style F fill:#22c55e,stroke:#16a34a,color:#fff,stroke-width:2px
    style C fill:#8b5cf6,stroke:#7c3aed,color:#fff,stroke-width:2px
    style choice fill:none,stroke:none
```

**Core principles:**

| Principle | What It Means |
|-----------|--------------|
| **Zero Dependencies** | Core has NO external runtime deps — no supply chain risks |
| **Multi-Runtime** | Same code runs on Node.js, Bun, Deno, and Edge |
| **Dual Paradigm** | Use functions OR classes — migrate when ready |
| **Type Safety** | Full TypeScript with zero `any` types |
| **Modular** | Install only what you need |

## The Problem With Existing Frameworks

Backend frameworks force you into a false choice:

```mermaid
flowchart TD
    subgraph old["The Old Choice"]
        direction LR
        E["📦 Express / Koa"]
        N["🏗️ NestJS / AdonisJS"]
    end

    E -.->|"✅ Flexible\n❌ No structure\n❌ DIY everything"| P1["😫 Pain"]
    N -.->|"✅ Structured\n❌ Heavy\n❌ Steep learning curve"| P2["😫 Pain"]

    style P1 fill:#ef4444,stroke:#dc2626,color:#fff,stroke-width:2px
    style P2 fill:#ef4444,stroke:#dc2626,color:#fff,stroke-width:2px
    style E fill:#f8fafc,stroke:#94a3b8,stroke-width:2px
    style N fill:#f8fafc,stroke:#94a3b8,stroke-width:2px
```

**Minimal but limited.** Express and Koa give you flexibility but no structure. You end up reinventing authentication, validation, and dependency injection for every project.

**Structured but heavy.** NestJS and AdonisJS provide structure but force you into patterns. Their learning curves are steep, and you pay for features you don't use.

## How NextRush is Different

NextRush gives you **both options** in a single framework — and you can migrate between them progressively:

```mermaid
flowchart LR
    subgraph Start["Day 1: Simple"]
        S[Functional Style<br/>10 lines of code]
    end

    subgraph Scale["Day 100: Complex"]
        E[Class-Based Style<br/>Controllers + DI]
    end

    Start -->|"Add structure<br/>when YOU need it"| Scale

    style S fill:#22c55e,stroke:#16a34a,color:#fff
    style E fill:#8b5cf6,stroke:#7c3aed,color:#fff
```

### Start Simple (Functional)

For small services, APIs, and developers who prefer functions:

```typescript
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { serve } from '@nextrush/adapter-node';

const app = createApp();
const router = createRouter();

router.get('/hello', (ctx) => {
  ctx.json({ message: 'Hello, World!' });
});

app.use(router.routes());
serve(app, { port: 3000 });
```

**That's it.** No configuration. No boilerplate. Just a working API.

### Scale with Structure (Class-Based)

For larger applications, teams, and developers who prefer structure:

```typescript
// src/controllers/hello.controller.ts
import { Controller, Get, Service } from '@nextrush/decorators';

@Service()
class GreetingService {
  getGreeting() {
    return 'Hello, World!';
  }
}

@Controller('/hello')
export class HelloController {
  constructor(private greetingService: GreetingService) {}

  @Get()
  sayHello() {
    return { message: this.greetingService.getGreeting() };
  }
}
```

```typescript
// src/index.ts
import 'reflect-metadata';
import { createApp } from '@nextrush/core';
import { serve } from '@nextrush/adapter-node';
import { controllersPlugin } from '@nextrush/controllers';
import { HelloController } from './controllers/hello.controller';

const app = createApp();

app.plugin(controllersPlugin({
  controllers: [HelloController],
}));

serve(app, { port: 3000 });
```

**Same framework. Same performance. Your choice.**

## Why Zero Dependencies?

The core framework (`@nextrush/core`, `@nextrush/router`, `@nextrush/types`) has **zero external runtime dependencies**.

```mermaid
flowchart TD
    subgraph typical["❌ Typical Framework"]
        T["Your Code"] --> D1["50+ Dependencies"]
        D1 --> D2["200+ Transitive Deps"]
        D2 --> R["🎯 Attack Surface"]
    end

    subgraph next["✅ NextRush"]
        N["Your Code"] --> NC["NextRush Core"]
        NC --> NR["Node.js Runtime"]
    end

    style R fill:#ef4444,stroke:#dc2626,color:#fff,stroke-width:2px
    style NR fill:#22c55e,stroke:#16a34a,color:#fff,stroke-width:2px
    style NC fill:#3b82f6,stroke:#1d4ed8,color:#fff,stroke-width:2px
    style typical fill:transparent,stroke:#fca5a5,stroke-width:2px,stroke-dasharray:5 5
    style next fill:transparent,stroke:#86efac,stroke-width:2px,stroke-dasharray:5 5
```

| Benefit | Why It Matters |
|---------|----------------|
| **No supply chain attacks** | Nothing to compromise except your own code |
| **No version conflicts** | Works with any project, any Node.js 20+ |
| **Minimal attack surface** | Only your code and the runtime |
| **Fast installs** | No dependency tree to resolve |
| **Full auditability** | You can read and understand every line |

## Runtime Compatibility

Write once, run anywhere:

```mermaid
flowchart TB
    NC["⚡ NextRush App"] --> |"adapter-node"| N["🟢 Node.js 20+"]
    NC --> |"adapter-bun"| B["🟡 Bun 1.0+"]
    NC --> |"adapter-deno"| D["🦕 Deno 2.0+"]
    NC --> |"adapter-edge"| E["☁️ Edge Runtimes"]

    E --> CF["Cloudflare Workers"]
    E --> VE["Vercel Edge"]

    style NC fill:#3b82f6,stroke:#1d4ed8,color:#fff,stroke-width:3px
    style N fill:#22c55e,stroke:#16a34a,color:#fff,stroke-width:2px
    style B fill:#eab308,stroke:#ca8a04,color:#000,stroke-width:2px
    style D fill:#06b6d4,stroke:#0891b2,color:#fff,stroke-width:2px
    style E fill:#8b5cf6,stroke:#7c3aed,color:#fff,stroke-width:2px
```

| Runtime | Version | Adapter |
|---------|---------|---------|
| Node.js | 20+ | `@nextrush/adapter-node` |
| Bun | 1.0+ | `@nextrush/adapter-bun` |
| Deno | 2.0+ | `@nextrush/adapter-deno` |
| Cloudflare Workers | Latest | `@nextrush/adapter-edge` |
| Vercel Edge | Latest | `@nextrush/adapter-edge` |

## Performance

NextRush is built on architectural decisions that prioritize speed:

```mermaid
flowchart LR
    R["📨 Request"] --> RT["🌳 Radix Tree\nO(k) lookup"]
    RT --> MW["⚙️ Middleware\nOnion model"]
    MW --> H["🎯 Handler"]
    H --> Res["📤 Response"]

    style RT fill:#22c55e,stroke:#16a34a,color:#fff,stroke-width:2px
    style MW fill:#3b82f6,stroke:#1d4ed8,color:#fff,stroke-width:2px
    style H fill:#8b5cf6,stroke:#7c3aed,color:#fff,stroke-width:2px
```

| vs Framework | Performance |
|--------------|-------------|
| Express | **52% faster** |
| Koa | **5% faster** |
| Hono | Competitive |

*Benchmarks vary by hardware. Run your own tests.*

### Why It's Fast

1. **Radix tree routing** — O(k) lookup where k = path length, not route count
2. **Async middleware composition** — Koa-style onion model
3. **Zero dependencies** — No unused code paths
4. **Modern JavaScript** — ES2022+ features, no polyfills

## Modular Architecture

Every feature is a separate package. Install only what you need:

```mermaid
flowchart TB
    subgraph core["📦 Core - Always Needed"]
        C["@nextrush/core"] --> T["@nextrush/types"]
        R["@nextrush/router"] --> T
    end

    subgraph middleware["🔧 Middleware - Pick & Choose"]
        BP["body-parser"]
        CO["cors"]
        HE["helmet"]
        RL["rate-limit"]
    end

    subgraph advanced["🚀 Advanced - When Ready"]
        DI["di"]
        DE["decorators"]
        CT["controllers"]
        DEV["dev"]
    end

    style C fill:#3b82f6,stroke:#1d4ed8,color:#fff,stroke-width:2px
    style R fill:#3b82f6,stroke:#1d4ed8,color:#fff,stroke-width:2px
    style T fill:#3b82f6,stroke:#1d4ed8,color:#fff,stroke-width:2px
    style core fill:transparent,stroke:#60a5fa,stroke-width:2px,stroke-dasharray:5 5
    style middleware fill:transparent,stroke:#fbbf24,stroke-width:2px,stroke-dasharray:5 5
    style advanced fill:transparent,stroke:#a78bfa,stroke-width:2px,stroke-dasharray:5 5
    style DEV fill:#f97316,stroke:#ea580c,color:#fff,stroke-width:2px
```

| Need | Install |
|------|---------|
| Routing | `@nextrush/router` |
| Body parsing | `@nextrush/body-parser` |
| CORS | `@nextrush/cors` |
| Security headers | `@nextrush/helmet` |
| Controllers + DI | `@nextrush/controllers` |
| Rate limiting | `@nextrush/rate-limit` |

Or use the `nextrush` meta package for common essentials:

```bash
pnpm add nextrush
```

## When to Use NextRush

::: tip Use NextRush when:
- Building REST APIs or microservices
- You want TypeScript-first development
- You need multi-runtime support (Node.js, Bun, Deno, Edge)
- You want to start simple and add structure later
- You care about supply chain security
:::

::: warning Consider alternatives when:
- You need a full-stack framework with SSR (use Next.js, Remix)
- You're building a monolithic MVC app (use AdonisJS)
- You need maximum raw speed above all else (use Fastify)
:::

## Next Steps

Ready to build something?

<div class="vp-card-grid">

- **[Quick Start →](/getting-started/quick-start)**

  Your first app in 5 minutes

- **[Installation →](/getting-started/installation)**

  Detailed setup guide for all runtimes

- **[Package Overview →](/packages/)**

  Explore all available packages

</div>
