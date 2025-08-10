#!/usr/bin/env tsx
/**
 * 🎯 NextRush v2 Simple Benchmark CLI
 * Clean, professional benchmarking
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { ExpressAdapter } from './adapters/express';
import { FastifyAdapter } from './adapters/fastify';
import { KoaAdapter } from './adapters/koa';
import { NextRushAdapter } from './adapters/nextrush';

const execAsync = promisify(exec);

const ADAPTERS = {
  nextrush: NextRushAdapter,
  express: ExpressAdapter,
  fastify: FastifyAdapter,
  koa: KoaAdapter,
};

const PORTS = {
  nextrush: 3000,
  express: 3001,
  fastify: 3002,
  koa: 3003,
};

interface BenchmarkResult {
  framework: string;
  rps: number;
  latency: number;
  errors: number;
}

async function runBenchmark(
  framework: string,
  adapter: any,
  port: number
): Promise<BenchmarkResult> {
  const instance = new adapter();

  try {
    console.log(`🚀 Starting ${framework} on port ${port}...`);
    await instance.start(port);

    // Wait for server to be fully ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Warmup run first
    console.log(`🔥 Warming up ${framework}...`);
    await execAsync(`npx autocannon -c 10 -d 5 http://localhost:${port}/hello`);

    // Wait between warmup and real test
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log(`📊 Running benchmark for ${framework}...`);

    // Fair benchmark: same settings for all
    const { stdout } = await execAsync(
      `npx autocannon -c 100 -d 30 --json http://localhost:${port}/hello`
    );
    const result = JSON.parse(stdout);

    await instance.stop();

    return {
      framework,
      rps: Math.round(result.requests.average),
      latency: Math.round(result.latency.average * 100) / 100,
      errors: result.errors || 0,
    };
  } catch (error) {
    console.error(`❌ ${framework} failed:`, error);
    await instance.stop();
    return {
      framework,
      rps: 0,
      latency: 0,
      errors: 1,
    };
  }
}

async function runComparison(): Promise<void> {
  console.log('🏁 NextRush v2 Framework Comparison\n');

  const results: BenchmarkResult[] = [];

  for (const [name, Adapter] of Object.entries(ADAPTERS)) {
    const result = await runBenchmark(
      name,
      Adapter,
      PORTS[name as keyof typeof PORTS]
    );
    results.push(result);
  }

  // Sort by RPS descending
  results.sort((a, b) => b.rps - a.rps);

  console.log('\n🏆 Results:');
  console.log('┌─────────────┬─────────┬─────────┬────────┐');
  console.log('│ Framework   │ RPS     │ Latency │ Errors │');
  console.log('├─────────────┼─────────┼─────────┼────────┤');

  results.forEach((result, index) => {
    const icon =
      index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
    console.log(
      `│ ${icon} ${result.framework.padEnd(8)} │ ${result.rps.toString().padStart(7)} │ ${result.latency.toString().padStart(6)}ms │ ${result.errors.toString().padStart(6)} │`
    );
  });

  console.log('└─────────────┴─────────┴─────────┴────────┘\n');
}

async function main(): Promise<void> {
  const command = process.argv[2];

  switch (command) {
    case 'compare':
    case 'all':
    default:
      await runComparison();
      break;
  }
}

main().catch(console.error);
