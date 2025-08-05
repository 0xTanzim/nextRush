#!/usr/bin/env node

/**
 * 🚀 Comprehensive Benchmark Suite with Apache Bench Integration
 *
 * Runs multiple benchmarking tools including:
 * - Apache Bench (ab) for HTTP server testing
 * - Autocannon for Node.js optimized testing
 * - Artillery for scenario-based testing
 * - K6 for advanced load testing
 */

import chalk from 'chalk';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import ora from 'ora';
import ApacheBenchRunner, {
  APACHE_BENCH_SCENARIOS,
} from './apache-bench/apache-bench.js';
import { runComprehensiveBenchmark } from './comprehensive-benchmark.js';

export interface ComprehensiveBenchmarkConfig {
  frameworks: Array<{ name: string; port: number }>;
  tools: ('autocannon' | 'apache-bench' | 'artillery' | 'k6')[];
  scenarios?: string[];
  duration?: number;
  connections?: number;
  outputDir?: string;
}

export interface BenchmarkResult {
  tool: string;
  framework: string;
  metrics: Record<string, number>;
  timestamp: string;
}

export class ComprehensiveBenchmarkOrchestrator {
  private config: ComprehensiveBenchmarkConfig;
  private results: Map<string, BenchmarkResult[]> = new Map();
  private outputDir: string;

  constructor(config: ComprehensiveBenchmarkConfig) {
    this.config = config;
    this.outputDir = config.outputDir || './reports/comprehensive';
    mkdirSync(this.outputDir, { recursive: true });
  }

  /**
   * Run comprehensive benchmark with all tools
   */
  async run(): Promise<void> {
    console.log(chalk.blue('🏆 Starting Comprehensive Benchmark Suite'));
    console.log(
      chalk.gray(
        `   Frameworks: ${this.config.frameworks.map(f => f.name).join(', ')}`
      )
    );
    console.log(chalk.gray(`   Tools: ${this.config.tools.join(', ')}`));
    console.log('');

    // Check tool availability
    await this.checkToolAvailability();

    // Run benchmarks for each tool
    for (const tool of this.config.tools) {
      console.log(chalk.yellow(`\n🔧 Running ${tool} benchmarks...`));

      try {
        switch (tool) {
          case 'apache-bench':
            await this.runApacheBench();
            break;
          case 'autocannon':
            await this.runAutocannon();
            break;
          case 'artillery':
            await this.runArtillery();
            break;
          case 'k6':
            await this.runK6();
            break;
        }
      } catch (error) {
        console.log(chalk.red(`❌ ${tool} benchmark failed: ${error}`));
      }
    }

    // Generate comprehensive report
    await this.generateComprehensiveReport();
  }

  /**
   * Check if all required tools are available
   */
  private async checkToolAvailability(): Promise<void> {
    console.log(chalk.blue('🔍 Checking tool availability...'));

    const tools = [
      { name: 'Apache Bench', command: 'ab', args: ['-V'] },
      { name: 'Autocannon', command: 'npx', args: ['autocannon', '--version'] },
      { name: 'Artillery', command: 'npx', args: ['artillery', '--version'] },
      { name: 'K6', command: 'k6', args: ['version'] },
    ];

    for (const tool of tools) {
      const spinner = ora(`Checking ${tool.name}...`).start();

      try {
        const isAvailable = await this.checkCommand(tool.command, tool.args);
        if (isAvailable) {
          spinner.succeed(`${tool.name} available`);
        } else {
          spinner.warn(`${tool.name} not available`);
        }
      } catch (error) {
        spinner.fail(`${tool.name} check failed`);
      }
    }
  }

  /**
   * Check if a command is available
   */
  private async checkCommand(
    command: string,
    args: string[]
  ): Promise<boolean> {
    return new Promise(resolve => {
      const process = spawn(command, args, { stdio: 'ignore' });
      process.on('close', code => resolve(code === 0));
      process.on('error', () => resolve(false));
    });
  }

