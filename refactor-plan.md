# 🔧 NextRush Framework - Comprehensive Refactoring Plan

**Report Date:** July 20, 2025
**Framework Version:** v1.3.0
**Scope:** Complete codebase optimization and architecture consolidation

---

## 🎯 Refactoring Objectives

### Primary Goals

1. **Performance Optimization** - Achieve 50%+ performance improvement
2. **Code Consolidation** - Eliminate duplicate implementations
3. **Memory Management** - Implement proper cleanup and pooling
4. **Architecture Simplification** - Single source of truth for each component
5. **Enterprise Readiness** - Production-grade patterns and practices

### Success Metrics

| Metric           | Current   | Target    | Method                                      |
| ---------------- | --------- | --------- | ------------------------------------------- |
| RPS              | 1,000     | 1,500+    | Handler pre-compilation + optimized routing |
| Memory Growth    | Unbounded | <5MB/hour | Proper cleanup + pooling                    |
| Route Match Time | 2-5ms     | <0.5ms    | Trie-based matching                         |
| Bundle Size      | ~2MB      | <1.5MB    | Tree shaking + consolidation                |
| Startup Time     | 200ms     | <100ms    | Lazy loading + optimization                 |

---

## 📋 Phase 1: Critical Performance Fixes (Week 1)

### Task 1.1: Fix Handler Conversion Performance

**Priority:** CRITICAL
**Impact:** +15-25% performance
**Files:** `src/core/app/application.ts`

**Current Problem:**

```typescript
// ❌ Converts on EVERY request
private convertHandler(handler: RouteHandler | ExpressHandler): RouteHandler {
  if (handler.length === 1) return handler;
  return async (context) => {
    const { req, res } = context;
    return handler(req, res);
  };
}
```

**Refactored Solution:**

```typescript
// ✅ Pre-compile during registration
class OptimizedApplication {
  private preCompiledHandlers = new Map<string, CompiledHandler>();

  private preCompileHandler(
    handler: RouteHandler | ExpressHandler
  ): CompiledHandler {
    const isAsync = handler.constructor.name === 'AsyncFunction';
    const paramCount = handler.length;

    if (paramCount === 1) {
      // Context-style handler
      return {
        type: 'context',
        fn: handler as RouteHandler,
        isAsync,
        compiled: true,
      };
    } else {
      // Express-style handler - pre-convert
      return {
        type: 'express',
        fn: async (context: RequestContext) => {
          const { req, res } = context;
          return (handler as ExpressHandler)(req, res);
        },
        isAsync: true,
        compiled: true,
      };
    }
  }

  // Use pre-compiled handlers in route registration
  addRoute(
    method: HttpMethod,
    path: Path,
    handler: RouteHandler | ExpressHandler
  ): void {
    const routeKey = `${method}:${path}`;
    const compiledHandler = this.preCompileHandler(handler);
    this.preCompiledHandlers.set(routeKey, compiledHandler);

    this.routeManager.addRoute({
      method,
      path,
      handler: compiledHandler.fn,
      metadata: {
        compiled: true,
        type: compiledHandler.type,
        compiledAt: Date.now(),
      },
    });
  }
}
```

**Implementation Steps:**

1. Create `CompiledHandler` interface
2. Implement `preCompileHandler` method
3. Modify route registration to use pre-compilation
4. Update all HTTP method handlers (get, post, put, etc.)
5. Add performance tests to verify improvement

---

### Task 1.2: Enable OptimizedRouteManager

**Priority:** CRITICAL
**Impact:** +25-40% routing performance
**Files:** `src/core/app/application.ts`, `src/routing/`

**Current Problem:**
Application uses legacy `RouteManager` instead of `OptimizedRouteManager`

**Refactored Solution:**

```typescript
// ✅ Force optimized routing
import { OptimizedRouteManager } from '../routing/optimized-route-manager';

class Application {
  private routeManager: OptimizedRouteManager;

  constructor(options: ApplicationOptions = {}) {
    // Always use optimized route manager
    this.routeManager = new OptimizedRouteManager({
      enableTrie: true,
      enableCaching: true,
      enablePrecompilation: true,
      cacheSize: 10000,
      enableMetrics: true,
    });

    // Remove legacy router option
    this.router = new Router({
      routeManager: this.routeManager,
      ...options.routerOptions,
    });
  }
}
```

