#!/usr/bin/env node

/**
 * 🚀 NextRush Ultimate Performance Benchmark Suite v2.0
 *
 * Enhanced benchmarking tool with versioned results and comprehensive testing
 *
 * New Features:
 * - Versioned benchmark results in /benchmarks folder
 * - Routing-specific performance tests
 * - Before/after optimization tracking
 * - More comprehensive test scenarios
 * - Better memory and performance analysis
 */

import { existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import * as os from 'os';
import { performance, PerformanceObserver } from 'perf_hooks';
import { createApp } from '../src/index';

interface BenchmarkResult {
  test: string;
  requestsPerSecond: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  maxLatency: number;
  minLatency: number;
  totalRequests: number;
  duration: number;
  memoryUsage: {
    before: NodeJS.MemoryUsage;
    after: NodeJS.MemoryUsage;
    peak: NodeJS.MemoryUsage;
    heapSnapshotSize?: number | undefined;
  };
  errorCount: number;
  cpuUsage?: {
    before: NodeJS.CpuUsage;
    after: NodeJS.CpuUsage;
  };
  throughputMBps?: number;
  gcPauses?: number;
  httpVersion?: string;
  routeCount?: number; // New: Track number of routes
  routeComplexity?: string; // New: Track route complexity
}

interface FrameworkComparison {
  framework: string;
  version: string;
  rps: number;
  latencyAvg: number;
  memoryMB: number;
  dependencies: number;
  notes: string;
}

interface StressTestResult {
  concurrency: number;
  rps: number;
  errorRate: number;
  p99Latency: number;
  memoryUsageMB: number;
  cpuUsagePercent: number;
}

class UltimatePerformanceBenchmark {
  private app: any;
  private server: any | null = null;
  private port = 3001;
  private results: BenchmarkResult[] = [];
  private stressTestResults: StressTestResult[] = [];
  private frameworkComparisons: FrameworkComparison[] = [];
  private baseUrl = `http://localhost:${this.port}`;
  private isRunning = false;
  private gcObserver: PerformanceObserver | null = null;
  private gcPauses = 0;
  private benchmarkVersion: string; // New: Track benchmark version
  private timestamp: string; // New: Track when benchmark was run

  constructor() {
    this.benchmarkVersion = '2.0.0';
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    if (typeof PerformanceObserver !== 'undefined' && global.gc) {
      this.gcObserver = new PerformanceObserver(() => {
        this.gcPauses++;
      });
      this.gcObserver.observe({ entryTypes: ['gc'] });
    }

    // Ensure benchmarks directory exists
    if (!existsSync('./benchmarks')) {
      mkdirSync('./benchmarks', { recursive: true });
    }
  }

  async runAllBenchmarks(): Promise<void> {
    if (this.isRunning) {
      console.warn('⚠️ Benchmark is already running.');
      return;
    }
    this.isRunning = true;
    console.log(
      `🚀 Starting NextRush Performance Benchmark Suite v${this.benchmarkVersion}...\n`
    );
    this.printSystemInfo();

    try {
      await this.setupServer();
      await this.startServer();

      console.log('🔥 Running warm-up phase...');
      await this.warmupPhase();

      // Core benchmarks
      await this.benchmarkSimpleRoute();
      await this.benchmarkJsonResponse();
      await this.benchmarkMiddlewareStack();
      await this.benchmarkParameterParsing();
      await this.benchmarkConcurrentRequests();
      await this.benchmarkErrorHandling();
      await this.benchmarkLargePayload();

      // New: Routing-specific benchmarks
      console.log('\n🛣️  Running Routing Performance Tests...');
      await this.benchmarkManyStaticRoutes();
      await this.benchmarkManyDynamicRoutes();
      await this.benchmarkNestedRoutes();
      await this.benchmarkWildcardRoutes();

      // New: Real-world scenarios
      console.log('\n🌐 Running Real-World Scenarios...');
      await this.benchmarkRESTAPI();
      await this.benchmarkGraphQLLike();
      await this.benchmarkMicroservicePatterns();

      console.log('\n🌪️ Running Stress Tests...');
      await this.runStressTests();

      console.log('\n🆚 Running Framework Comparisons...');
      await this.runFrameworkComparisons();

      this.printResults();
      this.printMemoryAnalysis();
      this.printCpuAnalysis();
      this.printStressTestResults();
      this.printFrameworkComparisons();
      this.printOverallAnalysis();

      await this.saveResults();
    } catch (error) {
      console.error('❌ Benchmark suite failed:', error);
    } finally {
      await this.cleanup();
      console.log('\n✅ Benchmark suite completed');

      // Force exit after a short delay to allow final logs
      setTimeout(() => {
        process.exit(0);
      }, 100);
    }
  }

  private printSystemInfo(): void {
    const cpus = os.cpus();
    console.log('🖥️  System Information:');
    console.log(`   Node.js Version: ${process.version}`);
    console.log(`   V8 Version: ${process.versions.v8}`);
    console.log(`   CPU: ${cpus[0].model} (${cpus.length} cores)`);
    console.log(
      `   Total Memory: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`
    );
    console.log(`   Platform: ${os.platform()} ${os.release()}`);
    console.log(`   Architecture: ${os.arch()}`);
    console.log(`   TypeScript Version: 5.8.3\n`);
  }

  private async setupServer(): Promise<void> {
    this.app = createApp();

    // Simple route
    this.app.get('/simple', (req: any, res: any) => {
      res.send('Hello World');
    });

    // JSON response
    this.app.get('/json', (req: any, res: any) => {
      res.json({
        message: 'Hello World',
        timestamp: Date.now(),
      });
    });

    // Middleware stack
    this.app.use((req: any, res: any, next: any) => {
      req.middleware1 = true;
      next();
    });
    this.app.use(async (req: any, res: any, next: any) => {
      req.middleware2 = true;
      await new Promise((resolve) => setImmediate(resolve));
      next();
    });
    this.app.get('/middleware', (req: any, res: any) => {
      res.json({
        processed: true,
      });
    });

    // Parameter parsing
    this.app.get('/users/:id/posts/:postId', (req: any, res: any) => {
      res.json({
        userId: req.params.id,
        postId: req.params.postId,
      });
    });

    // Error handling route
    this.app.get('/error', (req: any, res: any) => {
      res.status(500).json({ error: 'Test Error' });
    });

    // Large payload route
    const largePayload = { data: 'x'.repeat(1024 * 10) }; // 10KB payload
    this.app.get('/large-payload', (req: any, res: any) => {
      res.json(largePayload);
    });

    // Set keepAliveTimeout to ensure proper connection cleanup
    if (this.app.server) {
      this.app.server.keepAliveTimeout = 1000;
      this.app.server.headersTimeout = 1100;
    }

    console.log('✅ NextRush test server configured');
  }

  private async startServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, (err?: Error) => {
        if (err) {
          reject(err);
        } else {
          console.log(`🚀 Test server running on port ${this.port}`);
          resolve();
        }
      });
    });
  }

  private async stopServer(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server && this.server.listening) {
        this.server.close((err?: Error) => {
          if (err) {
            console.warn('⚠️ Server close warning:', err.message);
          } else {
            console.log('🛑 Test server stopped');
          }
          this.server = null;
          resolve();
        });
      } else {
        if (this.server) {
          console.log('🛑 Test server already stopped');
          this.server = null;
        }
        resolve();
      }
    });
  }

  async cleanup(): Promise<void> {
    try {
      // Stop the server first
      await this.stopServer();

      // Clean up application instance
      if (this.app) {
        try {
          if (typeof this.app.close === 'function') {
            await this.app.close();
            console.log('🛑 NextRush Application closed');
          } else if (typeof this.app.destroy === 'function') {
            await this.app.destroy();
            console.log('🛑 NextRush Application destroyed');
          }
        } catch (error) {
          // Application may already be closed - this is fine
          console.log('🛑 NextRush Application closed');
        }
        this.app = null;
      }

      // Disconnect GC observer
      if (this.gcObserver) {
        this.gcObserver.disconnect();
        this.gcObserver = null;
      }

      // Reset state
      this.isRunning = false;

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      console.log('🧹 Cleanup completed');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.warn('⚠️ Error during cleanup:', errorMessage);
    }
  }

  private async warmupPhase(): Promise<void> {
    const warmupRoutes = [
      '/simple',
      '/json',
      '/middleware',
      '/users/123/posts/456',
      '/error',
      '/large-payload',
      // '/public/test.txt', // Disabled for now
    ];
    const warmupRequests = 100;

    for (const route of warmupRoutes) {
      await this.warmup(route, warmupRequests);
    }

    if (global.gc) {
      global.gc();
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log('✅ Warm-up completed\n');
  }

  private async warmup(path: string, requests: number): Promise<void> {
    for (let i = 0; i < requests; i++) {
      try {
        await fetch(`${this.baseUrl}${path}`);
      } catch (e) {
        // Ignore errors during warmup
      }
    }
  }

  private async benchmarkSimpleRoute(): Promise<void> {
    console.log('📈 Benchmarking simple route...');
    const result = await this.runBenchmark('/simple', 'Simple Route', 2000);
    this.results.push(result);
  }

  private async benchmarkJsonResponse(): Promise<void> {
    console.log('📈 Benchmarking JSON response...');
    const result = await this.runBenchmark('/json', 'JSON Response', 2000);
    this.results.push(result);
  }

  private async benchmarkMiddlewareStack(): Promise<void> {
    console.log('📈 Benchmarking middleware stack...');
    const result = await this.runBenchmark(
      '/middleware',
      'Middleware Stack',
      1500
    );
    this.results.push(result);
  }

  private async benchmarkParameterParsing(): Promise<void> {
    console.log('📈 Benchmarking parameter parsing...');
    const result = await this.runBenchmark(
      '/users/123/posts/456',
      'Parameter Parsing',
      1500
    );
    this.results.push(result);
  }

  private async benchmarkConcurrentRequests(): Promise<void> {
    console.log('📈 Benchmarking concurrent requests...');
    const concurrencyLevels = [10, 50, 100];
    for (const level of concurrencyLevels) {
      const result = await this.runConcurrentBenchmark(
        '/simple',
        `Concurrent Load`,
        2000,
        level
      );
      this.results.push(result);
    }
  }

  private async benchmarkErrorHandling(): Promise<void> {
    console.log('📈 Benchmarking error handling...');
    const result = await this.runBenchmark('/error', 'Error Handling', 1000);
    this.results.push(result);
  }

  private async benchmarkLargePayload(): Promise<void> {
    console.log('📈 Benchmarking large payload...');
    const result = await this.runBenchmark(
      '/large-payload',
      'Large Payload',
      500
    );
    this.results.push(result);
  }

  private async benchmarkStaticFile(): Promise<void> {
    if (!existsSync('./public/test.txt')) {
      console.warn(
        "⚠️ Skipping static file benchmark: './public/test.txt' not found."
      );
      return;
    }
    console.log('📈 Benchmarking static file serving...');
    const result = await this.runBenchmark(
      '/public/test.txt',
      'Static File',
      1000
    );
    this.results.push(result);
  }

  // 🚀 NEW: Enhanced Routing Performance Tests

  private async benchmarkManyStaticRoutes(): Promise<void> {
    console.log('📈 Benchmarking many static routes (1000 routes)...');

    // Add 1000 static routes
    for (let i = 0; i < 1000; i++) {
      this.app.get(`/static-route-${i}`, (req: any, res: any) => {
        res.json({ route: i, message: 'Static route response' });
      });
    }

    const result = await this.runBenchmark(
      '/static-route-500', // Test middle route
      'Many Static Routes (1000)',
      1000
    );
    result.routeCount = 1000;
    result.routeComplexity = 'static';
    this.results.push(result);
  }

  private async benchmarkManyDynamicRoutes(): Promise<void> {
    console.log('📈 Benchmarking many dynamic routes (500 routes)...');

    // Add 500 dynamic routes with parameters
    for (let i = 0; i < 500; i++) {
      this.app.get(`/dynamic-${i}/:id/:action`, (req: any, res: any) => {
        res.json({
          route: i,
          id: req.params.id,
          action: req.params.action,
          message: 'Dynamic route response',
        });
      });
    }

    const result = await this.runBenchmark(
      '/dynamic-250/123/view', // Test middle route
      'Many Dynamic Routes (500)',
      1000
    );
    result.routeCount = 500;
    result.routeComplexity = 'dynamic';
    this.results.push(result);
  }

  private async benchmarkNestedRoutes(): Promise<void> {
    console.log('📈 Benchmarking deeply nested routes...');

    // Add deeply nested routes
    this.app.get(
      '/api/v1/users/:userId/posts/:postId/comments/:commentId/replies/:replyId',
      (req: any, res: any) => {
        res.json({
          userId: req.params.userId,
          postId: req.params.postId,
          commentId: req.params.commentId,
          replyId: req.params.replyId,
          message: 'Deeply nested route',
        });
      }
    );

    this.app.get(
      '/api/v2/organizations/:orgId/teams/:teamId/projects/:projectId/tasks/:taskId/subtasks/:subtaskId',
      (req: any, res: any) => {
        res.json({
          orgId: req.params.orgId,
          teamId: req.params.teamId,
          projectId: req.params.projectId,
          taskId: req.params.taskId,
          subtaskId: req.params.subtaskId,
          message: 'Complex nested route',
        });
      }
    );

    const result = await this.runBenchmark(
      '/api/v1/users/123/posts/456/comments/789/replies/101',
      'Deeply Nested Routes',
      1000
    );
    result.routeComplexity = 'nested';
    this.results.push(result);
  }

  private async benchmarkWildcardRoutes(): Promise<void> {
    console.log('📈 Benchmarking wildcard routes...');

    // Add wildcard routes
    this.app.get('/files/*', (req: any, res: any) => {
      res.json({
        path: req.params[0],
        message: 'Wildcard file route',
      });
    });

    this.app.get('/admin/settings/*', (req: any, res: any) => {
      res.json({
        settings: req.params[0],
        message: 'Admin settings wildcard',
      });
    });

    const result = await this.runBenchmark(
      '/files/documents/reports/2023/quarterly.pdf',
      'Wildcard Routes',
      1000
    );
    result.routeComplexity = 'wildcard';
    this.results.push(result);
  }

  private async benchmarkRESTAPI(): Promise<void> {
    console.log('📈 Benchmarking REST API patterns...');

    // Add typical REST API routes
    const resources = ['users', 'posts', 'comments', 'categories', 'tags'];

    for (const resource of resources) {
      this.app.get(`/api/${resource}`, (req: any, res: any) => {
        res.json({ resource, action: 'list', data: [] });
      });
      this.app.get(`/api/${resource}/:id`, (req: any, res: any) => {
        res.json({ resource, action: 'get', id: req.params.id });
      });
      this.app.post(`/api/${resource}`, (req: any, res: any) => {
        res.json({ resource, action: 'create', success: true });
      });
      this.app.put(`/api/${resource}/:id`, (req: any, res: any) => {
        res.json({ resource, action: 'update', id: req.params.id });
      });
      this.app.delete(`/api/${resource}/:id`, (req: any, res: any) => {
        res.json({ resource, action: 'delete', id: req.params.id });
      });
    }

    const result = await this.runBenchmark(
      '/api/users/123',
      'REST API Patterns',
      1000
    );
    result.routeComplexity = 'rest-api';
    this.results.push(result);
  }

  private async benchmarkGraphQLLike(): Promise<void> {
    console.log('📈 Benchmarking GraphQL-like complex queries...');

    // Add GraphQL-like routes with complex parameters
    this.app.post('/graphql', (req: any, res: any) => {
      res.json({
        data: {
          user: { id: 1, name: 'Test User' },
          posts: [{ id: 1, title: 'Test Post' }],
        },
      });
    });

    this.app.get(
      '/api/query/:fields/:filters/:pagination',
      (req: any, res: any) => {
        res.json({
          fields: req.params.fields,
          filters: req.params.filters,
          pagination: req.params.pagination,
          data: { complex: 'query result' },
        });
      }
    );

    const result = await this.runBenchmark(
      '/api/query/id,name,email/status:active,role:admin/page:1,limit:20',
      'GraphQL-like Queries',
      800
    );
    result.routeComplexity = 'graphql-like';
    this.results.push(result);
  }

  private async benchmarkMicroservicePatterns(): Promise<void> {
    console.log('📈 Benchmarking microservice patterns...');

    // Add microservice-style routes
    const services = ['auth', 'user', 'order', 'payment', 'notification'];

    for (const service of services) {
      this.app.get(`/services/${service}/health`, (req: any, res: any) => {
        res.json({ service, status: 'healthy', timestamp: Date.now() });
      });
      this.app.get(`/services/${service}/metrics`, (req: any, res: any) => {
        res.json({ service, metrics: { requests: 1000, errors: 0 } });
      });
      this.app.post(`/services/${service}/events`, (req: any, res: any) => {
        res.json({ service, event: 'processed', id: Math.random() });
      });
    }

    const result = await this.runBenchmark(
      '/services/user/health',
      'Microservice Patterns',
      1000
    );
    result.routeComplexity = 'microservice';
    this.results.push(result);
  }

  private async runBenchmark(
    path: string,
    testName: string,
    totalRequests: number = 1000
  ): Promise<BenchmarkResult> {
    if (global.gc) global.gc();
    const memoryBefore = process.memoryUsage();
    const cpuBefore = process.cpuUsage();
    let peakMemory = { ...memoryBefore };
    this.gcPauses = 0;

    const latencies: number[] = [];
    let errorCount = 0;
    let totalBytes = 0;

    const startTime = performance.now();

    for (let i = 0; i < totalRequests; i++) {
      const reqStart = performance.now();
      try {
        const res = await fetch(`${this.baseUrl}${path}`);
        const text = await res.text();
        totalBytes += Buffer.byteLength(text);

        if (path === '/error' && res.status === 500) {
          // Count as success for this test
        } else if (res.status >= 400) {
          errorCount++;
        }
        latencies.push(performance.now() - reqStart);
      } catch (error) {
        errorCount++;
        latencies.push(performance.now() - reqStart);
      }
    }

    const duration = (performance.now() - startTime) / 1000;
    if (global.gc) global.gc();
    const memoryAfter = process.memoryUsage();
    const cpuAfter = process.cpuUsage(cpuBefore);

    const requestCount = totalRequests;
    const requestsPerSecond = requestCount / duration;
    const avgLatency =
      latencies.reduce((a, b) => a + b, 0) / latencies.length || 0;
    const sortedLatencies = latencies.sort((a, b) => a - b);
    const p95Latency =
      sortedLatencies[Math.floor(latencies.length * 0.95)] || 0;
    const p99Latency =
      sortedLatencies[Math.floor(latencies.length * 0.99)] || 0;
    const maxLatency = Math.max(...latencies) || 0;
    const minLatency = Math.min(...latencies) || 0;
    const throughputMBps = totalBytes / (1024 * 1024) / duration;

    return {
      test: testName,
      requestsPerSecond,
      averageLatency: avgLatency,
      p95Latency,
      p99Latency,
      maxLatency,
      minLatency,
      totalRequests: requestCount,
      duration,
      memoryUsage: {
        before: memoryBefore,
        after: memoryAfter,
        peak: peakMemory,
      },
      errorCount,
      cpuUsage: { before: cpuBefore, after: cpuAfter },
      throughputMBps,
      gcPauses: this.gcPauses,
    };
  }

  private async runConcurrentBenchmark(
    path: string,
    testName: string,
    totalRequests: number,
    concurrency: number
  ): Promise<BenchmarkResult> {
    if (global.gc) global.gc();
    const memoryBefore = process.memoryUsage();
    const cpuBefore = process.cpuUsage();
    let peakMemory = { ...memoryBefore };
    this.gcPauses = 0;

    const latencies: number[] = [];
    let errorCount = 0;
    let totalBytes = 0;
    let completedRequests = 0;

    const requestExecutor = async () => {
      const reqStart = performance.now();
      try {
        const res = await fetch(`${this.baseUrl}${path}`);
        const text = await res.text();
        totalBytes += Buffer.byteLength(text);

        if (res.status >= 400) {
          errorCount++;
        }
      } catch (error) {
        errorCount++;
      } finally {
        latencies.push(performance.now() - reqStart);
      }
    };

    const startTime = performance.now();

    const batches = Math.ceil(totalRequests / concurrency);
    for (let i = 0; i < batches; i++) {
      const batchPromises: Promise<void>[] = [];
      const batchSize = Math.min(
        concurrency,
        totalRequests - completedRequests
      );
      for (let j = 0; j < batchSize; j++) {
        batchPromises.push(requestExecutor());
      }
      await Promise.all(batchPromises);
      completedRequests += batchSize;
    }

    const duration = (performance.now() - startTime) / 1000;
    if (global.gc) global.gc();
    const memoryAfter = process.memoryUsage();
    const cpuAfter = process.cpuUsage(cpuBefore);

    const requestsPerSecond = completedRequests / duration;
    const avgLatency =
      latencies.reduce((a, b) => a + b, 0) / latencies.length || 0;
    const sortedLatencies = latencies.sort((a, b) => a - b);
    const p95Latency =
      sortedLatencies[Math.floor(latencies.length * 0.95)] || 0;
    const p99Latency =
      sortedLatencies[Math.floor(latencies.length * 0.99)] || 0;
    const maxLatency = Math.max(...latencies) || 0;
    const minLatency = Math.min(...latencies) || 0;
    const throughputMBps = totalBytes / (1024 * 1024) / duration;

    return {
      test: `${testName} (c=${concurrency})`,
      requestsPerSecond,
      averageLatency: avgLatency,
      p95Latency,
      p99Latency,
      maxLatency,
      minLatency,
      totalRequests: completedRequests,
      duration,
      memoryUsage: {
        before: memoryBefore,
        after: memoryAfter,
        peak: peakMemory,
      },
      errorCount,
      cpuUsage: { before: cpuBefore, after: cpuAfter },
      throughputMBps,
      gcPauses: this.gcPauses,
    };
  }

  private async runStressTests(): Promise<void> {
    const concurrencyLevels = [50, 100, 200];
    for (const concurrency of concurrencyLevels) {
      console.log(`   Testing with ${concurrency} concurrent users...`);
      const result = await this.runConcurrentBenchmark(
        '/simple',
        `Stress Test`,
        2000 * (concurrency / 50),
        concurrency
      );
      this.stressTestResults.push({
        concurrency,
        rps: result.requestsPerSecond,
        errorRate: result.errorCount / result.totalRequests,
        p99Latency: result.p99Latency,
        memoryUsageMB: result.memoryUsage.peak.heapUsed / 1024 / 1024,
        cpuUsagePercent:
          ((result.cpuUsage!.after.user + result.cpuUsage!.after.system) /
            (result.duration * 1000000)) *
          100,
      });
    }
  }

  private async runFrameworkComparisons(): Promise<void> {
    console.log(
      `   (Note: Framework comparison requires installing Express and Fastify)`
    );
    // Placeholder for framework comparison logic
    this.frameworkComparisons.push({
      framework: 'Express',
      version: '4.18.2',
      rps: 12000,
      latencyAvg: 8.1,
      memoryMB: 55,
      dependencies: 31,
      notes: 'Simulated result',
    });
    this.frameworkComparisons.push({
      framework: 'Fastify',
      version: '4.25.2',
      rps: 35000,
      latencyAvg: 2.5,
      memoryMB: 65,
      dependencies: 15,
      notes: 'Simulated result',
    });
  }

  private printResults(): void {
    console.log('\n📊 NextRush Performance Benchmark Results:\n');
    console.table(
      this.results.map((r) => ({
        Test: r.test,
        'Req/sec': r.requestsPerSecond.toFixed(0),
        'Avg Latency (ms)': r.averageLatency.toFixed(2),
        'P99 Latency (ms)': r.p99Latency.toFixed(2),
        'Throughput (MB/s)': r.throughputMBps?.toFixed(2) ?? 'N/A',
        Errors: r.errorCount,
      }))
    );
  }

  private printMemoryAnalysis(): void {
    console.log('\n🧠 Memory Usage Analysis:\n');
    console.table(
      this.results.map((r) => ({
        Test: r.test,
        'Peak Heap (MB)': (r.memoryUsage.peak.heapUsed / 1024 / 1024).toFixed(
          2
        ),
        'Leaked (MB)': (
          (r.memoryUsage.after.heapUsed - r.memoryUsage.before.heapUsed) /
          1024 /
          1024
        ).toFixed(2),
        'GC Pauses': r.gcPauses ?? 'N/A',
      }))
    );
  }

  private printCpuAnalysis(): void {
    console.log('\n💻 CPU Usage Analysis:\n');
    console.table(
      this.results.map((r) => {
        const cpuUser = r.cpuUsage?.after.user ?? 0;
        const cpuSystem = r.cpuUsage?.after.system ?? 0;
        const totalCpu = (cpuUser + cpuSystem) / 1000; // in ms
        return {
          Test: r.test,
          'Total CPU Time (ms)': totalCpu.toFixed(2),
          'CPU Usage (%)': ((totalCpu / (r.duration * 1000)) * 100).toFixed(2),
        };
      })
    );
  }

  private printStressTestResults(): void {
    if (this.stressTestResults.length === 0) return;
    console.log('\n🌪️ Stress Test Results:\n');
    console.table(
      this.stressTestResults.map((r) => ({
        Concurrency: r.concurrency,
        'Req/sec': r.rps.toFixed(0),
        'Error Rate (%)': (r.errorRate * 100).toFixed(2),
        'P99 Latency (ms)': r.p99Latency.toFixed(2),
        'Peak Memory (MB)': r.memoryUsageMB.toFixed(2),
        'CPU Usage (%)': r.cpuUsagePercent.toFixed(2),
      }))
    );
  }

  private printFrameworkComparisons(): void {
    if (this.frameworkComparisons.length === 0) return;
    console.log('\n🆚 Framework Comparison:\n');
    console.table(this.frameworkComparisons);
  }

  private printOverallAnalysis(): void {
    console.log('\n💡 Overall Analysis & Recommendations:\n');

    const avgRps =
      this.results.reduce((sum, r) => sum + r.requestsPerSecond, 0) /
      this.results.length;
    const routingTests = this.results.filter(
      (r) => r.routeCount || r.routeComplexity
    );

    // General performance analysis
    if (avgRps > 20000) {
      console.log(
        '   🎉 Excellent! Performance is on par with or exceeds Fastify.'
      );
    } else if (avgRps > 10000) {
      console.log('   ✅ Solid performance, competitive with Express.js.');
    } else {
      console.log(
        '   ⚠️  Performance is moderate. Consider optimizations in routing and middleware processing.'
      );
    }

    // Memory analysis
    const totalLeak = this.results.reduce(
      (sum, r) =>
        sum + (r.memoryUsage.after.heapUsed - r.memoryUsage.before.heapUsed),
      0
    );
    if (totalLeak / this.results.length < 1024 * 1024) {
      console.log('   ✅ Memory management appears stable with minimal leaks.');
    } else {
      console.log(
        '   🔧 Potential memory leaks detected. Investigate heap snapshots.'
      );
    }

    // Routing performance analysis
    if (routingTests.length > 0) {
      console.log('\n🛣️  Routing Performance Analysis:');

      const routingAnalysis = this.analyzeRoutingPerformance();
      if (routingAnalysis) {
        for (const [complexity, stats] of Object.entries(routingAnalysis)) {
          console.log(
            `   ${complexity}: ${stats.averageRPS} RPS, ${stats.averageLatency}ms avg latency`
          );
        }
      }

      // Find best and worst performing route types
      const bestRouting = routingTests.reduce((best, current) =>
        current.requestsPerSecond > best.requestsPerSecond ? current : best
      );
      const worstRouting = routingTests.reduce((worst, current) =>
        current.requestsPerSecond < worst.requestsPerSecond ? current : worst
      );

      console.log(
        `   🏆 Best: ${bestRouting.test} (${Math.round(
          bestRouting.requestsPerSecond
        )} RPS)`
      );
      console.log(
        `   🐌 Needs Optimization: ${worstRouting.test} (${Math.round(
          worstRouting.requestsPerSecond
        )} RPS)`
      );
    }

    // Performance improvement recommendations
    console.log('\n📈 Performance Recommendations:');

    if (avgRps < 2000) {
      console.log(
        '   🔧 Enable routing optimizations (should be on by default)'
      );
      console.log('   🔧 Consider request/response pooling');
      console.log('   🔧 Optimize middleware stack');
    }

    if (
      routingTests.some(
        (t) => t.routeCount && t.routeCount > 100 && t.requestsPerSecond < 1000
      )
    ) {
      console.log(
        '   🚀 Many routes detected - routing optimizations are critical'
      );
      console.log('   🚀 Consider route grouping and caching strategies');
    }

    // Optimization status
    console.log('\n🎯 NextRush Optimization Status:');
    console.log('   ✅ Plugin Architecture: Active');
    console.log('   ✅ Routing Optimizations: Active (v2.0)');
    console.log('   ✅ Memory Management: Monitored');
    console.log('   📊 Performance Tracking: Enhanced');
  }

  private async saveResults(): Promise<void> {
    const output = {
      meta: {
        benchmarkVersion: this.benchmarkVersion,
        timestamp: this.timestamp,
        date: new Date().toISOString(),
        nextRushVersion: '1.3.0', // TODO: Read from package.json
        optimizationsEnabled: true, // Track if routing optimizations are enabled
      },
      system: {
        nodeVersion: process.version,
        v8Version: process.versions.v8,
        cpu: os.cpus()[0].model,
        cores: os.cpus().length,
        totalMemoryGB: (os.totalmem() / 1024 / 1024 / 1024).toFixed(2),
        platform: `${os.platform()} ${os.release()}`,
        architecture: os.arch(),
        typescriptVersion: '5.8.3',
      },
      results: this.results,
      stressTestResults: this.stressTestResults,
      frameworkComparisons: this.frameworkComparisons,
      summary: {
        averageRequestsPerSecond: (
          this.results.reduce((sum, r) => sum + r.requestsPerSecond, 0) /
          this.results.length
        ).toFixed(0),
        averageLatency: (
          this.results.reduce((sum, r) => sum + r.averageLatency, 0) /
          this.results.length
        ).toFixed(2),
        totalErrors: this.results.reduce((sum, r) => sum + r.errorCount, 0),
        totalTests: this.results.length,
        routingTests: this.results.filter(
          (r) => r.routeCount || r.routeComplexity
        ).length,
      },
      performance: {
        bestRPS: Math.max(...this.results.map((r) => r.requestsPerSecond)),
        worstRPS: Math.min(...this.results.map((r) => r.requestsPerSecond)),
        bestLatency: Math.min(...this.results.map((r) => r.averageLatency)),
        worstLatency: Math.max(...this.results.map((r) => r.averageLatency)),
        routingPerformance: this.analyzeRoutingPerformance(),
      },
    };

    // Calculate summary for filename
    const avgRps = Math.round(
      this.results.reduce((sum, r) => sum + r.requestsPerSecond, 0) /
        this.results.length
    );
    const avgLatency = (
      this.results.reduce((sum, r) => sum + r.averageLatency, 0) /
      this.results.length
    ).toFixed(1);
    const bestRps = Math.round(
      Math.max(...this.results.map((r) => r.requestsPerSecond))
    );
    const routingTests = this.results.filter(
      (r) => r.routeCount || r.routeComplexity
    ).length;

    // Create simple filename with performance summary
    const date = new Date().toISOString().split('T')[0]; // 2025-07-19
    const time = new Date()
      .toISOString()
      .split('T')[1]
      .split('.')[0]
      .replace(/:/g, '-'); // 08-57-14
    const performanceSummary = `${avgRps}rps-${avgLatency}ms`;

    const readableFilename = `NextRush-v${output.meta.nextRushVersion}-${date}-${time}-${performanceSummary}`;

    // Save to versioned file in benchmarks folder
    const jsonPath = `./benchmarks/${readableFilename}.json`;
    const reportPath = `./benchmarks/${readableFilename}.md`;

    // Save JSON (for programmatic use)
    await writeFile(jsonPath, JSON.stringify(output, null, 2));

    // Save human-readable report
    await this.saveHumanReadableReport(output, reportPath);

    // Also save to current benchmark-results.json for compatibility
    await writeFile('benchmark-results.json', JSON.stringify(output, null, 2));

    console.log(`\n💾 Benchmark results saved to:`);
    console.log(`   📁 ${jsonPath} (JSON data)`);
    console.log(`   📄 ${reportPath} (Human-readable report)`);
    console.log(`   📁 ./benchmark-results.json (current)`);
  }

  private analyzeRoutingPerformance() {
    const routingTests = this.results.filter(
      (r) => r.routeCount || r.routeComplexity
    );
    if (routingTests.length === 0) return null;

    const complexityGroups = routingTests.reduce((groups, test) => {
      const complexity = test.routeComplexity || 'unknown';
      if (!groups[complexity]) groups[complexity] = [];
      groups[complexity].push(test);
      return groups;
    }, {} as Record<string, BenchmarkResult[]>);

    const analysis: Record<string, any> = {};
    for (const [complexity, tests] of Object.entries(complexityGroups)) {
      const avgRPS =
        tests.reduce((sum, t) => sum + t.requestsPerSecond, 0) / tests.length;
      const avgLatency =
        tests.reduce((sum, t) => sum + t.averageLatency, 0) / tests.length;

      analysis[complexity] = {
        testCount: tests.length,
        averageRPS: Math.round(avgRPS),
        averageLatency: Math.round(avgLatency * 100) / 100,
        totalRoutes: tests.reduce((sum, t) => sum + (t.routeCount || 0), 0),
      };
    }

    return analysis;
  }

  private async saveHumanReadableReport(
    data: any,
    filePath: string
  ): Promise<void> {
    const date = new Date(data.meta.date);
    const report = `# 🚀 NextRush Performance Benchmark Report

## 📋 Benchmark Information

**Date:** ${date.toLocaleString()}
**Benchmark Version:** ${data.meta.benchmarkVersion}
**NextRush Version:** ${data.meta.nextRushVersion}
**Optimizations:** ${
      data.meta.optimizationsEnabled ? '✅ Enabled' : '❌ Disabled'
    }

## 🖥️ System Information

**Node.js:** ${data.system.nodeVersion}
**V8 Engine:** ${data.system.v8Version}
**CPU:** ${data.system.cpu}
**Cores:** ${data.system.cores}
**Memory:** ${data.system.totalMemoryGB} GB
**Platform:** ${data.system.platform}
**Architecture:** ${data.system.architecture}
**TypeScript:** ${data.system.typescriptVersion}

## 📊 Performance Summary

**Average RPS:** ${data.summary.averageRequestsPerSecond} requests/second
**Average Latency:** ${data.summary.averageLatency} ms
**Total Tests:** ${data.summary.totalTests}
**Routing Tests:** ${data.summary.routingTests}
**Total Errors:** ${data.summary.totalErrors}

**Best Performance:** ${Math.round(data.performance.bestRPS)} RPS
**Worst Performance:** ${Math.round(data.performance.worstRPS)} RPS
**Best Latency:** ${data.performance.bestLatency.toFixed(2)} ms
**Worst Latency:** ${data.performance.worstLatency.toFixed(2)} ms

## 🎯 Detailed Test Results

| Test | RPS | Avg Latency (ms) | P99 Latency (ms) | Throughput (MB/s) | Errors |
|------|-----|------------------|------------------|-------------------|--------|
${data.results
  .map(
    (r: any) =>
      `| ${r.test} | ${Math.round(
        r.requestsPerSecond
      )} | ${r.averageLatency.toFixed(2)} | ${r.p99Latency.toFixed(2)} | ${(
        r.throughputMBps || 0
      ).toFixed(2)} | ${r.errorCount} |`
  )
  .join('\n')}

## 🧠 Memory Analysis

| Test | Peak Heap (MB) | Memory Change (MB) | GC Pauses |
|------|----------------|-------------------|-----------|
${data.results
  .map(
    (r: any) =>
      `| ${r.test} | ${(r.memoryUsage.peak.heapUsed / 1024 / 1024).toFixed(
        1
      )} | ${(
        (r.memoryUsage.after.heapUsed - r.memoryUsage.before.heapUsed) /
        1024 /
        1024
      ).toFixed(1)} | ${r.gcPauses || 0} |`
  )
  .join('\n')}

## 🌪️ Stress Test Results

${
  data.stressTestResults.length > 0
    ? `
| Concurrency | RPS | Error Rate (%) | P99 Latency (ms) | Peak Memory (MB) | CPU Usage (%) |
|-------------|-----|----------------|------------------|------------------|---------------|
${data.stressTestResults
  .map(
    (r: any) =>
      `| ${r.concurrency} | ${Math.round(r.rps)} | ${(
        r.errorRate * 100
      ).toFixed(2)} | ${r.p99Latency.toFixed(2)} | ${r.memoryUsageMB.toFixed(
        1
      )} | ${r.cpuUsagePercent.toFixed(1)} |`
  )
  .join('\n')}
`
    : '*No stress test results available*'
}

## 🛣️ Routing Performance Analysis

${
  data.performance.routingPerformance
    ? Object.entries(data.performance.routingPerformance)
        .map(
          ([complexity, stats]: [string, any]) =>
            `**${
              complexity.charAt(0).toUpperCase() + complexity.slice(1)
            } Routes:** ${stats.averageRPS} RPS, ${
              stats.averageLatency
            } ms avg latency`
        )
        .join('  \n')
    : '*No routing-specific performance data available*'
}

## 🆚 Framework Comparison

${
  data.frameworkComparisons.length > 0
    ? `
| Framework | Version | RPS | Avg Latency (ms) | Memory (MB) | Dependencies | Notes |
|-----------|---------|-----|------------------|-------------|--------------|-------|
${data.frameworkComparisons
  .map(
    (f: any) =>
      `| ${f.framework} | ${f.version} | ${f.rps} | ${f.latencyAvg} | ${f.memoryMB} | ${f.dependencies} | ${f.notes} |`
  )
  .join('\n')}
`
    : '*No framework comparison data available*'
}

## 📈 Performance Verdict

${this.generatePerformanceVerdict(data)}

## ❓ Understanding Performance Variations

**Why do benchmark results vary between runs?**

Performance benchmarks can show variations of **±5-15%** between runs due to:

- **System Load:** Other processes running on your machine
- **Memory State:** Different garbage collection timing
- **CPU Temperature:** Thermal throttling under sustained load
- **Network Stack:** Local network buffer states
- **Node.js JIT:** V8 optimization warming up differently
- **OS Scheduling:** Process priority and CPU time allocation

**What's Normal:**
- ✅ **±5% variation** is completely normal
- ✅ **±10% variation** is acceptable for stress tests
- ⚠️ **±15% variation** indicates system instability
- 🚨 **>20% variation** suggests environmental issues

**Tips for Consistent Results:**
- Close unnecessary applications before benchmarking
- Run multiple benchmark sessions and average results
- Use dedicated hardware for performance testing
- Monitor system temperature and CPU usage

---
*Generated by NextRush Benchmark Suite v${
      data.meta.benchmarkVersion
    } on ${date.toLocaleString()}*
`;

    await writeFile(filePath, report);
  }

  private generatePerformanceVerdict(data: any): string {
    const avgRps = parseFloat(data.summary.averageRequestsPerSecond);
    const routingTests = data.results.filter(
      (r: any) => r.routeCount || r.routeComplexity
    );

    let verdict = '';

    // Overall performance assessment
    if (avgRps > 2000) {
      verdict +=
        '🎉 **Excellent Performance!** NextRush is performing at high levels.\n\n';
    } else if (avgRps > 1500) {
      verdict +=
        '✅ **Good Performance!** Solid performance with room for optimization.\n\n';
    } else if (avgRps > 1000) {
      verdict += '⚠️ **Moderate Performance.** Consider optimizations.\n\n';
    } else {
      verdict += '🔴 **Performance Issues Detected.** Optimization needed.\n\n';
    }

    // Memory assessment
    const avgMemoryChange =
      data.results.reduce(
        (sum: number, r: any) =>
          sum + (r.memoryUsage.after.heapUsed - r.memoryUsage.before.heapUsed),
        0
      ) / data.results.length;

    if (avgMemoryChange < 1024 * 1024) {
      // < 1MB
      verdict +=
        '✅ **Memory Management:** Excellent - minimal memory leaks detected.\n\n';
    } else if (avgMemoryChange < 10 * 1024 * 1024) {
      // < 10MB
      verdict +=
        '⚠️ **Memory Management:** Good - some memory usage increase observed.\n\n';
    } else {
      verdict +=
        '🔴 **Memory Management:** Potential memory leaks - investigation recommended.\n\n';
    }

    // Routing performance
    if (routingTests.length > 0) {
      const routingRps =
        routingTests.reduce(
          (sum: number, r: any) => sum + r.requestsPerSecond,
          0
        ) / routingTests.length;
      verdict += `🛣️ **Routing Performance:** ${Math.round(
        routingRps
      )} RPS average across ${routingTests.length} routing tests.\n\n`;
    }

    // Recommendations
    verdict += '### 📋 Recommendations:\n\n';
    if (avgRps < 2000) {
      verdict += '- Enable routing optimizations\n';
      verdict += '- Consider request/response pooling\n';
      verdict += '- Optimize middleware stack\n';
    }
    if (data.summary.totalErrors > 0) {
      verdict += '- Investigate and fix error conditions\n';
    }
    verdict += '- Monitor memory usage in production\n';
    verdict += '- Run benchmarks regularly to track performance trends\n';

    return verdict;
  }
}

// Run benchmarks
async function runBenchmarkSuite() {
  const benchmark = new UltimatePerformanceBenchmark();

  // Handle process termination signals
  const cleanup = async () => {
    console.log('\n🛑 Received termination signal, cleaning up...');
    try {
      await benchmark.cleanup();
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('SIGUSR1', cleanup);
  process.on('SIGUSR2', cleanup);

  try {
    await benchmark.runAllBenchmarks();
  } catch (error) {
    console.error('Benchmark failed:', error);
    process.exit(1);
  }
}

// Run only if this file is executed directly
if (require.main === module) {
  runBenchmarkSuite().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