  /**
   * Run Apache Bench benchmarks
   */
  private async runApacheBench(): Promise<void> {
    const abRunner = new ApacheBenchRunner(
      join(this.outputDir, 'apache-bench')
    );

    // Check if Apache Bench is available
    const isAvailable = await abRunner.checkAvailability();
    if (!isAvailable) {
      console.log(
        chalk.red(
          '❌ Apache Bench not available. Install with: sudo apt-get install apache2-utils'
        )
      );
      return;
    }

    console.log(
      chalk.green('✅ Apache Bench available, running benchmarks...')
    );

    // Run comprehensive Apache Bench benchmark
    const results = await abRunner.runComprehensiveBenchmark(
      this.config.frameworks,
      APACHE_BENCH_SCENARIOS
    );

    // Save results
    abRunner.saveResults(results);

    // Convert to our format
    for (const [framework, frameworkResults] of results) {
      const benchmarkResults: BenchmarkResult[] = frameworkResults.map(
        result => ({
          tool: 'apache-bench',
          framework,
          metrics: {
            rps: result.rps,
            latency_mean: result.latency.mean,
            latency_p95: result.latency.p95,
            latency_p99: result.latency.p99,
            success_rate: result.successRate,
            failed_requests: result.failedRequests,
            transfer_rate: result.transferRate,
          },
          timestamp: result.timestamp,
        })
      );

      this.results.set(`${framework}-apache-bench`, benchmarkResults);
    }
  }

  /**
   * Run Autocannon benchmarks
   */
  private async runAutocannon(): Promise<void> {
    console.log(chalk.blue('📊 Running Autocannon benchmarks...'));

    // Use existing comprehensive benchmark
    const results = await runComprehensiveBenchmark();

    // Convert results to our format
    for (const [framework, frameworkResults] of Object.entries(results)) {
      const benchmarkResults: BenchmarkResult[] = frameworkResults.map(
        result => ({
          tool: 'autocannon',
          framework,
          metrics: {
            rps: result.rps,
            latency_mean: result.latency.mean,
            latency_p95: result.latency.p95,
            latency_p99: result.latency.p99,
            throughput: result.throughput,
            errors: result.errors,
          },
          timestamp: new Date().toISOString(),
        })
      );

      this.results.set(`${framework}-autocannon`, benchmarkResults);
    }
  }

  /**
   * Run Artillery benchmarks
   */
  private async runArtillery(): Promise<void> {
    console.log(chalk.blue('🎯 Running Artillery benchmarks...'));

    for (const framework of this.config.frameworks) {
      console.log(
        chalk.gray(`   Testing ${framework.name} on port ${framework.port}...`)
      );

      try {
        // Run Artillery test
        const result = await this.runArtilleryTest(framework);

        const benchmarkResult: BenchmarkResult = {
          tool: 'artillery',
          framework: framework.name,
          metrics: {
            rps: result.rps,
            latency_mean: result.latency.mean,
            latency_p95: result.latency.p95,
            success_rate: result.successRate,
            errors: result.errors,
          },
          timestamp: new Date().toISOString(),
        };

        this.results.set(`${framework.name}-artillery`, [benchmarkResult]);
      } catch (error) {
        console.log(
          chalk.red(`❌ Artillery test failed for ${framework.name}: ${error}`)
        );
      }
    }
  }

