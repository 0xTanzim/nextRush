# 🚀 NextRush v3

> **Minimal, modular, blazing fast Node.js framework**

[![npm version](https://badge.fury.io/js/nextrush.svg)](https://www.npmjs.com/package/nextrush)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ⚡ Features

- **🪶 Minimal Core** - Under 3,000 lines of code
- **📦 Modular** - Only use what you need
- **🚄 Fast** - Target 30,000+ requests per second
- **🔒 Type-Safe** - Full TypeScript with zero `any`
- **0️⃣ Zero Dependencies** - No external runtime dependencies
- **🌳 Tree-Shakable** - Bundle only what you use

## 📦 Packages

| Package | Description | Status |
|---------|-------------|--------|
| `@nextrush/types` | Shared TypeScript types | ✅ Ready |
| `@nextrush/core` | Application, Middleware | ✅ Ready |
| `@nextrush/router` | Radix tree routing | 🚧 Coming |
| `@nextrush/adapter-node` | Node.js HTTP adapter | 🚧 Coming |
| `@nextrush/cors` | CORS middleware | 🚧 Coming |
| `@nextrush/body-parser` | Body parsing middleware | 🚧 Coming |
| `nextrush` | Meta package | 🚧 Coming |

## 🚀 Quick Start

```typescript
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { listen } from '@nextrush/adapter-node';

const app = createApp();
const router = createRouter();

// Modern DX - ctx.body is input, ctx.json() is output
router.get('/users/:id', async (ctx) => {
  const { id } = ctx.params;
  ctx.json({ id, name: 'John' });
});

router.post('/users', async (ctx) => {
  const userData = ctx.body; // Input
  ctx.status = 201;
  ctx.json({ user: userData }); // Output
});

// Modern middleware syntax
app.use(async (ctx) => {
  const start = Date.now();
  await ctx.next(); // Clean, modern syntax
  console.log(`${ctx.method} ${ctx.path} - ${Date.now() - start}ms`);
});

app.use(router.routes());

listen(app, { port: 3000 });
```

## 🎯 Design Philosophy

### Minimal Core

The core does ONE thing: handle HTTP requests with middleware. Everything else is a package.

```
@nextrush/core     →  Application, Context, Middleware (1,500 LOC)
@nextrush/router   →  Routing (1,000 LOC)
@nextrush/cors     →  CORS (200 LOC)
...
```

### DX-First API

```typescript
// INPUT (Request)
ctx.body      // Parsed request body
ctx.query     // Query parameters
ctx.params    // Route parameters

// OUTPUT (Response)
ctx.json()    // Send JSON
ctx.send()    // Send text/buffer
ctx.html()    // Send HTML
ctx.redirect()// Redirect

// MIDDLEWARE
ctx.next()    // Modern syntax
```

### Performance Targets

| Metric | v2 | v3 Target |
|--------|-----|-----------|
| RPS | 13,000 | 30,000+ |
| Core Size | 25,000 LOC | <3,000 LOC |
| Cold Start | 150ms | <30ms |
| Memory | 1.5MB | <200KB |

## 🛠️ Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Type check
pnpm typecheck

# Lint
pnpm lint
```

## 📁 Project Structure

```
nextrush/
├── packages/
│   ├── types/           # @nextrush/types
│   ├── core/            # @nextrush/core
│   ├── router/          # @nextrush/router
│   ├── adapters/node/   # @nextrush/adapter-node
│   └── middleware/      # cors, helmet, body-parser...
├── apps/
│   └── playground/      # Testing playground
├── draft/               # Architecture docs
└── _archive/            # Old v2 code
```

## 📖 Documentation

- [Architecture Vision](draft/V3-ARCHITECTURE-VISION.md)
- [DX Guidelines](draft/V3-DX-AND-EXTENSIBILITY.md)
- [Migration Roadmap](draft/V3-MIGRATION-ROADMAP.md)

## 🤝 Contributing

Contributions are welcome! Please read the contribution guidelines first.

## 📄 License

MIT © [Tanzim Hossain](https://github.com/0xTanzim)