**Implementation Steps:**

1. Update Application constructor to use OptimizedRouteManager
2. Remove legacy RouteManager usage
3. Update Router class to work with optimized manager
4. Add trie-based route matching
5. Implement route caching with LRU eviction

---

### Task 1.3: Implement Memory Cleanup Hooks

**Priority:** HIGH
**Impact:** Prevent memory leaks
**Files:** All plugin files

**Current Problem:**
Plugins have caches without cleanup mechanisms

**Refactored Solution:**

```typescript
// ✅ Enhanced BasePlugin with cleanup
abstract class BasePlugin {
  protected caches = new Set<CacheManager>();
  protected timers = new Set<NodeJS.Timeout>();
  protected intervals = new Set<NodeJS.Timeout>();

  abstract install(app: Application): void;
  abstract start(): void;

  stop(): void {
    this.cleanup();
  }

  protected cleanup(): void {
    // Clear all caches
    this.caches.forEach((cache) => cache.clear());
    this.caches.clear();

    // Clear all timers
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();

    // Clear all intervals
    this.intervals.forEach((interval) => clearInterval(interval));
    this.intervals.clear();

    // Subclass-specific cleanup
    this.onCleanup?.();
  }

  protected onCleanup?(): void;

  // Helper methods for managed resources
  protected createManagedCache<K, V>(
    options: CacheOptions
  ): CacheManager<K, V> {
    const cache = new CacheManager<K, V>(options);
    this.caches.add(cache);
    return cache;
  }

  protected createManagedTimer(
    callback: () => void,
    delay: number
  ): NodeJS.Timeout {
    const timer = setTimeout(callback, delay);
    this.timers.add(timer);
    return timer;
  }
}
```

**Implementation Steps:**

1. Update BasePlugin with resource management
2. Refactor all plugins to use managed resources
3. Implement CacheManager with TTL and size limits
4. Add cleanup calls in application shutdown
5. Add memory leak detection tests

---

## 📋 Phase 2: Code Consolidation (Week 2)

### Task 2.1: Consolidate Plugin Registries

**Priority:** HIGH
**Impact:** Eliminate confusion and duplication
**Files:** `src/plugins/core/`, `src/core/app/`

**Current Problem:**
Three different plugin registry implementations:

- `SimplePluginRegistry` (basic, currently used)
- `PluginRegistry` (more features, unused)
- `PluginManager` (enterprise, unused)

**Refactored Solution:**

```typescript
// ✅ Unified plugin registry
export class UnifiedPluginRegistry implements PluginRegistryInterface {
  private plugins = new Map<string, PluginInfo>();
  private app?: Application;
  private semaphore = new Semaphore(3); // Controlled concurrency
  private eventEmitter = new EventEmitter();
  private metrics = new PluginMetrics();

  constructor(private config: PluginRegistryConfig = {}) {}

  register(plugin: BasePlugin, options: PluginOptions = {}): void {
    if (this.plugins.has(plugin.name)) {
      throw new PluginError(`Plugin '${plugin.name}' already registered`);
    }

    const pluginInfo: PluginInfo = {
      plugin,
      options,
      state: PluginState.REGISTERED,
      registeredAt: Date.now(),
      dependencies: this.resolveDependencies(plugin),
      health: { status: 'unknown', lastCheck: 0 },
    };

    this.plugins.set(plugin.name, pluginInfo);
    this.metrics.recordRegistration(plugin.name);
    this.eventEmitter.emit('plugin:registered', { plugin: plugin.name });
  }

  async installAll(app: Application): Promise<void> {
    this.app = app;
    const installOrder = this.resolveDependencyOrder();

    for (const pluginName of installOrder) {
      await this.semaphore.acquire();
      try {
        await this.installPlugin(pluginName);
      } finally {
        this.semaphore.release();
      }
    }
  }

  private async installPlugin(name: string): Promise<void> {
    const info = this.plugins.get(name);
    if (!info || !this.app) return;

    try {
      console.log(`🔌 Installing ${name} plugin...`);
      await info.plugin.install(this.app);
      info.state = PluginState.INSTALLED;
      this.metrics.recordInstallation(name, true);
      console.log(`✅ ${name} plugin installed successfully`);
    } catch (error) {
      info.state = PluginState.ERROR;
      this.metrics.recordInstallation(name, false);
      console.error(`❌ Failed to install ${name} plugin:`, error);
      throw new PluginError(
        `Installation failed for ${name}: ${error.message}`
      );
    }
  }

  // Health monitoring
  async checkHealth(): Promise<PluginHealthReport> {
    const healthChecks = new Map<string, PluginHealth>();

    for (const [name, info] of this.plugins) {
      try {
        const health = await this.checkPluginHealth(info.plugin);
        healthChecks.set(name, health);
        info.health = health;
      } catch (error) {
        healthChecks.set(name, {
          status: 'unhealthy',
          lastCheck: Date.now(),
          error: error.message,
        });
      }
    }

    return {
      overall: this.calculateOverallHealth(healthChecks),
      plugins: healthChecks,
      checkedAt: Date.now(),
    };
  }
}
```

