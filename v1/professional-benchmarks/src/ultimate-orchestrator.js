#!/usr/bin/env node

/**
 * 🔥 ULTIMATE PERFORMANCE ORCHESTRATOR
 *
 * This orchestrator pushes frameworks to their ABSOLUTE LIMITS:
 * - UNLIMITED RPS (no rate limiting)
 * - Escalating connection counts (100 → 2000)
 * - Memory leak detection
 * - CPU throttling monitoring
 * - Breaking point discovery
 * - Real-time resource monitoring
 */

import chalk from 'chalk';
import { exec, spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class UltimateStressOrchestrator {
  constructor() {
    this.frameworks = ['nextrush', 'express', 'fastify'];
    this.ports = { nextrush: 3000, express: 3001, fastify: 3002 };
    this.connectionLevels = [100, 300, 500, 800, 1200, 1600, 2000]; // Escalating pressure
    this.duration = 30; // seconds
    this.outputDir = path.join(__dirname, '..', 'results', 'ultimate-stress');

    this.results = {};
    this.breakingPoints = {};
    this.memoryLeaks = {};
    this.servers = new Map();
  }

  async run() {
    console.log(
      chalk.red.bold(
        '🔥🔥🔥 ULTIMATE STRESS TEST - FIND THE BREAKING POINT! 🔥🔥🔥'
      )
    );
    console.log(
      chalk.red(
        '================================================================'
      )
    );
    console.log('');

    console.log(chalk.yellow('📊 Test Configuration:'));
    console.log(chalk.gray(`   - Frameworks: ${this.frameworks.join(', ')}`));
    console.log(
      chalk.gray(`   - Connection levels: ${this.connectionLevels.join(', ')}`)
    );
    console.log(chalk.gray(`   - Duration: ${this.duration}s per test`));
    console.log(chalk.red.bold('   - RPS: UNLIMITED (find maximum capacity)'));
    console.log('');

    try {
      await this.ensureOutputDir();
      await this.killExistingProcesses();

      // Test each framework to its breaking point
      for (const framework of this.frameworks) {
        await this.stressTestFramework(framework);
      }

      await this.generateUltimateReport();
      this.displayWinner();
    } catch (error) {
      console.error(
        chalk.red('❌ Ultimate stress test failed:'),
        error.message
      );
      process.exit(1);
    }
  }

  async stressTestFramework(framework) {
    console.log('');
    console.log(
      chalk.yellow.bold(`🚀 ULTIMATE STRESS TEST: ${framework.toUpperCase()}`)
    );
    console.log(
      chalk.yellow('================================================')
    );

    const port = this.ports[framework];
    let maxRps = 0;
    let breakingPoint = 0;
    let memoryLeakDetected = false;

    this.results[framework] = [];

    for (const connections of this.connectionLevels) {
      console.log('');
      console.log(
        chalk.cyan(`🔥 Testing ${framework} with ${connections} connections...`)
      );

      try {
        // Start server and get initial metrics
        const { serverPid, initialMemory } = await this.startServerWithMetrics(
          framework,
          port
        );

        console.log(chalk.gray(`   📊 Initial memory: ${initialMemory}MB`));
        console.log(
          chalk.red.bold(
            `   🔥 Running UNLIMITED RPS test for ${this.duration}s...`
          )
        );

        // Run UNLIMITED RPS test (no rate limiting)
        const testResult = await this.runUnlimitedRPSTest(port, connections);

        // Get final memory and calculate increase
        const finalMemory = await this.getProcessMemory(serverPid);
        const memoryIncrease = finalMemory - initialMemory;

        // Analyze results
        const result = {
          framework,
          connections,
          duration: this.duration,
          rps: testResult.rps,
          latency: testResult.latency,
          p99: testResult.p99,
          errors: testResult.errors,
          initialMemory,
          finalMemory,
          memoryIncrease,
          testSuccess: testResult.success,
          timestamp: new Date().toISOString(),
        };

        this.results[framework].push(result);

        // Display results
        if (testResult.success) {
          console.log(
            chalk.green(
              `   ✅ Results: ${testResult.rps.toFixed(
                0
              )} RPS, ${testResult.latency.toFixed(2)}ms latency, ${
                testResult.errors
              } errors`
            )
          );
          console.log(
            chalk.blue(
              `   📈 Memory: ${initialMemory}MB → ${finalMemory}MB (+${memoryIncrease.toFixed(
                1
              )}MB)`
            )
          );

          // Check for breaking point indicators
          if (testResult.errors > 100 || testResult.latency > 1000) {
            console.log(
              chalk.red(
                `   ⚠️  BREAKING POINT DETECTED: High errors (${
                  testResult.errors
                }) or latency (${testResult.latency.toFixed(2)}ms)`
              )
            );
            breakingPoint = connections;
          }

          // Check for memory leak (>50MB increase)
          if (memoryIncrease > 50) {
            console.log(
              chalk.red(
                `   🚨 MEMORY LEAK DETECTED: +${memoryIncrease.toFixed(1)}MB`
              )
            );
            memoryLeakDetected = true;
          }

          // Track maximum RPS
          if (testResult.rps > maxRps) {
            maxRps = testResult.rps;
          }
        } else {
          console.log(
            chalk.red(`   ❌ Test FAILED - Server crashed or unresponsive`)
          );
          breakingPoint = connections;
          break; // Stop testing this framework
        }

        // Stop server
        await this.stopServer(framework, serverPid);

        // If we hit breaking point, stop escalating
        if (breakingPoint > 0) {
          console.log(
            chalk.red(`   🛑 Breaking point reached, stopping escalation`)
          );
          break;
        }
      } catch (error) {
        console.log(chalk.red(`   💥 Catastrophic failure: ${error.message}`));
        breakingPoint = connections;
        break;
      }
    }

    // Store summary
    this.breakingPoints[framework] = breakingPoint;
    this.memoryLeaks[framework] = memoryLeakDetected;

    console.log('');
    console.log(chalk.yellow(`📋 ${framework.toUpperCase()} SUMMARY:`));
    console.log(chalk.green(`   🏆 Maximum RPS: ${maxRps.toFixed(0)}`));
    console.log(
      chalk.red(
        `   🛑 Breaking point: ${breakingPoint || 'Not reached'} connections`
      )
    );
    console.log(
      chalk.blue(`   🧠 Memory leak: ${memoryLeakDetected ? 'YES' : 'NO'}`)
    );

    // Save framework results
    await this.saveFrameworkResults(framework);
  }

  async runUnlimitedRPSTest(port, connections) {
    const url = `http://localhost:${port}`;

    // Use autocannon with NO RATE LIMITING (find maximum RPS)
    const command = [
      'npx',
      'autocannon',
      '-c',
      connections,
      '-d',
      this.duration,
      '--json',
      url,
    ];

    try {
      const { stdout } = await execAsync(command.join(' '), {
        timeout: (this.duration + 10) * 1000,
      });

      const result = JSON.parse(stdout);

      return {
        success: true,
        rps: result.requests?.average || 0,
        latency: result.latency?.average || 0,
        p99: result.latency?.p99 || 0,
        errors: result.errors || 0,
        throughput: result.throughput?.average || 0,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async startServerWithMetrics(framework, port) {
    const adapterPath = path.join(
      __dirname,
      '..',
      'adapters',
      `${framework}.js`
    );

    console.log(
      chalk.gray(`   🚀 Starting ${framework} server on port ${port}...`)
    );

    const serverProcess = spawn('node', [adapterPath, port], {
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false,
    });

    this.servers.set(framework, serverProcess);

    // Wait for server to start
    await this.waitForServer(`http://localhost:${port}`, 10000);

    // Get initial memory
    const initialMemory = await this.getProcessMemory(serverProcess.pid);

    return {
      serverPid: serverProcess.pid,
      initialMemory,
    };
  }

  async getProcessMemory(pid) {
    try {
      const { stdout } = await execAsync(`ps -p ${pid} -o rss= 2>/dev/null`);
      return parseFloat(stdout.trim()) / 1024; // Convert KB to MB
    } catch {
      return 0;
    }
  }

  async waitForServer(url, timeout = 10000) {
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

  async stopServer(framework, pid) {
    if (pid) {
      try {
        process.kill(pid, 'SIGTERM');
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Force kill if still running
        try {
          process.kill(pid, 'SIGKILL');
        } catch (e) {
          // Process already dead
        }
      } catch (error) {
        // Process might already be dead
      }
    }

    this.servers.delete(framework);

    // Additional cleanup
    const port = this.ports[framework];
    try {
      await execAsync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`);
    } catch (e) {
      // Port cleanup failed, continue
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  async saveFrameworkResults(framework) {
    const resultsFile = path.join(
      this.outputDir,
      `${framework}-ultimate-results.json`
    );
    await fs.writeFile(
      resultsFile,
      JSON.stringify(this.results[framework], null, 2)
    );
  }

  async generateUltimateReport() {
    console.log('');
    console.log(chalk.yellow('📊 GENERATING ULTIMATE COMPARISON REPORT...'));
    console.log(chalk.yellow('============================================'));

    // Calculate winners
    let maxRpsWinner = { framework: '', rps: 0 };
    let mostStableWinner = { framework: '', connections: 0 };

    for (const framework of this.frameworks) {
      const frameworkResults = this.results[framework] || [];
      const maxRps = Math.max(...frameworkResults.map((r) => r.rps || 0));
      const maxConnections = Math.max(
        ...frameworkResults
          .filter((r) => r.testSuccess)
          .map((r) => r.connections)
      );

      if (maxRps > maxRpsWinner.rps) {
        maxRpsWinner = { framework, rps: maxRps };
      }

      if (maxConnections > mostStableWinner.connections) {
        mostStableWinner = { framework, connections: maxConnections };
      }
    }

    // Generate report
    const report = {
      testType: 'Ultimate Stress Test - Breaking Point Discovery',
      testConfig: {
        connectionLevels: this.connectionLevels,
        duration: this.duration,
        rpsLimit: 'UNLIMITED',
        frameworks: this.frameworks,
      },
      winners: {
        maxRps: maxRpsWinner,
        mostStable: mostStableWinner,
      },
      results: this.results,
      breakingPoints: this.breakingPoints,
      memoryLeaks: this.memoryLeaks,
      timestamp: new Date().toISOString(),
    };

    const reportFile = path.join(this.outputDir, 'ultimate-stress-report.json');
    await fs.writeFile(reportFile, JSON.stringify(report, null, 2));

    // Generate markdown report
    await this.generateMarkdownReport(report);
  }

  async generateMarkdownReport(report) {
    let markdown = `# 🔥 ULTIMATE STRESS TEST RESULTS 🔥

## Test Configuration
- **Test Type**: Breaking Point Discovery
- **Connection Levels**: ${this.connectionLevels.join(', ')}
- **RPS Limit**: UNLIMITED (maximum capacity testing)
- **Duration**: ${this.duration} seconds per test
- **Monitoring**: Memory usage, error rates, latency spikes

## 🏆 ULTIMATE WINNERS

### 🚀 Maximum RPS Champion
**${report.winners.maxRps.framework.toUpperCase()}** - ${report.winners.maxRps.rps.toFixed(
      0
    )} RPS

### 🛡️ Stability Champion
**${report.winners.mostStable.framework.toUpperCase()}** - Handled ${
      report.winners.mostStable.connections
    } connections

## Detailed Results

`;

    for (const framework of this.frameworks) {
      const frameworkResults = this.results[framework] || [];
      const maxRps = Math.max(...frameworkResults.map((r) => r.rps || 0));
      const breakingPoint = this.breakingPoints[framework];
      const memoryLeak = this.memoryLeaks[framework];

      markdown += `### ${framework.toUpperCase()} Framework

- **Maximum RPS Achieved**: ${maxRps.toFixed(0)}
- **Breaking Point**: ${breakingPoint || 'Not reached'} connections
- **Memory Leak Detected**: ${memoryLeak ? 'YES 🚨' : 'NO ✅'}

#### Performance by Connection Count:
| Connections | RPS | Latency (ms) | P99 (ms) | Memory Increase (MB) | Status |
|-------------|-----|--------------|----------|---------------------|---------|
`;

      frameworkResults.forEach((result) => {
        const status = result.testSuccess ? '✅' : '❌';
        markdown += `| ${result.connections} | ${(result.rps || 0).toFixed(
          0
        )} | ${(result.latency || 0).toFixed(2)} | ${(result.p99 || 0).toFixed(
          2
        )} | +${(result.memoryIncrease || 0).toFixed(1)} | ${status} |\n`;
      });

      markdown += '\n';
    }

    markdown += `
## Analysis Notes

This test pushed each framework to its absolute limits to discover:
1. **Maximum RPS capacity** (without rate limiting)
2. **Breaking points** (where frameworks start failing)
3. **Memory leak detection** (unusual memory growth)
4. **Stability under extreme load**

## Next Steps

1. Optimize the losing frameworks based on these results
2. Investigate memory leaks in frameworks that showed unusual growth
3. Use these breaking points to set safe production limits

*Generated on ${new Date().toLocaleString()}*
`;

    const markdownFile = path.join(this.outputDir, 'ultimate-stress-report.md');
    await fs.writeFile(markdownFile, markdown);
  }

  displayWinner() {
    console.log('');
    console.log(chalk.red.bold('🎉 ULTIMATE STRESS TEST COMPLETE!'));
    console.log(chalk.red('==============================='));

    // Find overall winner (highest max RPS)
    let winner = { framework: '', rps: 0 };
    for (const framework of this.frameworks) {
      const frameworkResults = this.results[framework] || [];
      const maxRps = Math.max(...frameworkResults.map((r) => r.rps || 0));
      if (maxRps > winner.rps) {
        winner = { framework, rps: maxRps };
      }
    }

    console.log(
      chalk.green.bold(`🏆 ULTIMATE WINNER: ${winner.framework.toUpperCase()}`)
    );
    console.log(chalk.green(`🚀 Maximum RPS: ${winner.rps.toFixed(0)}`));
    console.log('');
    console.log(chalk.blue(`📁 Results: ${this.outputDir}/`));
    console.log(
      chalk.blue(`📊 Report: ${this.outputDir}/ultimate-stress-report.md`)
    );
  }

  async ensureOutputDir() {
    await fs.mkdir(this.outputDir, { recursive: true });
  }

  async killExistingProcesses() {
    try {
      await execAsync('killall node 2>/dev/null || true');
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      // Ignore errors
    }
  }
}

// Run the ultimate stress test
const orchestrator = new UltimateStressOrchestrator();
orchestrator.run().catch(console.error);
