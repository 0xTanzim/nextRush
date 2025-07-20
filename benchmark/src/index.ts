#!/usr/bin/env node

/**
 * 🚀 NextRush Modular Benchmark Suite v3.0
 *
 * Main entry point for the benchmark system
 */

import { BenchmarkEngine } from './core/engine.js';
import { log } from './utils/logger.js';

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
🚀 NextRush Modular Benchmark Suite v3.0

Usage:
  node src/index.js [frameworks...]     Run benchmarks for specific frameworks
  node src/index.js                     Run benchmarks for all available frameworks
  node src/index.js --list              List available frameworks
  node src/index.js --help              Show this help

Examples:
  node src/index.js nextrush express    Compare NextRush vs Express
  node src/index.js fastify             Benchmark only Fastify
  node src/index.js --list              See all supported frameworks

Supported Frameworks:
  nextrush    - NextRush (built-in, zero dependencies)
  express     - Express.js (pnpm add express)
  fastify     - Fastify (pnpm add fastify)
  koa         - Koa.js (pnpm add koa @koa/router koa-bodyparser)
  hapi        - Hapi.js (pnpm add @hapi/hapi)

Output:
  Results are saved to ./results/ folder in JSON, Markdown, and CSV formats.

Environment Variables:
  BENCHMARK_WARMUP=100      Number of warmup requests (default: 100)
  BENCHMARK_TIMEOUT=30000   Request timeout in ms (default: 30000)
  BENCHMARK_CONCURRENCY=50  Max concurrency level (default: 50)
`);
}

/**
 * List available frameworks
 */
async function listFrameworks(): Promise<void> {
  const { autoRegisterAdapters, getAvailableAdapters, createAdapter } =
    await import('./adapters/registry.js');

  log.header('Available Frameworks');

  await autoRegisterAdapters();
  const available = await getAvailableAdapters();

  if (available.length === 0) {
    log.warning('No frameworks are currently available.');
    log.info(
      'Install frameworks with: pnpm install express fastify koa @koa/router koa-bodyparser @hapi/hapi'
    );
    return;
  }

  for (const name of available) {
    const adapter = await createAdapter(name);
    if (adapter) {
      const info = await adapter.getInfo();
      console.log(`  ✅ ${info.name} v${info.version}`);
      console.log(`     Features: ${info.features.join(', ')}`);
      console.log();
      await adapter.cleanup();
    }
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Handle command line arguments
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  if (args.includes('--list') || args.includes('-l')) {
    await listFrameworks();
    return;
  }

  // Create benchmark engine with environment configuration
  const config = {
    warmupRequests: parseInt(process.env.BENCHMARK_WARMUP || '100'),
    defaultTimeout: parseInt(process.env.BENCHMARK_TIMEOUT || '30000'),
    maxConcurrency: parseInt(process.env.BENCHMARK_CONCURRENCY || '50'),
  };

  const engine = new BenchmarkEngine(config);

  // Handle cleanup
  const cleanup = async () => {
    log.info('Cleaning up...');
    await engine.cleanup();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  try {
    // Filter valid framework arguments
    const frameworkArgs = args.filter((arg) => !arg.startsWith('--'));
    const frameworks = frameworkArgs.length > 0 ? frameworkArgs : undefined;

    // Run benchmarks
    const results = await engine.runBenchmarks(frameworks);

    if (results.length === 0) {
      log.error('No benchmark results generated!');
      process.exit(1);
    }

    // Generate reports
    const { ReportGenerator } = await import('./reporters/index.js');
    const reporter = new ReportGenerator();
    await reporter.generateReports(results);

    log.success(`Benchmark completed! ${results.length} tests executed.`);
    log.info('Reports saved to ./results/ folder');
  } catch (error) {
    log.error(`Benchmark failed: ${error}`);
    process.exit(1);
  } finally {
    await cleanup();
  }
}

// Run if called directly (handle both CommonJS and ES modules)
const isMainModule = () => {
  // For ES modules
  if (typeof import.meta !== 'undefined' && import.meta.url) {
    return import.meta.url === `file://${process.argv[1]}`;
  }
  // For CommonJS (fallback)
  return typeof require !== 'undefined' && require.main === module;
};

if (isMainModule()) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { BenchmarkEngine } from './core/engine.js';
export { FrameworkAdapter } from './core/types.js';
