/**
 * 🚀 Main Benchmark Engine
 *
 * Modular benchmark system for testing web frameworks
 */

import { performance, PerformanceObserver } from 'perf_hooks';
import {
  autoRegisterAdapters,
  createAdapter,
  getAvailableAdapters,
} from '../adapters/registry.js';
import { findAvailablePort, makeRequest } from '../utils/http-client.js';
import { log, printSystemInfo, ProgressBar } from '../utils/logger.js';
import {
  BenchmarkConfig,
  BenchmarkResult,
  FrameworkAdapter,
  TestCase,
} from './types.js';

/**
 * Default test cases for benchmarking
 */
const DEFAULT_TEST_CASES: TestCase[] = [
  {
    name: 'Simple Route',
    path: '/simple',
    method: 'GET',
    description: 'Basic hello world response',
    requests: 2000,
  },
  {
    name: 'JSON Response',
    path: '/json',
    method: 'GET',
    description: 'JSON response with structured data',
    requests: 2000,
  },
  {
    name: 'Middleware Stack',
    path: '/middleware',
    method: 'GET',
    description: 'Route with multiple middleware',
    requests: 1500,
  },
  {
    name: 'Parameter Parsing',
    path: '/users/123/posts/456',
    method: 'GET',
    description: 'Route with URL parameters',
    requests: 1500,
  },
  {
    name: 'Error Handling',
    path: '/error',
    method: 'GET',
    description: 'Error handling performance',
    requests: 1000,
    expectedStatus: 500,
  },
  {
    name: 'Large Payload',
    path: '/large-payload',
    method: 'GET',
    description: '10KB JSON response',
    requests: 800,
  },
  {
    name: 'POST Echo',
    path: '/echo',
    method: 'POST',
    body: { test: 'data', timestamp: Date.now() },
    headers: { 'Content-Type': 'application/json' },
    description: 'POST request with JSON body',
    requests: 1200,
  },
  {
    name: 'Nested Route',
    path: '/api/v1/users/123/posts/456/comments/789',
    method: 'GET',
    description: 'Complex nested route',
    requests: 1000,
  },
];

/**
 * Default benchmark configuration
 */
const DEFAULT_CONFIG: BenchmarkConfig = {
  warmupRequests: 100,
  defaultTimeout: 30000,
  maxConcurrency: 100,
  memoryProfiling: true,
  cpuProfiling: true,
  gcMonitoring: true,
};

/**
 * Main benchmark engine class
 */
export class BenchmarkEngine {
  private config: BenchmarkConfig;
  private results: BenchmarkResult[] = [];
  private gcObserver: PerformanceObserver | null = null;
  private gcPauses = 0;

  constructor(config: Partial<BenchmarkConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupGCObserver();
  }

  /**
   * Setup garbage collection monitoring
   */
  private setupGCObserver(): void {
    if (
      this.config.gcMonitoring &&
      typeof PerformanceObserver !== 'undefined' &&
      global.gc
    ) {
      this.gcObserver = new PerformanceObserver((list) => {
        this.gcPauses += list.getEntries().length;
      });
      this.gcObserver.observe({ entryTypes: ['gc'] });
    }
  }

  /**
   * Run benchmark for specific frameworks
   */
  async runBenchmarks(frameworkNames?: string[]): Promise<BenchmarkResult[]> {
    log.header('NextRush Modular Benchmark Suite v3.0');
    printSystemInfo();

    // Auto-register all available adapters
    await autoRegisterAdapters();

    // Get available frameworks
    const availableFrameworks = await getAvailableAdapters();

    if (availableFrameworks.length === 0) {
      log.error('No frameworks available for benchmarking!');
      log.info(
        'Install frameworks with: pnpm install express fastify koa @koa/router koa-bodyparser @hapi/hapi'
      );
      return [];
    }

    // Filter to requested frameworks or use all available
    const frameworksToTest = frameworkNames
      ? frameworkNames.filter((name) =>
          availableFrameworks.includes(name.toLowerCase())
        )
      : availableFrameworks;

    if (frameworksToTest.length === 0) {
      log.error('None of the requested frameworks are available!');
      log.info(`Available frameworks: ${availableFrameworks.join(', ')}`);
      return [];
    }

    log.subheader(
      `Testing ${frameworksToTest.length} framework(s): ${frameworksToTest.join(
        ', '
      )}`
    );

    // Run benchmarks for each framework
    for (const frameworkName of frameworksToTest) {
      await this.benchmarkFramework(frameworkName);
    }

    return this.results;
  }