**Implementation Steps:**

1. Create unified registry interface
2. Implement consolidated registry class
3. Update Application to use unified registry
4. Remove old registry implementations
5. Update all imports and references
6. Add comprehensive tests

---

### Task 2.2: Remove Temporary and Deprecated Files

**Priority:** MEDIUM
**Impact:** Clean codebase
**Files:** Various locations

**Files to Remove:**

```bash
# Temporary files
src/plugins/static-files/t-static-files.plugin.ts
src/plugins/metrics/t-metrics.plugin.ts

# Deprecated files
src/routing/route-matcher-deprecated.ts
src/utils/x-deprecated-template-engine.ts
src/http/request/request-handler.ts  # Replaced by MegaUltimateParser
```

**Verification Steps:**

1. Search for imports of deprecated files
2. Ensure no dependencies exist
3. Remove files and update imports
4. Update documentation references
5. Clean up exports from index files

---

### Task 2.3: Standardize Error Handling

**Priority:** MEDIUM
**Impact:** Consistent error patterns
**Files:** All plugin and core files

**Current Problem:**
Mixed error handling approaches across codebase

**Refactored Solution:**

```typescript
// ✅ Standardized error handling
abstract class BasePlugin {
  protected async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    context: string,
    options: ErrorHandlingOptions = {}
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await operation();
      this.metrics?.recordSuccess(context, Date.now() - startTime);
      return result;
    } catch (error) {
      const pluginError = this.createPluginError(error, context);
      this.metrics?.recordError(context, Date.now() - startTime);

      if (options.emit !== false) {
        this.emit('error', pluginError);
      }

      if (options.rethrow !== false) {
        throw pluginError;
      }

      return options.defaultValue;
    }
  }

  private createPluginError(error: Error, context: string): PluginError {
    return new PluginError(`[${this.name}] ${context}: ${error.message}`, {
      plugin: this.name,
      context,
      originalError: error,
      timestamp: Date.now(),
      stackTrace: error.stack,
    });
  }
}

// Usage in plugins
class StaticFilesPlugin extends BasePlugin {
  async serveFile(path: string): Promise<Buffer> {
    return this.executeWithErrorHandling(
      () => this.doServeFile(path),
      'File serving operation',
      { defaultValue: Buffer.alloc(0) }
    );
  }
}
```

**Implementation Steps:**

1. Update BasePlugin with error handling utilities
2. Refactor all plugins to use standardized error handling
3. Create plugin-specific error classes
4. Update error response formatting
5. Add error handling tests

---

## 📋 Phase 3: Performance Optimizations (Week 3)

### Task 3.1: Implement Object Pooling

**Priority:** HIGH
**Impact:** +10-15% performance, -30% memory allocation
**Files:** Core request handling, routing

**Implementation:**

