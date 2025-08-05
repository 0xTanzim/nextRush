#!/usr/bin/env node

/**
 * 🚀 Apache Bench (ab) Benchmarking Module for NextRush v2
 *
 * Provides comprehensive HTTP server benchmarking using Apache Bench
 * with multiple test scenarios and detailed performance analysis
 */

import chalk from 'chalk';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface ApacheBenchConfig {
  url: string;
  requests: number;
  concurrency: number;
  timeout?: number;
  keepAlive?: boolean;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  data?: string;
  outputFile?: string;
}

export interface ApacheBenchResult {
  framework: string;
  url: string;
  requests: number;
  concurrency: number;
  rps: number;
  latency: {
    mean: number;
    median: number;
    p95: number;
    p99: number;
  };
  transferRate: number;
  failedRequests: number;
  successRate: number;
  duration: number;
  timestamp: string;
}

export interface ApacheBenchScenario {
  name: string;
  description: string;
  config: ApacheBenchConfig;
  weight?: number;
}

export class ApacheBenchRunner {
  private results: ApacheBenchResult[] = [];
  private outputDir: string;

  constructor(outputDir = './reports/apache-bench') {
    this.outputDir = outputDir;
    mkdirSync(this.outputDir, { recursive: true });
  }

  /**
   * Check if Apache Bench is available on the system
   */
  async checkAvailability(): Promise<boolean> {
    return new Promise(resolve => {
      const ab = spawn('ab', ['-V']);
      ab.on('close', code => {
        resolve(code === 0);
      });
      ab.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Run a single Apache Bench test
   */
  async runTest(
    framework: string,
    config: ApacheBenchConfig
  ): Promise<ApacheBenchResult> {
    console.log(chalk.blue(`🔍 Running Apache Bench test for ${framework}...`));
    console.log(chalk.gray(`   URL: ${config.url}`));
    console.log(
      chalk.gray(
        `   Requests: ${config.requests}, Concurrency: ${config.concurrency}`
      )
    );

    const args = this.buildAbArgs(config);

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const ab = spawn('ab', args);

      let stdout = '';
      let stderr = '';

      ab.stdout.on('data', data => {
        stdout += data.toString();
      });

      ab.stderr.on('data', data => {
        stderr += data.toString();
      });

      // Write POST data to stdin if provided
      if (config.method === 'POST' && config.data) {
        ab.stdin.write(config.data);
        ab.stdin.end();
      }

      ab.on('close', code => {
        const duration = Date.now() - startTime;

        if (code !== 0) {
          console.log(chalk.red(`❌ Apache Bench failed: ${stderr}`));
          reject(new Error(`Apache Bench failed with code ${code}: ${stderr}`));
          return;
        }

        try {
          const result = this.parseAbOutput(
            framework,
            config,
            stdout,
            duration
          );
          this.results.push(result);

          console.log(
            chalk.green(
              `✅ ${framework}: ${result.rps} RPS, ${result.latency.mean}ms avg`
            )
          );

          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      ab.on('error', error => {
        reject(new Error(`Failed to start Apache Bench: ${error.message}`));
      });
    });
  }

  /**
   * Run multiple scenarios for a framework
   */
  async runScenarios(
    framework: string,
    scenarios: ApacheBenchScenario[]
  ): Promise<ApacheBenchResult[]> {
    console.log(
      chalk.blue(`🚀 Running ${scenarios.length} scenarios for ${framework}...`)
    );

    const results: ApacheBenchResult[] = [];

    for (const scenario of scenarios) {
      try {
        const result = await this.runTest(framework, scenario.config);
        results.push(result);

        // Save individual scenario result
        const scenarioFile = join(
          this.outputDir,
          `${framework}-${scenario.name}.json`
        );
        writeFileSync(scenarioFile, JSON.stringify(result, null, 2));
      } catch (error) {
        console.log(chalk.red(`❌ Scenario ${scenario.name} failed: ${error}`));
      }
    }

    return results;
  }

  /**
   * Run comprehensive benchmark across multiple frameworks
   */
  async runComprehensiveBenchmark(
    frameworks: Array<{ name: string; port: number }>,
    scenarios: ApacheBenchScenario[]
  ): Promise<Map<string, ApacheBenchResult[]>> {
    console.log(chalk.blue('🏆 Starting Comprehensive Apache Bench Benchmark'));
    console.log(
      chalk.gray(`   Frameworks: ${frameworks.map(f => f.name).join(', ')}`)
    );
    console.log(chalk.gray(`   Scenarios: ${scenarios.length}`));
    console.log('');

    const allResults = new Map<string, ApacheBenchResult[]>();
    const servers: Array<{
      name: string;
      server: any;
      adapter: any;
      port: number;
    }> = [];

    try {
      // Start all framework servers
      console.log(chalk.blue('\n🚀 Starting framework servers...'));

      const { ExpressAdapter } = await import('./../adapters/express.js');
      const { FastifyAdapter } = await import('./../adapters/fastify.js');
      const { KoaAdapter } = await import('./../adapters/koa.js');

      const adapters = [
        { name: 'nextrush', adapter: null, port: 3000 },
        { name: 'express', adapter: new ExpressAdapter(), port: 3001 },
        { name: 'fastify', adapter: new FastifyAdapter(), port: 3002 },
        { name: 'koa', adapter: new KoaAdapter(), port: 3003 },
      ];

      for (const { name, adapter, port } of adapters) {
        if (adapter) {
          console.log(chalk.gray(`   Starting ${name}...`));
          const serverInfo = await adapter.setup();
          servers.push({
            name,
            server: serverInfo.server,
            adapter,
            port: serverInfo.port,
          });
        } else {
          // NextRush v2 - start with EQUIVALENT configuration
          console.log(chalk.gray(`   Starting ${name} on port ${port}...`));
          const { createApp } = await import('nextrush-v2');
          const app = createApp({
            port: port, // Use specific port for consistency
            host: 'localhost',
            trustProxy: true,
          });

          // Add EQUIVALENT middleware stack to match other frameworks
          app.use(app.cors());
          app.use(app.helmet());
          app.use(app.requestId());
          app.use(app.timer());
          app.use(app.compression());
          app.use(app.smartBodyParser());
          app.use(app.logger());
          // REMOVED: app.use(app.rateLimit()); // Rate limiting breaks benchmarks!

          // Add EQUIVALENT routes to match other frameworks
          app.get('/', ctx => {
            ctx.res.json({
              message: 'NextRush v2 API',
              version: '2.0.0-alpha.1',
              timestamp: Date.now(),
              uptime: process.uptime(),
            });
          });

          app.get('/api/health', ctx => {
            ctx.res.json({
              status: 'healthy',
              timestamp: Date.now(),
              memory: process.memoryUsage(),
              uptime: process.uptime(),
            });
          });

          app.get('/health', ctx => {
            ctx.res.json({ status: 'OK', timestamp: Date.now() });
          });

          // CRUD operations to match other frameworks
          const users = [
            { id: 1, name: 'John Doe', email: 'john@example.com' },
            { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
            { id: 3, name: 'Bob Johnson', email: 'bob@example.com' },
          ];

          app.get('/api/users', ctx => {
            ctx.res.json({
              users,
              total: users.length,
              page: 1,
              limit: 10,
            });
          });

          app.get('/api/users/:id', ctx => {
            const id = parseInt(ctx.params['id'] || '0');
            const user = users.find(u => u.id === id);
            if (!user) {
              ctx.res.status(404).json({ error: 'User not found' });
              return;
            }
            ctx.res.json(user);
          });

          app.post('/api/users', ctx => {
            const body = ctx.body as { name?: string; email?: string };
            if (!body?.name || !body?.email) {
              ctx.res
                .status(400)
                .json({ error: 'Name and email are required' });
              return;
            }
            const newUser = {
              id: users.length + 1,
              name: body.name,
              email: body.email,
            };
            users.push(newUser);
            ctx.res.status(201).json(newUser);
          });

          app.put('/api/users/:id', ctx => {
            const id = parseInt(ctx.params['id'] || '0');
            const userIndex = users.findIndex(u => u.id === id);
            if (userIndex === -1) {
              ctx.res.status(404).json({ error: 'User not found' });
              return;
            }
            const body = ctx.body as { name?: string; email?: string };
            const currentUser = users[userIndex];
            if (!currentUser) {
              ctx.res.status(404).json({ error: 'User not found' });
              return;
            }
            users[userIndex] = {
              id: currentUser.id,
              name: body.name || currentUser.name,
              email: body.email || currentUser.email,
            };
            ctx.res.json(users[userIndex]);
          });

          app.get('/api/search', ctx => {
            const query = ctx.query as {
              q?: string;
              page?: string;
              limit?: string;
            };
            const { q = '', page = '1', limit = '20' } = query;
            const results = users.filter(
              user =>
                user.name.toLowerCase().includes((q || '').toLowerCase()) ||
                user.email.toLowerCase().includes((q || '').toLowerCase())
            );
            ctx.res.json({
              results,
              total: results.length,
              page: parseInt(page),
              limit: parseInt(limit),
              query: q,
            });
          });

          app.post('/api/upload', ctx => {
            const data = ctx.body;
            ctx.res.json({
              message: 'Data received',
              size: JSON.stringify(data).length,
              items: Array.isArray(data) ? data.length : 1,
              timestamp: Date.now(),
            });
          });

          app.get('/json', ctx => {
            ctx.res.json({ data: 'JSON response' });
          });

          app.get('/users/:id/posts/:postId', ctx => {
            ctx.res.json({
              userId: ctx.params['id'],
              postId: ctx.params['postId'],
            });
          });

          app.get('/search', ctx => {
            ctx.res.json({ query: ctx.query });
          });

          const server = app.listen(port) as any;

          // Wait for server to be ready
          await new Promise<void>(resolve => {
            const checkServer = () => {
              const address = server.address();
              if (address) {
                console.log(
                  `📡 NextRush server started on port ${(address as any).port}`
                );
                resolve();
              } else {
                setTimeout(checkServer, 100);
              }
            };
            checkServer();
          });

          const serverAddress = server.address() as any;
          servers.push({
            name,
            server,
            adapter: null,
            port: serverAddress.port,
          });
        }
      }

      // Wait for servers to be ready
      console.log(chalk.gray('   Waiting for servers to be ready...'));
      await new Promise(resolve => setTimeout(resolve, 5000)); // Increased from 2000ms to 5000ms

      // Test server readiness before benchmarking
      console.log(chalk.blue('\n🔍 Testing server readiness...'));
      for (const server of servers) {
        try {
          const response = await fetch(
            `http://localhost:${server.port}/health`
          );
          if (response.ok) {
            console.log(
              chalk.green(
                `✅ ${server.name} server ready on port ${server.port}`
              )
            );
          } else {
            console.log(
              chalk.yellow(
                `⚠️ ${server.name} server responded with ${response.status}`
              )
            );
          }
        } catch (error) {
          console.log(
            chalk.red(`❌ ${server.name} server not ready: ${error}`)
          );
        }
      }

      // Additional wait for stability
      console.log(chalk.gray('   Waiting for server stability...'));
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Run benchmarks for each framework
      for (const server of servers) {
        console.log(
          chalk.yellow(`\n📊 Testing ${server.name} on port ${server.port}...`)
        );

        const frameworkScenarios = scenarios.map(scenario => ({
          ...scenario,
          config: {
            ...scenario.config,
            url: `http://localhost:${server.port}${scenario.config.url}`,
          },
        }));

        const results = await this.runScenarios(
          server.name,
          frameworkScenarios
        );
        allResults.set(server.name, results);
      }

      return allResults;
    } finally {
      // Stop all servers
      console.log(chalk.blue('\n🛑 Stopping framework servers...'));
      for (const { name, server, adapter } of servers) {
        console.log(chalk.gray(`   Stopping ${name}...`));
        if (adapter) {
          await adapter.teardown();
        } else {
          server.close();
        }
      }
    }
  }

  /**
   * Generate performance comparison report
   */
  generateReport(results: Map<string, ApacheBenchResult[]>): string {
    console.log(chalk.blue('\n📊 Generating Apache Bench Report...'));

    let report = '# 🚀 Apache Bench Performance Report\n\n';
    report += `Generated: ${new Date().toISOString()}\n\n`;

    // Overall comparison
    report += '## 📈 Overall Performance Comparison\n\n';
    report += '| Framework | Avg RPS | Avg Latency | Success Rate |\n';
    report += '|-----------|---------|-------------|-------------|\n';

    const frameworkAverages = new Map<
      string,
      { rps: number; latency: number; success: number }
    >();

    for (const [framework, frameworkResults] of results) {
      const avgRps =
        frameworkResults.reduce((sum, r) => sum + r.rps, 0) /
        frameworkResults.length;
      const avgLatency =
        frameworkResults.reduce((sum, r) => sum + r.latency.mean, 0) /
        frameworkResults.length;
      const avgSuccess =
        frameworkResults.reduce((sum, r) => sum + r.successRate, 0) /
        frameworkResults.length;

      frameworkAverages.set(framework, {
        rps: avgRps,
        latency: avgLatency,
        success: avgSuccess,
      });

      report += `| ${framework} | ${avgRps.toFixed(0)} | ${avgLatency.toFixed(2)}ms | ${(avgSuccess * 100).toFixed(2)}% |\n`;
    }

    // Find winner
    const winner = Array.from(frameworkAverages.entries()).reduce((a, b) =>
      a[1].rps > b[1].rps ? a : b
    );

    report += `\n🏆 **Winner: ${winner[0]}** with ${winner[1].rps.toFixed(0)} RPS\n\n`;

    // Detailed results per framework
    for (const [framework, frameworkResults] of results) {
      report += `## 📊 ${framework} Detailed Results\n\n`;

      for (const result of frameworkResults) {
        report += `### ${result.url}\n`;
        report += `- **RPS**: ${result.rps.toFixed(0)}\n`;
        report += `- **Latency**: ${result.latency.mean.toFixed(2)}ms (mean), ${result.latency.p95.toFixed(2)}ms (p95)\n`;
        report += `- **Success Rate**: ${(result.successRate * 100).toFixed(2)}%\n`;
        report += `- **Failed Requests**: ${result.failedRequests}\n`;
        report += `- **Transfer Rate**: ${result.transferRate.toFixed(2)} KB/s\n\n`;
      }
    }

    // Performance recommendations
    report += '## 💡 Performance Recommendations\n\n';

    const recommendations = this.generateRecommendations(results);
    for (const recommendation of recommendations) {
      report += `- ${recommendation}\n`;
    }

    return report;
  }

  /**
   * Build Apache Bench command line arguments
   */
  private buildAbArgs(config: ApacheBenchConfig): string[] {
    const args = [
      '-n',
      config.requests.toString(),
      '-c',
      config.concurrency.toString(),
      '-s', // Timeout for socket operations
      '30', // 30 second timeout
      '-r', // Don't exit on socket receive errors
    ];

    if (config.timeout) {
      args.push('-s', config.timeout.toString());
    }

    if (config.keepAlive) {
      args.push('-k');
    }

    if (config.method === 'POST') {
      args.push('-T', 'application/json');
      if (config.data) {
        args.push('-p', '-'); // Read POST data from stdin
      }
    }

    // Add custom headers
    if (config.headers) {
      for (const [key, value] of Object.entries(config.headers)) {
        args.push('-H', `${key}: ${value}`);
      }
    }

    args.push(config.url);
    return args;
  }

  /**
   * Parse Apache Bench output
   */
  private parseAbOutput(
    framework: string,
    config: ApacheBenchConfig,
    output: string,
    duration: number
  ): ApacheBenchResult {
    // Extract key metrics from ab output with more robust parsing
    const rpsMatch = output.match(/Requests per second:\s+([\d.]+)/);
    const rps = rpsMatch ? parseFloat(rpsMatch[1] || '0') : 0;

    // Handle different latency formats
    const latencyMatch = output.match(
      /Time per request:\s+([\d.]+)\s+\[ms\]\s+\(mean\)/
    );
    const latency = latencyMatch ? parseFloat(latencyMatch[1] || '0') : 0;

    // More robust failed requests parsing
    const failedMatch = output.match(/Failed requests:\s+(\d+)/);
    const failedRequests = failedMatch ? parseInt(failedMatch[1] || '0') : 0;

    // Handle different transfer rate formats
    const transferMatch = output.match(
      /Transfer rate:\s+([\d.]+)\s+\[Kbytes\/sec\]/
    );
    const transferRate = transferMatch
      ? parseFloat(transferMatch[1] || '0')
      : 0;

    const successRate = (config.requests - failedRequests) / config.requests;

    // Extract percentile data with better regex patterns
    const p95Match = output.match(/95%\s+(\d+)/);
    const p99Match = output.match(/99%\s+(\d+)/);
    const medianMatch = output.match(/50%\s+(\d+)/);

    // Debug logging for troubleshooting
    console.log(`[DEBUG] ${framework} parsing:`);
    console.log(`  RPS: ${rps}`);
    console.log(`  Latency: ${latency}ms`);
    console.log(`  Failed: ${failedRequests}`);
    console.log(`  Success Rate: ${(successRate * 100).toFixed(2)}%`);

    return {
      framework,
      url: config.url,
      requests: config.requests,
      concurrency: config.concurrency,
      rps,
      latency: {
        mean: latency,
        median: medianMatch ? parseInt(medianMatch[1] || '0') : latency,
        p95: p95Match ? parseInt(p95Match[1] || '0') : latency,
        p99: p99Match ? parseInt(p99Match[1] || '0') : latency,
      },
      transferRate,
      failedRequests,
      successRate,
      duration,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(
    results: Map<string, ApacheBenchResult[]>
  ): string[] {
    const recommendations: string[] = [];

    // Analyze RPS patterns
    const allRps = Array.from(results.values())
      .flat()
      .map(r => r.rps);
    const avgRps = allRps.reduce((sum, rps) => sum + rps, 0) / allRps.length;
    const maxRps = Math.max(...allRps);

    if (maxRps > avgRps * 1.5) {
      recommendations.push(
        'Significant performance variation detected - consider load balancing'
      );
    }

    // Analyze error rates
    const highErrorFrameworks = Array.from(results.entries())
      .filter(([_, results]) => results.some(r => r.successRate < 0.95))
      .map(([name]) => name);

    if (highErrorFrameworks.length > 0) {
      recommendations.push(
        `High error rates detected in: ${highErrorFrameworks.join(', ')}`
      );
    }

    // Analyze latency patterns
    const allLatencies = Array.from(results.values())
      .flat()
      .map(r => r.latency.mean);
    const avgLatency =
      allLatencies.reduce((sum, lat) => sum + lat, 0) / allLatencies.length;

    if (avgLatency > 100) {
      recommendations.push(
        'High average latency detected - consider performance optimization'
      );
    }

    return recommendations;
  }

  /**
   * Save results to file
   */
  saveResults(results: Map<string, ApacheBenchResult[]>): void {
    const reportFile = join(this.outputDir, 'apache-bench-report.md');
    const report = this.generateReport(results);
    writeFileSync(reportFile, report);

    const jsonFile = join(this.outputDir, 'apache-bench-results.json');
    const jsonData = Object.fromEntries(results);
    writeFileSync(jsonFile, JSON.stringify(jsonData, null, 2));

    console.log(chalk.green(`📁 Results saved to: ${this.outputDir}`));
  }
}

/**
 * Generate POST data for testing
 */
function generatePostData(): string {
  return JSON.stringify({
    test: 'data',
    timestamp: Date.now(),
    id: Math.random(),
    message: 'Apache Bench POST test',
  });
}

/**
 * Predefined Apache Bench scenarios
 */
export const APACHE_BENCH_SCENARIOS: ApacheBenchScenario[] = [
  {
    name: 'basic-load',
    description: 'Basic load test with moderate concurrency',
    config: {
      url: '/',
      requests: 1000,
      concurrency: 10,
      keepAlive: true,
    },
  },
  {
    name: 'high-concurrency',
    description: 'High concurrency stress test',
    config: {
      url: '/',
      requests: 5000,
      concurrency: 100,
      keepAlive: true,
    },
  },
  {
    name: 'json-endpoint',
    description: 'JSON response performance test',
    config: {
      url: '/json',
      requests: 2000,
      concurrency: 50,
      keepAlive: true,
    },
  },
  {
    name: 'post-requests',
    description: 'POST request performance test',
    config: {
      url: '/data',
      requests: 1000,
      concurrency: 25,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      get data() {
        return (
          '{"test":"data","timestamp":' +
          Date.now() +
          ',"id":' +
          Math.random() +
          ',"message":"Apache Bench POST test"}'
        );
      },
    },
  },
  {
    name: 'parameter-parsing',
    description: 'URL parameter parsing performance',
    config: {
      url: '/users/123/posts/456',
      requests: 1500,
      concurrency: 30,
      keepAlive: true,
    },
  },
  {
    name: 'query-parameters',
    description: 'Query parameter handling test',
    config: {
      url: '/search?q=test&page=1&limit=10&sort=name',
      requests: 2000,
      concurrency: 40,
      keepAlive: true,
    },
  },
  {
    name: 'health-check',
    description: 'Health endpoint performance',
    config: {
      url: '/health',
      requests: 3000,
      concurrency: 60,
      keepAlive: true,
    },
  },
];

export default ApacheBenchRunner;
