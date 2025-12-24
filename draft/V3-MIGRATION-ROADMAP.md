# 🛤️ NextRush v3 Migration Roadmap

> **Document Type**: Implementation Roadmap
> **Date**: December 24, 2025
> **Target Release**: v3.0.0
> **Timeline**: 12 weeks (3 months)

---

## Executive Summary

This document outlines the step-by-step migration plan from NextRush v2 (monolithic) to v3 (modular monorepo). The migration prioritizes:

1. **Minimal disruption** to existing v2 users
2. **Incremental delivery** of packages
3. **Performance validation** at each phase
4. **Backward compatibility** where possible

---

## Git Strategy

### Branch Structure

```
main (v3 development)
├── v2 (maintenance branch - frozen)
├── feat/core (core package)
├── feat/router (router package)
├── feat/middleware-* (middleware packages)
├── feat/plugin-* (plugin packages)
└── release/v3.0.0-alpha.x (releases)
```

### Immediate Git Commands

```bash
# 1. Create v2 maintenance branch from current state
git checkout -b v2
git push origin v2

# 2. Tag the last v2 release
git tag v2.0.1-final
git push origin v2.0.1-final

# 3. Create v3 branch for development
git checkout main
git checkout -b feat/v3-init

# 4. Set up branch protection
# - v2: require PR for bug fixes only
# - main: require PR + tests passing
```

---

## Phase 0: Preparation (Week 0)

### 0.1 Project Setup

- [ ] Create `v2` branch from current main
- [ ] Add deprecation notice to v2 README
- [ ] Set up monorepo structure in main
- [ ] Configure Turborepo
- [ ] Configure pnpm workspaces
- [ ] Set up Changesets for versioning
- [ ] Create shared TypeScript config

### 0.2 CI/CD Setup

- [ ] Update GitHub Actions for monorepo
- [ ] Set up package publishing workflow
- [ ] Configure test matrix for all packages
- [ ] Set up benchmark automation

### 0.3 Documentation Setup

- [ ] Create migration guide template
- [ ] Create package README template
- [ ] Set up documentation site (apps/docs)

### Deliverables
- ✅ Monorepo structure ready
- ✅ CI/CD working
- ✅ Documentation scaffolding

---

## Phase 1: Core Foundation (Weeks 1-2)

### 1.1 `@nextrush/types` Package

**Purpose**: Shared TypeScript interfaces

**Extract from v2**:
- `src/types/context.ts` → `packages/types/src/context.ts`
- `src/types/http.ts` → `packages/types/src/http.ts`

**New Files**:
```
packages/types/
├── src/
│   ├── context.ts      # Context, Middleware, Next
│   ├── http.ts         # Request, Response types
│   ├── router.ts       # Route, Match types
│   ├── plugin.ts       # Plugin interface
│   └── index.ts
├── package.json
└── tsconfig.json
```

**Target**: <500 LOC

### 1.2 `@nextrush/core` Package

**Purpose**: Minimal application core

**Extract from v2**:
```
v2 Source                          → v3 Destination
─────────────────────────────────────────────────────
src/core/app/application.ts        → REWRITE (too complex)
src/core/app/context.ts            → packages/core/src/context.ts
src/core/middleware/index.ts       → packages/core/src/compose.ts
src/errors/custom-errors/base.ts   → packages/core/src/errors.ts
```

**New Core API**:
```typescript
// packages/core/src/index.ts
export { Application, createApp } from './application';
export { createContext } from './context';
export { compose } from './compose';
export { NextRushError } from './errors';
export type { Context, Middleware, Next, Plugin } from './types';
```

**Files**:
```
packages/core/
├── src/
│   ├── application.ts   # ~100 LOC (simplified)
│   ├── context.ts       # ~150 LOC
│   ├── compose.ts       # ~50 LOC (middleware chain)
│   ├── errors.ts        # ~100 LOC (base errors)
│   ├── types.ts         # Re-exports from @nextrush/types
│   └── index.ts
├── tests/
│   ├── application.test.ts
│   ├── context.test.ts
│   └── compose.test.ts
├── package.json
└── tsconfig.json
```

