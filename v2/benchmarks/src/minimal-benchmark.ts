#!/usr/bin/env tsx

/**
 * 🏆 Minimal Framework Benchmark
 *
 * A minimal "ping-pong" test for NextRush, Express, Fastify, and Koa
 */

import autocannon from 'autocannon';
import { ExpressMinimalAdapter } from './minimal/express.js';
import { FastifyMinimalAdapter } from './minimal/fastify.js';
import { KoaMinimalAdapter } from './minimal/koa.js';
import { NextRushMinimalAdapter } from './minimal/nextrush.js';
import { ReportGenerator } from './report-generator.js';
import type { FrameworkResult } from './types.js';

// Benchmark Configuration
const BENCHMARK_CONFIG = {
  duration: 10,
  connections: 100,
  pipelining: 10,
  timeout: 10,
};

// Test Scenario
const TEST_SCENARIO = {
  name: 'GET /ping',
  path: '/ping',
  method: 'GET',
};

interface FrameworkTest {
  name: string;
  version: string;
  adapter: any;
}

const FRAMEWORKS: FrameworkTest[] = [
  {
    name: 'NextRush v2 (Minimal)',
    version: '2.0.0-alpha.1',
    adapter: new NextRushMinimalAdapter(),
  },
  {
    name: 'Express (Minimal)',
    version: '4.18.2',
    adapter: new ExpressMinimalAdapter(),
  },
  {
    name: 'Fastify (Minimal)',
    version: '4.24.3',
    adapter: new FastifyMinimalAdapter(),
  },
  {
    name: 'Koa (Minimal)',
    version: '2.13.4',
    adapter: new KoaMinimalAdapter(),
  },
];

export async function runMinimalBenchmark() {
  console.log('🏆 Minimal Framework Benchmark');
  console.log('=============================');
  console.log('');

  const results: FrameworkResult[] = [];

  for (const framework of FRAMEWORKS) {
    console.log(`\n🚀 Testing ${framework.name}...`);
    const { port, server } = await framework.adapter.setup();

    try {
      const result = await autocannon({
        url: `http://localhost:${port}${TEST_SCENARIO.path}`,
        ...BENCHMARK_CONFIG,
      });

      results.push({
        framework: framework.name,
        version: framework.version,
        port,
        scenarios: [{ ...result, name: TEST_SCENARIO.name, weight: 1 }],
        summary: {
          requests: { average: result.requests.average },
          latency: { average: result.latency.average },
          throughput: { average: result.throughput.average / (1024 * 1024) }, // MB/s
          errors: result.errors,
          timeouts: result.timeouts,
        },
      });
    } finally {
      await framework.adapter.teardown();
    }
  }

  // Generate report
  const reportGenerator = new ReportGenerator();

  const winner = results.reduce((prev, current) =>
    prev.summary.requests.average > current.summary.requests.average
      ? prev
      : current
  );

  const rankings = results
    .map(result => ({
      framework: result.framework,
      requests: result.summary.requests.average,
      latency: result.summary.latency.average,
      throughput: result.summary.throughput.average,
    }))
    .sort((a, b) => b.requests - a.requests);

  const comparison = results.map(result => ({
    framework: result.framework,
    performance: (result.summary.requests.average / winner.summary.requests.average) * 100,
    latency: result.summary.latency.average,
    throughput: result.summary.throughput.average,
  }));

  const reportPath = await reportGenerator.generateReport({
    results,
    config: BENCHMARK_CONFIG,
    summary: {
      winner,
      rankings,
      comparison,
    },
  });

  console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  console.log('✅ Minimal benchmark completed!');

  return results;
}