```typescript
// ✅ Object pooling system
class ObjectPoolManager {
  private pools = new Map<string, ObjectPool<any>>();

  createPool<T>(
    name: string,
    factory: () => T,
    reset: (obj: T) => void,
    maxSize = 100
  ): ObjectPool<T> {
    const pool = new ObjectPool(factory, reset, maxSize);
    this.pools.set(name, pool);
    return pool;
  }

  getPool<T>(name: string): ObjectPool<T> | undefined {
    return this.pools.get(name);
  }

  clearAll(): void {
    this.pools.forEach((pool) => pool.clear());
    this.pools.clear();
  }
}

class ObjectPool<T> {
  private pool: T[] = [];
  private inUse = new Set<T>();

  constructor(
    private factory: () => T,
    private reset: (obj: T) => void,
    private maxSize: number
  ) {}

  acquire(): T {
    let obj = this.pool.pop();
    if (!obj) {
      obj = this.factory();
    } else {
      this.reset(obj);
    }

    this.inUse.add(obj);
    return obj;
  }

  release(obj: T): void {
    if (!this.inUse.has(obj)) return;

    this.inUse.delete(obj);
    if (this.pool.length < this.maxSize) {
      this.pool.push(obj);
    }
  }

  clear(): void {
    this.pool.length = 0;
    this.inUse.clear();
  }
}

// Usage in application
class OptimizedApplication {
  private poolManager = new ObjectPoolManager();

  constructor() {
    // Create object pools
    this.poolManager.createPool(
      'routeMatch',
      () => ({ params: {}, query: {}, matched: false }),
      (obj) => {
        Object.keys(obj.params).forEach((key) => delete obj.params[key]);
        Object.keys(obj.query).forEach((key) => delete obj.query[key]);
        obj.matched = false;
      }
    );

    this.poolManager.createPool(
      'requestContext',
      () => ({ req: null, res: null, params: {}, query: {} }),
      (obj) => {
        obj.req = null;
        obj.res = null;
        Object.keys(obj.params).forEach((key) => delete obj.params[key]);
        Object.keys(obj.query).forEach((key) => delete obj.query[key]);
      }
    );
  }
}
```

**Implementation Steps:**

1. Create object pool infrastructure
2. Implement pools for route matching objects
3. Add pools for request/response contexts
4. Integrate with existing request handling
5. Add pool monitoring and metrics

---

### Task 3.2: Implement Trie-Based Route Matching

**Priority:** HIGH
**Impact:** +25-40% routing performance
**Files:** `src/routing/optimized-route-matcher.ts`

**Implementation:**

