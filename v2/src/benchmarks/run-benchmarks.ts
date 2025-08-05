#!/usr/bin/env tsx

/**
 * Comprehensive Router Performance Benchmarks
 *
 * Tests NextRush v2 OptimizedRouter against standard implementations
 * with focus on routing performance, memory usage, and scalability.
 */

import { performance } from 'perf_hooks';
import { OptimizedRouter } from '../core/router/optimized-router';
import type { Context } from '../types/context';

interface BenchmarkResult {
  name: string;
  opsPerSecond: number;
  avgTimeMs: number;
  minTimeMs: number;
  maxTimeMs: number;
  memoryUsage: NodeJS.MemoryUsage;
  cacheStats?: any;
}

interface RouterBenchmarkSuite {
  routeRegistration: BenchmarkResult;
  routeMatching: BenchmarkResult;
  parameterExtraction: BenchmarkResult;
  deepNesting: BenchmarkResult;
  wildcardMatching: BenchmarkResult;
  cachePerformance: BenchmarkResult;
  memoryEfficiency: BenchmarkResult;
  concurrentAccess: BenchmarkResult;
}

/**
 * Mock context for benchmarking
 */
function createMockContext(path: string, method: string = 'GET'): Context {
  return {
    req: {
      method,
      url: path,
      headers: {},
      params: {},
      query: {},
      body: {},
      ip: '127.0.0.1',
      hostname: 'localhost',
      secure: false,
      protocol: 'http',
      originalUrl: path,
      path,
      fresh: false,
      stale: true,
      idempotent: false,
      cacheable: false,
      xhr: false,
      acceptsLanguages: () => [],
      acceptsEncodings: () => [],
      acceptsCharsets: () => [],
      accepts: () => false,
      get: () => undefined,
      is: () => false,

      // Enhanced request properties
      id: 'test-req-id',
      startTime: Date.now(),
      userAgent: 'benchmark-test',
      acceptLanguage: 'en-US',
      sessionId: 'benchmark-session',
    } as any,
    res: {
      statusCode: 200,
      statusMessage: 'OK',
      headersSent: false,
      headers: {},

      // Response methods
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(data: any) {
        return this;
      },
      send(data: any) {
        return this;
      },
      redirect(url: string) {
        return this;
      },
      cookie(name: string, value: string) {
        return this;
      },
      clearCookie(name: string) {
        return this;
      },
      header(name: string, value: string) {
        this.headers[name] = value;
        return this;
      },
      set(name: string, value: string) {
        this.headers[name] = value;
        return this;
      },
      get(name: string) {
        return this.headers[name];
      },
      type(type: string) {
        return this;
      },
      end() {
        return this;
      },

      // Enhanced response methods
      sendJSON(data: any) {
        return this;
      },
      sendHTML(html: string) {
        return this;
      },
      sendText(text: string) {
        return this;
      },
      sendXML(xml: string) {
        return this;
      },
      sendData(data: any) {
        return this;
      },
      sendCSV(data: any) {
        return this;
      },
      stream(stream: any) {
        return this;
      },
      sendFile(path: string) {
        return this;
      },
      download(path: string) {
        return this;
      },
      getContentType(ext: string) {
        return 'text/plain';
      },
      generateETag() {
        return 'etag-123';
      },
      permanentRedirect(url: string) {
        return this;
      },
      temporaryRedirect(url: string) {
        return this;
      },
      setHeaders(headers: any) {
        return this;
      },
      getHeader(name: string) {
        return this.headers[name];
      },
      removeHeader(name: string) {
        delete this.headers[name];
        return this;
      },
      setCookie(name: string, value: string) {
        return this;
      },
      render(template: string, data?: any) {
        return this;
      },
      getNestedValue(obj: any, path: string) {
        return null;
      },
      isTruthy(value: any) {
        return !!value;
      },
      cache(ttl: number) {
        return this;
      },
      noCache() {
        return this;
      },
      cors(origin?: string) {
        return this;
      },
      security() {
        return this;
      },
      compress() {
        return this;
      },
      success(data: any) {
        return this;
      },
      error(message: string, code?: number) {
        return this;
      },
      paginate(data: any, options: any) {
        return this;
      },
      timing(name: string, value: number) {
        return this;
      },
    } as any,

    // Context methods
    throw(status: number, message?: string) {
      throw new Error(message);
    },
    assert(condition: any, status: number, message?: string) {
      if (!condition) throw new Error(message);
    },
    fresh: false,
    stale: true,
    idempotent: false,
    cacheable: false,
  } as Context;
}

