#!/usr/bin/env node

/**
 * 🚀 NextRush Dedicated Benchmark Suite
 *
 * A comprehensive benchmarking tool for NextRush v2 performance tracking.
 * Saves results with timestamps for easy comparison over time.
 *
 * Features:
 * - Runs all benchmark tests (hello, params, query, post, mixed)
 * - Saves timestamped results to results/nextrush/YYYY-MM-DD_HH-mm-ss/
 * - Generates detailed markdown reports
 * - Automatically compares with previous run
 * - Tracks performance trends over time
 *
 * Usage:
 *   pnpm bench:nextrush              # Run full benchmark
 *   pnpm bench:nextrush --quick      # Quick 10s tests
 *   pnpm bench:nextrush --duration 20 # Custom duration
 *   pnpm bench:nextrush --label "v2.1 refactor"  # Add label
 *
 * @author NextRush Team
 * @version 2.0.0
 */

import autocannon from 'autocannon';
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PERFORMANCE_DIR = path.join(__dirname, '..');
const RESULTS_BASE = path.join(PERFORMANCE_DIR, 'results', 'nextrush');

// Configuration
const DEFAULT_DURATION = 30;
const QUICK_DURATION = 10;
const CONNECTIONS = 100;
const PIPELINING = 10;
const WARMUP_TIME = 3000;
const PORT = 3000;

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
};

/**
 * Test configurations
 */
const TESTS = [
  {
    name: 'hello',
    title: 'Hello World',
    description: 'Simple JSON response - baseline performance',
    url: `http://localhost:${PORT}/`,
    method: 'GET',
  },
  {
    name: 'params',
    title: 'Route Parameters',
    description: 'Dynamic route with params - router performance',
    url: `http://localhost:${PORT}/users/12345`,
    method: 'GET',
  },
  {
    name: 'query',
    title: 'Query Strings',
    description: 'URL query parsing - query parser performance',
    url: `http://localhost:${PORT}/search?q=benchmark&limit=10`,
    method: 'GET',
  },
  {
    name: 'post',
    title: 'POST JSON',
    description: 'POST with JSON body - body parser performance',
    url: `http://localhost:${PORT}/users`,
    method: 'POST',
    body: JSON.stringify({ name: 'Test User', email: 'test@example.com' }),
    headers: { 'content-type': 'application/json' },
  },
  {
    name: 'mixed',
    title: 'Mixed Workload',
    description: 'Combined operations - real-world simulation',
    url: `http://localhost:${PORT}/`,
    method: 'GET',
  },
];

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    quick: args.includes('--quick'),
    duration: DEFAULT_DURATION,
    label: '',
    verbose: args.includes('--verbose') || args.includes('-v'),
  };

  const durationIdx = args.indexOf('--duration');
  if (durationIdx !== -1 && args[durationIdx + 1]) {
    config.duration = parseInt(args[durationIdx + 1], 10) || DEFAULT_DURATION;
  }

  const labelIdx = args.indexOf('--label');
  if (labelIdx !== -1 && args[labelIdx + 1]) {
    config.label = args[labelIdx + 1];
  }

  if (config.quick) {
    config.duration = QUICK_DURATION;
  }

  return config;
}

/**
 * Generate timestamp for folder name
 */
function generateTimestamp() {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}

/**
 * Format timestamp for display
 */
function formatDisplayDate(timestamp) {
  const [date, time] = timestamp.split('_');
  const [year, month, day] = date.split('-');
  const [hour, minute, second] = time.split('-');

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

/**
 * Get system information
 */
function getSystemInfo() {
  const cpus = os.cpus();
  return {
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    cpuModel: cpus[0]?.model || 'Unknown',
    cpuCores: cpus.length,
    totalMemory: `${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`,
    freeMemory: `${Math.round(os.freemem() / 1024 / 1024 / 1024)}GB`,
  };
}

/**
 * Start the NextRush server
 */
function startServer() {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(PERFORMANCE_DIR, 'servers', 'nextrush.js');
    const server = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'production' },
    });

    let serverReady = false;
    const timeout = setTimeout(() => {
      if (!serverReady) {
        server.kill();
        reject(new Error('Server failed to start within 10 seconds'));
      }
    }, 10000);

    server.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('running on') || output.includes('listening')) {
        serverReady = true;
        clearTimeout(timeout);
        resolve(server);
      }
    });

    server.stderr.on('data', (data) => {
      console.error(`${colors.red}Server error: ${data.toString()}${colors.reset}`);
    });

    server.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/**
 * Wait for warmup period
 */