```typescript
// ✅ Trie-based route matching
interface TrieNode {
  children: Map<string, TrieNode>;
  handler?: RouteHandler;
  paramName?: string;
  isWildcard: boolean;
  middleware: Middleware[];
  priority: number;
}

class RouteTrieMatcher {
  private tries = new Map<HttpMethod, TrieNode>();
  private staticRoutes = new Map<string, RouteHandler>(); // O(1) lookup
  private routeMetrics = new Map<string, RouteMetrics>();

  addRoute(
    method: HttpMethod,
    path: string,
    handler: RouteHandler,
    middleware: Middleware[] = []
  ): void {
    const routeKey = `${method}:${path}`;

    // Static routes get special treatment
    if (this.isStaticRoute(path)) {
      this.staticRoutes.set(routeKey, handler);
      return;
    }

    // Dynamic routes go in trie
    const trie = this.getOrCreateTrie(method);
    this.insertIntoTrie(trie, path, handler, middleware);

    // Initialize metrics
    this.routeMetrics.set(routeKey, {
      hits: 0,
      totalTime: 0,
      avgTime: 0,
      lastAccessed: 0,
    });
  }

  findRoute(method: HttpMethod, path: string): RouteMatch | null {
    const routeKey = `${method}:${path}`;

    // Try static routes first (O(1))
    const staticHandler = this.staticRoutes.get(routeKey);
    if (staticHandler) {
      this.updateMetrics(routeKey);
      return {
        handler: staticHandler,
        params: {},
        middleware: [],
      };
    }

    // Try trie matching
    const trie = this.tries.get(method);
    if (!trie) return null;

    const result = this.matchInTrie(trie, path);
    if (result) {
      this.updateMetrics(routeKey);
    }

    return result;
  }

  private matchInTrie(node: TrieNode, path: string): RouteMatch | null {
    const segments = path.split('/').filter(Boolean);
    const params: Record<string, string> = {};

    let current = node;

    for (const segment of segments) {
      // Try exact match first
      if (current.children.has(segment)) {
        current = current.children.get(segment)!;
        continue;
      }

      // Try parameter match
      let paramMatch: TrieNode | undefined;
      let wildcardMatch: TrieNode | undefined;

      for (const [key, child] of current.children) {
        if (key.startsWith(':')) {
          paramMatch = child;
        } else if (key === '*') {
          wildcardMatch = child;
        }
      }

      if (paramMatch) {
        if (paramMatch.paramName) {
          params[paramMatch.paramName] = segment;
        }
        current = paramMatch;
        continue;
      }

      if (wildcardMatch) {
        current = wildcardMatch;
        break; // Wildcard consumes rest of path
      }

      return null; // No match found
    }

    if (current.handler) {
      return {
        handler: current.handler,
        params,
        middleware: current.middleware,
      };
    }

    return null;
  }

  private insertIntoTrie(
    root: TrieNode,
    path: string,
    handler: RouteHandler,
    middleware: Middleware[]
  ): void {
    const segments = path.split('/').filter(Boolean);
    let current = root;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];

      if (segment.startsWith(':')) {
        // Parameter segment
        const paramName = segment.slice(1);
        const paramKey = ':param';

        if (!current.children.has(paramKey)) {
          current.children.set(paramKey, {
            children: new Map(),
            paramName,
            isWildcard: false,
            middleware: [],
            priority: 0,
          });
        }
        current = current.children.get(paramKey)!;
      } else if (segment === '*') {
        // Wildcard segment
        if (!current.children.has('*')) {
          current.children.set('*', {
            children: new Map(),
            isWildcard: true,
            middleware: [],
            priority: -1, // Lower priority
          });
        }
        current = current.children.get('*')!;
      } else {
        // Static segment
        if (!current.children.has(segment)) {
          current.children.set(segment, {
            children: new Map(),
            isWildcard: false,
            middleware: [],
            priority: 1, // Higher priority
          });
        }
        current = current.children.get(segment)!;
      }
    }

    current.handler = handler;
    current.middleware = middleware;
  }
}
```

**Implementation Steps:**

1. Implement trie data structure
2. Add static route optimization
3. Implement parameter and wildcard matching
4. Add route metrics collection
5. Integrate with OptimizedRouteManager
6. Add performance benchmarks

---

### Task 3.3: Implement Buffer Pooling

**Priority:** MEDIUM
**Impact:** Reduce GC pressure in body parsing
**Files:** `src/plugins/body-parser/`

**Implementation:**