  /**
   * Benchmark a specific framework
   */
  private async benchmarkFramework(frameworkName: string): Promise<void> {
    const adapter = await createAdapter(frameworkName);
    if (!adapter) {
      log.error(`Failed to create adapter for ${frameworkName}`);
      return;
    }

    log.benchmark(`Starting ${adapter.frameworkName} benchmark...`);

    try {
      // Setup framework
      await adapter.createApp();
      await adapter.setupRoutes();

      // Find available port and start server
      const port = await findAvailablePort(
        3000 + Math.floor(Math.random() * 1000)
      );
      await adapter.startServer(port);

      // Warmup
      await this.warmupFramework(adapter);

      // Run test cases
      const progress = new ProgressBar(
        DEFAULT_TEST_CASES.length,
        `${adapter.frameworkName} Tests`
      );

      for (let i = 0; i < DEFAULT_TEST_CASES.length; i++) {
        const testCase = DEFAULT_TEST_CASES[i];
        const result = await this.runTestCase(adapter, testCase);
        this.results.push(result);
        progress.update(i + 1);
      }

      // Run stress tests
      await this.runStressTests(adapter);

      log.success(`${adapter.frameworkName} benchmark completed`);
    } catch (error) {
      log.error(`Failed to benchmark ${adapter.frameworkName}: ${error}`);
    } finally {
      await adapter.cleanup();
    }
  }

  /**
   * Warmup framework
   */
  private async warmupFramework(adapter: FrameworkAdapter): Promise<void> {
    log.info('Warming up...');

    for (let i = 0; i < this.config.warmupRequests; i++) {
      try {
        await makeRequest({
          url: `${adapter.getBaseUrl()}/simple`,
          method: 'GET',
          timeout: 5000,
        });
      } catch {
        // Ignore warmup errors
      }
    }

    // Force garbage collection if available
    if (global.gc) global.gc();
  }

  /**
   * Run a single test case
   */
  private async runTestCase(
    adapter: FrameworkAdapter,
    testCase: TestCase
  ): Promise<BenchmarkResult> {
    // Reset GC counter
    this.gcPauses = 0;

    // Force GC before test
    if (global.gc) global.gc();

    const memoryBefore = process.memoryUsage();
    const cpuBefore = process.cpuUsage();
    let peakMemory = { ...memoryBefore };

    const latencies: number[] = [];
    let errorCount = 0;
    let totalBytes = 0;
    let successCount = 0;

    const startTime = performance.now();
    const url = `${adapter.getBaseUrl()}${testCase.path}`;

    // Execute requests
    for (let i = 0; i < testCase.requests; i++) {
      try {
        const requestStart = performance.now();
        const response = await makeRequest({
          url,
          method: testCase.method,
          body: testCase.body,
          headers: testCase.headers,
          timeout: this.config.defaultTimeout,
        });
        const requestEnd = performance.now();

        const latency = requestEnd - requestStart;
        latencies.push(latency);

        if (response.size) {
          totalBytes += response.size;
        }

        // Check expected status
        const expectedStatus = testCase.expectedStatus || 200;
        if (
          response.status >= expectedStatus &&
          response.status < expectedStatus + 100
        ) {
          successCount++;
        } else {
          errorCount++;
        }

        // Track peak memory every 100 requests
        if (i % 100 === 0) {
          const currentMemory = process.memoryUsage();
          if (currentMemory.heapUsed > peakMemory.heapUsed) {
            peakMemory = currentMemory;
          }
        }
      } catch (error) {
        errorCount++;
        latencies.push(10000); // 10s penalty for errors
      }
    }

    const duration = (performance.now() - startTime) / 1000;

    // Force GC after test
    if (global.gc) global.gc();

    const memoryAfter = process.memoryUsage();
    const cpuAfter = process.cpuUsage(cpuBefore);

    // Calculate metrics
    const requestsPerSecond = successCount / duration;
    const avgLatency =
      latencies.reduce((a, b) => a + b, 0) / latencies.length || 0;

    const sortedLatencies = latencies.sort((a, b) => a - b);
    const p50Latency = sortedLatencies[Math.floor(latencies.length * 0.5)];
    const p95Latency = sortedLatencies[Math.floor(latencies.length * 0.95)];
    const p99Latency = sortedLatencies[Math.floor(latencies.length * 0.99)];
    const maxLatency = Math.max(...latencies);
    const minLatency = Math.min(...latencies);

    const throughputMBps = totalBytes / (1024 * 1024) / duration;

    // CPU usage calculation (cpuAfter already contains the diff)
    const cpuUserPercent = (cpuAfter.user / 1000 / duration) * 100;
    const cpuSystemPercent = (cpuAfter.system / 1000 / duration) * 100;

    const status: 'success' | 'partial' | 'failed' =
      errorCount === 0
        ? 'success'
        : successCount > errorCount
        ? 'partial'
        : 'failed';

    return {
      framework: adapter.frameworkName,
      version: await adapter.getVersion(),
      test: testCase.name,
      requestsPerSecond,
      averageLatency: avgLatency,
      p50Latency,
      p95Latency,
      p99Latency,
      maxLatency,
      minLatency,
      totalRequests: testCase.requests,
      duration,
      memoryUsage: {
        before: memoryBefore,
        after: memoryAfter,
        peak: peakMemory,
        leaked: memoryAfter.heapUsed - memoryBefore.heapUsed,
      },
      errorCount,
      cpuUsage: {
        before: cpuBefore,
        after: cpuAfter,
        userPercent: cpuUserPercent,
        systemPercent: cpuSystemPercent,
      },
      throughputMBps,
      gcPauses: this.gcPauses,
      status,
      notes: testCase.description,
    };
  }

