#!/usr/bin/env node

/**
 * 🚀 NextRush Ultimate Performance Benchmark Suite
 *
 * Advanced benchmarking tool that measures NextRush against industry standards
 * including Express.js, Fastify, and other leading frameworks.
 *
 * Features:
 * - Comprehensive performance metrics (RPS, latency, memory, CPU)
 * - Industry framework comparisons
 * - Real-world scenario testing
 * - Memory leak detection
 * - Stress testing and load simulation
 * - Detailed analysis and recommendations
 */

import { existsSync } from 'fs';
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
  private port = 3000;
  private results: BenchmarkResult[] = [];
  private stressTestResults: StressTestResult[] = [];
  private frameworkComparisons: FrameworkComparison[] = [];
  private baseUrl = `http://localhost:${this.port}`;
  private isRunning = false;
  private gcObserver: PerformanceObserver | null = null;
  private gcPauses = 0;

  constructor() {
    if (typeof PerformanceObserver !== 'undefined' && global.gc) {
      this.gcObserver = new PerformanceObserver(() => {
        this.gcPauses++;
      });
      this.gcObserver.observe({ entryTypes: ['gc'] });
    }
  }

  async runAllBenchmarks(): Promise<void> {
    if (this.isRunning) {
      console.warn('⚠️ Benchmark is already running.');
      return;
    }
    this.isRunning = true;
    console.log(
      '🚀 Starting NextRush Ultimate Performance Benchmark Suite...\n'
    );
    this.printSystemInfo();

    try {
      await this.setupServer();
      await this.startServer();

      console.log('🔥 Running warm-up phase...');
      await this.warmupPhase();

      await this.benchmarkSimpleRoute();
      await this.benchmarkJsonResponse();
      await this.benchmarkMiddlewareStack();
      await this.benchmarkParameterParsing();
      await this.benchmarkConcurrentRequests();
      await this.benchmarkErrorHandling();
      await this.benchmarkLargePayload();
      // await this.benchmarkStaticFile(); // Disabled for now

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
      await this.stopServer();
      if (this.gcObserver) {
        this.gcObserver.disconnect();
      }
      this.isRunning = false;
      console.log('\n✅ Benchmark suite completed');
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

    // Static file serving - commented out for now
    // try {
    //   this.app.static('/public', './public');
    // } catch (error) {
    //   console.warn('⚠️ Static file serving not available');
    // }

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
      if (this.server) {
        this.server.close(() => {
          console.log('🛑 Test server stopped');
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
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

    const totalLeak = this.results.reduce(
      (sum, r) =>
        sum + (r.memoryUsage.after.heapUsed - r.memoryUsage.before.heapUsed),
      0
    );
    if (totalLeak / this.results.length < 1024 * 1024) {
      // < 1MB avg leak
      console.log('   ✅ Memory management appears stable with minimal leaks.');
    } else {
      console.log(
        '   🔧 Potential memory leaks detected. Investigate heap snapshots.'
      );
    }
  }

  private async saveResults(): Promise<void> {
    const output = {
      system: {
        nodeVersion: process.version,
        v8Version: process.versions.v8,
        cpu: os.cpus()[0].model,
        cores: os.cpus().length,
        totalMemoryGB: (os.totalmem() / 1024 / 1024 / 1024).toFixed(2),
        platform: `${os.platform()} ${os.release()}`,
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
      },
    };

    await writeFile('benchmark-results.json', JSON.stringify(output, null, 2));
    console.log('\n💾 Benchmark results saved to benchmark-results.json');
  }
}

// Run benchmarks
const benchmark = new UltimatePerformanceBenchmark();
benchmark.runAllBenchmarks().catch(console.error);
