# Optimized Router Deep Dive

Advanced router architecture documentation for NextRush v2's high-performance Radix Tree Router with O(k) lookup performance and aggressive optimization strategies.

## Router Architecture Overview

NextRush v2 implements an ultra-optimized Radix Tree Router that achieves **O(k) lookup performance** where k is the path length, not the route count. This means routing performance remains constant regardless of how many routes you register.

### Core Architecture Components

```typescript
┌─────────────────────────────────────────────────────────────┐
│                    OptimizedRouter                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   RouteCache    │  │  PathSplitter   │  │ ParameterPool│ │
│  │   (LRU-like)    │  │  (Zero-copy)    │  │ (Pre-alloc)  │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              RadixTree Structure                        │ │
│  │                                                         │ │
│  │  ┌────────┐     ┌────────┐     ┌────────┐              │ │
│  │  │  Root  │────▶│ Static │────▶│ Param  │              │ │
│  │  │  Node  │     │  Node  │     │  Node  │              │ │
│  │  └────────┘     └────────┘     └────────┘              │ │
│  │                      │              │                  │ │
│  │                      ▼              ▼                  │ │
│  │                 ┌────────┐     ┌────────┐              │ │
│  │                 │Wildcard│     │Handler │              │ │
│  │                 │  Node  │     │  Map   │              │ │
│  │                 └────────┘     └────────┘              │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Performance Optimizations

### 1. Radix Tree Structure

The router uses a **Radix Tree** (compressed prefix tree) where each node represents a path segment:

```typescript
interface OptimizedRadixNode {
  path: string; // Path segment
  handlers: Map<string, RouteData>; // HTTP method handlers
  children: Map<string, OptimizedRadixNode>; // Static children (O(1) lookup)
  paramChild?: OptimizedRadixNode; // Single parameter child
  wildcardChild?: OptimizedRadixNode; // Wildcard child
  isParam: boolean; // Parameter node flag
  paramName?: string; // Parameter name
  paramIndex?: number; // Pre-computed index
}
```

**Benefits:**

- **O(1) static route lookup** via Map-based children
- **Single parameter child** eliminates iteration overhead
- **Path compression** reduces memory usage
- **Pre-computed indices** for faster parameter extraction

### 2. Zero-Copy Path Splitting

The `PathSplitter` class implements ultra-fast path parsing:

```typescript
class PathSplitter {
  private static readonly PARAM_CHAR_CODE = 58; // ':'
  private static readonly SLASH_CHAR_CODE = 47; // '/'
  private static pathCache = new Map<string, string[]>();

  static split(path: string): string[] {
    // Cache check for O(1) repeated paths
    const cached = this.pathCache.get(path);
    if (cached) return cached;

    // Single-pass parsing with charCodeAt optimization
    const parts: string[] = [];
    let start = path.charCodeAt(0) === this.SLASH_CHAR_CODE ? 1 : 0;

    for (let i = start; i <= path.length; i++) {
      const charCode =
        i < path.length ? path.charCodeAt(i) : this.SLASH_CHAR_CODE;

      if (charCode === this.SLASH_CHAR_CODE || i === path.length) {
        if (i > start) {
          parts.push(path.substring(start, i));
        }
        start = i + 1;
      }
    }

    // Cache result for future use
    if (this.pathCache.size < this.CACHE_SIZE) {
      this.pathCache.set(path, parts);
    }

    return parts;
  }
}
```

**Optimizations:**

- **Character code comparison** faster than string operations
- **Single-pass parsing** eliminates multiple iterations
- **Intelligent caching** for frequently accessed paths
- **Zero-copy substring extraction** reduces allocations

### 3. High-Performance Route Cache

```typescript
class RouteCache {
  private cache = new Map<string, OptimizedRouteMatch | null>();
  private maxSize: number;
  private cacheHits = 0;
  private cacheMisses = 0;

