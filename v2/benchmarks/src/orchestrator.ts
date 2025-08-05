#!/usr/bin/env node

/**
 * 🚀 NextRush v2 Benchmark Orchestrator
 *
 * Comprehensive benchmarking suite with multiple tools:
 * - Autocannon (Node.js optimized)
 * - Apache Bench (ab) for HTTP server testing
 * - Artillery for scenario-based testing
 * - K6 for advanced load testing
 */

import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import ApacheBenchRunner, {
  APACHE_BENCH_SCENARIOS,
} from './apache-bench/apache-bench.js';
import { runComprehensiveBenchmarkWithAB } from './comprehensive-benchmark-with-ab.js';
import { runComprehensiveBenchmark } from './comprehensive-benchmark.js';
import { runFairBenchmark } from './fair-benchmark.js';
import { runMinimalBenchmark } from './minimal-benchmark.js';

const program = new Command();

program
  .name('nextrush-benchmark')
  .description('🚀 NextRush v2 Comprehensive Benchmarking Suite')
  .version('2.0.0');

// Apache Bench command
program
  .command('apache-bench')
  .description('Run Apache Bench (ab) benchmarks')
  .option(
    '-f, --frameworks <frameworks>',
    'Comma-separated list of frameworks to test',
    'nextrush,express,fastify,koa'
  )
  .option(
    '-s, --scenarios <scenarios>',
    'Comma-separated list of scenarios to run',
    'basic-load,high-concurrency,json-endpoint'
  )
  .option(
    '-o, --output <dir>',
    'Output directory for results',
    './reports/apache-bench'
  )
  .action(async options => {
    const spinner = ora('Running Apache Bench benchmarks...').start();
    try {
      const frameworks = options.frameworks
        .split(',')
        .map((name: string, index: number) => ({
          name: name.trim(),
          port: 3000 + index,
        }));

      const abRunner = new ApacheBenchRunner(options.output);

      // Check availability
      const isAvailable = await abRunner.checkAvailability();
      if (!isAvailable) {
        spinner.fail(
          chalk.red(
            'Apache Bench not available. Install with: ./scripts/install-apache-bench.sh'
          )
        );
        process.exit(1);
      }

      spinner.stop();
      console.log(chalk.blue('\n🚀 Apache Bench Benchmark Suite'));
      console.log(chalk.blue('=============================='));
      console.log('');

      // Run benchmarks
      const results = await abRunner.runComprehensiveBenchmark(
        frameworks,
        APACHE_BENCH_SCENARIOS
      );

      // Save results
      abRunner.saveResults(results);

      console.log(chalk.green('\n✅ Apache Bench benchmarks completed!'));
      console.log(chalk.blue(`📁 Results saved to: ${options.output}`));
    } catch (error: any) {
      spinner.fail(
        chalk.red(`Apache Bench benchmark failed: ${error.message}`)
      );
      process.exit(1);
    }
  });

// Comprehensive benchmark with Apache Bench
program
  .command('comprehensive-with-ab')
  .description('Run comprehensive benchmark with Apache Bench integration')
  .option(
    '-t, --tools <tools>',
    'Comma-separated list of tools to use',
    'apache-bench,autocannon,artillery,k6'
  )
  .option(
    '-f, --frameworks <frameworks>',
    'Comma-separated list of frameworks to test',
    'nextrush,express,fastify,koa'
  )
  .option(
    '-o, --output <dir>',
    'Output directory for results',
    './reports/comprehensive'
  )
  .action(async options => {
    const spinner = ora(
      'Running comprehensive benchmark with Apache Bench...'
    ).start();
    try {
      const tools = options.tools
        .split(',')
        .map((tool: string) => tool.trim()) as any[];
      const frameworks = options.frameworks
        .split(',')
        .map((name: string, index: number) => ({
          name: name.trim(),
          port: 3000 + index,
        }));

      spinner.stop();

      await runComprehensiveBenchmarkWithAB({
        frameworks,
        tools,
        outputDir: options.output,
      });

      console.log(
        chalk.green('\n✅ Comprehensive benchmark with Apache Bench completed!')
      );
      console.log(chalk.blue(`📁 Results saved to: ${options.output}`));
    } catch (error: any) {
      spinner.fail(
        chalk.red(`Comprehensive benchmark failed: ${error.message}`)
      );
      process.exit(1);
    }
  });

