---
applyTo: '**'
---

# NextRush v3 Architecture Overview

## Monorepo Structure

NextRush v3 uses a modular monorepo architecture with Turborepo and pnpm workspaces.

### Package Hierarchy

```
@nextrush/types      → Shared TypeScript types (no deps)
       ↓
@nextrush/core       → Application, Context, Middleware (depends on types)
       ↓
@nextrush/router     → Radix tree routing (depends on types)
       ↓
@nextrush/adapter-*  → Platform adapters (depends on core, types)
       ↓
@nextrush/middleware/* → cors, helmet, body-parser (depends on types)
       ↓
@nextrush/plugins/*  → logger, static, websocket (depends on core, types)
       ↓
nextrush             → Meta package (re-exports all essentials)
```

### Core Concepts

1. **Application** (`@nextrush/core`): Main entry point, middleware registration, plugin system
2. **Context**: Request/response wrapper with DX-focused API
3. **Middleware**: Koa-style async middleware with `compose()`
4. **Plugin**: Extension mechanism via `Plugin` interface
5. **Router** (`@nextrush/router`): High-performance radix tree routing
6. **Adapter**: Platform-specific HTTP handling (Node.js, Bun, Edge)

### Context API (DX-First Design)

```typescript
// INPUT (Request)
ctx.body       // Parsed request body
ctx.query      // Query parameters
ctx.params     // Route parameters
ctx.headers    // Request headers
ctx.method     // HTTP method
ctx.path       // Request path

// OUTPUT (Response)
ctx.json(data) // Send JSON
ctx.send(data) // Send text/buffer
ctx.html(str)  // Send HTML
ctx.redirect() // Redirect
ctx.status     // Status code

// MIDDLEWARE
ctx.next()     // Modern middleware syntax
```

### Package Size Targets

| Package | Max LOC |
|---------|---------|
| types | 500 |
| core | 1,500 |
| router | 1,000 |
| adapter-* | 500 |
| middleware/* | 300 |
| plugins/* | 600 |

### Key Files

- `packages/types/src/context.ts` - Context interface
- `packages/types/src/http.ts` - HTTP types
- `packages/core/src/application.ts` - Application class
- `packages/core/src/middleware.ts` - Middleware composition
- `packages/core/src/errors.ts` - Error classes