```typescript
// ✅ Buffer pooling for body parser
class BufferPoolManager {
  private pools = new Map<number, Buffer[]>();
  private readonly standardSizes = [1024, 4096, 16384, 65536, 262144]; // 1KB to 256KB
  private readonly maxPoolSize = 10; // Max buffers per size

  acquire(requestedSize: number): PooledBuffer {
    const poolSize = this.findOptimalSize(requestedSize);
    const pool = this.pools.get(poolSize) || [];

    let buffer = pool.pop();
    if (!buffer) {
      buffer = Buffer.allocUnsafe(poolSize);
    }

    // Clear buffer for security
    buffer.fill(0, 0, requestedSize);

    return new PooledBuffer(buffer.subarray(0, requestedSize), poolSize, this);
  }

  release(buffer: Buffer, originalSize: number): void {
    const pool = this.pools.get(originalSize) || [];

    if (pool.length < this.maxPoolSize) {
      pool.push(buffer);
      this.pools.set(originalSize, pool);
    }
  }

  private findOptimalSize(requestedSize: number): number {
    return (
      this.standardSizes.find((size) => size >= requestedSize) || requestedSize
    );
  }

  clear(): void {
    this.pools.clear();
  }

  getStats(): BufferPoolStats {
    const stats: BufferPoolStats = {
      poolSizes: Array.from(this.pools.keys()),
      totalBuffers: 0,
      memoryUsage: 0,
    };

    this.pools.forEach((pool, size) => {
      stats.totalBuffers += pool.length;
      stats.memoryUsage += pool.length * size;
    });

    return stats;
  }
}

class PooledBuffer {
  constructor(
    public readonly buffer: Buffer,
    private originalSize: number,
    private pool: BufferPoolManager
  ) {}

  release(): void {
    this.pool.release(this.buffer, this.originalSize);
  }
}

// Usage in body parser
class OptimizedBodyParser {
  private bufferPool = new BufferPoolManager();

  async parseBody(req: IncomingMessage, maxSize: number): Promise<Buffer> {
    const chunks: PooledBuffer[] = [];
    let totalSize = 0;

    try {
      for await (const chunk of req) {
        if (totalSize + chunk.length > maxSize) {
          throw new PayloadTooLargeError('Request payload too large');
        }

        const pooledBuffer = this.bufferPool.acquire(chunk.length);
        chunk.copy(pooledBuffer.buffer);
        chunks.push(pooledBuffer);
        totalSize += chunk.length;
      }

      // Concatenate chunks efficiently
      const result = Buffer.allocUnsafe(totalSize);
      let offset = 0;

      for (const pooledBuffer of chunks) {
        pooledBuffer.buffer.copy(result, offset);
        offset += pooledBuffer.buffer.length;
      }

      return result;
    } finally {
      // Release all pooled buffers
      chunks.forEach((pooledBuffer) => pooledBuffer.release());
    }
  }
}
```

**Implementation Steps:**

1. Implement buffer pool manager
2. Create pooled buffer wrapper
3. Update body parser to use buffer pooling
4. Add buffer pool monitoring
5. Integrate with cleanup system

---

## 📋 Phase 4: Architecture Improvements (Week 4)

### Task 4.1: Implement Semaphore-Controlled Concurrency

**Priority:** MEDIUM
**Impact:** Prevent resource exhaustion
**Files:** Plugin loading, request handling

**Implementation:**

```typescript
// ✅ Semaphore implementation
class Semaphore {
  private permits: number;
  private waitQueue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  release(): void {
    this.permits++;
    const next = this.waitQueue.shift();
    if (next) {
      this.permits--;
      next();
    }
  }

  async withPermit<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  get availablePermits(): number {
    return this.permits;
  }

  get queueLength(): number {
    return this.waitQueue.length;
  }
}

// Usage in plugin system
class ConcurrencyManagedPluginRegistry {
  private installSemaphore = new Semaphore(3); // Max 3 concurrent installs
  private startSemaphore = new Semaphore(5); // Max 5 concurrent starts

  async installAll(app: Application): Promise<void> {
    const plugins = Array.from(this.plugins.values());

    await Promise.all(
      plugins.map((plugin) =>
        this.installSemaphore.withPermit(async () => {
          await this.installPlugin(plugin, app);
        })
      )
    );
  }

  async startAll(): Promise<void> {
    const plugins = Array.from(this.plugins.values());

    await Promise.all(
      plugins.map((plugin) =>
        this.startSemaphore.withPermit(async () => {
          await this.startPlugin(plugin);
        })
      )
    );
  }
}
```

**Implementation Steps:**

1. Implement semaphore utility class
2. Add to plugin registry for controlled loading
3. Implement in high-concurrency areas
4. Add monitoring for semaphore usage
5. Add configuration options for limits

---

### Task 4.2: Implement Advanced Caching System

**Priority:** MEDIUM
**Impact:** Improved response times
**Files:** New caching infrastructure

**Implementation:**