function warmup(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run a single benchmark test
 */
async function runBenchmarkTest(test, duration) {
  const opts = {
    url: test.url,
    connections: CONNECTIONS,
    duration: duration,
    pipelining: PIPELINING,
    method: test.method,
    headers: test.headers || { 'content-type': 'application/json' },
    body: test.body || undefined,
  };

  const result = await autocannon(opts);

  return {
    test: test.name,
    title: test.title,
    description: test.description,
    method: test.method,
    url: test.url,
    requests: {
      total: result.requests.total,
      average: result.requests.average,
      mean: result.requests.mean,
      stddev: result.requests.stddev,
      min: result.requests.min,
      max: result.requests.max,
      p1: result.requests.p1,
      p2_5: result.requests.p2_5,
      p50: result.requests.p50,
      p97_5: result.requests.p97_5,
      p99: result.requests.p99,
    },
    latency: {
      average: result.latency.average,
      mean: result.latency.mean,
      stddev: result.latency.stddev,
      min: result.latency.min,
      max: result.latency.max,
      p1: result.latency.p1,
      p2_5: result.latency.p2_5,
      p50: result.latency.p50,
      p97_5: result.latency.p97_5,
      p99: result.latency.p99,
    },
    throughput: {
      total: result.throughput.total,
      average: result.throughput.average,
      mean: result.throughput.mean,
      stddev: result.throughput.stddev,
      min: result.throughput.min,
      max: result.throughput.max,
    },
    errors: result.errors,
    timeouts: result.timeouts,
    duration: result.duration,
    connections: CONNECTIONS,
    pipelining: PIPELINING,
  };
}

/**
 * Get latest benchmark result for comparison
 */
function getLatestResult() {
  if (!fs.existsSync(RESULTS_BASE)) {
    return null;
  }

  const dirs = fs
    .readdirSync(RESULTS_BASE)
    .filter((d) => {
      const fullPath = path.join(RESULTS_BASE, d);
      return fs.statSync(fullPath).isDirectory() && d.match(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/);
    })
    .sort()
    .reverse();

  if (dirs.length === 0) {
    return null;
  }

  const latestDir = dirs[0];
  const resultsPath = path.join(RESULTS_BASE, latestDir, 'results.json');

  if (fs.existsSync(resultsPath)) {
    return {
      timestamp: latestDir,
      data: JSON.parse(fs.readFileSync(resultsPath, 'utf8')),
    };
  }

  return null;
}

/**
 * Calculate performance change percentage
 */
function calculateChange(current, previous) {
  if (!previous || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/**
 * Format change with color
 */
function formatChange(change, higherIsBetter = true) {
  if (change === null) return `${colors.dim}--${colors.reset}`;

  const isPositive = higherIsBetter ? change > 0 : change < 0;
  const color = isPositive ? colors.green : change === 0 ? colors.dim : colors.red;
  const arrow = change > 0 ? '↑' : change < 0 ? '↓' : '→';
  const sign = change > 0 ? '+' : '';

  return `${color}${arrow} ${sign}${change.toFixed(1)}%${colors.reset}`;
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(results, config, previous) {
  const sysInfo = results.system;
  const lines = [];

  lines.push('# 🚀 NextRush v2 Benchmark Report\n');
  lines.push(`**Generated**: ${results.displayDate}\n`);
  lines.push(`**Timestamp**: \`${results.timestamp}\`\n`);

  if (config.label) {
    lines.push(`**Label**: ${config.label}\n`);
  }

  lines.push('---\n');

  // System Info
  lines.push('## 🖥️ System Information\n');
  lines.push('| Property | Value |');
  lines.push('|----------|-------|');
  lines.push(`| **Node.js** | ${sysInfo.nodeVersion} |`);
  lines.push(`| **Platform** | ${sysInfo.platform} (${sysInfo.arch}) |`);
  lines.push(`| **CPU** | ${sysInfo.cpuModel} |`);
  lines.push(`| **Cores** | ${sysInfo.cpuCores} |`);
  lines.push(`| **Memory** | ${sysInfo.totalMemory} total / ${sysInfo.freeMemory} free |`);
  lines.push('');

  // Test Configuration
  lines.push('## ⚙️ Test Configuration\n');
  lines.push('| Setting | Value |');
  lines.push('|---------|-------|');
  lines.push(`| **Duration** | ${config.duration}s per test |`);
  lines.push(`| **Connections** | ${CONNECTIONS} |`);
  lines.push(`| **Pipelining** | ${PIPELINING} |`);
  lines.push(`| **Mode** | ${config.quick ? 'Quick' : 'Full'} |`);
  lines.push('');

  // Summary Table
  lines.push('## 📊 Results Summary\n');
  lines.push('| Test | RPS | Latency (p50) | Latency (p99) | Throughput |');
  lines.push('|------|-----|---------------|---------------|------------|');

  for (const test of results.tests) {
    const rps = Math.round(test.requests.average).toLocaleString();
    const p50 = `${test.latency.p50}ms`;
    const p99 = `${test.latency.p99}ms`;
    const throughput = `${(test.throughput.average / 1024 / 1024).toFixed(2)} MB/s`;

    lines.push(`| **${test.title}** | ${rps} | ${p50} | ${p99} | ${throughput} |`);
  }
  lines.push('');

  // Comparison with previous
  if (previous) {
    lines.push('## 📈 Comparison with Previous Run\n');
    lines.push(`*Previous run: ${formatDisplayDate(previous.timestamp)}*\n`);
    lines.push('| Test | Current RPS | Previous RPS | Change |');
    lines.push('|------|-------------|--------------|--------|');

    for (const test of results.tests) {
      const prevTest = previous.data.tests.find((t) => t.test === test.test);
      const currentRps = Math.round(test.requests.average);
      const prevRps = prevTest ? Math.round(prevTest.requests.average) : 0;
      const change = calculateChange(currentRps, prevRps);
      const changeStr = change !== null ? `${change > 0 ? '+' : ''}${change.toFixed(1)}%` : '--';

      lines.push(`| **${test.title}** | ${currentRps.toLocaleString()} | ${prevRps.toLocaleString()} | ${changeStr} |`);
    }
    lines.push('');
  }

  // Detailed Results
  lines.push('## 📋 Detailed Results\n');

  for (const test of results.tests) {
    lines.push(`### ${test.title}\n`);
    lines.push(`*${test.description}*\n`);
    lines.push(`- **Endpoint**: \`${test.method} ${test.url}\``);
    lines.push(`- **Total Requests**: ${test.requests.total.toLocaleString()}`);
    lines.push(`- **Errors**: ${test.errors}`);
    lines.push(`- **Timeouts**: ${test.timeouts}`);
    lines.push('');
    lines.push('**Requests/sec Distribution:**');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Average | ${Math.round(test.requests.average).toLocaleString()} |`);
    lines.push(`| Min | ${Math.round(test.requests.min).toLocaleString()} |`);
    lines.push(`| Max | ${Math.round(test.requests.max).toLocaleString()} |`);
    lines.push(`| p50 | ${Math.round(test.requests.p50).toLocaleString()} |`);
    lines.push(`| p99 | ${Math.round(test.requests.p99).toLocaleString()} |`);
    lines.push('');
    lines.push('**Latency Distribution:**');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Average | ${test.latency.average.toFixed(2)}ms |`);
    lines.push(`| Min | ${test.latency.min}ms |`);
    lines.push(`| Max | ${test.latency.max}ms |`);
    lines.push(`| p50 | ${test.latency.p50}ms |`);
    lines.push(`| p99 | ${test.latency.p99}ms |`);
    lines.push('');
  }

  // Performance Summary
  const avgRps = Math.round(results.tests.reduce((sum, t) => sum + t.requests.average, 0) / results.tests.length);
  const avgLatency = results.tests.reduce((sum, t) => sum + t.latency.p50, 0) / results.tests.length;

  lines.push('## 🎯 Performance Summary\n');
  lines.push(`- **Average RPS**: ${avgRps.toLocaleString()} requests/sec`);
  lines.push(`- **Average Latency (p50)**: ${avgLatency.toFixed(2)}ms`);
  lines.push(`- **Total Tests**: ${results.tests.length}`);
  lines.push(`- **Total Duration**: ~${Math.round(config.duration * results.tests.length / 60)} minutes`);
  lines.push('');

  // Footer
  lines.push('---\n');
  lines.push('*Generated by NextRush Benchmark Suite v2.0*\n');

  return lines.join('\n');
}

/**
 * Print results to console
 */
function printResults(results, config, previous) {
  console.log('');
  console.log(`${colors.cyan}╔══════════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║${colors.reset}              ${colors.bold}📊 NextRush v2 Benchmark Results${colors.reset}                      ${colors.cyan}║${colors.reset}`);
  console.log(`${colors.cyan}╚══════════════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log('');
  console.log(`${colors.dim}Timestamp: ${results.timestamp}${colors.reset}`);
  console.log(`${colors.dim}Date: ${results.displayDate}${colors.reset}`);
  if (config.label) {
    console.log(`${colors.dim}Label: ${config.label}${colors.reset}`);
  }
  console.log('');

  // Results table
  console.log(`${colors.yellow}┌────────────────────┬──────────────┬─────────────┬─────────────┬───────────────┐${colors.reset}`);
  console.log(`${colors.yellow}│${colors.reset} ${colors.bold}Test${colors.reset}               ${colors.yellow}│${colors.reset} ${colors.bold}RPS${colors.reset}          ${colors.yellow}│${colors.reset} ${colors.bold}Latency p50${colors.reset} ${colors.yellow}│${colors.reset} ${colors.bold}Latency p99${colors.reset} ${colors.yellow}│${colors.reset} ${colors.bold}vs Previous${colors.reset}   ${colors.yellow}│${colors.reset}`);
  console.log(`${colors.yellow}├────────────────────┼──────────────┼─────────────┼─────────────┼───────────────┤${colors.reset}`);

  for (const test of results.tests) {
    const rps = Math.round(test.requests.average).toLocaleString().padStart(10);
    const p50 = `${test.latency.p50}ms`.padStart(9);
    const p99 = `${test.latency.p99}ms`.padStart(9);

    let change = '--'.padStart(11);
    if (previous) {
      const prevTest = previous.data.tests.find((t) => t.test === test.test);
      if (prevTest) {
        const changeVal = calculateChange(test.requests.average, prevTest.requests.average);
        change = formatChange(changeVal, true).padStart(20); // Extra padding for color codes
      }
    }

    const testName = test.title.padEnd(18);
    console.log(`${colors.yellow}│${colors.reset} ${testName} ${colors.yellow}│${colors.reset} ${rps} ${colors.yellow}│${colors.reset} ${p50} ${colors.yellow}│${colors.reset} ${p99} ${colors.yellow}│${colors.reset} ${change} ${colors.yellow}│${colors.reset}`);
  }

  console.log(`${colors.yellow}└────────────────────┴──────────────┴─────────────┴─────────────┴───────────────┘${colors.reset}`);
  console.log('');

  // Summary
  const avgRps = Math.round(results.tests.reduce((sum, t) => sum + t.requests.average, 0) / results.tests.length);
  const avgLatency = (results.tests.reduce((sum, t) => sum + t.latency.p50, 0) / results.tests.length).toFixed(2);

  console.log(`${colors.green}📈 Average RPS: ${colors.bold}${avgRps.toLocaleString()}${colors.reset}${colors.green} requests/sec${colors.reset}`);
  console.log(`${colors.green}⚡ Average Latency: ${colors.bold}${avgLatency}ms${colors.reset}${colors.green} (p50)${colors.reset}`);
  console.log('');
}

/**
 * Main benchmark runner
 */
async function main() {
  const config = parseArgs();
  const timestamp = generateTimestamp();
  const resultsDir = path.join(RESULTS_BASE, timestamp);

  console.log('');
  console.log(`${colors.magenta}╔══════════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.magenta}║${colors.reset}                                                                      ${colors.magenta}║${colors.reset}`);
  console.log(`${colors.magenta}║${colors.reset}              ${colors.bold}🚀 NextRush v2 Benchmark Suite${colors.reset}                        ${colors.magenta}║${colors.reset}`);
  console.log(`${colors.magenta}║${colors.reset}                                                                      ${colors.magenta}║${colors.reset}`);
  console.log(`${colors.magenta}╚══════════════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log('');
  console.log(`${colors.dim}Timestamp: ${timestamp}${colors.reset}`);
  console.log(`${colors.dim}Mode: ${config.quick ? 'Quick' : 'Full'} (${config.duration}s per test)${colors.reset}`);
  if (config.label) {
    console.log(`${colors.dim}Label: ${config.label}${colors.reset}`);
  }
  console.log('');

  // Create results directory
  fs.mkdirSync(resultsDir, { recursive: true });

  // Get previous results for comparison
  const previous = getLatestResult();
  if (previous) {
    console.log(`${colors.cyan}📋 Previous benchmark: ${formatDisplayDate(previous.timestamp)}${colors.reset}`);
    console.log('');
  }

  // Start server
  console.log(`${colors.yellow}🚀 Starting NextRush server...${colors.reset}`);
  let server;
  try {
    server = await startServer();
    console.log(`${colors.green}✓ Server started on port ${PORT}${colors.reset}`);
  } catch (err) {
    console.error(`${colors.red}✗ Failed to start server: ${err.message}${colors.reset}`);
    process.exit(1);
  }

  // Warmup
  console.log(`${colors.yellow}🔥 Warming up server (${WARMUP_TIME / 1000}s)...${colors.reset}`);
  await warmup(WARMUP_TIME);
  console.log(`${colors.green}✓ Warmup complete${colors.reset}`);
  console.log('');

  // Run tests
  const testResults = [];
  const totalTests = TESTS.length;

  for (let i = 0; i < TESTS.length; i++) {
    const test = TESTS[i];
    console.log(`${colors.blue}[${i + 1}/${totalTests}] Running: ${test.title}${colors.reset}`);
    console.log(`${colors.dim}    ${test.description}${colors.reset}`);

    try {
      const result = await runBenchmarkTest(test, config.duration);
      testResults.push(result);

      const rps = Math.round(result.requests.average).toLocaleString();
      console.log(`${colors.green}    ✓ Complete: ${rps} RPS, ${result.latency.p50}ms (p50)${colors.reset}`);
    } catch (err) {
      console.error(`${colors.red}    ✗ Error: ${err.message}${colors.reset}`);
    }

    // Brief pause between tests
    if (i < TESTS.length - 1) {
      await warmup(1000);
    }
  }

  // Stop server
  server.kill();
  console.log('');
  console.log(`${colors.green}✓ Server stopped${colors.reset}`);

  // Compile results
  const results = {
    timestamp,
    displayDate: formatDisplayDate(timestamp),
    label: config.label,
    config: {
      duration: config.duration,
      connections: CONNECTIONS,
      pipelining: PIPELINING,
      quick: config.quick,
    },
    system: getSystemInfo(),
    tests: testResults,
    summary: {
      avgRps: Math.round(testResults.reduce((sum, t) => sum + t.requests.average, 0) / testResults.length),
      avgLatencyP50: testResults.reduce((sum, t) => sum + t.latency.p50, 0) / testResults.length,
      avgLatencyP99: testResults.reduce((sum, t) => sum + t.latency.p99, 0) / testResults.length,
      totalTests: testResults.length,
    },
  };

  // Save JSON results
  const jsonPath = path.join(resultsDir, 'results.json');
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));

  // Generate and save markdown report
  const report = generateMarkdownReport(results, config, previous);
  const reportPath = path.join(resultsDir, 'REPORT.md');
  fs.writeFileSync(reportPath, report);

  // Update latest symlink/copy
  const latestPath = path.join(RESULTS_BASE, 'latest');
  if (fs.existsSync(latestPath)) {
    fs.rmSync(latestPath, { recursive: true });
  }
  fs.cpSync(resultsDir, latestPath, { recursive: true });

  // Print results
  printResults(results, config, previous);

  // Final summary
  console.log(`${colors.cyan}📁 Results saved to:${colors.reset}`);
  console.log(`   ${colors.dim}JSON: ${jsonPath}${colors.reset}`);
  console.log(`   ${colors.dim}Report: ${reportPath}${colors.reset}`);
  console.log(`   ${colors.dim}Latest: ${latestPath}/${colors.reset}`);
  console.log('');

  console.log(`${colors.green}╔══════════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.green}║${colors.reset}              ${colors.bold}✅ Benchmark Complete!${colors.reset}                                ${colors.green}║${colors.reset}`);
  console.log(`${colors.green}╚══════════════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log('');

  console.log(`${colors.yellow}💡 Next steps:${colors.reset}`);
  console.log(`   • View report: ${colors.cyan}cat ${reportPath}${colors.reset}`);
  console.log(`   • Compare runs: ${colors.cyan}pnpm bench:nextrush:compare${colors.reset}`);
  console.log(`   • View history: ${colors.cyan}pnpm bench:nextrush:history${colors.reset}`);
  console.log('');
}

// Run
main().catch((err) => {
  console.error(`${colors.red}Fatal error: ${err.message}${colors.reset}`);
  process.exit(1);
});