  get(key: string): OptimizedRouteMatch | null | undefined {
    const result = this.cache.get(key);
    if (result !== undefined) {
      this.cacheHits++;
      return result;
    }
    this.cacheMisses++;
    return undefined;
  }

  set(key: string, value: OptimizedRouteMatch | null): void {
    // Simplified eviction: clear half when full
    if (this.cache.size >= this.maxSize) {
      const entries = Array.from(this.cache.entries());
      this.cache.clear();
      const keepFrom = Math.floor(entries.length / 2);
      for (let i = keepFrom; i < entries.length; i++) {
        this.cache.set(entries[i][0], entries[i][1]);
      }
    }
    this.cache.set(key, value);
  }
}
```

**Features:**

- **O(1) cache operations** using native Map
- **Simplified LRU** eliminates complex bookkeeping overhead
- **Negative caching** prevents repeated failed lookups
- **Configurable cache size** for memory management

### 4. Pre-Allocated Parameter Pool

```typescript
export class OptimizedRouter {
  private paramPool: Record<string, string>[] = [];
  private maxPoolSize = 200;
  private poolHits = 0;
  private poolMisses = 0;

  private getParamObject(): Record<string, string> {
    if (this.paramPool.length > 0) {
      this.poolHits++;
      const params = this.paramPool.pop()!;
      // Efficiently clear object properties
      for (const key in params) {
        if (Object.prototype.hasOwnProperty.call(params, key)) {
          delete params[key];
        }
      }
      return params;
    }

    this.poolMisses++;
    return {}; // Create new object if pool is empty
  }
}
```

**Benefits:**

- **Eliminates object allocation** for parameter objects
- **Reduced garbage collection pressure**
- **Pool statistics** for performance monitoring
- **Automatic pool management** with configurable size

## Route Matching Algorithm

### Fast Path Resolution

The router implements a **three-tier matching strategy**:

```typescript
public find(method: string, path: string): OptimizedRouteMatch | null {
  // 1. Ultra-fast cache check (O(1))
  const cacheKey = `${method}:${path}`;
  const cached = this.cache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  // 2. Fast path: direct match without alternatives
  const result = this.findInternalOptimized(method, path);
  if (result) {
    this.cache.set(cacheKey, result);
    return result;
  }

  // 3. Slow path: try trailing slash alternatives
  if (path.length > 1) {
    const alternativePath = path.endsWith('/') ? path.slice(0, -1) : `${path}/`;
    const alternativeResult = this.findInternalOptimized(method, alternativePath);
    if (alternativeResult) {
      this.cache.set(cacheKey, alternativeResult);
      return alternativeResult;
    }
  }

  // Cache null result to prevent repeated failed lookups
  this.cache.set(cacheKey, null);
  return null;
}
```

### Optimized Tree Traversal

```typescript
private findInternalOptimized(method: string, path: string): OptimizedRouteMatch | null {
  // Fast root path check
  if (path === '/' || path === '') {
    const routeData = this.root.handlers.get(method);
    return routeData ? { handler: routeData.handler, middleware: routeData.middleware, params: {}, path } : null;
  }

  const pathParts = PathSplitter.split(path);
  let currentNode = this.root;
  const params = this.getParamObject(); // Pre-allocated parameter object

  // Single-pass traversal with prioritized matching
  for (let i = 0; i < pathParts.length; i++) {
    const part = pathParts[i];
    if (!part) continue;

    // 1. Exact match (hot path) - O(1)
    const exactChild = currentNode.children.get(part);
    if (exactChild) {
      currentNode = exactChild;
      continue;
    }

    // 2. Parameter match (warm path) - O(1)
    const paramChild = currentNode.paramChild;
    if (paramChild?.paramName) {
      params[paramChild.paramName] = part;
      currentNode = paramChild;
      continue;
    }

    // 3. Wildcard match (cold path) - O(1)
    const wildcardChild = currentNode.wildcardChild;
    if (wildcardChild) {
      params['*'] = pathParts.slice(i).join('/');
      currentNode = wildcardChild;
      break;
    }

    // No match found - early exit
    return null;
  }

  // Final handler check
  const routeData = currentNode.handlers.get(method);
  return routeData ? { handler: routeData.handler, middleware: routeData.middleware, params, path } : null;
}
```

**Algorithm Features:**

- **Prioritized matching**: Static → Parameter → Wildcard
- **Early exit optimization** on no match
- **Single-pass traversal** eliminates backtracking
- **O(1) operations** at each tree level

## Route Registration Architecture

### Efficient Tree Building

```typescript
private registerRoute(method: string, path: string, handler: RouteHandler | RouteConfig): void {
  const fullPath = this.prefix ? `${this.prefix}${path}` : path;
  const pathParts = PathSplitter.split(fullPath);
  let currentNode = this.root;

  // Extract handler and middleware efficiently
  let actualHandler: RouteHandler;
  let routeMiddleware: Middleware[] = [];

  if (typeof handler === 'function') {
    actualHandler = handler;
  } else {
    actualHandler = handler.handler;
    if (handler.middleware) {
      routeMiddleware = Array.isArray(handler.middleware) ? handler.middleware : [handler.middleware];
    }
  }

  // Handle root path case
  if (pathParts.length === 0) {
    currentNode.handlers.set(method, { handler: actualHandler, middleware: routeMiddleware });
    return;
  }

  // Build tree with optimized node creation
  for (let i = 0; i < pathParts.length; i++) {
    const part = pathParts[i];
    if (!part) continue;

    if (PathSplitter.isParameterized(part)) {
      // Parameter node creation
      const paramName = PathSplitter.extractParamName(part);
      if (!currentNode.paramChild && paramName) {
        currentNode.paramChild = {
          path: part,
          handlers: new Map(),
          children: new Map(),
          isParam: true,
          paramName,
          paramIndex: i,
        };
      }
      currentNode = currentNode.paramChild!;
    } else if (part === '*') {
      // Wildcard node creation
      if (!currentNode.wildcardChild) {
        currentNode.wildcardChild = {
          path: part,
          handlers: new Map(),
          children: new Map(),
          isParam: false,
        };
      }
      currentNode = currentNode.wildcardChild;
    } else {
      // Static node creation
      let childNode = currentNode.children.get(part);
      if (!childNode) {
        childNode = {
          path: part,
          handlers: new Map(),
          children: new Map(),
          isParam: false,
        };
        currentNode.children.set(part, childNode);
      }
      currentNode = childNode;
    }
  }

  // Set handler at final node
  currentNode.handlers.set(method, { handler: actualHandler, middleware: routeMiddleware });
}
```

## Router Usage Patterns

### Basic Route Registration

```typescript
import { createOptimizedRouter } from 'nextrush/router';