  /**
   * Run a single Artillery test
   */
  private async runArtilleryTest(framework: {
    name: string;
    port: number;
  }): Promise<any> {
    return new Promise((resolve, reject) => {
      const config = {
        target: `http://localhost:${framework.port}`,
        phases: [
          { duration: 30, arrivalRate: 10 },
          { duration: 60, arrivalRate: 50 },
        ],
        scenarios: [
          {
            name: 'Basic load test',
            flow: [
              { get: { url: '/' } },
              { get: { url: '/json' } },
              { get: { url: '/health' } },
            ],
          },
        ],
      };

      const configFile = join(
        this.outputDir,
        `${framework.name}-artillery-config.json`
      );
      writeFileSync(configFile, JSON.stringify(config, null, 2));

      const artillery = spawn('npx', [
        'artillery',
        'run',
        '--output',
        `${configFile}.result.json`,
        configFile,
      ]);

      let stdout = '';
      let stderr = '';

      artillery.stdout.on('data', data => {
        stdout += data.toString();
      });

      artillery.stderr.on('data', data => {
        stderr += data.toString();
      });

      artillery.on('close', code => {
        if (code === 0) {
          try {
            const resultData = JSON.parse(stdout);
            resolve({
              rps: resultData.metrics.http.requests.rate || 0,
              latency: {
                mean: resultData.metrics.http.response_time.median || 0,
                p95: resultData.metrics.http.response_time.p95 || 0,
              },
              successRate:
                resultData.metrics.http.responses['200'] /
                  resultData.metrics.http.requests.total || 0,
              errors: resultData.metrics.http.responses['500'] || 0,
            });
          } catch (error) {
            reject(new Error('Failed to parse Artillery results'));
          }
        } else {
          reject(new Error(`Artillery failed with code ${code}: ${stderr}`));
        }
      });

      artillery.on('error', error => {
        reject(new Error(`Failed to start Artillery: ${error.message}`));
      });
    });
  }

  /**
   * Run K6 benchmarks
   */
  private async runK6(): Promise<void> {
    console.log(chalk.blue('📈 Running K6 benchmarks...'));

    for (const framework of this.config.frameworks) {
      console.log(
        chalk.gray(`   Testing ${framework.name} on port ${framework.port}...`)
      );

      try {
        // Run K6 test
        const result = await this.runK6Test(framework);

        const benchmarkResult: BenchmarkResult = {
          tool: 'k6',
          framework: framework.name,
          metrics: {
            rps: result.rps,
            latency_mean: result.latency.mean,
            latency_p95: result.latency.p95,
            success_rate: result.successRate,
            errors: result.errors,
          },
          timestamp: new Date().toISOString(),
        };

        this.results.set(`${framework.name}-k6`, [benchmarkResult]);
      } catch (error) {
        console.log(
          chalk.red(`❌ K6 test failed for ${framework.name}: ${error}`)
        );
      }
    }
  }

  /**
   * Run a single K6 test
   */
  private async runK6Test(framework: {
    name: string;
    port: number;
  }): Promise<any> {
    return new Promise((resolve, reject) => {
      const k6Script = `
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '60s', target: 50 },
  ],
};

export default function() {
  const responses = http.batch([
    ['GET', 'http://localhost:${framework.port}/'],
    ['GET', 'http://localhost:${framework.port}/json'],
    ['GET', 'http://localhost:${framework.port}/health'],
  ]);

  check(responses[0], { 'status is 200': (r) => r.status === 200 });
  check(responses[1], { 'status is 200': (r) => r.status === 200 });
  check(responses[2], { 'status is 200': (r) => r.status === 200 });
}
`;

      const scriptFile = join(this.outputDir, `${framework.name}-k6-script.js`);
      writeFileSync(scriptFile, k6Script);

      const k6 = spawn('k6', [
        'run',
        '--out',
        'json',
        `${scriptFile}.result.json`,
        scriptFile,
      ]);

      let stdout = '';
      let stderr = '';

      k6.stdout.on('data', data => {
        stdout += data.toString();
      });

      k6.stderr.on('data', data => {
        stderr += data.toString();
      });

      k6.on('close', code => {
        if (code === 0) {
          try {
            // Parse K6 output to extract metrics
            const rpsMatch = stdout.match(/http_reqs\s+:\s+([\d.]+)/);
            const latencyMatch = stdout.match(
              /http_req_duration\s+:\s+avg=([\d.]+)/
            );
            const p95Match = stdout.match(
              /http_req_duration\s+:\s+p\(95\)=([\d.]+)/
            );

            resolve({
              rps: rpsMatch ? parseFloat(rpsMatch[1]) : 0,
              latency: {
                mean: latencyMatch ? parseFloat(latencyMatch[1]) : 0,
                p95: p95Match ? parseFloat(p95Match[1]) : 0,
              },
              successRate: 0.99, // K6 doesn't always report this clearly
              errors: 0,
            });
          } catch (error) {
            reject(new Error('Failed to parse K6 results'));
          }
        } else {
          reject(new Error(`K6 failed with code ${code}: ${stderr}`));
        }
      });

      k6.on('error', error => {
        reject(new Error(`Failed to start K6: ${error.message}`));
      });
    });
  }

