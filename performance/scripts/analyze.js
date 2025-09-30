#!/usr/bin/env node

/**
 * Benchmark Results Analyzer
 * Analyzes autocannon results and generates comparison report
 */

const fs = require('fs');
const path = require('path');

const RESULTS_DIR = path.join(__dirname, '../results');
const FRAMEWORKS = ['nextrush', 'express', 'koa', 'fastify'];
const TESTS = ['hello', 'params', 'query', 'post'];

class BenchmarkAnalyzer {
  constructor() {
    this.results = {};
    this.summary = {};
  }

  loadResults() {
    console.log('📂 Loading benchmark results...\n');

    for (const framework of FRAMEWORKS) {
      this.results[framework] = {};

      for (const test of TESTS) {
        const filename = `${framework}-${test}-autocannon.json`;
        const filepath = path.join(RESULTS_DIR, filename);

        try {
          const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
          this.results[framework][test] = data;
          console.log(`✅ Loaded ${filename}`);
        } catch (err) {
          console.log(`⚠️  Skipped ${filename} (not found)`);
        }
      }
    }

    console.log('\n');
  }

  calculateSummary() {
    console.log('📊 Calculating summary statistics...\n');

    for (const framework of FRAMEWORKS) {
      let totalRps = 0;
      let totalLatency = 0;
      let count = 0;

      for (const test of TESTS) {
        if (this.results[framework][test]) {
          totalRps += this.results[framework][test].rps;
          totalLatency += this.results[framework][test].latency.p95;
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
    console.log('📝 Generating markdown report...\n');

    const report = [];

    // Header
    report.push('# Performance Benchmark Results\n');
    report.push(`*Generated: ${new Date().toISOString()}*\n`);
    report.push('## Test Environment\n');
    report.push('- **Method**: autocannon -c 100 -d 40 -p 10');
    report.push('- **Node.js**: ' + process.version);
    report.push('- **Platform**: ' + process.platform + ' ' + process.arch);
    report.push('- **CPU**: ' + require('os').cpus()[0].model);
    report.push('- **Cores**: ' + require('os').cpus().length + '\n');

    // Summary Table
    report.push('## Summary (Average Across All Tests)\n');
    report.push('| Framework | Avg RPS | Avg Latency (p95) | Tests |');
    report.push('|-----------|---------|-------------------|-------|');

    // Sort by RPS
    const sorted = Object.entries(this.summary).sort(
      ([, a], [, b]) => b.avgRps - a.avgRps
    );

    for (const [framework, stats] of sorted) {
      report.push(
        `| **${framework}** | ${stats.avgRps.toLocaleString()} | ${stats.avgLatency}ms | ${stats.testCount}/4 |`
      );
    }
    report.push('\n');

    // Detailed Results by Test
    for (const test of TESTS) {
      report.push(`## Test: ${test.toUpperCase()}\n`);
      report.push(
        '| Framework | RPS | Latency p50 | Latency p95 | Latency p99 |'
      );
      report.push(
        '|-----------|-----|-------------|-------------|-------------|'
      );

      const testResults = [];

      for (const framework of FRAMEWORKS) {
        if (this.results[framework][test]) {
          const data = this.results[framework][test];
          testResults.push({
            framework,
            rps: data.rps,
            p50: data.latency.p50,
            p95: data.latency.p95,
            p99: data.latency.p99,
          });
        }
      }

      // Sort by RPS
      testResults.sort((a, b) => b.rps - a.rps);

      for (const result of testResults) {
        report.push(
          `| **${result.framework}** | ${Math.round(result.rps).toLocaleString()} | ${result.p50}ms | ${result.p95}ms | ${result.p99}ms |`
        );
      }
      report.push('\n');
    }

    // Analysis
    report.push('## Analysis\n');

    const winner = sorted[0];
    if (winner) {
      report.push(
        `**Overall Winner**: ${winner[0]} (${winner[1].avgRps.toLocaleString()} avg RPS)\n`
      );
    }

    if (this.summary.nextrush) {
      const nextrushRps = this.summary.nextrush.avgRps;
      const expressRps = this.summary.express?.avgRps || 0;
      const koaRps = this.summary.koa?.avgRps || 0;
      const fastifyRps = this.summary.fastify?.avgRps || 0;

      if (expressRps > 0) {
        const vsExpress = ((nextrushRps / expressRps - 1) * 100).toFixed(1);
        report.push(
          `- NextRush v2 is **${vsExpress > 0 ? '+' : ''}${vsExpress}%** ${vsExpress > 0 ? 'faster' : 'slower'} than Express`
        );
      }

      if (koaRps > 0) {
        const vsKoa = ((nextrushRps / koaRps - 1) * 100).toFixed(1);
        report.push(
          `- NextRush v2 is **${vsKoa > 0 ? '+' : ''}${vsKoa}%** ${vsKoa > 0 ? 'faster' : 'slower'} than Koa`
        );
      }

      if (fastifyRps > 0) {
        const vsFastify = ((nextrushRps / fastifyRps - 1) * 100).toFixed(1);
        report.push(
          `- NextRush v2 is **${vsFastify > 0 ? '+' : ''}${vsFastify}%** ${vsFastify > 0 ? 'faster' : 'slower'} than Fastify`
        );
      }
    }

    report.push('\n');
    report.push('## Notes\n');
    report.push('- All tests run in production mode');
    report.push('- No logging middleware enabled');
    report.push('- Identical routes and logic across all frameworks');
    report.push('- Results may vary based on hardware and system load\n');

    // Write report
    const reportPath = path.join(RESULTS_DIR, 'BENCHMARK_RESULTS.md');
    fs.writeFileSync(reportPath, report.join('\n'));
    console.log(`✅ Report saved to: ${reportPath}\n`);

    return report.join('\n');
  }

  printConsoleSummary() {
    console.log('='.repeat(60));
    console.log('📊 BENCHMARK SUMMARY');
    console.log('='.repeat(60));
    console.log('');

    const sorted = Object.entries(this.summary).sort(
      ([, a], [, b]) => b.avgRps - a.avgRps
    );

    for (let i = 0; i < sorted.length; i++) {
      const [framework, stats] = sorted[i];
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
      console.log(
        `${medal} ${framework.padEnd(12)} ${stats.avgRps.toLocaleString().padStart(8)} RPS  |  ${stats.avgLatency}ms (p95)`
      );
    }

    console.log('\n' + '='.repeat(60) + '\n');
  }

  run() {
    this.loadResults();
    this.calculateSummary();
    this.printConsoleSummary();
    this.generateMarkdownReport();

    console.log('✨ Analysis complete!\n');
  }
}

// Run analyzer
const analyzer = new BenchmarkAnalyzer();
analyzer.run();
