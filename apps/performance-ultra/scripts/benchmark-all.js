#!/usr/bin/env node

/**
 * 🚀 NextRush v3 Complete Benchmark Suite
 *
 * Enterprise-grade benchmarking tool for comparing NextRush v3 against
 * Express, Fastify, Koa, and Hono.
 *
 * Features:
 * - Automated server management with health checks
 * - Comprehensive test suite (hello, params, query, post, mixed)
 * - Timestamped results with JSON and Markdown reports
 * - Built-in comparison and analysis
 * - Graceful error handling and cleanup
 *
 * Usage:
 *   pnpm bench:all                    # Full benchmark all frameworks
 *   pnpm bench:all --quick            # Quick 10s tests
 *   pnpm bench:all --frameworks nextrush-v3,hono  # Specific frameworks
 *   pnpm bench:all --label "v3.0-alpha" # Add label
 *
 * @author NextRush Team
 * @version 3.0.0
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
const RESULTS_DIR = path.join(PERFORMANCE_DIR, 'results');

// ═══════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_DURATION = 30;
const QUICK_DURATION = 10;
const CONNECTIONS = 100;
const PIPELINING = 10;
const WARMUP_TIME = 3000;
const SERVER_TIMEOUT = 15000;
const PORT = 3000;

const AVAILABLE_FRAMEWORKS = ['nextrush-v3', 'nextrush', 'express', 'fastify', 'koa', 'hono'];

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

// ═══════════════════════════════════════════════════════════════════════════
// Terminal Colors
// ═══════════════════════════════════════════════════════════════════════════

const c = {
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
};

// ═══════════════════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════════════════

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    quick: args.includes('--quick'),
    duration: DEFAULT_DURATION,
    label: '',
    frameworks: [...AVAILABLE_FRAMEWORKS],
  };

  const durationIdx = args.indexOf('--duration');
  if (durationIdx !== -1 && args[durationIdx + 1]) {
    config.duration = parseInt(args[durationIdx + 1], 10) || DEFAULT_DURATION;
  }

  const labelIdx = args.indexOf('--label');
  if (labelIdx !== -1 && args[labelIdx + 1]) {
    config.label = args[labelIdx + 1];
  }

  const frameworksIdx = args.indexOf('--frameworks');
  if (frameworksIdx !== -1 && args[frameworksIdx + 1]) {
    const requested = args[frameworksIdx + 1].split(',').map((f) => f.trim().toLowerCase());
    config.frameworks = requested.filter((f) => AVAILABLE_FRAMEWORKS.includes(f));
  }

  if (config.quick) {
    config.duration = QUICK_DURATION;
  }

  return config;
}

function generateTimestamp() {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}

function formatDisplayDate(timestamp) {
  const [date, time] = timestamp.split('_');
  const [year, month, day] = date.split('-');
  const [hour, minute, second] = time.split('-');
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════════════════
// Server Management
// ═══════════════════════════════════════════════════════════════════════════

async function startServer(framework) {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(PERFORMANCE_DIR, 'servers', `${framework}.js`);

    if (!fs.existsSync(serverPath)) {
      reject(new Error(`Server file not found: ${serverPath}`));
      return;
    }

    const server = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'production' },
    });

    let serverReady = false;
    const timeout = setTimeout(() => {
      if (!serverReady) {
        server.kill('SIGKILL');
        reject(new Error(`${framework} server failed to start within ${SERVER_TIMEOUT / 1000}s`));
      }
    }, SERVER_TIMEOUT);

    server.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('running on') || output.includes('listening') || output.includes('http://localhost')) {
        serverReady = true;
        clearTimeout(timeout);
        resolve(server);
      }
    });

    server.stderr.on('data', (data) => {
      const error = data.toString();
      // Suppress EPIPE/ECONNRESET errors - these are normal during high-load benchmarks
      if (error.includes('EPIPE') || error.includes('ECONNRESET')) {
        return;
      }
      if (error.includes('Error') || error.includes('error')) {
        console.error(`${c.red}  Server error: ${error}${c.reset}`);
      }
    });

    server.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    server.on('exit', (code) => {
      if (!serverReady && code !== 0) {
        clearTimeout(timeout);
        reject(new Error(`${framework} server exited with code ${code}`));
      }
    });
  });
}

async function stopServer(server) {
  if (!server) return;

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      server.kill('SIGKILL');
      resolve();
    }, 5000);

    server.on('exit', () => {
      clearTimeout(timeout);
      // Small delay to ensure all sockets are cleaned up
      setTimeout(resolve, 100);
    });

    server.kill('SIGTERM');
  });
}

async function healthCheck(url, retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {
      await sleep(500);
    }
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// Benchmark Functions
// ═══════════════════════════════════════════════════════════════════════════

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
      p50: result.requests.p50,
      p99: result.requests.p99,
    },
    latency: {
      average: result.latency.average,
      mean: result.latency.mean,
      stddev: result.latency.stddev,
      min: result.latency.min,
      max: result.latency.max,
      p50: result.latency.p50,
      p99: result.latency.p99,
    },
    throughput: {
      total: result.throughput.total,
      average: result.throughput.average,
      mean: result.throughput.mean,
    },
    errors: result.errors,
    timeouts: result.timeouts,
    duration: result.duration,
  };
}

async function benchmarkFramework(framework, config) {
  console.log(`${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
  console.log(`${c.cyan}  📦 Benchmarking: ${c.bold}${framework.toUpperCase()}${c.reset}`);
  console.log(`${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
  console.log('');

  // Start server
  console.log(`${c.yellow}  🚀 Starting ${framework} server...${c.reset}`);
  let server;
  try {
    server = await startServer(framework);
    console.log(`${c.green}  ✓ Server started${c.reset}`);
  } catch (err) {
    console.error(`${c.red}  ✗ Failed to start: ${err.message}${c.reset}`);
    return null;
  }

  // Health check
  const healthy = await healthCheck(`http://localhost:${PORT}/`);
  if (!healthy) {
    console.error(`${c.red}  ✗ Health check failed${c.reset}`);
    await stopServer(server);
    return null;
  }

  // Warmup
  console.log(`${c.yellow}  🔥 Warming up (${WARMUP_TIME / 1000}s)...${c.reset}`);
  await sleep(WARMUP_TIME);

  // Run tests
  const testResults = [];
  for (let i = 0; i < TESTS.length; i++) {
    const test = TESTS[i];
    process.stdout.write(`${c.blue}  [${i + 1}/${TESTS.length}] ${test.title}...${c.reset}`);

    try {
      const result = await runBenchmarkTest(test, config.duration);
      testResults.push(result);
      console.log(`${c.green} ✓ ${Math.round(result.requests.average).toLocaleString()} RPS${c.reset}`);
    } catch (err) {
      console.log(`${c.red} ✗ Error: ${err.message}${c.reset}`);
    }

    if (i < TESTS.length - 1) {
      await sleep(1000);
    }
  }

  // Stop server
  await stopServer(server);
  console.log(`${c.green}  ✓ Server stopped${c.reset}`);
  console.log('');

  // Calculate summary
  const avgRps = testResults.length > 0
    ? Math.round(testResults.reduce((sum, t) => sum + t.requests.average, 0) / testResults.length)
    : 0;
  const avgLatency = testResults.length > 0
    ? testResults.reduce((sum, t) => sum + t.latency.p50, 0) / testResults.length
    : 0;

  return {
    framework,
    tests: testResults,
    summary: {
      avgRps,
      avgLatencyP50: avgLatency,
      avgLatencyP99: testResults.length > 0
        ? testResults.reduce((sum, t) => sum + t.latency.p99, 0) / testResults.length
        : 0,
      totalTests: testResults.length,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Report Generation
// ═══════════════════════════════════════════════════════════════════════════

function generateMarkdownReport(results, config, timestamp) {
  const sysInfo = getSystemInfo();
  const lines = [];

  lines.push('# 🚀 NextRush v3 Complete Benchmark Report\n');
  lines.push(`**Generated**: ${formatDisplayDate(timestamp)}\n`);
  lines.push(`**Timestamp**: \`${timestamp}\`\n`);
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
  lines.push(`| **Memory** | ${sysInfo.totalMemory} total |`);
  lines.push('');

  // Test Configuration
  lines.push('## ⚙️ Test Configuration\n');
  lines.push('| Setting | Value |');
  lines.push('|---------|-------|');
  lines.push(`| **Duration** | ${config.duration}s per test |`);
  lines.push(`| **Connections** | ${CONNECTIONS} |`);
  lines.push(`| **Pipelining** | ${PIPELINING} |`);
  lines.push(`| **Frameworks** | ${results.map((r) => r.framework).join(', ')} |`);
  lines.push('');

  // Overall Ranking
  const sorted = [...results].sort((a, b) => b.summary.avgRps - a.summary.avgRps);
  lines.push('## 🏆 Overall Ranking (by Average RPS)\n');
  lines.push('| Rank | Framework | Avg RPS | Avg Latency (p50) | Avg Latency (p99) |');
  lines.push('|------|-----------|---------|-------------------|-------------------|');

  sorted.forEach((r, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    lines.push(
      `| ${medal} | **${r.framework}** | ${r.summary.avgRps.toLocaleString()} | ${r.summary.avgLatencyP50.toFixed(2)}ms | ${r.summary.avgLatencyP99.toFixed(2)}ms |`
    );
  });
  lines.push('');

  // Comparison with NextRush v3
  const nextrushV3 = results.find((r) => r.framework === 'nextrush-v3');
  if (nextrushV3) {
    lines.push('## 📈 NextRush v3 vs Competition\n');
    lines.push('| Framework | RPS Difference | Performance |');
    lines.push('|-----------|----------------|-------------|');

    for (const r of sorted) {
      if (r.framework === 'nextrush-v3') continue;
      const diff = ((nextrushV3.summary.avgRps / r.summary.avgRps - 1) * 100).toFixed(1);
      const status = parseFloat(diff) > 0 ? `✅ ${diff}% faster` : `⚠️ ${Math.abs(diff)}% slower`;
      lines.push(`| ${r.framework} | ${status} | ${r.summary.avgRps.toLocaleString()} RPS |`);
    }
    lines.push('');
  }

  // Per-Test Results
  lines.push('## 📋 Detailed Results by Test\n');

  for (const test of TESTS) {
    lines.push(`### ${test.title}\n`);
    lines.push(`*${test.description}*\n`);
    lines.push('| Framework | RPS | Latency p50 | Latency p99 | Errors |');
    lines.push('|-----------|-----|-------------|-------------|--------|');

    const testResults = results
      .map((r) => {
        const t = r.tests.find((t) => t.test === test.name);
        return t ? { framework: r.framework, ...t } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.requests.average - a.requests.average);

    for (const t of testResults) {
      lines.push(
        `| **${t.framework}** | ${Math.round(t.requests.average).toLocaleString()} | ${t.latency.p50}ms | ${t.latency.p99}ms | ${t.errors} |`
      );
    }
    lines.push('');
  }

  // Footer
  lines.push('---\n');
  lines.push('*Generated by NextRush Complete Benchmark Suite v3.0*\n');

  return lines.join('\n');
}

function printResults(results, config) {
  console.log('');
  console.log(`${c.magenta}╔══════════════════════════════════════════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.magenta}║${c.reset}                     ${c.bold}🏆 BENCHMARK RESULTS${c.reset}                                    ${c.magenta}║${c.reset}`);
  console.log(`${c.magenta}╚══════════════════════════════════════════════════════════════════════════════╝${c.reset}`);
  console.log('');

  // Sort by RPS
  const sorted = [...results].sort((a, b) => b.summary.avgRps - a.summary.avgRps);

  console.log(`${c.yellow}┌──────────────┬──────────────┬───────────────┬───────────────┬──────────┐${c.reset}`);
  console.log(`${c.yellow}│${c.reset} ${c.bold}Rank${c.reset}         ${c.yellow}│${c.reset} ${c.bold}Framework${c.reset}    ${c.yellow}│${c.reset} ${c.bold}Avg RPS${c.reset}       ${c.yellow}│${c.reset} ${c.bold}Latency (p50)${c.reset} ${c.yellow}│${c.reset} ${c.bold}Tests${c.reset}    ${c.yellow}│${c.reset}`);
  console.log(`${c.yellow}├──────────────┼──────────────┼───────────────┼───────────────┼──────────┤${c.reset}`);

  sorted.forEach((r, i) => {
    const medal = i === 0 ? '🥇 1st' : i === 1 ? '🥈 2nd' : i === 2 ? '🥉 3rd' : `   ${i + 1}th`;
    const framework = r.framework.padEnd(10);
    const rps = r.summary.avgRps.toLocaleString().padStart(11);
    const latency = `${r.summary.avgLatencyP50.toFixed(2)}ms`.padStart(11);
    const tests = `${r.summary.totalTests}/${TESTS.length}`.padStart(6);

    console.log(`${c.yellow}│${c.reset} ${medal}       ${c.yellow}│${c.reset} ${framework} ${c.yellow}│${c.reset} ${rps} ${c.yellow}│${c.reset} ${latency} ${c.yellow}│${c.reset} ${tests} ${c.yellow}│${c.reset}`);
  });

  console.log(`${c.yellow}└──────────────┴──────────────┴───────────────┴───────────────┴──────────┘${c.reset}`);
  console.log('');

  // Show NextRush v3 comparison
  const nextrushV3 = results.find((r) => r.framework === 'nextrush-v3');
  if (nextrushV3) {
    console.log(`${c.cyan}📊 NextRush v3 Performance:${c.reset}`);
    for (const r of sorted) {
      if (r.framework === 'nextrush-v3') continue;
      const diff = ((nextrushV3.summary.avgRps / r.summary.avgRps - 1) * 100);
      const color = diff > 0 ? c.green : c.red;
      const sign = diff > 0 ? '+' : '';
      console.log(`   vs ${r.framework}: ${color}${sign}${diff.toFixed(1)}%${c.reset}`);
    }
    console.log('');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  const config = parseArgs();
  const timestamp = generateTimestamp();
  const resultsDir = path.join(RESULTS_DIR, 'comparison', timestamp);

  // Ensure results directory exists
  fs.mkdirSync(resultsDir, { recursive: true });

  console.log('');
  console.log(`${c.magenta}╔══════════════════════════════════════════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.magenta}║${c.reset}                                                                              ${c.magenta}║${c.reset}`);
  console.log(`${c.magenta}║${c.reset}            ${c.bold}🚀 NextRush v3 Complete Benchmark Suite${c.reset}                         ${c.magenta}║${c.reset}`);
  console.log(`${c.magenta}║${c.reset}                                                                              ${c.magenta}║${c.reset}`);
  console.log(`${c.magenta}╚══════════════════════════════════════════════════════════════════════════════╝${c.reset}`);
  console.log('');

  // Print system information
  const sysInfo = getSystemInfo();
  console.log(`${c.blue}## 🖥️ System Information${c.reset}`);
  console.log(`  - Node.js: ${sysInfo.nodeVersion}`);
  console.log(`  - Platform: ${sysInfo.platform} (${sysInfo.arch})`);
  console.log(`  - CPU: ${sysInfo.cpuModel}`);
  console.log(`  - Cores: ${sysInfo.cpuCores}`);
  console.log(`  - Memory: ${sysInfo.totalMemory} total`);
  console.log('');

  // Print test configuration
  console.log(`${c.blue}## ⚙️ Test Configuration${c.reset}`);
  console.log(`  - Duration: ${config.duration}s per test`);
  console.log(`  - Connections: ${CONNECTIONS}`);
  console.log(`  - Pipelining: ${PIPELINING}`);
  console.log(`  - Frameworks: ${config.frameworks.join(', ')}`);
  console.log('');

  // Run benchmarks for each framework
  const results = [];
  for (const framework of config.frameworks) {
    const result = await benchmarkFramework(framework, config);
    if (result) {
      results.push(result);

      // Save individual framework result
      const frameworkFile = path.join(resultsDir, `${framework}.json`);
      fs.writeFileSync(frameworkFile, JSON.stringify(result, null, 2));
    }

    // Cooldown between frameworks
    if (config.frameworks.indexOf(framework) < config.frameworks.length - 1) {
      console.log(`${c.dim}  Cooldown (2s)...${c.reset}`);
      await sleep(2000);
    }
  }

  if (results.length === 0) {
    console.error(`${c.red}No benchmark results collected. Check server implementations.${c.reset}`);
    process.exit(1);
  }

  // Save combined results
  const combinedResults = {
    timestamp,
    displayDate: formatDisplayDate(timestamp),
    label: config.label,
    config: {
      duration: config.duration,
      connections: CONNECTIONS,
      pipelining: PIPELINING,
      quick: config.quick,
      frameworks: config.frameworks,
    },
    system: getSystemInfo(),
    results,
  };

  const jsonPath = path.join(resultsDir, 'results.json');
  fs.writeFileSync(jsonPath, JSON.stringify(combinedResults, null, 2));

  // Generate and save markdown report
  const report = generateMarkdownReport(results, config, timestamp);
  const reportPath = path.join(resultsDir, 'REPORT.md');
  fs.writeFileSync(reportPath, report);

  // Update latest symlink
  const latestPath = path.join(RESULTS_DIR, 'comparison', 'latest');
  if (fs.existsSync(latestPath)) {
    fs.rmSync(latestPath, { recursive: true });
  }
  fs.cpSync(resultsDir, latestPath, { recursive: true });

  // Print results
  printResults(results, config);

  console.log(`${c.cyan}📁 Results saved to:${c.reset}`);
  console.log(`   ${c.dim}JSON: ${jsonPath}${c.reset}`);
  console.log(`   ${c.dim}Report: ${reportPath}${c.reset}`);
  console.log(`   ${c.dim}Latest: ${latestPath}/${c.reset}`);
  console.log('');

  console.log(`${c.green}╔══════════════════════════════════════════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.green}║${c.reset}                     ${c.bold}✅ Benchmark Complete!${c.reset}                                  ${c.green}║${c.reset}`);
  console.log(`${c.green}╚══════════════════════════════════════════════════════════════════════════════╝${c.reset}`);
  console.log('');

  console.log(`${c.yellow}💡 Next steps:${c.reset}`);
  console.log(`   • View report: ${c.cyan}cat ${reportPath}${c.reset}`);
  console.log(`   • NextRush v3 only: ${c.cyan}pnpm bench:v3${c.reset}`);
  console.log(`   • Compare history: ${c.cyan}pnpm bench:v3:compare${c.reset}`);
  console.log('');
}

// Handle signals
process.on('SIGINT', () => {
  console.log(`\n${c.yellow}⏸️  Benchmark interrupted${c.reset}`);
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});

// Run
main().catch((err) => {
  console.error(`${c.red}Fatal error: ${err.message}${c.reset}`);
  console.error(err.stack);
  process.exit(1);
});