const router = createOptimizedRouter();

// Static routes
router.get('/users', async ctx => {
  ctx.res.json({ users: await getUsers() });
});

// Parameterized routes
router.get('/users/:id', async ctx => {
  const userId = ctx.params.id;
  ctx.res.json({ user: await getUserById(userId) });
});

// Wildcard routes
router.get('/files/*', async ctx => {
  const filePath = ctx.params['*'];
  ctx.res.sendFile(filePath);
});
```

### Advanced Route Configuration

```typescript
// Route with middleware
router.post('/admin/users', {
  middleware: [authMiddleware, adminMiddleware],
  handler: async ctx => {
    const userData = ctx.body;
    const user = await createUser(userData);
    ctx.res.json(user);
  },
});

// Multiple middleware
router.put('/users/:id', {
  middleware: [authMiddleware, validateUser, auditMiddleware],
  handler: async ctx => {
    const userId = ctx.params.id;
    const userData = ctx.body;
    const user = await updateUser(userId, userData);
    ctx.res.json(user);
  },
});
```

### Sub-Router Integration

```typescript
// Create specialized routers
const userRouter = createOptimizedRouter('/users');
const adminRouter = createOptimizedRouter('/admin');

// Configure user routes
userRouter.get('/profile', getUserProfile);
userRouter.put('/profile', updateUserProfile);
userRouter.get('/:id/posts', getUserPosts);