```typescript
// ✅ Advanced caching system
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  lastAccessed: number;
  accessCount: number;
  size: number;
}

class AdvancedCacheManager<K, V> {
  private cache = new Map<K, CacheEntry<V>>();
  private accessOrder: K[] = [];
  private maxSize: number;
  private maxMemory: number;
  private currentMemory = 0;
  private defaultTTL: number;
  private hitCount = 0;
  private missCount = 0;

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize || 1000;
    this.maxMemory = options.maxMemory || 50 * 1024 * 1024; // 50MB
    this.defaultTTL = options.defaultTTL || 300000; // 5 minutes

    // Cleanup interval
    setInterval(() => this.cleanup(), 60000); // Every minute
  }

  set(key: K, value: V, ttl = this.defaultTTL): void {
    const size = this.calculateSize(value);
    const expiresAt = Date.now() + ttl;

    // Check if we need to evict
    this.ensureCapacity(size);

    const entry: CacheEntry<V> = {
      value,
      expiresAt,
      lastAccessed: Date.now(),
      accessCount: 0,
      size,
    };

    // Remove old entry if exists
    const oldEntry = this.cache.get(key);
    if (oldEntry) {
      this.currentMemory -= oldEntry.size;
      this.removeFromAccessOrder(key);
    }

    this.cache.set(key, entry);
    this.currentMemory += size;
    this.accessOrder.push(key);
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.missCount++;
      return undefined;
    }

    if (entry.expiresAt < Date.now()) {
      this.delete(key);
      this.missCount++;
      return undefined;
    }

    // Update access information
    entry.lastAccessed = Date.now();
    entry.accessCount++;
    this.hitCount++;

    // Move to end of access order (most recently used)
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);

    return entry.value;
  }

  private ensureCapacity(newEntrySize: number): void {
    // Evict by size
    while (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    // Evict by memory
    while (this.currentMemory + newEntrySize > this.maxMemory) {
      this.evictLRU();
    }
  }

  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;

    const oldestKey = this.accessOrder.shift()!;
    const entry = this.cache.get(oldestKey);

    if (entry) {
      this.currentMemory -= entry.size;
      this.cache.delete(oldestKey);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: K[] = [];

    for (const [key, entry] of this.cache) {
      if (entry.expiresAt < now) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach((key) => this.delete(key));
  }

  getStats(): CacheStats {
    const totalRequests = this.hitCount + this.missCount;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      memoryUsage: this.currentMemory,
      maxMemory: this.maxMemory,
      hitRate: totalRequests > 0 ? this.hitCount / totalRequests : 0,
      hitCount: this.hitCount,
      missCount: this.missCount,
    };
  }
}
```

**Implementation Steps:**

1. Implement advanced cache manager
2. Add TTL and LRU eviction
3. Implement memory-based limits
4. Add cache statistics
5. Integrate with plugins that need caching

---

## 📋 Implementation Timeline

### Week 1: Critical Performance Fixes

**Days 1-2:**

- [ ] Fix handler conversion performance
- [ ] Enable OptimizedRouteManager
- [ ] Basic performance testing

**Days 3-4:**

- [ ] Implement memory cleanup hooks
- [ ] Update all plugins with cleanup
- [ ] Memory leak detection tests

**Days 5-7:**

- [ ] Integration testing
- [ ] Performance benchmarking
- [ ] Bug fixes and optimization

### Week 2: Code Consolidation

**Days 1-3:**

- [ ] Consolidate plugin registries
- [ ] Remove temporary/deprecated files
- [ ] Update all imports and references

**Days 4-5:**

- [ ] Standardize error handling
- [ ] Update all plugins
- [ ] Error handling tests

**Days 6-7:**

- [ ] Integration testing
- [ ] Documentation updates
- [ ] Code review and fixes

### Week 3: Performance Optimizations

**Days 1-3:**

- [ ] Implement object pooling
- [ ] Trie-based route matching
- [ ] Performance validation

**Days 4-5:**

- [ ] Buffer pooling system
- [ ] Integration with body parser
- [ ] Memory usage optimization

**Days 6-7:**

- [ ] End-to-end performance testing
- [ ] Benchmark comparisons
- [ ] Performance tuning

### Week 4: Architecture Improvements

**Days 1-2:**

- [ ] Semaphore-controlled concurrency
- [ ] Advanced caching system
- [ ] Resource management

**Days 3-4:**

