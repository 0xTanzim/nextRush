#!/usr/bin/env tsx

/**
 * 🚀 NextRush v2 Benchmark Demo
 *
 * Quick demo to test the benchmarking setup
 */

import { BenchmarkRunner } from './runner.js';
import type { BenchmarkConfig } from './types.js';

async function main() {
  console.log('🚀 NextRush v2 Benchmark Demo');
  console.log('================================\n');

  const config: BenchmarkConfig = {
    framework: 'nextrush',
    scenario: 'all',
    duration: 10, // 10 seconds for demo
    concurrent: 10, // 10 connections for demo
    requests: 1000,
    profile: false,
    memory: false,
    cpu: false,
    output: 'json',
  };

  try {
    const runner = new BenchmarkRunner(config);
    const results = await runner.run();

    console.log('\n📊 Results:');
    console.log('===========');

    for (const result of results.results) {
      console.log(`\n🏆 ${result.framework} v${result.version}`);
      console.log(
        `   Requests/sec: ${result.summary.requests.average.toFixed(2)}`
      );
      console.log(
        `   Latency (ms): ${result.summary.latency.average.toFixed(2)}`
      );
      console.log(
        `   Throughput: ${result.summary.throughput.average.toFixed(2)} MB/s`
      );
      console.log(`   Errors: ${result.summary.errors}`);
      console.log(`   Timeouts: ${result.summary.timeouts}`);
    }

    console.log('\n🏆 Winner:', results.summary.winner.framework);
    console.log('✅ Demo completed successfully!');
  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);