// Minimal benchmark
program
  .command('minimal')
  .description('Run minimal benchmark comparing all frameworks')
  .action(async () => {
    const spinner = ora('Running minimal benchmark...').start();
    try {
      console.log(chalk.blue('\n🏆 Minimal Framework Benchmark'));
      console.log(chalk.blue('============================='));
      console.log('');
      spinner.stop();
      await runMinimalBenchmark();
      console.log(
        chalk.green('\n✅ Minimal benchmark completed successfully!')
      );
    } catch (error: any) {
      spinner.fail(chalk.red(`Minimal benchmark failed: ${error.message}`));
      process.exit(1);
    }
  });

// Fair benchmark
program
  .command('fair')
  .description('Run fair benchmark comparing all frameworks')
  .action(async () => {
    const spinner = ora('Running fair benchmark...').start();
    try {
      console.log(chalk.blue('\n⚖️ Fair Framework Benchmark'));
      console.log(chalk.blue('=========================='));
      console.log('');
      spinner.stop();
      await runFairBenchmark();
      console.log(chalk.green('\n✅ Fair benchmark completed successfully!'));
    } catch (error: any) {
      spinner.fail(chalk.red(`Fair benchmark failed: ${error.message}`));
      process.exit(1);
    }
  });

// Comprehensive benchmark
program
  .command('comprehensive')
  .description('Run comprehensive benchmark with all tools')
  .action(async () => {
    const spinner = ora('Running comprehensive benchmark...').start();
    try {
      console.log(chalk.blue('\n🏆 Comprehensive Framework Benchmark'));
      console.log(chalk.blue('===================================='));
      console.log('');
      spinner.stop();
      await runComprehensiveBenchmark();
      console.log(
        chalk.green('\n✅ Comprehensive benchmark completed successfully!')
      );
    } catch (error: any) {
      spinner.fail(
        chalk.red(`Comprehensive benchmark failed: ${error.message}`)
      );
      process.exit(1);
    }
  });

// Quick benchmark
program
  .command('quick')
  .description('Run quick benchmark for NextRush only')
  .action(async () => {
    const spinner = ora('Running quick benchmark...').start();
    try {
      console.log(chalk.blue('\n⚡ Quick NextRush Benchmark'));
      console.log(chalk.blue('==========================='));
      console.log('');
      spinner.stop();

      // Import and run quick benchmark
      const { runQuickBenchmark } = await import('./quick-benchmark.js');
      await runQuickBenchmark();

      console.log(chalk.green('\n✅ Quick benchmark completed successfully!'));
    } catch (error: any) {
      spinner.fail(chalk.red(`Quick benchmark failed: ${error.message}`));
      process.exit(1);
    }
  });

// Stress test
program
  .command('stress')
  .description('Run stress test with high load')
  .option('-d, --duration <seconds>', 'Test duration in seconds', '60')
  .option(
    '-c, --connections <count>',
    'Number of concurrent connections',
    '500'
  )
  .action(async options => {
    const spinner = ora('Running stress test...').start();
    try {
      console.log(chalk.blue('\n🔥 Stress Test'));
      console.log(chalk.blue('=============='));
      console.log('');
      spinner.stop();

      // Import and run stress test
      const { runStressTest } = await import('./stress-test.js');
      await runStressTest({
        duration: parseInt(options.duration),
        connections: parseInt(options.connections),
      });

      console.log(chalk.green('\n✅ Stress test completed successfully!'));
    } catch (error: any) {
      spinner.fail(chalk.red(`Stress test failed: ${error.message}`));
      process.exit(1);
    }
  });