// Configure admin routes
adminRouter.get('/dashboard', getAdminDashboard);
adminRouter.post('/users', createUser);
adminRouter.delete('/users/:id', deleteUser);

// Mount sub-routers
app.use('/api', userRouter);
app.use('/api', adminRouter);
```

## Performance Monitoring

### Router Statistics

```typescript
const router = createOptimizedRouter('/api', 2000); // 2000 cache entries

// Get comprehensive performance statistics
const stats = router.getCacheStats();
console.log(stats);

// Output:
// {
//   cache: {
//     size: 150,
//     hitRate: 0.89,
//     hits: 1780,
//     misses: 220
//   },
//   pool: {
//     poolSize: 195,
//     maxSize: 200,
//     hits: 1650,
//     misses: 350,
//     hitRate: 0.825
//   },
//   performance: {
//     totalRoutes: 45,
//     pathCacheSize: 128
//   }
// }
```

### Cache Management

```typescript
// Clear route cache when needed
router.clearCache();

// Clear path splitting cache
PathSplitter.clearCache();

// Monitor cache performance
const cacheStats = router.getCacheStats();
if (cacheStats.cache.hitRate < 0.8) {
  console.warn('Low cache hit rate detected');
}
```

## Memory Management

### Automatic Pool Management

The router automatically manages memory through:

1. **Parameter Object Pooling**: Reuses parameter objects to reduce GC pressure
2. **Path Cache Management**: Automatically evicts old entries when cache is full
3. **Node Reuse**: Shares common path prefixes in the radix tree

### Memory Optimization Strategies

```typescript
// Configure cache sizes based on application needs
const highTrafficRouter = createOptimizedRouter('', 5000); // Large cache
const lowTrafficRouter = createOptimizedRouter('', 100); // Small cache

// Monitor memory usage
const stats = router.getCacheStats();
const memoryUsage = {
  cacheSize: stats.cache.size,
  poolUtilization:
    (stats.pool.maxSize - stats.pool.poolSize) / stats.pool.maxSize,
  totalRoutes: stats.performance.totalRoutes,
};

console.log('Memory usage:', memoryUsage);
```

## Benchmarking and Performance

### Expected Performance Characteristics

| Operation               | Time Complexity | Typical Performance     |
| ----------------------- | --------------- | ----------------------- |
| Route Registration      | O(k)            | 1-5μs per route         |
| Route Lookup (cached)   | O(1)            | 0.1-0.5μs               |
| Route Lookup (uncached) | O(k)            | 1-10μs                  |
| Parameter Extraction    | O(1)            | 0.1-1μs                 |
| Memory Usage            | O(n)            | ~50-100 bytes per route |

### Benchmark Example

```typescript
import { performance } from 'perf_hooks';
import { createOptimizedRouter } from 'nextrush/router';

const router = createOptimizedRouter();

// Register 1000 routes
const start = performance.now();
for (let i = 0; i < 1000; i++) {
  router.get(`/api/users/${i}/posts/:postId`, async ctx => {
    ctx.res.json({ userId: i, postId: ctx.params.postId });
  });
}
const registrationTime = performance.now() - start;

console.log(`Registered 1000 routes in ${registrationTime.toFixed(2)}ms`);
console.log(`Average: ${(registrationTime / 1000).toFixed(4)}ms per route`);

// Benchmark lookups
const lookupStart = performance.now();
for (let i = 0; i < 10000; i++) {
  const routeId = Math.floor(Math.random() * 1000);
  const result = router.find('GET', `/api/users/${routeId}/posts/123`);
  if (!result) throw new Error('Route not found');
}
const lookupTime = performance.now() - lookupStart;

console.log(`10,000 lookups in ${lookupTime.toFixed(2)}ms`);
console.log(`Average: ${(lookupTime / 10000).toFixed(4)}ms per lookup`);