**Target**: <1,500 LOC, 90%+ coverage

### 1.3 `@nextrush/router` Package

**Purpose**: High-performance route matching

**Extract from v2**:
```
v2 Source                          → v3 Destination
─────────────────────────────────────────────────────
src/core/router/optimized-router.ts → packages/router/src/router.ts
src/core/router/route-tree.ts       → packages/router/src/tree.ts
src/core/router/route-cache.ts      → packages/router/src/cache.ts
src/core/router/param-pool.ts       → packages/router/src/pool.ts
src/core/router/static-routes.ts    → packages/router/src/static.ts
src/core/router/path-splitter.ts    → packages/router/src/path.ts
```

**Files**:
```
packages/router/
├── src/
│   ├── router.ts       # Main Router class
│   ├── tree.ts         # Radix tree
│   ├── cache.ts        # LRU cache
│   ├── pool.ts         # Object pooling
│   ├── static.ts       # Static route map
│   ├── path.ts         # Path utilities
│   └── index.ts
├── tests/
│   ├── router.test.ts
│   ├── tree.test.ts
│   └── matching.test.ts
├── benchmarks/
│   └── match.bench.ts
├── package.json
└── tsconfig.json
```

**Target**: <1,000 LOC, 95%+ coverage

### Phase 1 Success Criteria

- [ ] Core hello world works
- [ ] Router matching works
- [ ] Benchmark: 30,000+ RPS
- [ ] All tests pass
- [ ] TypeScript strict mode

### Phase 1 Milestone

```bash
# Test Phase 1
pnpm test --filter @nextrush/core
pnpm test --filter @nextrush/router
pnpm bench --filter @nextrush/router
```

---

## Phase 2: HTTP Adapter (Weeks 3-4)

### 2.1 `@nextrush/adapter-node` Package

**Purpose**: Node.js HTTP server binding

**Extract from v2**:
```
v2 Source                           → v3 Destination
──────────────────────────────────────────────────────
src/core/app/server-lifecycle.ts    → packages/adapters/node/src/server.ts
src/core/app/request-handler.ts     → packages/adapters/node/src/handler.ts
src/core/app/context.ts (partial)   → packages/adapters/node/src/context.ts
src/core/utils/url-parser.ts        → packages/adapters/node/src/url.ts
src/core/context/immutable.ts       → packages/adapters/node/src/immutable.ts
```

**New API**:
```typescript
// packages/adapters/node/src/index.ts
export { listen, createServer } from './server';
export { createNodeContext } from './context';
export type { NodeContext, ServerOptions } from './types';
```

**Files**:
```
packages/adapters/node/
├── src/
│   ├── server.ts       # HTTP server creation
│   ├── handler.ts      # Request handling
│   ├── context.ts      # Node-specific context
│   ├── url.ts          # URL parsing
│   ├── types.ts        # Node-specific types
│   └── index.ts
├── tests/
│   ├── server.test.ts
│   ├── handler.test.ts
│   └── integration.test.ts
├── package.json
└── tsconfig.json
```

**Target**: <500 LOC

### 2.2 Integration Testing

```typescript
// Test full request cycle
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { listen } from '@nextrush/adapter-node';

const app = createApp();
const router = createRouter();

router.get('/test', (ctx) => {
  ctx.body = 'OK';
});

app.use(router.routes());

const server = listen(app, { port: 0 });
// Test with supertest
```

### Phase 2 Success Criteria

- [ ] Full request/response cycle works
- [ ] Context properly populated
- [ ] Errors handled gracefully
- [ ] Benchmark: 30,000+ RPS maintained
- [ ] Memory: <200KB baseline

---

## Phase 3: Essential Middleware (Weeks 5-6)

### 3.1 `@nextrush/cors` Package

**Extract from v2**:
```
src/core/middleware/cors.ts → packages/middleware/cors/src/cors.ts
```

**API**:
```typescript
import { cors } from '@nextrush/cors';

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));
```

**Target**: <200 LOC

### 3.2 `@nextrush/helmet` Package