// Install tools
program
  .command('install-tools')
  .description('Install Apache Bench and other benchmarking tools')
  .action(async () => {
    console.log(chalk.blue('🔧 Installing benchmarking tools...'));
    console.log(
      chalk.yellow('💡 This will install Apache Bench, Artillery, K6, and wrk')
    );
    console.log('');

    const { spawn } = await import('node:child_process');
    const { execSync } = await import('node:child_process');

    try {
      // Run the installation script
      execSync('chmod +x scripts/install-apache-bench.sh', {
        stdio: 'inherit',
      });
      execSync('./scripts/install-apache-bench.sh', { stdio: 'inherit' });

      console.log(chalk.green('\n✅ Tools installation completed!'));
    } catch (error: any) {
      console.log(chalk.red(`❌ Tools installation failed: ${error.message}`));
      process.exit(1);
    }
  });

// Info command
program
  .command('info')
  .description('Show benchmark information')
  .action(() => {
    console.log(chalk.blue('🚀 NextRush v2 Benchmark Suite'));
    console.log(chalk.blue('================================'));
    console.log('');
    console.log(chalk.yellow('Available Commands:'));
    console.log(
      '  minimal              - Run minimal benchmark comparing all frameworks'
    );
    console.log(
      '  fair                 - Run fair benchmark comparing all frameworks'
    );
    console.log(
      '  comprehensive        - Run comprehensive benchmark with all tools'
    );
    console.log(
      '  apache-bench         - Run Apache Bench (ab) benchmarks only'
    );
    console.log(
      '  comprehensive-with-ab - Run comprehensive benchmark with Apache Bench integration'
    );
    console.log(
      '  quick                - Run quick benchmark for NextRush only'
    );
    console.log('  stress               - Run stress test with high load');
    console.log(
      '  install-tools        - Install Apache Bench and other tools'
    );
    console.log('');
    console.log(chalk.yellow('Available Tools:'));
    console.log('  📊 Autocannon        - Node.js optimized HTTP benchmarking');
    console.log(
      '  🔥 Apache Bench (ab) - Industry standard HTTP server testing'
    );
    console.log('  🎯 Artillery         - Scenario-based load testing');
    console.log(
      '  📈 K6                - Advanced load testing with JavaScript'
    );
    console.log('  ⚡ wrk               - High-performance HTTP benchmarking');
    console.log('');
    console.log(chalk.yellow('Frameworks Tested:'));
    console.log('  🚀 NextRush v2       - Your high-performance framework');
    console.log('  🟢 Express           - Industry standard comparison');
    console.log('  ⚡ Fastify           - Performance-focused alternative');
    console.log('  🎋 Koa               - Lightweight middleware framework');
    console.log('');
    console.log(chalk.blue('📚 Documentation:'));
    console.log(
      '  Apache Bench: https://httpd.apache.org/docs/2.4/programs/ab.html'
    );
    console.log('  Autocannon: https://github.com/mcollina/autocannon');
    console.log('  Artillery: https://www.artillery.io/docs');
    console.log('  K6: https://k6.io/docs');
    console.log('');
  });

// Clean command
program
  .command('clean')
  .description('Clean benchmark results and reports')
  .action(async () => {
    const spinner = ora('Cleaning benchmark results...').start();
    try {
      const { rmSync } = await import('node:fs');
      const { join } = await import('node:path');

      // Remove reports directory
      rmSync(join(process.cwd(), 'reports'), { recursive: true, force: true });

      spinner.succeed(chalk.green('Benchmark results cleaned successfully!'));
    } catch (error: any) {
      spinner.fail(chalk.red(`Clean failed: ${error.message}`));
    }
  });

// Default command (run comprehensive)
program
  .command('run')
  .description('Run comprehensive benchmark (default)')
  .action(async () => {
    const spinner = ora('Running comprehensive benchmark...').start();
    try {
      console.log(chalk.blue('\n🏆 NextRush v2 Comprehensive Benchmark'));
      console.log(chalk.blue('========================================'));
      console.log('');
      spinner.stop();
      await runComprehensiveBenchmark();
      console.log(
        chalk.green('\n✅ Comprehensive benchmark completed successfully!')
      );
    } catch (error: any) {
      spinner.fail(
        chalk.red(`Comprehensive benchmark failed: ${error.message}`)
      );
      process.exit(1);
    }
  });

program.parse();