/**
 * Run a benchmark with multiple iterations and return statistics
 */
async function runBenchmark(
  name: string,
  fn: () => Promise<void> | void,
  iterations: number = 10000
): Promise<BenchmarkResult> {
  const times: number[] = [];
  const memoryBefore = process.memoryUsage();

  // Warm up
  for (let i = 0; i < 100; i++) {
    await fn();
  }

  // Clear garbage
  if (global.gc) {
    global.gc();
  }

  // Actual benchmark
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    times.push(end - start);
  }

  const memoryAfter = process.memoryUsage();
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const opsPerSecond = 1000 / avgTime;

  return {
    name,
    opsPerSecond,
    avgTimeMs: avgTime,
    minTimeMs: minTime,
    maxTimeMs: maxTime,
    memoryUsage: {
      rss: memoryAfter.rss - memoryBefore.rss,
      heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
      heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
      external: memoryAfter.external - memoryBefore.external,
      arrayBuffers: memoryAfter.arrayBuffers - memoryBefore.arrayBuffers,
    },
  };
}

/**
 * Benchmark route registration performance
 */
async function benchmarkRouteRegistration(): Promise<BenchmarkResult> {
  return runBenchmark(
    'Route Registration',
    () => {
      const router = new OptimizedRouter();

      // Register 100 routes per iteration
      for (let i = 0; i < 100; i++) {
        router.get(`/api/v1/users/${i}`, async ctx => {
          ctx.res.json({ id: i });
        });

        router.post(`/api/v1/posts/${i}`, async ctx => {
          ctx.res.json({ postId: i });
        });

        router.get(`/api/v1/users/:userId/posts/${i}`, async ctx => {
          ctx.res.json({ userId: ctx.req.params.userId, postId: i });
        });
      }
    },
    100
  ); // Fewer iterations for registration benchmark
}

/**
 * Benchmark route matching performance
 */
async function benchmarkRouteMatching(): Promise<BenchmarkResult> {
  const router = new OptimizedRouter();

  // Setup routes
  const routes = [
    '/api/v1/users',
    '/api/v1/users/:id',
    '/api/v1/users/:userId/posts',
    '/api/v1/users/:userId/posts/:postId',
    '/api/v1/posts',
    '/api/v1/posts/:id',
    '/blog/articles',
    '/blog/articles/:slug',
    '/files/*',
    '/assets/js/:filename',
    '/assets/css/:filename',
  ];

  routes.forEach(route => {
    router.get(route, async ctx => {
      ctx.res.json({ route });
    });
  });

  const testPaths = [
    '/api/v1/users',
    '/api/v1/users/123',
    '/api/v1/users/456/posts',
    '/api/v1/users/789/posts/abc',
    '/blog/articles/my-article',
    '/files/documents/readme.txt',
    '/assets/js/app.js',
    '/assets/css/style.css',
  ];

  return runBenchmark('Route Matching', () => {
    const randomPath = testPaths[Math.floor(Math.random() * testPaths.length)];
    const result = router.find('GET', randomPath);
    return result;
  });
}

/**
 * Benchmark parameter extraction performance
 */
async function benchmarkParameterExtraction(): Promise<BenchmarkResult> {
  const router = new OptimizedRouter();

  router.get(
    '/api/v1/users/:userId/posts/:postId/comments/:commentId',
    async ctx => {
      ctx.res.json({
        userId: ctx.req.params.userId,
        postId: ctx.req.params.postId,
        commentId: ctx.req.params.commentId,
      });
    }
  );

  return runBenchmark('Parameter Extraction', () => {
    const result = router.find(
      'GET',
      '/api/v1/users/12345/posts/67890/comments/abcdef'
    );
    if (result && result.params) {
      const { userId, postId, commentId } = result.params;
      // Simulate parameter usage
      return { userId, postId, commentId };
    }
  });
}

/**
 * Benchmark deep nesting performance
 */