**Extract from v2**:
```
src/core/middleware/helmet.ts → packages/middleware/helmet/src/helmet.ts
```

**API**:
```typescript
import { helmet } from '@nextrush/helmet';

app.use(helmet({
  contentSecurityPolicy: true,
  xssFilter: true,
}));
```

**Target**: <200 LOC

### 3.3 `@nextrush/body-parser` Package

**Extract from v2**:
```
src/core/middleware/body-parser/* → packages/middleware/body-parser/src/*
```

**API**:
```typescript
import { json, urlencoded, multipart } from '@nextrush/body-parser';

app.use(json({ limit: '1mb' }));
app.use(urlencoded({ extended: true }));
```

**Target**: <800 LOC

### 3.4 `@nextrush/compression` Package

**Extract from v2**:
```
src/core/middleware/compression/* → packages/middleware/compression/src/*
```

**API**:
```typescript
import { compression } from '@nextrush/compression';

app.use(compression({ level: 6 }));
```

**Target**: <400 LOC

### Phase 3 Success Criteria

- [ ] All middleware work independently
- [ ] Middleware composable with core
- [ ] Benchmark: <5% overhead per middleware
- [ ] 90%+ test coverage

---

## Phase 4: Plugins (Weeks 7-8)

### 4.1 `@nextrush/logger` Plugin

**Extract from v2**:
```
src/plugins/logger/* → packages/plugins/logger/src/*
```

**API**:
```typescript
import { LoggerPlugin } from '@nextrush/logger';

app.plugin(new LoggerPlugin({
  level: 'info',
  transports: [new ConsoleTransport()],
}));
```

**Target**: <600 LOC

### 4.2 `@nextrush/static` Plugin

**Extract from v2**:
```
src/plugins/static-files/* → packages/plugins/static/src/*
```

**API**:
```typescript
import { StaticPlugin } from '@nextrush/static';

app.plugin(new StaticPlugin({
  root: './public',
  maxAge: 86400,
}));
```

**Target**: <400 LOC

### 4.3 `@nextrush/websocket` Plugin

**Extract from v2**:
```
src/plugins/websocket/* → packages/plugins/websocket/src/*
```

**API**:
```typescript
import { WebSocketPlugin } from '@nextrush/websocket';

app.plugin(new WebSocketPlugin({
  path: '/ws',
  heartbeat: 30000,
}));
```

**Target**: <500 LOC

### Phase 4 Success Criteria

- [ ] All plugins install correctly
- [ ] Plugins don't affect core performance
- [ ] Clean uninstall/cleanup

---

## Phase 5: Advanced Features (Weeks 9-10)

### 5.1 `@nextrush/events` Package (CQRS)

**Extract from v2**:
```
src/core/events/* → packages/plugins/events/src/*
```

**API**:
```typescript
import { EventsPlugin, EventBus } from '@nextrush/events';

const events = new EventsPlugin();
app.plugin(events);

events.on('user.created', handler);
events.emit('user.created', { id: '123' });
```

**Target**: <1,500 LOC

### 5.2 `@nextrush/rate-limit` Package

**Extract from v2**:
```
src/core/middleware/rate-limiter.ts → packages/middleware/rate-limit/src/*
```

**Target**: <300 LOC

### 5.3 `@nextrush/template` Plugin

**Extract from v2**:
```
src/plugins/template/* → packages/plugins/template/src/*
```

**Target**: <400 LOC

### Phase 5 Success Criteria

- [ ] CQRS works as documented
- [ ] Rate limiting accurate
- [ ] Template rendering correct

---

## Phase 6: Meta Package & Release (Weeks 11-12)

### 6.1 `nextrush` Meta Package

**Purpose**: Convenience package for easy installation

