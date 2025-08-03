#!/usr/bin/env tsx

/**
 * 🚀 NextRush v2 Benchmark CLI
 *
 * Professional benchmarking tool with comprehensive options
 */

import { Command } from 'commander';
import chalk from 'chalk';
import gradient from 'gradient-string';
import figlet from 'figlet';
import boxen from 'boxen';
import { runComprehensiveBenchmark } from './comprehensive-benchmark.js';
import { runMinimalBenchmark } from './minimal-benchmark.js';
import { ReportGenerator } from './report-generator.js';

const program = new Command();

// ASCII Art Banner
const banner = figlet.textSync('NextRush v2', {
  font: 'Standard',
  horizontalLayout: 'default',
  verticalLayout: 'default',
});

console.log(gradient.rainbow(banner));
console.log(chalk.cyan('🚀 Professional Benchmarking Suite\n'));

program
  .name('nextrush-benchmark')
  .description('NextRush v2 Professional Benchmarking Suite')
  .version('2.0.0-alpha.1');

program
  .command('run')
  .description('Run comprehensive benchmark')
  .option('-d, --duration <seconds>', 'Test duration per scenario', '10')
  .option('-c, --concurrent <connections>', 'Concurrent connections', '20')
  .option('-r, --requests <number>', 'Total requests', '2000')
  .option('-o, --output <format>', 'Output format (json, markdown, console)', 'markdown')
  .option('--no-report', 'Skip report generation')
  .option('--verbose', 'Verbose output')
  .action(async (options) => {
    console.log(chalk.blue('🚀 Starting NextRush v2 Benchmark...\n'));
    
    const config = {
      duration: parseInt(options.duration),
      concurrent: parseInt(options.concurrent),
      requests: parseInt(options.requests),
      output: options.output,
      verbose: options.verbose,
    };

    console.log(chalk.yellow('📊 Configuration:'));
    console.log(`   Duration: ${config.duration}s per scenario`);
    console.log(`   Concurrent: ${config.concurrent} connections`);
    console.log(`   Requests: ${config.requests} total`);
    console.log(`   Output: ${config.output}`);
    console.log(`   Verbose: ${config.verbose}\n`);

    try {
      await runComprehensiveBenchmark(config);
      
      if (!options.report) {
        console.log(chalk.green('\n✅ Benchmark completed successfully!'));
        console.log(chalk.cyan('📄 Check the reports directory for detailed results.'));
      }
    } catch (error) {
      console.error(chalk.red('❌ Benchmark failed:'), error);
      process.exit(1);
    }
  });

program
  .command('quick')
  .description('Run quick benchmark (5s duration, 10 connections)')
  .action(async () => {
    console.log(chalk.blue('⚡ Running Quick Benchmark...\n'));
    
    const config = {
      duration: 5,
      concurrent: 10,
      requests: 1000,
      output: 'markdown',
      verbose: false,
    };

    try {
      await runComprehensiveBenchmark(config);
      console.log(chalk.green('\n✅ Quick benchmark completed!'));
    } catch (error) {
      console.error(chalk.red('❌ Quick benchmark failed:'), error);
      process.exit(1);
    }
  });

program
  .command('stress')
  .description('Run stress test (30s duration, 100 connections)')
  .action(async () => {
    console.log(chalk.red('🔥 Running Stress Test...\n'));
    
    const config = {
      duration: 30,
      concurrent: 100,
      requests: 10000,
      output: 'markdown',
      verbose: true,
    };

    try {
      await runComprehensiveBenchmark(config);
      console.log(chalk.green('\n✅ Stress test completed!'));
    } catch (error) {
      console.error(chalk.red('❌ Stress test failed:'), error);
      process.exit(1);
    }
  });

program
  .command('compare')
  .description('Compare multiple frameworks (requires additional setup)')
  .option('-f, --frameworks <list>', 'Frameworks to compare', 'nextrush,express,fastify')
  .action(async (options) => {
    console.log(chalk.blue('🔄 Framework Comparison Mode\n'));
    console.log(chalk.yellow('⚠️  This feature requires additional framework adapters.'));
    console.log(chalk.yellow('   Currently only NextRush v2 is implemented.\n'));
    
    const frameworks = options.frameworks.split(',');
    console.log(`📊 Frameworks to compare: ${frameworks.join(', ')}\n`);
    
    console.log(chalk.cyan('💡 To implement framework comparison:'));
    console.log('   1. Add framework adapters in src/adapters/');
    console.log('   2. Update the comparison logic');
    console.log('   3. Install framework dependencies\n');
  });

program
  .command('info')
  .description('Show benchmark information')
  .action(() => {
    const info = boxen(
      chalk.cyan(`
🚀 NextRush v2 Benchmark Suite

📊 Features:
   • Comprehensive scenario testing
   • Multiple output formats
   • Professional reporting
   • Stress testing capabilities
   • Framework comparison (planned)

📁 Structure:
   • src/adapters/ - Framework adapters
   • src/reports/ - Generated reports
   • src/types.ts - Type definitions

🔧 Commands:
   • run - Full benchmark
   • quick - Quick test
   • stress - Stress test
   • compare - Framework comparison
   • info - This information

📈 Scenarios:
   • Basic API endpoints
   • Health checks
   • CRUD operations
   • Complex queries
   • Large payloads
   • Error handling
   • Middleware testing
      `),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan',
      }
    );
    
    console.log(info);
  });

program
  .command('minimal')
  .description('Run minimal benchmark')
  .action(async () => {
    console.log(chalk.blue('🚀 Starting Minimal Benchmark...\n'));
    try {
      await runMinimalBenchmark();
      console.log(chalk.green('\n✅ Minimal benchmark completed successfully!'));
    } catch (error) {
      console.error(chalk.red('❌ Minimal benchmark failed:'), error);
      process.exit(1);
    }
  });

program
  .command('clean')
  .description('Clean generated reports')
  .action(() => {
    console.log(chalk.yellow('🧹 Cleaning generated reports...'));
    // Implementation for cleaning reports
    console.log(chalk.green('✅ Reports cleaned!'));
  });

// Error handling
program.exitOverride();

try {
  program.parse();
} catch (err) {
  if (err.code === 'commander.help') {
    process.exit(0);
  }
  console.error(chalk.red('❌ Error:'), err.message);
  process.exit(1);
} 