// Print cache statistics
console.log('Cache stats:', router.getCacheStats());
```

## Architecture Decisions

### Why Radix Tree?

1. **O(k) Performance**: Lookup time based on path length, not route count
2. **Memory Efficiency**: Path compression reduces memory usage
3. **Predictable Performance**: No worst-case scenarios like hash collisions

### Why Aggressive Caching?

1. **Real-world Patterns**: Most applications have hot paths accessed frequently
2. **Amortized Cost**: Cache overhead pays for itself after 2-3 lookups
3. **Configurable**: Cache size can be tuned per application needs

### Why Parameter Pooling?

1. **GC Pressure**: Reduces object allocations in hot code paths
2. **Predictable Memory**: Pool size provides memory usage guarantees
3. **Performance**: Object reuse is faster than allocation

## Migration and Compatibility

### From Express.js Router

```typescript
// Express.js pattern
app.get('/users/:id', (req, res) => {
  res.json({ id: req.params.id });
});

// NextRush v2 pattern (similar API)
router.get('/users/:id', async ctx => {
  ctx.res.json({ id: ctx.params.id });
});
```

### From Koa Router

```typescript
// Koa Router pattern
koaRouter.get('/users/:id', async (ctx, next) => {
  ctx.body = { id: ctx.params.id };
  await next();
});

// NextRush v2 pattern (direct compatibility)
router.get('/users/:id', async ctx => {
  ctx.body = { id: ctx.params.id };
});
```

## Troubleshooting

### Common Performance Issues

1. **Low Cache Hit Rate**

   ```typescript
   const stats = router.getCacheStats();
   if (stats.cache.hitRate < 0.7) {
     // Increase cache size or analyze route patterns
     console.warn('Consider increasing cache size');
   }
   ```

2. **Memory Usage Growth**

   ```typescript
   // Monitor pool efficiency
   if (stats.pool.hitRate < 0.8) {
     console.warn('Parameter pool may need tuning');
   }
   ```

3. **Route Registration Performance**

   ```typescript
   // Register routes in batches for better performance
   const routes = generateRoutes();
   const batchSize = 100;

   for (let i = 0; i < routes.length; i += batchSize) {
     const batch = routes.slice(i, i + batchSize);
     batch.forEach(route => router.get(route.path, route.handler));
   }
   ```

## Advanced Topics

### Custom Route Caching Strategies

```typescript
class CustomRouteCache extends RouteCache {
  // Override eviction strategy
  set(key: string, value: OptimizedRouteMatch | null): void {
    // Implement custom LRU or LFU logic
    super.set(key, value);
  }
}
```

### Route Analytics and Monitoring

```typescript
class AnalyticsRouter extends OptimizedRouter {
  private routeStats = new Map<string, { count: number; totalTime: number }>();

  public find(method: string, path: string): OptimizedRouteMatch | null {
    const start = performance.now();
    const result = super.find(method, path);
    const duration = performance.now() - start;

    // Track route performance
    const key = `${method}:${path}`;
    const stats = this.routeStats.get(key) || { count: 0, totalTime: 0 };
    stats.count++;
    stats.totalTime += duration;
    this.routeStats.set(key, stats);

    return result;
  }

  public getRouteAnalytics() {
    const analytics = new Map();
    for (const [route, stats] of this.routeStats) {
      analytics.set(route, {
        count: stats.count,
        averageTime: stats.totalTime / stats.count,
        totalTime: stats.totalTime,
      });
    }
    return analytics;
  }
}
```

## See Also

- [Router API Reference](../api/routing.md) - Basic router usage and API
- [Middleware Architecture](./middleware-architecture.md) - Middleware integration patterns
- [Performance Optimization Guide](../guides/performance-optimization.md) - Application-level optimizations
- [Dependency Injection](./dependency-injection.md) - DI integration with routing

## Version

- **Added in:** v2.0.0-alpha.1
- **Architecture Version:** 2.0
- **Performance Target:** O(k) lookup complexity
- **Status:** Production Ready
