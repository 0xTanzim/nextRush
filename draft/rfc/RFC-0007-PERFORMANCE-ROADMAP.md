# RFC-0007: Performance Optimization Roadmap

**Status**: Draft
**Created**: 2026-01-07
**Author**: NextRush Core Team
**Target Version**: v3.1.0+

---

## Summary

This RFC outlines the performance optimization roadmap for NextRush v3.x based on benchmark analysis against Fastify, Hono, Koa, and Express.

### Current Performance (v3.0.0)

| Metric | Value |
|--------|-------|
| NextRush RPS | 35,370 |
| vs Fastify | -11.8% slower |
| vs Hono | +15.9% faster |
| vs Koa | +18.3% faster |
| vs Express | +68.5% faster |

### Target Performance (v3.2.0)

| Metric | Target |
|--------|--------|
| vs Fastify | Within 5% |
| vs Hono | +20% faster |
| JSON serialization | 2-3x faster (opt-in) |

---

## Table of Contents

1. [Phase 1: Static Route Optimization](#phase-1-static-route-optimization)
2. [Phase 2: Lazy Property Access](#phase-2-lazy-property-access)
3. [Phase 3: Optional Fast JSON Package](#phase-3-optional-fast-json-package)
4. [Phase 4: Context Object Pooling](#phase-4-context-object-pooling)
5. [Phase 5: Request Pipeline Optimization](#phase-5-request-pipeline-optimization)
6. [Non-Goals](#non-goals)
7. [Implementation Timeline](#implementation-timeline)

---

## Phase 1: Static Route Optimization

**Priority**: High
**Effort**: Low
**Expected Gain**: 5-10% on static routes
**Target Version**: v3.1.0

### Problem

Currently, all routes (static and dynamic) traverse the radix tree for matching. Static routes without parameters could be matched in O(1) using a Map lookup instead of O(k) tree traversal.

### Current Behavior

```typescript
// All routes go through radix tree
match(method, path) {
  const segments = path.split('/').filter(Boolean);
  return this.matchNode(this.root, segments, 0, {}, method);
}
```

### Proposed Solution

```typescript
class Router {
  // O(1) lookup for static routes
  private staticRoutes = new Map<string, Map<HttpMethod, HandlerEntry>>();

  // O(k) lookup for dynamic routes
  private root: RadixNode;

  private addRoute(method: HttpMethod, path: string, handlers: RouteHandler[]) {
    const hasParams = path.includes(':') || path.includes('*');

    if (!hasParams) {
      // Static route - store in Map
      const key = this.normalizePath(path);
      if (!this.staticRoutes.has(key)) {
        this.staticRoutes.set(key, new Map());
      }
      this.staticRoutes.get(key)!.set(method, entry);
    } else {
      // Dynamic route - store in tree
      // ... existing radix tree logic
    }
  }

  match(method: HttpMethod, path: string): RouteMatch | null {
    const normalized = this.normalizePath(path);

    // Try static routes first (O(1))
    const staticHandlers = this.staticRoutes.get(normalized);
    if (staticHandlers) {
      const entry = staticHandlers.get(method);
      if (entry) {
        return {
          handler: entry.handler,
          params: {},
          middleware: entry.middleware,
          executor: entry.executor,
        };
      }
    }

    // Fall back to radix tree (O(k))
    return this.matchTree(method, normalized);
  }
}
```

### Benefits

- Static routes (most common in APIs) get O(1) matching
- No changes to public API
- Backward compatible
- Reduces radix tree traversal overhead

### Risks

- Slightly more memory for dual storage
- Need to handle trailing slash normalization consistently

### Acceptance Criteria

- [ ] Static routes match in O(1)
- [ ] All existing tests pass
- [ ] Benchmark shows measurable improvement on static routes
- [ ] No regression on dynamic routes

---

## Phase 2: Lazy Property Access

**Priority**: Medium
**Effort**: Low
**Expected Gain**: 1-3%
**Target Version**: v3.1.0

### Problem

Context properties like `query`, `body`, and `params` are computed eagerly even when not used by handlers.

### Current Behavior

```typescript
// In NodeContext constructor
constructor(req, res) {
  // Query is parsed immediately, even if not used
  const questionIndex = this.url.indexOf('?');
  if (questionIndex !== -1) {
    this.path = this.url.slice(0, questionIndex);
    this.query = parseQueryString(this.url.slice(questionIndex + 1));
  }
}
```

### Proposed Solution

```typescript
class NodeContext implements Context {
  private _query: QueryParams | undefined;
  private _queryParsed = false;

  get query(): QueryParams {
    if (!this._queryParsed) {
      const questionIndex = this.url.indexOf('?');
      if (questionIndex !== -1) {
        this._query = parseQueryString(this.url.slice(questionIndex + 1));
      } else {
        this._query = {};
      }
      this._queryParsed = true;
    }
    return this._query!;
  }
}
```

### Properties to Make Lazy

| Property | Current | Proposed | Benefit |
|----------|---------|----------|---------|
| `query` | Eager | Lazy | Skip parsing if not used |
| `ip` | Eager | Lazy | Skip header lookup if not used |
| `path` | Eager | Keep eager | Always needed for routing |
| `method` | Eager | Keep eager | Always needed for routing |

### Benefits

- Reduces work for handlers that don't use certain properties
- No API changes
- Backward compatible

### Risks

- Slight overhead for property access (getter vs direct access)
- Need to ensure thread-safety (not an issue in Node.js)

### Acceptance Criteria

- [ ] Query parsing is deferred until first access
- [ ] IP lookup is deferred until first access
- [ ] All existing tests pass
- [ ] No measurable regression on hot paths

---

## Phase 3: Optional Fast JSON Package

**Priority**: Medium
**Effort**: Medium
**Expected Gain**: 2-5x JSON serialization speed (opt-in)
**Target Version**: v3.2.0

### Problem

`JSON.stringify()` is a general-purpose serializer that must handle any JavaScript value. When the response schema is known, specialized serializers can be 2-5x faster.

### Current Behavior

```typescript
// In context.json()
json(data: unknown): void {
  const json = JSON.stringify(data);  // General-purpose, slower
  res.end(json);
}
```

### Proposed Solution

Create new package `@nextrush/fast-json`:

```typescript
// @nextrush/fast-json
import { compile } from '@nextrush/fast-json';

// Define schema once at startup
const userSerializer = compile({
  type: 'object',
  properties: {
    id: { type: 'number' },
    name: { type: 'string' },
    email: { type: 'string' },
    createdAt: { type: 'string' }
  }
});

// Use in routes
router.get('/users/:id', (ctx) => {
  const user = await db.users.findById(ctx.params.id);
  ctx.json(user, userSerializer);  // Fast path with schema
});
```

### Implementation Approach

Option A: Wrap `fast-json-stringify` (proven, MIT license)
```typescript
import fastJson from 'fast-json-stringify';

export function compile(schema: JSONSchema) {
  const stringify = fastJson(schema);
  return {
    stringify,
    schema
  };
}
```

Option B: Build our own (more control, more work)
- Generate specialized functions based on schema
- Avoid runtime type checking
- Direct string concatenation for known structures

### Recommendation

**Start with Option A** (wrap fast-json-stringify):
- Proven performance (used by Fastify)
- Well-tested edge cases
- MIT license compatible
- Can replace internals later if needed

### Context API Addition

```typescript
// Extended json() signature
json(data: unknown, serializer?: Serializer): void {
  if (serializer) {
    // Fast path with pre-compiled serializer
    const json = serializer.stringify(data);
    res.end(json);
  } else {
    // Default path with JSON.stringify
    const json = JSON.stringify(data);
    res.end(json);
  }
}
```

### Benefits

- 2-5x faster JSON serialization for opt-in users
- No breaking changes (existing code works unchanged)
- Follows Fastify's proven approach
- Separate package keeps core minimal

### Risks

- Schema definition overhead for users
- Type safety between schema and TypeScript types
- Additional dependency (fast-json-stringify)

### Acceptance Criteria

- [ ] `@nextrush/fast-json` package created
- [ ] 2x+ faster than JSON.stringify in benchmarks
- [ ] TypeScript type inference from schema
- [ ] Documentation with examples
- [ ] Integration guide for NextRush

---

## Phase 4: Context Object Pooling

**Priority**: Low
**Effort**: High
**Expected Gain**: 3-5%
**Target Version**: v3.3.0

### Problem

A new Context object is created for every request, causing allocation overhead and GC pressure under high load.

### Current Behavior

```typescript
// In adapter
const ctx = new NodeContext(req, res);  // New object every request
await handler(ctx);
// ctx is garbage collected
```

### Proposed Solution

```typescript
class ContextPool {
  private pool: NodeContext[] = [];
  private maxSize = 1000;

  acquire(req: IncomingMessage, res: ServerResponse): NodeContext {
    const ctx = this.pool.pop();
    if (ctx) {
      ctx.reset(req, res);  // Reuse existing object
      return ctx;
    }
    return new NodeContext(req, res);  // Create new if pool empty
  }

  release(ctx: NodeContext): void {
    if (this.pool.length < this.maxSize) {
      ctx.cleanup();  // Clear references
      this.pool.push(ctx);
    }
    // else: let GC collect it
  }
}
```

### Context.reset() Implementation

```typescript
class NodeContext {
  reset(req: IncomingMessage, res: ServerResponse): void {
    this.raw = { req, res };
    this.method = (req.method?.toUpperCase() ?? 'GET') as HttpMethod;
    this.url = req.url ?? '/';
    // ... reset all properties

    // Clear previous request state
    this._responded = false;
    this._queryParsed = false;
    this._query = undefined;
    this.params = {};
    this.state = {};
    this.body = undefined;
  }

  cleanup(): void {
    // Clear references to allow GC of request/response
    this.raw = null!;
    this.state = {};
    this.body = undefined;
  }
}
```

### Benefits

- Reduces object allocation rate
- Reduces GC pressure under high load
- Better performance at scale

### Risks

- Complexity in ensuring clean state between requests
- Potential for state leakage if reset() is incomplete
- Memory held by pool even when idle

### Acceptance Criteria

- [ ] ContextPool implementation
- [ ] Context.reset() and cleanup() methods
- [ ] No state leakage between requests (security critical!)
- [ ] Configurable pool size
- [ ] Benchmark shows improvement under high load
- [ ] Memory usage remains reasonable

---

## Phase 5: Request Pipeline Optimization

**Priority**: Low
**Effort**: Medium
**Expected Gain**: 2-3%
**Target Version**: v3.3.0

### Problem

The request handling pipeline has multiple async/await points that could be optimized.

### Current Pipeline

```
Request → createContext → compose(middleware) → dispatch → handler → response
           ↑                    ↑                   ↑
         await              await each          await
```

### Optimizations

#### 5.1 Sync Handler Fast Path

```typescript
// If handler is sync and no middleware, skip async machinery
if (match.middleware.length === 0 && isSync(match.handler)) {
  match.handler(ctx);  // Direct call, no await
  return;
}
```

#### 5.2 Reduce Await Points

```typescript
// Current: await on every middleware
for (const mw of middleware) {
  await mw(ctx, next);
}

// Optimized: batch sync middleware
let i = 0;
while (i < middleware.length) {
  const mw = middleware[i];
  const result = mw(ctx, next);
  if (result instanceof Promise) {
    await result;
  }
  i++;
}
```

#### 5.3 Pre-allocated Response Headers

```typescript
// Common headers pre-allocated once
const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8'
};

// Reuse instead of setting individually
res.writeHead(status, JSON_HEADERS);
```

### Benefits

- Reduced promise creation
- Fewer await points
- Pre-allocated common values

### Risks

- Complexity in sync/async detection
- Edge cases with error handling
- May not work with all middleware patterns

---

## Non-Goals

The following are explicitly **NOT** goals for NextRush performance optimization:

### 1. C++ Addons

**Why not:**
- Cross-platform build complexity (Windows, Mac, Linux, ARM)
- Node.js version compatibility issues
- npm install becomes painful
- Maintenance burden
- Diminishing returns (V8 is already fast)

### 2. Custom JSON Parser

**Why not:**
- V8's JSON.parse is highly optimized
- Security risk (parsing untrusted input)
- Edge cases in JSON spec
- `fast-json-stringify` only helps serialization, not parsing

### 3. Matching Fastify Exactly

**Why not:**
- Fastify has 8+ years of optimization
- Uses schema-based approach (different philosophy)
- Being within 10-15% is acceptable for NextRush
- Focus on DX, not just raw speed

### 4. Constraints System (like find-my-way)

**Why not:**
- Adds complexity
- Overhead for users who don't need it
- 90% of APIs don't need version/host constraints
- Can be added as optional package later

---

## Implementation Timeline

### v3.1.0 (Q1 2026)

| Feature | Priority | Status |
|---------|----------|--------|
| Static route optimization | High | Planned |
| Lazy query parsing | Medium | Planned |
| Lazy IP lookup | Low | Planned |

**Expected improvement**: 5-8% overall

### v3.2.0 (Q2 2026)

| Feature | Priority | Status |
|---------|----------|--------|
| `@nextrush/fast-json` package | Medium | Planned |
| Documentation updates | High | Planned |
| Performance guide | Medium | Planned |

**Expected improvement**: 2-5x JSON serialization (opt-in)

### v3.3.0 (Q3 2026)

| Feature | Priority | Status |
|---------|----------|--------|
| Context object pooling | Low | Planned |
| Sync handler fast path | Low | Planned |
| Request pipeline optimization | Low | Planned |

**Expected improvement**: 3-5% overall

---

## Benchmarking Strategy

### Methodology

1. Run each benchmark 5 times
2. Discard highest and lowest
3. Average remaining 3 runs
4. Compare against baseline (current version)

### Benchmark Suite

```bash
# Quick benchmark (development)
pnpm bench:quick

# Full benchmark (release validation)
pnpm bench:full

# Compare with previous version
pnpm bench:compare
```

### Metrics to Track

| Metric | Tool |
|--------|------|
| Requests/sec | autocannon |
| Latency p50/p99 | autocannon |
| Memory usage | Node.js --expose-gc |
| CPU usage | Node.js profiler |
| GC pressure | --trace-gc |

---

## Success Criteria

### v3.1.0
- [ ] Static routes 10%+ faster
- [ ] No regression on dynamic routes
- [ ] All tests pass
- [ ] Documentation updated

### v3.2.0
- [ ] `@nextrush/fast-json` published
- [ ] 2x+ faster JSON serialization with schemas
- [ ] Performance guide published
- [ ] Real-world benchmark (todo app, REST API)

### v3.3.0
- [ ] Overall 10-15% improvement from v3.0.0
- [ ] Within 10% of Fastify
- [ ] 20%+ faster than Hono
- [ ] Memory usage stable under load

---

## References

- [Fastify Performance Guide](https://fastify.dev/docs/latest/Guides/Performance/)
- [find-my-way Router](https://github.com/delvedor/find-my-way)
- [fast-json-stringify](https://github.com/fastify/fast-json-stringify)
- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/dont-block-the-event-loop)
- [V8 Blog: Fast Properties](https://v8.dev/blog/fast-properties)

---

## Appendix A: Benchmark Configuration

```javascript
// autocannon config
{
  url: 'http://localhost:3000',
  connections: 100,
  pipelining: 10,
  duration: 10,
  workers: 4
}
```

## Appendix B: Test Scenarios

| Test | Description | Purpose |
|------|-------------|---------|
| Hello World | `GET /` → `{ message: 'Hello' }` | Baseline overhead |
| Route Params | `GET /users/:id` | Router performance |
| Query Strings | `GET /search?q=...` | Query parsing |
| POST JSON | `POST /users` + body | Body parsing |
| Mixed | Random mix of above | Real-world simulation |

---

*Last updated: 2026-01-07*
