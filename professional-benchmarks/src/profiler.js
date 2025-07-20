#!/usr/bin/env node

/**
 * 🔬 Professional Performance Profiler
 *
 * Comprehensive profiling using Clinic.js suite:
 * - Doctor: Event loop monitoring
 * - Flame: CPU flame graphs
 * - Bubbleprof: Async operations
 * - HeapProfiler: Memory analysis
 */

import chalk from 'chalk';
import { exec, spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ProfessionalProfiler {
  constructor(options = {}) {
    this.options = {
      framework: 'nextrush',
      port: 3000,
      duration: 30,
      connections: 100,
      outputDir: path.join(__dirname, '../results/profiling'),
      tools: ['doctor', 'flame', 'bubbleprof', 'heapprofiler'],
      ...options,
    };

    this.serverProcess = null;
  }

  async run() {
    console.log(chalk.blue('🔬 Starting Professional Performance Profiling'));
    console.log(chalk.gray(`Framework: ${this.options.framework}`));
    console.log(chalk.gray(`Tools: ${this.options.tools.join(', ')}`));
    console.log(''.padEnd(50, '='));

    try {
      // Ensure output directory exists
      await this.ensureOutputDir();

      // Run each profiling tool
      for (const tool of this.options.tools) {
        console.log(chalk.yellow(`\n🔍 Running Clinic.js ${tool}...`));
        await this.runClinicTool(tool);
      }

      // Run additional profiling tools
      await this.runAdditionalProfilers();

      console.log(chalk.green('\n🎉 Performance profiling complete!'));
      console.log(chalk.blue(`📁 Results saved to: ${this.options.outputDir}`));
    } catch (error) {
      console.error(chalk.red('❌ Profiling failed:'), error.message);
      process.exit(1);
    }
  }

  async runClinicTool(tool) {
    const serverScript = path.join(
      __dirname,
      '../adapters',
      `${this.options.framework}.js`
    );
    const outputDir = path.join(
      this.options.outputDir,
      tool,
      this.options.framework
    );

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    console.log(chalk.cyan(`  🏥 Starting Clinic.js ${tool}...`));

    try {
      // Start the profiled server
      const clinicProcess = spawn(
        'clinic',
        [
          tool,
          '--dest',
          outputDir,
          '--',
          'node',
          serverScript,
          this.options.port,
        ],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          detached: true,
        }
      );

      // Wait for server to start
      await this.waitForServer(`http://localhost:${this.options.port}`, 10000);
      console.log(chalk.green(`    ✅ Server started, generating load...`));

      // Generate load while profiling
      await this.generateLoad();

      // Stop the clinic process gracefully
      console.log(chalk.yellow(`    🛑 Stopping profiler...`));
      process.kill(-clinicProcess.pid, 'SIGTERM');

      // Wait for clinic to finish processing
      await new Promise((resolve) => setTimeout(resolve, 5000));

      console.log(chalk.green(`    ✅ ${tool} profile saved to ${outputDir}`));
    } catch (error) {
      console.error(chalk.red(`    ❌ ${tool} failed: ${error.message}`));
    }
  }

  async generateLoad() {
    const url = `http://localhost:${this.options.port}`;

    console.log(
      chalk.gray(`    🔥 Generating load for ${this.options.duration}s...`)
    );

    try {
      // Use autocannon to generate consistent load
      const command = [
        'autocannon',
        '-c',
        this.options.connections,
        '-d',
        this.options.duration,
        '-R',
        1000, // 1000 requests per second
        url,
      ].join(' ');

      const { stdout } = await execAsync(command);
      const result = JSON.parse(stdout);

      console.log(
        chalk.green(
          `    ✅ Load generated: ${result.requests.average.toFixed(0)} RPS`
        )
      );
    } catch (error) {
      console.warn(
        chalk.yellow(`    ⚠️ Load generation failed: ${error.message}`)
      );
    }
  }

  async runAdditionalProfilers() {
    console.log(chalk.yellow('\n🔍 Running additional profilers...'));

    // Run 0x profiler for CPU flame graphs
    await this.run0xProfiler();

    // Run Node.js built-in profiler
    await this.runNodeProfiler();

    // Generate memory analysis
    await this.runMemoryAnalysis();
  }

  async run0xProfiler() {
    console.log(chalk.cyan('  🔥 Running 0x CPU profiler...'));

    const serverScript = path.join(
      __dirname,
      '../adapters',
      `${this.options.framework}.js`
    );
    const outputDir = path.join(
      this.options.outputDir,
      '0x',
      this.options.framework
    );

    await fs.mkdir(outputDir, { recursive: true });

    try {
      // Start 0x profiler
      const zeroXProcess = spawn(
        '0x',
        ['--output-dir', outputDir, serverScript, this.options.port],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          detached: true,
        }
      );

      // Wait for server to start
      await this.waitForServer(`http://localhost:${this.options.port}`, 10000);

      // Generate short burst of load
      await this.generateShortLoad();

      // Stop 0x profiler
      process.kill(-zeroXProcess.pid, 'SIGTERM');

      console.log(chalk.green(`    ✅ 0x flame graph saved to ${outputDir}`));
    } catch (error) {
      console.error(chalk.red(`    ❌ 0x profiler failed: ${error.message}`));
    }
  }

  async runNodeProfiler() {
    console.log(chalk.cyan('  🐧 Running Node.js built-in profiler...'));

    const serverScript = path.join(
      __dirname,
      '../adapters',
      `${this.options.framework}.js`
    );
    const outputDir = path.join(
      this.options.outputDir,
      'node-profiler',
      this.options.framework
    );

    await fs.mkdir(outputDir, { recursive: true });

    try {
      // Start Node.js with profiling enabled
      const nodeProcess = spawn(
        'node',
        ['--prof', '--prof-process', serverScript, this.options.port],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: outputDir,
          detached: true,
        }
      );

      // Wait for server to start
      await this.waitForServer(`http://localhost:${this.options.port}`, 10000);

      // Generate load
      await this.generateShortLoad();

      // Stop profiler
      process.kill(-nodeProcess.pid, 'SIGTERM');

      console.log(chalk.green(`    ✅ Node.js profile saved to ${outputDir}`));
    } catch (error) {
      console.error(
        chalk.red(`    ❌ Node.js profiler failed: ${error.message}`)
      );
    }
  }

  async runMemoryAnalysis() {
    console.log(chalk.cyan('  🧠 Running memory analysis...'));

    const serverScript = path.join(
      __dirname,
      '../adapters',
      `${this.options.framework}.js`
    );
    const outputDir = path.join(
      this.options.outputDir,
      'memory',
      this.options.framework
    );

    await fs.mkdir(outputDir, { recursive: true });

    try {
      // Start server with memory monitoring
      const serverProcess = spawn(
        'node',
        [
          '--inspect',
          '--max-old-space-size=512', // Limit memory to stress test
          serverScript,
          this.options.port,
        ],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          detached: true,
        }
      );

      // Wait for server to start
      await this.waitForServer(`http://localhost:${this.options.port}`, 10000);

      // Generate memory pressure
      console.log(chalk.gray('    📈 Generating memory pressure...'));
      await this.generateMemoryPressure();

      // Collect memory statistics
      const memStats = await this.collectMemoryStats();

      // Save memory analysis
      const memoryReport = {
        timestamp: new Date().toISOString(),
        framework: this.options.framework,
        memoryStats,
        analysis: this.analyzeMemoryUsage(memStats),
      };

      await fs.writeFile(
        path.join(outputDir, 'memory-analysis.json'),
        JSON.stringify(memoryReport, null, 2)
      );

      // Stop server
      process.kill(-serverProcess.pid, 'SIGTERM');

      console.log(chalk.green(`    ✅ Memory analysis saved to ${outputDir}`));
    } catch (error) {
      console.error(
        chalk.red(`    ❌ Memory analysis failed: ${error.message}`)
      );
    }
  }

  async generateShortLoad() {
    const url = `http://localhost:${this.options.port}`;

    try {
      const command = `autocannon -c 50 -d 10 ${url}`;
      await execAsync(command);
    } catch (error) {
      console.warn(
        chalk.yellow(`    ⚠️ Short load generation failed: ${error.message}`)
      );
    }
  }

  async generateMemoryPressure() {
    const url = `http://localhost:${this.options.port}`;

    try {
      // Generate requests with large payloads
      const command = [
        'autocannon',
        '-c 100',
        '-d 20',
        '-m POST',
        '-H "content-type=application/json"',
        `-b '${JSON.stringify({
          data: 'x'.repeat(10000),
          array: new Array(1000).fill('test'),
        })}'`,
        `${url}/data`,
      ].join(' ');

      await execAsync(command);
    } catch (error) {
      // Memory pressure test might fail, that's expected
    }
  }

  async collectMemoryStats() {
    try {
      const response = await fetch(
        `http://localhost:${this.options.port}/health`
      );
      const healthData = await response.json();
      return healthData.memory || {};
    } catch (error) {
      return {};
    }
  }

  analyzeMemoryUsage(memStats) {
    const analysis = {
      heapUsed: memStats.heapUsed,
      heapTotal: memStats.heapTotal,
      external: memStats.external,
      recommendations: [],
    };

    if (memStats.heapUsed > 100 * 1024 * 1024) {
      // 100MB
      analysis.recommendations.push(
        'High heap usage detected - consider memory optimization'
      );
    }

    if (memStats.external > 50 * 1024 * 1024) {
      // 50MB
      analysis.recommendations.push(
        'High external memory usage - check for large buffers'
      );
    }

    return analysis;
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

  async ensureOutputDir() {
    const dirs = [
      this.options.outputDir,
      path.join(this.options.outputDir, 'doctor'),
      path.join(this.options.outputDir, 'flame'),
      path.join(this.options.outputDir, 'bubbleprof'),
      path.join(this.options.outputDir, 'heapprofiler'),
      path.join(this.options.outputDir, '0x'),
      path.join(this.options.outputDir, 'node-profiler'),
      path.join(this.options.outputDir, 'memory'),
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }
}

// CLI interface
const argv = yargs(hideBin(process.argv))
  .option('framework', {
    alias: 'f',
    type: 'string',
    description: 'Framework to profile',
    default: 'nextrush',
  })
  .option('port', {
    alias: 'p',
    type: 'number',
    description: 'Server port',
    default: 3000,
  })
  .option('duration', {
    alias: 'd',
    type: 'number',
    description: 'Load generation duration',
    default: 30,
  })
  .option('tools', {
    alias: 't',
    type: 'array',
    description: 'Profiling tools to use',
    default: ['doctor', 'flame', 'bubbleprof', 'heapprofiler'],
  }).argv;

// Create and run profiler
const profiler = new ProfessionalProfiler({
  framework: argv.framework,
  port: argv.port,
  duration: argv.duration,
  tools: argv.tools,
});

profiler.run().catch(console.error);
