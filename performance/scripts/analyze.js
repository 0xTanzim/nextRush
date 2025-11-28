#!/usr/bin/env node

/**
 * 📊 Benchmark Results Analyzer
 *
 * Analyzes autocannon benchmark results and generates comparison reports.
 * Supports all frameworks: NextRush, Express, Fastify, Koa, Hono.
 *
 * @author NextRush Team
 * @version 2.0.0
 */

import fs from 'fs';
import os from 'os';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const RESULTS_DIR = path.join(__dirname, '../results');

// All supported frameworks
const FRAMEWORKS = ['nextrush', 'express', 'koa', 'fastify', 'hono'];
const TESTS = ['hello', 'params', 'query', 'post', 'mixed'];

// Colors
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
};

class BenchmarkAnalyzer {
  constructor() {
    this.results = {};
    this.summary = {};
  }

  loadResults() {
    console.log(`${c.cyan}📂 Loading benchmark results...${c.reset}\n`);

    // Ensure results directory exists
    if (!fs.existsSync(RESULTS_DIR)) {
      console.log(`${c.yellow}⚠️ Results directory not found: ${RESULTS_DIR}${c.reset}`);
      return;
    }

    for (const framework of FRAMEWORKS) {
      this.results[framework] = {};

      for (const test of TESTS) {
        const filename = `${framework}-${test}-autocannon.json`;
        const filepath = path.join(RESULTS_DIR, filename);

        try {
          if (fs.existsSync(filepath)) {
            const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
            this.results[framework][test] = data;
            console.log(`${c.green}✅${c.reset} Loaded ${filename}`);
          }
        } catch (err) {
          console.log(`${c.yellow}⚠️${c.reset}  Failed to load ${filename}: ${err.message}`);
        }
      }
    }

    console.log('');
  }

  calculateSummary() {
    console.log(`${c.cyan}📊 Calculating summary statistics...${c.reset}\n`);

    for (const framework of FRAMEWORKS) {
      let totalRps = 0;
      let totalLatency = 0;
      let count = 0;

      for (const test of TESTS) {
        const data = this.results[framework]?.[test];
        if (data) {
          // Handle different result formats
          const rps = data.rps || data.requests?.average || 0;
          const latency = data.latency?.p99 || 0;

          totalRps += rps;
          totalLatency += latency;
          count++;
        }
      }

      if (count > 0) {
        this.summary[framework] = {
          avgRps: Math.round(totalRps / count),
          avgLatency: Math.round(totalLatency / count),
          testCount: count,
        };
      }
    }
  }