async function benchmarkDeepNesting(): Promise<BenchmarkResult> {
  const router = new OptimizedRouter();

  // Create deeply nested routes
  const depth = 10;
  let route = '/api';
  let path = '/api';

  for (let i = 0; i < depth; i++) {
    route += `/:param${i}`;
    path += `/value${i}`;
  }

  router.get(route, async ctx => {
    ctx.res.json({ deep: true });
  });

  return runBenchmark('Deep Nesting', () => {
    const result = router.find('GET', path);
    return result;
  });
}

/**
 * Benchmark wildcard matching performance
 */
async function benchmarkWildcardMatching(): Promise<BenchmarkResult> {
  const router = new OptimizedRouter();

  router.get('/files/*', async ctx => {
    ctx.res.json({ wildcard: true });
  });

  router.get('/assets/images/*', async ctx => {
    ctx.res.json({ images: true });
  });

  const testPaths = [
    '/files/documents/readme.txt',
    '/files/images/photo.jpg',
    '/files/videos/movie.mp4',
    '/assets/images/logo.png',
    '/assets/images/icons/home.svg',
  ];

  return runBenchmark('Wildcard Matching', () => {
    const randomPath = testPaths[Math.floor(Math.random() * testPaths.length)];
    const result = router.find('GET', randomPath);
    return result;
  });
}

/**
 * Benchmark cache performance
 */
async function benchmarkCachePerformance(): Promise<BenchmarkResult> {
  const router = new OptimizedRouter();

  // Setup routes
  router.get('/api/users/:id', async ctx => {
    ctx.res.json({ id: ctx.req.params.id });
  });

  router.get('/api/posts/:slug', async ctx => {
    ctx.res.json({ slug: ctx.req.params.slug });
  });

  // Pre-populate cache
  for (let i = 0; i < 100; i++) {
    router.find('GET', `/api/users/${i}`);
    router.find('GET', `/api/posts/post-${i}`);
  }

  const result = await runBenchmark('Cache Performance', () => {
    // This should hit cache frequently
    const id = Math.floor(Math.random() * 100);
    const result = router.find('GET', `/api/users/${id}`);
    return result;
  });

  // Add cache stats to result
  (result as any).cacheStats = router.getCacheStats();

  return result;
}

/**
 * Benchmark memory efficiency
 */
async function benchmarkMemoryEfficiency(): Promise<BenchmarkResult> {
  return runBenchmark(
    'Memory Efficiency',
    () => {
      const router = new OptimizedRouter();

      // Create many routes to test memory usage
      for (let i = 0; i < 1000; i++) {
        router.get(`/route${i}/:param`, async ctx => {
          ctx.res.json({ i });
        });
      }

      // Test matching
      for (let i = 0; i < 100; i++) {
        router.find('GET', `/route${i}/value`);
      }
    },
    10
  ); // Fewer iterations for memory benchmark
}

/**
 * Benchmark concurrent access
 */
async function benchmarkConcurrentAccess(): Promise<BenchmarkResult> {
  const router = new OptimizedRouter();

  // Setup routes
  for (let i = 0; i < 100; i++) {
    router.get(`/api/resource${i}/:id`, async ctx => {
      ctx.res.json({ resource: i, id: ctx.req.params.id });
    });
  }

  return runBenchmark(
    'Concurrent Access',
    async () => {
      // Simulate concurrent requests
      const promises = [];
      for (let i = 0; i < 10; i++) {
        const resourceId = Math.floor(Math.random() * 100);
        const id = Math.floor(Math.random() * 1000);

        promises.push(
          Promise.resolve(
            router.find('GET', `/api/resource${resourceId}/${id}`)
          )
        );
      }

      await Promise.all(promises);
    },
    1000
  ); // Fewer iterations for concurrent benchmark
}

/**
 * Run all benchmarks and generate report
 */
async function runAllBenchmarks(): Promise<RouterBenchmarkSuite> {
  console.log('🚀 Starting NextRush v2 Router Benchmarks...\n');

  const results: RouterBenchmarkSuite = {
    routeRegistration: await benchmarkRouteRegistration(),
    routeMatching: await benchmarkRouteMatching(),
    parameterExtraction: await benchmarkParameterExtraction(),
    deepNesting: await benchmarkDeepNesting(),
    wildcardMatching: await benchmarkWildcardMatching(),
    cachePerformance: await benchmarkCachePerformance(),
    memoryEfficiency: await benchmarkMemoryEfficiency(),
    concurrentAccess: await benchmarkConcurrentAccess(),
  };

  return results;
}