**Implementation**:
```typescript
// packages/nextrush/src/index.ts

// Re-export core
export * from '@nextrush/core';
export * from '@nextrush/router';

// Re-export common middleware
export { cors } from '@nextrush/cors';
export { helmet } from '@nextrush/helmet';
export { json, urlencoded } from '@nextrush/body-parser';
export { compression } from '@nextrush/compression';

// Re-export node adapter
export { listen, createServer } from '@nextrush/adapter-node';

// Extend Application with listen method
import { Application } from '@nextrush/core';
import { listen as nodeListen } from '@nextrush/adapter-node';

Application.prototype.listen = function(port: number, cb?: () => void) {
  return nodeListen(this, { port }, cb);
};
```

### 6.2 Documentation

- [ ] Complete API documentation
- [ ] Migration guide from v2
- [ ] Getting started guide
- [ ] Examples for each package
- [ ] Performance comparison
- [ ] Changelog

### 6.3 Release Checklist

- [ ] All packages published to npm
- [ ] Documentation site live
- [ ] GitHub release created
- [ ] Announcement written
- [ ] v2 deprecated notice

### Phase 6 Success Criteria

- [ ] `npm install nextrush` works
- [ ] All examples in docs work
- [ ] Migration guide tested
- [ ] Performance claims verified

---

## Package Publishing Order

```
Week 1:  @nextrush/types (0.1.0)
Week 2:  @nextrush/core (3.0.0-alpha.1)
Week 2:  @nextrush/router (3.0.0-alpha.1)
Week 4:  @nextrush/adapter-node (3.0.0-alpha.1)
Week 6:  @nextrush/cors (3.0.0-alpha.1)
Week 6:  @nextrush/helmet (3.0.0-alpha.1)
Week 6:  @nextrush/body-parser (3.0.0-alpha.1)
Week 6:  @nextrush/compression (3.0.0-alpha.1)
Week 8:  @nextrush/logger (3.0.0-alpha.1)
Week 8:  @nextrush/static (3.0.0-alpha.1)
Week 8:  @nextrush/websocket (3.0.0-alpha.1)
Week 10: @nextrush/events (3.0.0-alpha.1)
Week 10: @nextrush/rate-limit (3.0.0-alpha.1)
Week 10: @nextrush/template (3.0.0-alpha.1)
Week 12: nextrush (3.0.0-beta.1)
```

---

## Risk Mitigation

### Risk 1: Performance Regression

**Mitigation**:
- Benchmark after each phase
- Set hard performance gates in CI
- If RPS drops below target, stop and fix

### Risk 2: Breaking Changes

**Mitigation**:
- Keep v2 branch for maintenance
- Provide codemod for simple migrations
- Clear documentation of all changes

### Risk 3: Scope Creep

**Mitigation**:
- Freeze feature set at start
- Any new feature goes to v3.1
- Weekly progress reviews

### Risk 4: Quality Issues

**Mitigation**:
- 90%+ test coverage gate
- Manual review at each phase
- Beta testing period

---

## Weekly Milestones

| Week | Milestone | Deliverable |
|------|-----------|-------------|
| 0 | Setup | Monorepo structure |
| 1 | Types + Core start | @nextrush/types |
| 2 | Core + Router | @nextrush/core, @nextrush/router |
| 3 | Adapter start | Integration tests passing |
| 4 | Adapter complete | @nextrush/adapter-node |
| 5 | Middleware start | cors, helmet |
| 6 | Middleware complete | body-parser, compression |
| 7 | Plugins start | logger |
| 8 | Plugins complete | static, websocket |
| 9 | Advanced start | events, rate-limit |
| 10 | Advanced complete | template |
| 11 | Meta + Docs | nextrush meta package |
| 12 | Release | v3.0.0-beta.1 |

---

## Success Criteria Summary

### Technical

| Metric | Target |
|--------|--------|
| Core LOC | <3,000 |
| RPS | >30,000 |
| Memory | <200KB |
| Cold Start | <30ms |
| Test Coverage | >90% |

### DX

| Metric | Target |
|--------|--------|
| Hello World Lines | 3 |
| Install Size | <500KB |
| TypeScript Score | 100% |
| Doc Coverage | 100% |

### Ecosystem

| Metric | Target |
|--------|--------|
| Packages Published | 14 |
| All v2 Features | ✅ |
| Migration Guide | ✅ |

---

*End of Migration Roadmap*