  generateMarkdownReport() {
    console.log(`${c.cyan}📝 Generating markdown report...${c.reset}\n`);

    const report = [];

    // Header
    report.push('# Performance Benchmark Results\n');
    report.push(`*Generated: ${new Date().toISOString()}*\n`);

    // Environment
    report.push('## Test Environment\n');
    report.push('- **Method**: autocannon -c 100 -d 40 -p 10');
    report.push('- **Node.js**: ' + process.version);
    report.push('- **Platform**: ' + process.platform + ' ' + process.arch);
    report.push('- **CPU**: ' + os.cpus()[0].model);
    report.push('- **Cores**: ' + os.cpus().length);
    report.push('\n');

    // Summary Table
    const sorted = Object.entries(this.summary).sort(([, a], [, b]) => b.avgRps - a.avgRps);

    if (sorted.length === 0) {
      report.push('## No Results Found\n');
      report.push('Run benchmarks first using `pnpm bench:all` or `pnpm bench:nextrush`\n');
    } else {
      report.push('## Summary (Average Across All Tests)\n');
      report.push('| Rank | Framework | Avg RPS | Avg Latency (p99) | Tests |');
      report.push('|------|-----------|---------|-------------------|-------|');

      sorted.forEach(([framework, stats], i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        report.push(
          `| ${medal} | **${framework}** | ${stats.avgRps.toLocaleString()} | ${stats.avgLatency}ms | ${stats.testCount}/${TESTS.length} |`
        );
      });
      report.push('\n');

      // Detailed Results by Test
      for (const test of TESTS) {
        const testResults = [];

        for (const framework of FRAMEWORKS) {
          const data = this.results[framework]?.[test];
          if (data) {
            testResults.push({
              framework,
              rps: data.rps || data.requests?.average || 0,
              p50: data.latency?.p50 || 0,
              p99: data.latency?.p99 || 0,
              mean: data.latency?.mean || data.latency?.average || 0,
              throughput: data.throughput?.average || data.throughput || 0,
            });
          }
        }

        if (testResults.length > 0) {
          report.push(`## Test: ${test.toUpperCase()}\n`);
          report.push('| Framework | RPS | Latency p50 | Latency p99 | Latency Avg | Throughput |');
          report.push('|-----------|-----|-------------|-------------|-------------|------------|');

          testResults.sort((a, b) => b.rps - a.rps);

          for (const result of testResults) {
            const throughputMB = ((result.throughput || 0) / 1024 / 1024).toFixed(2);
            report.push(
              `| **${result.framework}** | ${Math.round(result.rps).toLocaleString()} | ${result.p50}ms | ${result.p99}ms | ${(result.mean || 0).toFixed(2)}ms | ${throughputMB} MB/s |`
            );
          }
          report.push('\n');
        }
      }

      // Analysis
      report.push('## Analysis\n');

      if (sorted.length > 0) {
        const [winner, winnerStats] = sorted[0];
        report.push(`**Overall Winner**: ${winner} (${winnerStats.avgRps.toLocaleString()} avg RPS)\n`);
      }

      // NextRush comparison
      if (this.summary.nextrush) {
        const nextrushRps = this.summary.nextrush.avgRps;

        for (const [framework, stats] of sorted) {
          if (framework === 'nextrush') continue;
          const diff = ((nextrushRps / stats.avgRps - 1) * 100).toFixed(1);
          const emoji = parseFloat(diff) > 0 ? '🚀' : '📉';
          report.push(`${emoji} NextRush is **${diff > 0 ? '+' : ''}${diff}%** vs ${framework}`);
        }
      }
    }

    report.push('\n');
    report.push('## Notes\n');
    report.push('- All tests run in production mode');
    report.push('- No logging middleware enabled');
    report.push('- Identical routes and logic across all frameworks');
    report.push('- Results may vary based on hardware and system load\n');

    // Write report
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    const reportPath = path.join(RESULTS_DIR, 'BENCHMARK_RESULTS.md');
    fs.writeFileSync(reportPath, report.join('\n'));
    console.log(`${c.green}✅${c.reset} Report saved to: ${reportPath}\n`);

    return report.join('\n');
  }

  printConsoleSummary() {
    const sorted = Object.entries(this.summary).sort(([, a], [, b]) => b.avgRps - a.avgRps);

    if (sorted.length === 0) {
      console.log(`${c.yellow}No benchmark results found.${c.reset}`);
      console.log(`Run ${c.cyan}pnpm bench:all${c.reset} or ${c.cyan}pnpm bench:nextrush${c.reset} first.\n`);
      return;
    }

    console.log('');
    console.log(`${c.magenta}═══════════════════════════════════════════════════════════════${c.reset}`);
    console.log(`${c.magenta}                    📊 BENCHMARK SUMMARY${c.reset}`);
    console.log(`${c.magenta}═══════════════════════════════════════════════════════════════${c.reset}`);
    console.log('');

    for (let i = 0; i < sorted.length; i++) {
      const [framework, stats] = sorted[i];
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
      const rps = stats.avgRps.toLocaleString().padStart(10);
      const latency = `${stats.avgLatency}ms`.padStart(6);
      console.log(`${medal} ${framework.padEnd(12)} ${rps} RPS  |  ${latency} (p99)`);
    }

    console.log('');
    console.log(`${c.magenta}═══════════════════════════════════════════════════════════════${c.reset}`);
    console.log('');
  }

  run() {
    this.loadResults();
    this.calculateSummary();
    this.printConsoleSummary();
    this.generateMarkdownReport();

    console.log(`${c.green}✨ Analysis complete!${c.reset}\n`);
  }
}

// Run analyzer
const analyzer = new BenchmarkAnalyzer();
analyzer.run();