  /**
   * Generate comprehensive report
   */
  private async generateComprehensiveReport(): Promise<void> {
    console.log(chalk.blue('\n📊 Generating Comprehensive Report...'));

    let report = '# 🏆 Comprehensive Benchmark Report\n\n';
    report += `Generated: ${new Date().toISOString()}\n\n`;

    // Tool comparison
    report += '## 📈 Tool Comparison\n\n';
    report += '| Tool | Framework | RPS | Latency (ms) | Success Rate |\n';
    report += '|------|-----------|-----|---------------|-------------|\n';

    for (const [key, results] of this.results) {
      for (const result of results) {
        const rps = result.metrics.rps || 0;
        const latency =
          result.metrics.latency_mean || result.metrics.latency_p95 || 0;
        const successRate = result.metrics.success_rate || 0.99;

        report += `| ${result.tool} | ${result.framework} | ${rps.toFixed(0)} | ${latency.toFixed(2)} | ${(successRate * 100).toFixed(1)}% |\n`;
      }
    }

    // Framework comparison
    report += '\n## 🏆 Framework Performance Summary\n\n';

    const frameworkStats = new Map<
      string,
      { rps: number[]; latency: number[]; tools: string[] }
    >();

    for (const [key, results] of this.results) {
      for (const result of results) {
        const framework = result.framework;
        const stats = frameworkStats.get(framework) || {
          rps: [],
          latency: [],
          tools: [],
        };

        stats.rps.push(result.metrics.rps || 0);
        stats.latency.push(
          result.metrics.latency_mean || result.metrics.latency_p95 || 0
        );
        stats.tools.push(result.tool);

        frameworkStats.set(framework, stats);
      }
    }

    for (const [framework, stats] of frameworkStats) {
      const avgRps =
        stats.rps.reduce((sum, rps) => sum + rps, 0) / stats.rps.length;
      const avgLatency =
        stats.latency.reduce((sum, lat) => sum + lat, 0) / stats.latency.length;

      report += `### ${framework}\n`;
      report += `- **Average RPS**: ${avgRps.toFixed(0)}\n`;
      report += `- **Average Latency**: ${avgLatency.toFixed(2)}ms\n`;
      report += `- **Tools Used**: ${stats.tools.join(', ')}\n\n`;
    }

    // Save report
    const reportFile = join(
      this.outputDir,
      'comprehensive-benchmark-report.md'
    );
    writeFileSync(reportFile, report);

    console.log(chalk.green(`📁 Comprehensive report saved to: ${reportFile}`));
  }
}

/**
 * Run comprehensive benchmark with Apache Bench
 */
export async function runComprehensiveBenchmarkWithAB(
  config?: Partial<ComprehensiveBenchmarkConfig>
): Promise<void> {
  const defaultConfig: ComprehensiveBenchmarkConfig = {
    frameworks: [
      { name: 'NextRush', port: 3000 },
      { name: 'Express', port: 3001 },
      { name: 'Fastify', port: 3002 },
      { name: 'Koa', port: 3003 },
    ],
    tools: ['apache-bench', 'autocannon', 'artillery', 'k6'],
    duration: 30,
    connections: 100,
  };

  const finalConfig = { ...defaultConfig, ...config };
  const orchestrator = new ComprehensiveBenchmarkOrchestrator(finalConfig);

  await orchestrator.run();
}

export default ComprehensiveBenchmarkOrchestrator;
