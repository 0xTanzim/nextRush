#!/usr/bin/env node

/**
 * 🚀 Professional Benchmark Orchestrator
 *
 * Main orchestrator that coordinates multiple benchmarking tools:
 * - Autocannon (HTTP load testing)
 * - Clinic.js (Performance profiling)
 * - Artillery (Scenario-based testing)
 * - K6 (Load testing)
 * - Custom metrics collection
 */

import chalk from 'chalk';
import { exec, spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import HTMLReporter from './reporters/html-reporter.js';
import MarkdownReporter from './reporters/markdown-reporter.js';
import SystemMetricsCollector from './utils/system-metrics.js';

// Professional progress indicators and timing
class ProgressIndicator {
  constructor(message) {
    this.message = message;
    this.startTime = Date.now();
    this.dots = 0;
    this.interval = null;
  }

  start() {
    console.log(chalk.cyan(`  🔄 ${this.message}...`));
    this.interval = setInterval(() => {
      process.stdout.write(chalk.gray('.'));
      this.dots++;
      if (this.dots > 3) {
        process.stdout.write('\b\b\b\b    \b\b\b\b');
        this.dots = 0;
      }
    }, 500);
  }

  stop(success = true, result = '') {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    const duration = ((Date.now() - this.startTime) / 1000).toFixed(1);
    process.stdout.write(
      '\b'.repeat(this.dots + 4) +
        ' '.repeat(this.dots + 4) +
        '\b'.repeat(this.dots + 4)
    );

    if (success) {
      console.log(
        chalk.green(
          `    ✅ ${this.message} completed in ${duration}s ${result}`
        )
      );
    } else {
      console.log(
        chalk.red(`    ❌ ${this.message} failed after ${duration}s: ${result}`)
      );
    }
  }
}

// Timeout wrapper for promises
function withTimeout(promise, timeoutMs, name) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`${name} timed out after ${timeoutMs / 1000}s`)),
        timeoutMs
      )
    ),
  ]);
}

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ProfessionalBenchmarkOrchestrator {
  constructor(options = {}) {
    this.options = {
      frameworks: ['nextrush', 'express', 'fastify'],
      tools: ['autocannon', 'clinic', 'artillery', 'k6'], // Re-enabled K6!
      outputDir: path.join(__dirname, '../results'),
      duration: 60, // Longer duration for better measurement
      connections: 500, // Much higher connection count
      rate: 5000, // Much higher rate limit
      warmup: 10, // Longer warmup
      ...options,
    };

    this.results = {
      autocannon: {},
      clinic: {},
      artillery: {},
      k6: {},
      summary: {},
    };

    this.servers = new Map();
  }

  async run() {
    console.log(chalk.blue('🚀 Starting Professional Benchmark Suite'));
    console.log(
      chalk.gray(`Frameworks: ${this.options.frameworks.join(', ')}`)
    );
    console.log(chalk.gray(`Tools: ${this.options.tools.join(', ')}`));
    console.log(''.padEnd(50, '='));

    try {
      // Ensure output directory exists
      await this.ensureOutputDir();

      // Run benchmarks for each framework
      for (const framework of this.options.frameworks) {
        console.log(
          chalk.yellow(`\n📊 Benchmarking ${framework.toUpperCase()}`)
        );
        console.log(''.padEnd(40, '-'));

        await this.benchmarkFramework(framework);
      }

      // Generate comparison report
      await this.generateComparisonReport();

      console.log(chalk.green('\n🎉 Professional benchmark complete!'));
      console.log(chalk.blue(`📁 Results saved to: ${this.options.outputDir}`));
    } catch (error) {
      console.error(chalk.red('❌ Benchmark failed:'), error.message);
      process.exit(1);
    }
  }

  async benchmarkFramework(framework) {
    const port = this.getFrameworkPort(framework);

    // Initialize system metrics collector
    const metricsCollector = new SystemMetricsCollector(
      framework,
      this.options.outputDir
    );

    try {
      // Start framework server
      await this.startFrameworkServer(framework, port);

      // Start system metrics collection
      await metricsCollector.startCollection();

      // Wait for server to be ready
      await this.waitForServer(`http://localhost:${port}`, 30000);

      // Run warmup
      await this.warmupServer(`http://localhost:${port}`);

      // Run each benchmarking tool
      if (this.options.tools.includes('autocannon')) {
        await this.runAutocannon(framework, port);
      }

      if (this.options.tools.includes('clinic')) {
        await this.runClinic(framework, port);
      }

      if (this.options.tools.includes('artillery')) {
        await this.runArtillery(framework, port);
      }

      if (this.options.tools.includes('k6')) {
        await this.runK6(framework, port);
      }
    } finally {
      // Stop system metrics collection
      await metricsCollector.stopCollection();

      // Stop framework server
      await this.stopFrameworkServer(framework);
    }
  }

  async runAutocannon(framework, port) {
    const progress = new ProgressIndicator(
      'Running Autocannon High-Performance Load Test'
    );
    progress.start();

    const url = `http://localhost:${port}`;

    // Use local autocannon from node_modules
    const autocannonPath = path.join(
      __dirname,
      '../node_modules/.bin/autocannon'
    );

    // Aggressive autocannon settings for better differentiation
    const command = [
      autocannonPath,
      '-c',
      this.options.connections, // 500 connections
      '-d',
      this.options.duration, // 60 seconds
      '-R',
      this.options.rate, // 5000 RPS target
      '--pipelining',
      '10', // Enable pipelining for higher throughput
      '--overallRate',
      this.options.rate,
      '--bailout',
      '10', // Stop if 10 consecutive errors
      '--json',
      url,
    ].join(' ');

    try {
      const { stdout } = await withTimeout(
        execAsync(command),
        (this.options.duration + 15) * 1000, // 15s buffer
        'Autocannon'
      );

      const result = JSON.parse(stdout);

      // Save detailed results
      await this.saveResult('autocannon', framework, result);

      const rpsResult = `(${result.requests.average.toFixed(
        0
      )} RPS, ${result.latency.average.toFixed(
        2
      )}ms avg, ${result.latency.p99.toFixed(2)}ms p99)`;
      progress.stop(true, rpsResult);

      this.results.autocannon[framework] = {
        rps: result.requests.average,
        latency: result.latency.average,
        p95: result.latency.p95,
        p99: result.latency.p99,
        throughput: result.throughput.average,
        errors: result.errors,
      };
    } catch (error) {
      progress.stop(false, error.message);
      this.results.autocannon[framework] = { error: error.message };
    }
  }

  async runClinic(framework, port) {
    const progress = new ProgressIndicator(
      'Running Clinic.js Doctor (Performance Profiling)'
    );
    progress.start();

    const serverScript = path.join(__dirname, '../adapters', `${framework}.js`);
    const outputDir = path.join(this.options.outputDir, 'clinic', framework);

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    let clinicProcess = null;

    try {
      // Use local clinic from node_modules
      const clinicPath = path.join(__dirname, '../node_modules/.bin/clinic');

      // Start the profiled server with shorter timeout
      clinicProcess = spawn(
        clinicPath,
        ['doctor', '--dest', outputDir, '--', 'node', serverScript, port],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          detached: true,
        }
      );

      // Wait for server to start (shorter timeout)
      await withTimeout(
        this.waitForServer(`http://localhost:${port}`, 5000),
        8000,
        'Clinic server startup'
      );

      // Generate shorter load while profiling
      const loadCommand = `npx autocannon -c 30 -d 5 http://localhost:${port}`;
      await withTimeout(
        execAsync(loadCommand),
        10000,
        'Clinic load generation'
      );

      // Stop the clinic process gracefully
      if (clinicProcess && clinicProcess.pid) {
        try {
          // First try SIGTERM for graceful shutdown
          process.kill(clinicProcess.pid, 'SIGTERM');
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Check if process is still running
          try {
            process.kill(clinicProcess.pid, 0); // Check if process exists
            // If we reach here, process is still running, force kill
            process.kill(clinicProcess.pid, 'SIGKILL');
          } catch (e) {
            // Process already terminated, which is good
          }
        } catch (e) {
          // Process might already be dead, that's fine
        }
      }

      // Wait for clinic to finish processing
      await new Promise((resolve) => setTimeout(resolve, 2000));

      progress.stop(true, `(profile saved to ${outputDir})`);
    } catch (error) {
      // Clean up process if it exists
      if (clinicProcess && clinicProcess.pid) {
        try {
          process.kill(-clinicProcess.pid, 'SIGKILL');
        } catch (e) {
          try {
            process.kill(clinicProcess.pid, 'SIGKILL');
          } catch (e2) {
            // Process already dead
          }
        }
      }

      progress.stop(false, error.message);
    }
  }

  async runArtillery(framework, port) {
    const progress = new ProgressIndicator(
      'Running Artillery Stress Test (Complex Scenarios)'
    );
    progress.start();

    const outputFile = path.join(
      this.options.outputDir,
      'artillery',
      `${framework}-artillery-report.json`
    );
    await fs.mkdir(path.dirname(outputFile), { recursive: true });

    // Create a focused Artillery config for aggressive testing
    const config = {
      config: {
        target: `http://localhost:${port}`,
        phases: [
          { duration: 15, arrivalRate: 50, name: 'Warm up' },
          { duration: 30, arrivalRate: 200, rampTo: 500, name: 'Ramp up' },
          { duration: 60, arrivalRate: 500, name: 'Sustained high load' },
          { duration: 15, arrivalRate: 800, name: 'Peak load spike' },
        ],
        timeout: 5, // 5 second timeout for requests
      },
      scenarios: [
        {
          name: 'High-intensity mixed load',
          weight: 60,
          flow: [
            { get: { url: '/' } },
            { get: { url: '/json' } },
            { get: { url: '/plaintext' } },
            {
              loop: [{ get: { url: '/api/users/{{ $randomInt(1, 1000) }}' } }],
              count: 5,
            },
          ],
        },
        {
          name: 'CPU-intensive operations',
          weight: 30,
          flow: [
            {
              get: {
                url: '/users/{{ $randomInt(1, 10000) }}/posts/{{ $randomInt(1, 10000) }}',
              },
            },
            {
              get: {
                url: '/search?q={{ $randomString(100) }}&page={{ $randomInt(1, 100) }}',
              },
            },
            {
              post: {
                url: '/data',
                json: {
                  data: '{{ $randomString(1000) }}',
                  array: [
                    '{{ $randomString(200) }}',
                    '{{ $randomString(200) }}',
                    '{{ $randomString(200) }}',
                  ],
                },
              },
            },
          ],
        },
        {
          name: 'Error handling test',
          weight: 10,
          flow: [
            { get: { url: '/error', expect: [{ statusCode: 500 }] } },
            { get: { url: '/health' } },
          ],
        },
      ],
    };

    const configFile = path.join(
      this.options.outputDir,
      'artillery-config.json'
    );
    await fs.writeFile(configFile, JSON.stringify(config, null, 2));

    try {
      const artilleryPath = path.join(
        __dirname,
        '../node_modules/.bin/artillery'
      );

      const command = `${artilleryPath} run --output ${outputFile} ${configFile}`;

      // Run with longer timeout for aggressive testing
      await withTimeout(
        execAsync(command),
        140000, // 140 second total timeout (120s test + 20s buffer)
        'Artillery execution'
      );

      progress.stop(true, `(report saved to ${outputFile})`);
    } catch (error) {
      progress.stop(false, error.message);
    } finally {
      // Cleanup config file
      try {
        await fs.unlink(configFile);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  async runK6(framework, port) {
    const progress = new ProgressIndicator(
      'Running K6 Performance Test (HTTP/2 & Metrics)'
    );
    progress.start();

    const outputFile = path.join(
      this.options.outputDir,
      'k6',
      `${framework}.json`
    );
    await fs.mkdir(path.dirname(outputFile), { recursive: true });

    // Create aggressive K6 script for better differentiation
    const k6Script = `
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '20s', target: 100 },  // Ramp up to 100 users
    { duration: '60s', target: 300 },  // Ramp up to 300 users
    { duration: '60s', target: 500 },  // Ramp up to 500 users
    { duration: '30s', target: 800 },  // Spike to 800 users
    { duration: '20s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.05'], // Less than 5% errors
  },
};

export default function () {
  // High-intensity request pattern
  const responses = http.batch([
    { method: 'GET', url: 'http://localhost:${port}/' },
    { method: 'GET', url: 'http://localhost:${port}/json' },
    { method: 'GET', url: 'http://localhost:${port}/plaintext' },
    { method: 'GET', url: 'http://localhost:${port}/health' },
  ]);

  responses.forEach(r => check(r, { 'status is 200': (r) => r.status === 200 }));

  // API intensive operations
  const userId = Math.floor(Math.random() * 1000) + 1;
  const postId = Math.floor(Math.random() * 100) + 1;

  const apiRes = http.get(\`http://localhost:${port}/users/\${userId}/posts/\${postId}\`);
  check(apiRes, { 'API response is 200': (r) => r.status === 200 });

  // Search operation with complex query
  const searchRes = http.get(\`http://localhost:${port}/search?q=\${Math.random().toString(36)}&page=\${Math.floor(Math.random() * 100)}\`);
  check(searchRes, { 'Search response is 200': (r) => r.status === 200 });

  // POST operation with large payload
  const postData = {
    data: 'x'.repeat(1000), // 1KB payload
    user_id: userId,
    timestamp: Date.now(),
    metadata: {
      test: true,
      load: 'high',
      payload: 'x'.repeat(500)
    }
  };

  const postRes = http.post(\`http://localhost:${port}/data\`, JSON.stringify(postData), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(postRes, { 'POST response is 200': (r) => r.status === 200 });

  // Minimal sleep for maximum pressure
  sleep(0.1);
}
`;

    const scriptFile = path.join(this.options.outputDir, 'k6-script.js');
    await fs.writeFile(scriptFile, k6Script);

    try {
      // Use globally installed K6 binary instead of node_modules
      const command = `k6 run --out json=${outputFile} ${scriptFile}`;

      await withTimeout(
        execAsync(command),
        210000, // 210 second timeout (190s test + 20s buffer)
        'K6 execution'
      );
      progress.stop(true, `(results saved to ${outputFile})`);
    } catch (error) {
      progress.stop(false, error.message);
    } finally {
      // Cleanup script file
      try {
        await fs.unlink(scriptFile);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  async startFrameworkServer(framework, port) {
    const adapterPath = path.join(__dirname, '../adapters', `${framework}.js`);

    // Check if adapter exists
    try {
      await fs.access(adapterPath);
    } catch {
      console.log(chalk.yellow(`    ⚠️ Creating adapter for ${framework}...`));
      await this.createFrameworkAdapter(framework, adapterPath);
    }

    console.log(
      chalk.gray(`    🚀 Starting ${framework} server on port ${port}...`)
    );

    const serverProcess = spawn('node', [adapterPath, port], {
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: true,
    });

    this.servers.set(framework, serverProcess);

    // Handle server output
    serverProcess.stdout.on('data', (data) => {
      // Suppress normal output, only show errors
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(chalk.red(`    ${framework} error: ${data}`));
    });
  }

  async stopFrameworkServer(framework) {
    const serverProcess = this.servers.get(framework);
    if (serverProcess) {
      console.log(chalk.gray(`    🛑 Stopping ${framework} server...`));

      // Kill the process group to ensure cleanup
      try {
        // First try graceful shutdown
        if (serverProcess.pid) {
          process.kill(-serverProcess.pid, 'SIGTERM');

          // Wait for graceful shutdown
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Force kill if still running
          try {
            process.kill(-serverProcess.pid, 'SIGKILL');
          } catch (e) {
            // Process group already terminated
          }
        }
      } catch (error) {
        try {
          process.kill(serverProcess.pid, 'SIGKILL');
        } catch (e) {
          // Process already dead
        }
      }

      this.servers.delete(framework);

      // Additional cleanup: kill any processes on the framework port
      const port = this.getFrameworkPort(framework);
      try {
        await execAsync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`);
      } catch (e) {
        // Port cleanup failed, continue
      }

      // Wait for port to be freed
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  async waitForServer(url, timeout = 30000) {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      try {
        const response = await fetch(url);
        if (response.ok) return;
      } catch (error) {
        // Server not ready yet
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error(
      `Server at ${url} did not become ready within ${timeout}ms`
    );
  }

  async warmupServer(url) {
    console.log(
      chalk.gray(
        `    🔥 Intensive warmup (warming up for ${this.options.warmup}s)...`
      )
    );

    try {
      // Use local autocannon from node_modules with aggressive warmup
      const autocannonPath = path.join(
        __dirname,
        '../node_modules/.bin/autocannon'
      );
      const command = `${autocannonPath} -c 50 -d ${this.options.warmup} -R 1000 ${url}`;
      await execAsync(command);

      // Additional warmup for different endpoints
      const warmupCommands = [
        `${autocannonPath} -c 20 -d 3 ${url}/json`,
        `${autocannonPath} -c 20 -d 3 ${url}/health`,
        `${autocannonPath} -c 20 -d 3 ${url}/plaintext`,
      ];

      for (const cmd of warmupCommands) {
        await execAsync(cmd);
      }
    } catch (error) {
      console.warn(chalk.yellow(`    ⚠️ Warmup failed: ${error.message}`));
    }
  }

  getFrameworkPort(framework) {
    const basePorts = {
      nextrush: 3000,
      express: 3001,
      fastify: 3002,
      koa: 3003,
      hapi: 3004,
    };

    return basePorts[framework] || 3000;
  }

  async ensureOutputDir() {
    const dirs = [
      this.options.outputDir,
      path.join(this.options.outputDir, 'autocannon'),
      path.join(this.options.outputDir, 'clinic'),
      path.join(this.options.outputDir, 'artillery'),
      path.join(this.options.outputDir, 'k6'),
      path.join(this.options.outputDir, 'comparison'),
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  async saveResult(tool, framework, data) {
    const outputDir = path.join(this.options.outputDir, tool);
    const outputFile = path.join(outputDir, `${framework}.json`);

    await fs.writeFile(outputFile, JSON.stringify(data, null, 2));
  }

  async createFrameworkAdapter(framework, adapterPath) {
    // Create a basic adapter for the framework
    let adapterCode = '';

    switch (framework) {
      case 'nextrush':
        adapterCode = this.createNextRushAdapter();
        break;
      case 'express':
        adapterCode = this.createExpressAdapter();
        break;
      case 'fastify':
        adapterCode = this.createFastifyAdapter();
        break;
      default:
        throw new Error(`Unknown framework: ${framework}`);
    }

    await fs.writeFile(adapterPath, adapterCode);
  }

  createNextRushAdapter() {
    return `
import { createApp } from '../../../dist/index.js';

const port = process.argv[2] || 3000;

const app = createApp();

app.get('/', (req, res) => {
  res.json({ message: 'Hello from NextRush!', timestamp: Date.now() });
});

app.get('/json', (req, res) => {
  res.json({
    framework: 'nextrush',
    version: '1.3.0',
    timestamp: Date.now(),
    data: { message: 'Hello World' }
  });
});

app.listen(port, () => {
  console.log(\`NextRush server running on port \${port}\`);
});
`;
  }

  createExpressAdapter() {
    return `
import express from 'express';

const port = process.argv[2] || 3001;

const app = express();

app.get('/', (req, res) => {
  res.json({ message: 'Hello from Express!', timestamp: Date.now() });
});

app.get('/json', (req, res) => {
  res.json({
    framework: 'express',
    version: '4.19.2',
    timestamp: Date.now(),
    data: { message: 'Hello World' }
  });
});

app.listen(port, () => {
  console.log(\`Express server running on port \${port}\`);
});
`;
  }

  createFastifyAdapter() {
    return `
import Fastify from 'fastify';

const port = process.argv[2] || 3002;

const fastify = Fastify({ logger: false });

fastify.get('/', async (request, reply) => {
  return { message: 'Hello from Fastify!', timestamp: Date.now() };
});

fastify.get('/json', async (request, reply) => {
  return {
    framework: 'fastify',
    version: '4.28.1',
    timestamp: Date.now(),
    data: { message: 'Hello World' }
  };
});

const start = async () => {
  try {
    await fastify.listen({ port });
    console.log(\`Fastify server running on port \${port}\`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
`;
  }

  async ensureArtilleryScenario(scenarioPath, port) {
    try {
      await fs.access(scenarioPath);
    } catch {
      await fs.mkdir(path.dirname(scenarioPath), { recursive: true });

      const scenario = `
config:
  target: 'http://localhost:${port}'
  phases:
    - duration: 30
      arrivalRate: 10
      name: "Warm up"
    - duration: 60
      arrivalRate: 50
      name: "Ramp up load"
    - duration: 30
      arrivalRate: 10
      name: "Cool down"

scenarios:
  - name: "Basic load test"
    weight: 100
    flow:
      - get:
          url: "/"
      - get:
          url: "/json"
`;

      await fs.writeFile(scenarioPath, scenario);
    }
  }

  async ensureK6Script(scriptPath, port) {
    try {
      await fs.access(scriptPath);
    } catch {
      await fs.mkdir(path.dirname(scriptPath), { recursive: true });

      const script = `
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 100,
  duration: '30s',
};

export default function () {
  const res = http.get('http://localhost:${port}/');
  check(res, { 'status was 200': (r) => r.status == 200 });

  const jsonRes = http.get('http://localhost:${port}/json');
  check(jsonRes, { 'status was 200': (r) => r.status == 200 });

  sleep(1);
}
`;

      await fs.writeFile(scriptPath, script);
    }
  }

  async generateComparisonReport() {
    console.log(chalk.yellow('\n📊 Generating comparison report...'));

    const comparison = {
      timestamp: new Date().toISOString(),
      frameworks: this.options.frameworks,
      tools: this.options.tools,
      results: this.results,
      summary: this.generateSummary(),
    };

    const reportPath = path.join(
      this.options.outputDir,
      'comparison',
      'benchmark-report.json'
    );
    await fs.writeFile(reportPath, JSON.stringify(comparison, null, 2));

    // Generate markdown report
    const markdownReport = this.generateMarkdownReport(comparison);
    const markdownPath = path.join(
      this.options.outputDir,
      'comparison',
      'benchmark-report.md'
    );
    await fs.writeFile(markdownPath, markdownReport);

    console.log(chalk.green(`    ✅ Comparison report saved`));

    // Generate beautiful HTML and Markdown reports using our new reporters
    try {
      const htmlReporter = new HTMLReporter(this.options.outputDir);
      const htmlReportPath = await htmlReporter.generateReport();

      const markdownReporter = new MarkdownReporter(this.options.outputDir);
      const mdReportPath = await markdownReporter.generateReport();

      console.log(
        chalk.green(
          `    ✅ Beautiful HTML Report: ${path.basename(htmlReportPath)}`
        )
      );
      console.log(
        chalk.green(
          `    ✅ Beautiful Markdown Report: ${path.basename(mdReportPath)}`
        )
      );
    } catch (error) {
      console.log(
        chalk.yellow(
          `    ⚠️ Beautiful report generation failed: ${error.message}`
        )
      );
    }
  }

  generateSummary() {
    const summary = {};

    for (const framework of this.options.frameworks) {
      if (this.results.autocannon[framework]) {
        summary[framework] = {
          rps: this.results.autocannon[framework].rps,
          latency: this.results.autocannon[framework].latency,
          throughput: this.results.autocannon[framework].throughput,
        };
      }
    }

    return summary;
  }

  generateMarkdownReport(comparison) {
    const summary = comparison.summary;

    let report = `# 🚀 Professional Benchmark Report\n\n`;
    report += `**Generated:** ${comparison.timestamp}\n`;
    report += `**Frameworks:** ${comparison.frameworks.join(', ')}\n`;
    report += `**Tools:** ${comparison.tools.join(', ')}\n\n`;

    report += `## 📊 Performance Summary\n\n`;
    report += `| Framework | RPS | Latency (ms) | Throughput |\n`;
    report += `|-----------|-----|--------------|------------|\n`;

    for (const [framework, data] of Object.entries(summary)) {
      report += `| ${framework} | ${data.rps?.toFixed(0) || 'N/A'} | ${
        data.latency?.toFixed(2) || 'N/A'
      } | ${data.throughput?.toFixed(2) || 'N/A'} |\n`;
    }

    report += `\n## 🏆 Winner Analysis\n\n`;

    // Find the best performing framework
    const best = Object.entries(summary).reduce((best, [framework, data]) => {
      if (!best || (data.rps && data.rps > best.rps)) {
        return { framework, ...data };
      }
      return best;
    }, null);

    if (best) {
      report += `**🥇 Best RPS:** ${best.framework} (${best.rps?.toFixed(
        0
      )} RPS)\n`;
    }

    return report;
  }
}

// CLI interface
const argv = yargs(hideBin(process.argv))
  .option('framework', {
    alias: 'f',
    type: 'array',
    description: 'Frameworks to benchmark',
    default: ['nextrush', 'express', 'fastify'],
  })
  .option('tools', {
    alias: 't',
    type: 'array',
    description: 'Tools to use',
    default: ['autocannon', 'clinic', 'artillery', 'k6'],
  })
  .option('duration', {
    alias: 'd',
    type: 'number',
    description: 'Test duration in seconds',
    default: 30,
  })
  .option('connections', {
    alias: 'c',
    type: 'number',
    description: 'Number of connections',
    default: 100,
  })
  .option('compare', {
    type: 'string',
    description: 'Compare specific frameworks (comma-separated)',
  }).argv;

// Handle compare option
if (argv.compare) {
  argv.framework = argv.compare.split(',').map((f) => f.trim());
}

// Create and run orchestrator
const orchestrator = new ProfessionalBenchmarkOrchestrator({
  frameworks: argv.framework,
  tools: argv.tools,
  duration: argv.duration,
  connections: argv.connections,
});

orchestrator.run().catch(console.error);