  /**
   * Run stress tests with concurrency
   */
  private async runStressTests(adapter: FrameworkAdapter): Promise<void> {
    const concurrencyLevels = [10, 25, 50];

    log.info('Running stress tests...');

    for (const concurrency of concurrencyLevels) {
      const result = await this.runConcurrentTest(adapter, concurrency, 500);
      this.results.push(result);
    }
  }

  /**
   * Run concurrent test
   */
  private async runConcurrentTest(
    adapter: FrameworkAdapter,
    concurrency: number,
    totalRequests: number
  ): Promise<BenchmarkResult> {
    this.gcPauses = 0;
    if (global.gc) global.gc();

    const memoryBefore = process.memoryUsage();
    const cpuBefore = process.cpuUsage();
    let peakMemory = { ...memoryBefore };

    const latencies: number[] = [];
    let errorCount = 0;
    let totalBytes = 0;
    let completedRequests = 0;

    const startTime = performance.now();
    const url = `${adapter.getBaseUrl()}/simple`;

    // Create request executor
    const executeRequest = async (): Promise<void> => {
      try {
        const requestStart = performance.now();
        const response = await makeRequest({ url, method: 'GET' });
        const requestEnd = performance.now();

        latencies.push(requestEnd - requestStart);
        if (response.size) {
          totalBytes += response.size;
        }

        if (response.status >= 200 && response.status < 300) {
          completedRequests++;
        } else {
          errorCount++;
        }

        // Track peak memory occasionally
        if (Math.random() < 0.01) {
          // 1% of requests
          const currentMemory = process.memoryUsage();
          if (currentMemory.heapUsed > peakMemory.heapUsed) {
            peakMemory = currentMemory;
          }
        }
      } catch (error) {
        errorCount++;
        latencies.push(10000); // 10s penalty
      }
    };

    // Execute requests in batches
    const batchSize = concurrency;
    const batches = Math.ceil(totalRequests / batchSize);

    for (let i = 0; i < batches; i++) {
      const promises: Promise<void>[] = [];
      const requestsInBatch = Math.min(
        batchSize,
        totalRequests - i * batchSize
      );

      for (let j = 0; j < requestsInBatch; j++) {
        promises.push(executeRequest());
      }

      await Promise.all(promises);
    }

    const duration = (performance.now() - startTime) / 1000;
    if (global.gc) global.gc();

    const memoryAfter = process.memoryUsage();
    const cpuAfter = process.cpuUsage(cpuBefore);

    // Calculate metrics
    const requestsPerSecond = completedRequests / duration;
    const avgLatency =
      latencies.reduce((a, b) => a + b, 0) / latencies.length || 0;

    const sortedLatencies = latencies.sort((a, b) => a - b);
    const p50Latency = sortedLatencies[Math.floor(latencies.length * 0.5)] || 0;
    const p95Latency =
      sortedLatencies[Math.floor(latencies.length * 0.95)] || 0;
    const p99Latency =
      sortedLatencies[Math.floor(latencies.length * 0.99)] || 0;
    const maxLatency = Math.max(...latencies) || 0;
    const minLatency = Math.min(...latencies) || 0;

    const throughputMBps = totalBytes / (1024 * 1024) / duration;

    const cpuUserPercent =
      ((cpuAfter.user - cpuBefore.user) / 1000 / duration) * 100;
    const cpuSystemPercent =
      ((cpuAfter.system - cpuBefore.system) / 1000 / duration) * 100;

    const status: 'success' | 'partial' | 'failed' =
      errorCount === 0
        ? 'success'
        : completedRequests > errorCount
        ? 'partial'
        : 'failed';

    return {
      framework: adapter.frameworkName,
      version: await adapter.getVersion(),
      test: `Stress Test (c=${concurrency})`,
      requestsPerSecond,
      averageLatency: avgLatency,
      p50Latency,
      p95Latency,
      p99Latency,
      maxLatency,
      minLatency,
      totalRequests,
      duration,
      memoryUsage: {
        before: memoryBefore,
        after: memoryAfter,
        peak: peakMemory,
        leaked: memoryAfter.heapUsed - memoryBefore.heapUsed,
      },
      errorCount,
      cpuUsage: {
        before: cpuBefore,
        after: cpuAfter,
        userPercent: cpuUserPercent,
        systemPercent: cpuSystemPercent,
      },
      throughputMBps,
      gcPauses: this.gcPauses,
      concurrency,
      status,
      notes: `Concurrent requests with ${concurrency} parallel connections`,
    };
  }

  /**
   * Get benchmark results
   */
  getResults(): BenchmarkResult[] {
    return this.results;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.gcObserver) {
      this.gcObserver.disconnect();
    }
  }
}