/**
 * Format benchmark results for display
 */
function formatResults(results: RouterBenchmarkSuite): string {
  let output = '\n📊 NextRush v2 Router Benchmark Results\n';
  output += `=${'='.repeat(50)}\n\n`;

  Object.entries(results).forEach(([key, result]) => {
    output += `🔹 ${result.name}\n`;
    output += `   Operations/sec: ${result.opsPerSecond.toFixed(2).padStart(10)}\n`;
    output += `   Avg time (ms):  ${result.avgTimeMs.toFixed(4).padStart(10)}\n`;
    output += `   Min time (ms):  ${result.minTimeMs.toFixed(4).padStart(10)}\n`;
    output += `   Max time (ms):  ${result.maxTimeMs.toFixed(4).padStart(10)}\n`;
    output += `   Memory (KB):    ${(result.memoryUsage.heapUsed / 1024).toFixed(2).padStart(10)}\n`;

    if ((result as any).cacheStats) {
      const stats = (result as any).cacheStats;
      const cacheData = stats.cache || stats; // Handle nested structure
      const hitRate = cacheData.hitRate || stats.hitRate || 0;
      const size = cacheData.size || stats.size || 0;
      output += `   Cache hit rate: ${(hitRate * 100).toFixed(1).padStart(10)}%\n`;
      output += `   Cache size:     ${size.toString().padStart(10)}\n`;
    }

    output += '\n';
  });

  // Performance summary
  const avgOpsPerSec =
    Object.values(results).reduce((sum, r) => sum + r.opsPerSecond, 0) /
    Object.keys(results).length;
  const totalMemory = Object.values(results).reduce(
    (sum, r) => sum + r.memoryUsage.heapUsed,
    0
  );

  output += '📈 Performance Summary\n';
  output += `${'-'.repeat(30)}\n`;
  output += `Average ops/sec: ${avgOpsPerSec.toFixed(2)}\n`;
  output += `Total memory:    ${(totalMemory / 1024 / 1024).toFixed(2)} MB\n`;
  const cacheResult = (results.cachePerformance as any).cacheStats;
  const cacheData = cacheResult?.cache || cacheResult;
  const cacheHitRate = cacheData?.hitRate || 0;
  output += `Cache efficiency: ${(cacheHitRate * 100).toFixed(1)}%\n\n`;

  // Performance indicators
  output += '🎯 Performance Indicators\n';
  output += `${'-'.repeat(30)}\n`;
  output += `Route matching:   ${results.routeMatching.opsPerSecond > 100000 ? '✅' : '⚠️'} ${results.routeMatching.opsPerSecond.toFixed(0)} ops/sec\n`;
  output += `Parameter ext.:   ${results.parameterExtraction.opsPerSecond > 50000 ? '✅' : '⚠️'} ${results.parameterExtraction.opsPerSecond.toFixed(0)} ops/sec\n`;
  const indicatorCacheResult = (results.cachePerformance as any).cacheStats;
  const indicatorCacheData =
    indicatorCacheResult?.cache || indicatorCacheResult;
  const indicatorHitRate = indicatorCacheData?.hitRate || 0;
  output += `Cache hit rate:   ${indicatorHitRate > 0.8 ? '✅' : '⚠️'} ${(indicatorHitRate * 100).toFixed(1)}%\n`;
  output += `Memory usage:     ${totalMemory < 10 * 1024 * 1024 ? '✅' : '⚠️'} ${(totalMemory / 1024 / 1024).toFixed(2)} MB\n`;

  return output;
}

/**
 * Main benchmark execution
 */
async function main() {
  try {
    const results = await runAllBenchmarks();
    const report = formatResults(results);

    console.log(report);

    // Save results to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `benchmarks/reports/nextrush-v2-benchmark-report-${timestamp}.md`;

    const fs = await import('fs/promises');
    await fs.writeFile(filename, report);

    console.log(`📄 Benchmark report saved to: ${filename}`);

    // Return success code
    process.exit(0);
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  }
}

// Run benchmarks if this file is executed directly
if (require.main === module) {
  main();
}

export { formatResults, runAllBenchmarks };
export type { BenchmarkResult, RouterBenchmarkSuite };
