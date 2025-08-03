#!/usr/bin/env tsx

/**
 * 🚀 Benchmark Orchestrator
 *
 * CLI tool for running comprehensive framework benchmarks
 */

import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { runComprehensiveBenchmark } from './comprehensive-benchmark.js';
import { runFairBenchmark } from './fair-benchmark.js';
import { runMinimalBenchmark } from './minimal-benchmark.js';

const program = new Command();

program
  .name('benchmark')
  .description('NextRush v2 Benchmark Suite')
  .version('2.0.0');

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

program
  .command('fair')
  .description(
    'Run fair benchmark comparing all frameworks with identical conditions'
  )
  .option('-d, --duration <seconds>', 'Test duration in seconds', '10')
  .option(
    '-c, --connections <number>',
    'Number of concurrent connections',
    '100'
  )
  .option('-p, --pipelining <number>', 'HTTP pipelining', '1')
  .action(async options => {
    const spinner = ora('Running fair benchmark...').start();

    try {
      console.log(chalk.blue('\n🏆 Fair Framework Benchmark'));
      console.log(chalk.blue('=========================='));
      console.log(
        chalk.gray(
          `Duration: ${options.duration}s, Connections: ${options.connections}, Pipelining: ${options.pipelining}`
        )
      );
      console.log('');

      spinner.stop();
      const results = await runFairBenchmark();

      if (results && results.length > 0) {
        console.log(chalk.green('\n✅ Fair benchmark completed successfully!'));
      } else {
        console.log(chalk.red('\n❌ Fair benchmark failed'));
      }
    } catch (error: any) {
      spinner.fail(chalk.red(`Benchmark failed: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('run')
  .description('Run comprehensive benchmark for NextRush v2')
  .option('-d, --duration <seconds>', 'Test duration in seconds', '10')
  .option('-c, --concurrent <number>', 'Number of concurrent connections', '10')
  .action(async options => {
    const spinner = ora('Running comprehensive benchmark...').start();

    try {
      spinner.stop();
      await runComprehensiveBenchmark({
        duration: parseInt(options.duration),
        concurrent: parseInt(options.concurrent),
      });
      console.log(chalk.green('\n✅ Comprehensive benchmark completed!'));
    } catch (error: any) {
      spinner.fail(chalk.red(`Benchmark failed: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('quick')
  .description('Run quick benchmark for NextRush v2')
  .action(async () => {
    const spinner = ora('Running quick benchmark...').start();

    try {
      spinner.stop();
      await runComprehensiveBenchmark({
        duration: 5,
        concurrent: 10,
      });
      console.log(chalk.green('\n✅ Quick benchmark completed!'));
    } catch (error: any) {
      spinner.fail(chalk.red(`Benchmark failed: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('stress')
  .description('Run stress test for NextRush v2')
  .action(async () => {
    const spinner = ora('Running stress test...').start();

    try {
      spinner.stop();
      await runComprehensiveBenchmark({
        duration: 30,
        concurrent: 100,
      });
      console.log(chalk.green('\n✅ Stress test completed!'));
    } catch (error: any) {
      spinner.fail(chalk.red(`Stress test failed: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('info')
  .description('Show benchmark information')
  .action(() => {
    console.log(chalk.blue('\n📊 NextRush v2 Benchmark Suite'));
    console.log(chalk.blue('================================'));
    console.log('');
    console.log(chalk.yellow('Available Commands:'));
    console.log('  minimal - Run minimal benchmark comparing all frameworks');
    console.log('  fair    - Run fair benchmark comparing all frameworks');
    console.log('  run     - Run comprehensive benchmark for NextRush v2');
    console.log('  quick   - Run quick benchmark for NextRush v2');
    console.log('  stress  - Run stress test for NextRush v2');
    console.log('  clean   - Clean benchmark artifacts');
    console.log('');
    console.log(chalk.yellow('Examples:'));
    console.log('  pnpm benchmark fair');
    console.log('  pnpm benchmark run --duration 15 --concurrent 50');
    console.log('  pnpm benchmark quick');
    console.log('');
    console.log(chalk.gray('Reports are saved to ./reports/ directory'));
  });

program
  .command('clean')
  .description('Clean benchmark artifacts')
  .action(async () => {
    const spinner = ora('Cleaning benchmark artifacts...').start();

    try {
      // Clean reports directory (keep latest)
      const fs = await import('node:fs');
      const path = await import('node:path');

      const reportsDir = './reports';
      if (fs.existsSync(reportsDir)) {
        const files = fs.readdirSync(reportsDir);
        if (files.length > 5) {
          // Keep only the 5 most recent reports
          const sortedFiles = files
            .map(file => ({
              name: file,
              time: fs.statSync(path.join(reportsDir, file)).mtime.getTime(),
            }))
            .sort((a, b) => b.time - a.time)
            .slice(5);

          sortedFiles.forEach(file => {
            fs.unlinkSync(path.join(reportsDir, file.name));
          });
        }
      }
      spinner.succeed(chalk.green('Benchmark artifacts cleaned!'));
    } catch (error: any) {
      spinner.fail(chalk.red(`Failed to clean artifacts: ${error.message}`));
    }
  });

program.parse();
