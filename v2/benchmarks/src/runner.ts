#!/usr/bin/env tsx

/**
 * 🚀 NextRush v2 Benchmark Runner
 *
 * Professional benchmarking suite with multiple frameworks and scenarios
 */

import autocannon from 'autocannon';
import { ExpressAdapter } from './adapters/express.js';
import { FastifyAdapter } from './adapters/fastify.js';
import { NextRushAdapter } from './adapters/nextrush.js';
import type {
  BenchmarkConfig,
  BenchmarkResult,
  FrameworkResult,
} from './types.js';

export class BenchmarkRunner {
  private config: BenchmarkConfig;
  private adapters: Map<string, any> = new Map();

  constructor(config: BenchmarkConfig) {
    this.config = config;
    this.setupAdapters();
  }

  private setupAdapters(): void {
    this.adapters.set('nextrush', new NextRushAdapter());
    this.adapters.set('express', new ExpressAdapter());
    this.adapters.set('fastify', new FastifyAdapter());
  }

  async run(): Promise<BenchmarkResult> {
    const results: FrameworkResult[] = [];
    const frameworks =
      this.config.framework === 'all'
        ? Array.from(this.adapters.keys())
        : [this.config.framework];

    console.log(`🚀 Running benchmarks for: ${frameworks.join(', ')}`);

    for (const framework of frameworks) {
      const adapter = this.adapters.get(framework);
      if (!adapter) {
        console.warn(`⚠️  Framework ${framework} not found, skipping...`);
        continue;
      }

      console.log(
        `\n📊 Testing ${adapter.getName()} v${adapter.getVersion()}...`
      );

      try {
        const result = await this.runFrameworkBenchmark(adapter);
        results.push(result);
        console.log(`✅ ${adapter.getName()} completed`);
      } catch (error) {
        console.error(`❌ ${adapter.getName()} failed:`, error);
      }
    }

    return {
      timestamp: new Date().toISOString(),
      config: this.config,
      results,
      summary: this.generateSummary(results),
    };
  }

  private async runFrameworkBenchmark(adapter: any): Promise<FrameworkResult> {
    const { port, server } = await adapter.setup();

    try {
      const scenarios = this.getTestScenarios();
      const scenarioResults = [];

      for (const scenario of scenarios) {
        console.log(`  🔄 Running scenario: ${scenario.name}`);

        const result = await this.runScenario(port, scenario);
        scenarioResults.push({
          name: scenario.name,
          weight: scenario.weight,
          ...result,
        });
      }

      // Calculate weighted average
      const weightedResults = this.calculateWeightedResults(scenarioResults);

      return {
        framework: adapter.getName(),
        version: adapter.getVersion(),
        port,
        scenarios: scenarioResults,
        summary: weightedResults,
      };
    } finally {
      await adapter.teardown();
    }
  }

  private async runScenario(port: number, scenario: any) {
    const autocannonConfig = {
      url: `http://localhost:${port}${scenario.path}`,
      connections: this.config.concurrent,
      duration: this.config.duration,
      pipelining: 1,
      method: scenario.method || 'GET',
      headers: scenario.headers || {},
      body: scenario.body,
      setupClient: scenario.setupClient,
    };

    return new Promise<any>((resolve, reject) => {
      autocannon(autocannonConfig, (err, result) => {
        if (err) {
          reject(err);
          return;
        }

        resolve({
          requests: {
            total: result.requests.total,
            average: result.requests.average,
            p50: result.requests.p50,
            p90: result.requests.p90,
            p99: result.requests.p99,
          },
          latency: {
            average: result.latency.average,
            p50: result.latency.p50,
            p90: result.latency.p90,
            p99: result.latency.p99,
          },
          throughput: {
            average: result.throughput.average,
            p50: result.throughput.p50,
            p90: result.throughput.p90,
            p99: result.throughput.p99,
          },
          errors: result.errors,
          timeouts: result.timeouts,
          duration: result.duration,
        });
      });
    });
  }

  private getTestScenarios() {
    return [
      {
        name: 'Basic API',
        path: '/',
        method: 'GET',
        weight: 0.15,
      },
      {
        name: 'Health Check',
        path: '/api/health',
        method: 'GET',
        weight: 0.1,
      },
      {
        name: 'CRUD - List Users',
        path: '/api/users',
        method: 'GET',
        weight: 0.2,
      },
      {
        name: 'CRUD - Get User',
        path: '/api/users/1',
        method: 'GET',
        weight: 0.15,
      },
      {
        name: 'CRUD - Create User',
        path: '/api/users',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test User', email: 'test@example.com' }),
        weight: 0.15,
      },
      {
        name: 'CRUD - Update User',
        path: '/api/users/1',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Updated User',
          email: 'updated@example.com',
        }),
        weight: 0.1,
      },
      {
        name: 'Complex Query',
        path: '/api/search?q=test&page=1&limit=20',
        method: 'GET',
        weight: 0.1,
      },
      {
        name: 'Large Payload',
        path: '/api/upload',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Array(1000).fill({ data: 'large payload test' })),
        weight: 0.05,
      },
    ];
  }

  private calculateWeightedResults(scenarioResults: any[]) {
    let totalWeight = 0;
    let weightedRequests = 0;
    let weightedLatency = 0;
    let weightedThroughput = 0;
    let totalErrors = 0;
    let totalTimeouts = 0;

    for (const result of scenarioResults) {
      totalWeight += result.weight;
      weightedRequests += result.requests.average * result.weight;
      weightedLatency += result.latency.average * result.weight;
      weightedThroughput += result.throughput.average * result.weight;
      totalErrors += result.errors;
      totalTimeouts += result.timeouts;
    }

    return {
      requests: {
        average: weightedRequests / totalWeight,
      },
      latency: {
        average: weightedLatency / totalWeight,
      },
      throughput: {
        average: weightedThroughput / totalWeight,
      },
      errors: totalErrors,
      timeouts: totalTimeouts,
    };
  }

  private generateSummary(results: FrameworkResult[]) {
    const sorted = results.sort(
      (a, b) => b.summary.requests.average - a.summary.requests.average
    );

    return {
      winner: sorted[0],
      rankings: sorted.map((result, index) => ({
        rank: index + 1,
        framework: result.framework,
        requests: result.summary.requests.average,
        latency: result.summary.latency.average,
        throughput: result.summary.throughput.average,
      })),
      comparison: this.generateComparison(sorted),
    };
  }

  private generateComparison(results: FrameworkResult[]) {
    const baseline = results[0].summary.requests.average;

    return results.map(result => ({
      framework: result.framework,
      performance: (result.summary.requests.average / baseline) * 100,
      latency: result.summary.latency.average,
      throughput: result.summary.throughput.average,
    }));
  }
}