- [ ] Final integrations
- [ ] Comprehensive testing
- [ ] Performance validation

**Days 5-7:**

- [ ] Documentation completion
- [ ] Release preparation
- [ ] Final review and approval

---

## 🧪 Testing Strategy

### Performance Tests

```typescript
describe('Refactoring Performance Validation', () => {
  describe('Handler Conversion', () => {
    it('should not convert handlers at runtime', async () => {
      const app = new OptimizedApplication();
      const startTime = process.hrtime.bigint();

      // Simulate 1000 requests
      for (let i = 0; i < 1000; i++) {
        await app.handleRequest(mockRequest, mockResponse);
      }

      const endTime = process.hrtime.bigint();
      const avgTime = Number(endTime - startTime) / 1000000 / 1000; // ms per request

      expect(avgTime).toBeLessThan(1); // < 1ms per request
    });
  });

  describe('Route Matching', () => {
    it('should provide O(1) static route matching', () => {
      const matcher = new RouteTrieMatcher();

      // Add 1000 static routes
      for (let i = 0; i < 1000; i++) {
        matcher.addRoute('GET', `/api/static/${i}`, mockHandler);
      }

      const startTime = process.hrtime.bigint();
      const result = matcher.findRoute('GET', '/api/static/500');
      const endTime = process.hrtime.bigint();

      const duration = Number(endTime - startTime) / 1000000; // ms
      expect(duration).toBeLessThan(0.1); // < 0.1ms
      expect(result).toBeTruthy();
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory during operation', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Simulate heavy usage
      for (let i = 0; i < 1000; i++) {
        const app = new OptimizedApplication();
        await app.initialize();
        await app.shutdown();
      }

      // Force garbage collection
      if (global.gc) global.gc();

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = (finalMemory - initialMemory) / 1024 / 1024; // MB

      expect(memoryGrowth).toBeLessThan(10); // < 10MB growth
    });
  });
});
```

### Integration Tests

```typescript
describe('Refactoring Integration', () => {
  let app: OptimizedApplication;

  beforeEach(async () => {
    app = new OptimizedApplication();
    await app.initialize();
  });

  afterEach(async () => {
    await app.shutdown();
  });

  it('should maintain API compatibility', async () => {
    // Test that old API still works
    app.get('/test', (req, res) => {
      res.json({ success: true });
    });

    const response = await request(app).get('/test');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
  });

  it('should handle concurrent requests efficiently', async () => {
    app.get('/concurrent', (req, res) => {
      setTimeout(() => res.json({ id: req.query.id }), 10);
    });

    const requests = Array.from({ length: 100 }, (_, i) =>
      request(app).get(`/concurrent?id=${i}`)
    );

    const startTime = Date.now();
    const responses = await Promise.all(requests);
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(500); // < 500ms for 100 concurrent requests
    expect(responses).toHaveLength(100);
    responses.forEach((res, i) => {
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(i.toString());
    });
  });
});
```

---

## 📊 Success Validation

### Performance Benchmarks

| Metric             | Baseline  | Target | Test Method                |
| ------------------ | --------- | ------ | -------------------------- |
| RPS (simple route) | 1,000     | 1,500+ | Artillery load test        |
| Route match time   | 2-5ms     | <0.5ms | hrtime measurement         |
| Memory growth/hour | Unbounded | <5MB   | Long-running test          |
| Startup time       | 200ms     | <100ms | Application initialization |
| Bundle size        | ~2MB      | <1.5MB | Webpack analysis           |

### Quality Metrics

| Metric                | Current | Target    | Validation           |
| --------------------- | ------- | --------- | -------------------- |
| Test coverage         | ~60%    | >90%      | Jest coverage report |
| Memory leaks          | Present | None      | heapdump analysis    |
| Code duplication      | High    | Low       | SonarQube analysis   |
| Cyclomatic complexity | Medium  | Low       | Code analysis tools  |
| Type safety           | Good    | Excellent | TSC strict mode      |

---

This comprehensive refactoring plan will transform NextRush into a high-performance, enterprise-ready framework that adheres to all copilot instructions while maintaining backward compatibility and developer experience.
