---
'nextrush': major
'@nextrush/types': major
'@nextrush/errors': major
'@nextrush/core': major
'@nextrush/router': major
'@nextrush/runtime': major
'@nextrush/adapter-node': major
'@nextrush/di': major
'@nextrush/decorators': major
'@nextrush/controllers': major
'@nextrush/adapter-bun': major
'@nextrush/adapter-deno': major
'@nextrush/adapter-edge': major
'@nextrush/cors': major
'@nextrush/helmet': major
'@nextrush/body-parser': major
'@nextrush/rate-limit': major
'@nextrush/compression': major
'@nextrush/cookies': major
'@nextrush/request-id': major
'@nextrush/timer': major
'@nextrush/logger': major
'@nextrush/static': major
'@nextrush/events': major
'@nextrush/template': major
'@nextrush/websocket': major
---

# NextRush v3.0.0 - Stable Release 🚀

NextRush v3 is a complete rewrite of the framework, introducing a modular architecture with 27 independent packages.

## Highlights

### Modular Architecture

- **Minimal Core**: Core package under 3,000 LOC
- **Opt-in Features**: Install only what you need
- **Zero Dependencies**: Core has no external runtime dependencies

### Dual Paradigm Support

- **Functional**: Simple function-based routes with `createApp()` and `createRouter()`
- **Class-Based**: Full DI and decorators with `@Controller`, `@Get`, `@Service`

### Multi-Runtime Support

- Node.js (bundled with facade)
- Bun (`@nextrush/adapter-bun`)
- Deno (`@nextrush/adapter-deno`)
- Edge (`@nextrush/adapter-edge`)

### Performance

- Target: 30,000+ RPS
- Cold start: <30ms
- Memory: <200KB base

## Installation

```bash
# Quick start
pnpm add nextrush

# With middleware
pnpm add nextrush @nextrush/cors @nextrush/body-parser

# Class-based (decorators + DI)
pnpm add nextrush @nextrush/decorators @nextrush/di @nextrush/controllers
```

## Quick Example\n\n`typescript\nimport { createApp, createRouter, listen } from 'nextrush';\n\nconst app = createApp();\nconst router = createRouter();\n\nrouter.get('/', (ctx) => {\n  ctx.json({ message: 'Hello NextRush v3!' });\n});\n\napp.route('/', router);\nlisten(app, 3000);\n`

## Breaking Changes from v2

- Complete API redesign
- Modular package structure
- New middleware signature
- New plugin system
