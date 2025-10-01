#!/usr/bin/env node

/**
 * K6 Results Parser
 * Extracts summary metrics from large K6 JSON files using statistical sampling
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const RESULTS_DIR = path.join(__dirname, '../results');
const FRAMEWORKS = ['nextrush', 'express', 'koa', 'fastify'];
const TESTS = ['hello', 'params', 'query', 'post', 'mixed'];

class K6Parser {
  constructor() {
    this.results = {};
    this.timestamp = new Date().toISOString();
  }

  async parseK6File(filePath) {
    return new Promise((resolve, reject) => {
      console.log('  📊 Using grep sampling for fast analysis...');

      // Use shell commands for fast parsing
      const commands = [
        `grep -c '"metric":"iterations"' "${filePath}"`,
        `grep '"metric":"http_req_duration"' "${filePath}" | head -5000 | grep -o '"value":[0-9.]*' | cut -d: -f2`,
        `grep -c '"metric":"http_req_failed","data":{"value":1' "${filePath}"`,
      ];

      const results = {};
      let commandsCompleted = 0;

      // Count iterations
      const iter = spawn('sh', ['-c', commands[0]]);
      let iterations = '';
      iter.stdout.on('data', data => (iterations += data.toString()));
      iter.on('close', () => {
        results.iterations = parseInt(iterations.trim()) || 0;
        commandsCompleted++;
        if (commandsCompleted === 3) processResults();
      });

      // Sample durations
      const dur = spawn('sh', ['-c', commands[1]]);
      let durations = '';
      dur.stdout.on('data', data => (durations += data.toString()));
      dur.on('close', () => {
        results.durations = durations
          .trim()
          .split('\n')
          .map(v => parseFloat(v))
          .filter(v => !isNaN(v));
        commandsCompleted++;
        if (commandsCompleted === 3) processResults();
      });

      // Count failures
      const fail = spawn('sh', ['-c', commands[2]]);
      let failures = '';
      fail.stdout.on('data', data => (failures += data.toString()));
      fail.on('close', () => {
        results.failures = parseInt(failures.trim()) || 0;
        commandsCompleted++;
        if (commandsCompleted === 3) processResults();
      });

      function processResults() {
        const metrics = {
          http_reqs: results.iterations,
          iterations: results.iterations,
          http_req_failed: results.failures,
          http_req_duration_p50: 0,
          http_req_duration_p95: 0,
          http_req_duration_p99: 0,
          http_req_duration_avg: 0,
        };

        if (results.durations && results.durations.length > 0) {
          results.durations.sort((a, b) => a - b);
          const len = results.durations.length;

          metrics.http_req_duration_avg =
            results.durations.reduce((a, b) => a + b, 0) / len;
          metrics.http_req_duration_p50 =
            results.durations[Math.floor(len * 0.5)];
          metrics.http_req_duration_p95 =
            results.durations[Math.floor(len * 0.95)];
          metrics.http_req_duration_p99 =
            results.durations[Math.floor(len * 0.99)];
        }

        console.log(
          `  ✅ Sampled ${results.durations.length} duration metrics from ${results.iterations.toLocaleString()} iterations`
        );

        resolve(metrics);
      }
    });
  }

  async loadAllResults() {
    console.log('📂 Loading K6 results...\n');

    for (const framework of FRAMEWORKS) {
      this.results[framework] = {};

      for (const test of TESTS) {
        const k6File = `${framework}-${test}-k6.json`;
        const k6Path = path.join(RESULTS_DIR, k6File);

        if (fs.existsSync(k6Path)) {
          const stats = fs.statSync(k6Path);
          const fileSizeMB = (stats.size / 1024 / 1024).toFixed(0);

          console.log(
            `\n🔍 Parsing ${k6File} (${fileSizeMB}MB - this may take a moment)...`
          );

          try {
            const metrics = await this.parseK6File(k6Path);
            this.results[framework][test] = metrics;
            console.log(`✅ Successfully parsed ${k6File}`);
          } catch (err) {
            console.log(`❌ Failed to parse ${k6File}: ${err.message}`);
          }
        }
      }
    }

    console.log('\n✨ All K6 files processed!\n');
  }

  generateK6Report() {
    const sections = [];

    sections.push('# 🚀 K6 Performance Test Results\n');
    sections.push(`*Generated: ${this.timestamp}*\n`);
    sections.push('## Test Environment\n');
    sections.push('- **Tool**: K6 Load Testing');
    sections.push('- **Virtual Users**: 100');
    sections.push('- **Duration**: 60 seconds');
    sections.push('- **Think Time**: 100ms between requests\n');

    sections.push('## Results by Test Scenario\n');

    for (const test of TESTS) {
      const hasData = FRAMEWORKS.some(
        fw => this.results[fw][test] && this.results[fw][test].http_reqs > 0
      );

      if (hasData) {
        sections.push(`### ${test.toUpperCase()}\n`);
        sections.push(
          '| Framework | Total Requests | RPS | p50 | p95 | p99 | Avg | Failed % |'
        );
        sections.push(
          '|-----------|----------------|-----|-----|-----|-----|-----|----------|'
        );

        const results = [];

        for (const framework of FRAMEWORKS) {
          if (
            this.results[framework][test] &&
            this.results[framework][test].http_reqs > 0
          ) {
            results.push({
              framework,
              data: this.results[framework][test],
            });
          }
        }

        // Sort by RPS (iterations per second)
        results.sort((a, b) => b.data.iterations / 60 - a.data.iterations / 60);

        for (const result of results) {
          const data = result.data;
          const rps = (data.iterations / 60).toFixed(0);
          const failedPct = (
            (data.http_req_failed / data.http_reqs) *
            100
          ).toFixed(2);

          sections.push(
            `| **${result.framework}** | ${data.http_reqs.toLocaleString()} | ${rps} | ${data.http_req_duration_p50.toFixed(2)}ms | ${data.http_req_duration_p95.toFixed(2)}ms | ${data.http_req_duration_p99.toFixed(2)}ms | ${data.http_req_duration_avg.toFixed(2)}ms | ${failedPct}% |`
          );
        }

        sections.push('\n');
      }
    }

    // Overall Summary
    sections.push('## Overall Performance Summary\n');
    sections.push(
      '| Framework | Avg RPS | Avg p95 Latency | Avg p99 Latency |'
    );
    sections.push(
      '|-----------|---------|-----------------|-----------------|'
    );

    const summaries = [];

    for (const framework of FRAMEWORKS) {
      let totalIterations = 0;
      let totalP95 = 0;
      let totalP99 = 0;
      let count = 0;

      for (const test of TESTS) {
        if (
          this.results[framework][test] &&
          this.results[framework][test].http_reqs > 0
        ) {
          totalIterations += this.results[framework][test].iterations;
          totalP95 += this.results[framework][test].http_req_duration_p95;
          totalP99 += this.results[framework][test].http_req_duration_p99;
          count++;
        }
      }

      if (count > 0) {
        summaries.push({
          framework,
          avgRps: Math.round(totalIterations / 60 / count),
          avgP95: (totalP95 / count).toFixed(2),
          avgP99: (totalP99 / count).toFixed(2),
        });
      }
    }

    // Sort by RPS
    summaries.sort((a, b) => b.avgRps - a.avgRps);

    for (const summary of summaries) {
      sections.push(
        `| **${summary.framework}** | ${summary.avgRps.toLocaleString()} | ${summary.avgP95}ms | ${summary.avgP99}ms |`
      );
    }

    sections.push('\n');

    // Winner
    if (summaries.length > 0) {
      const winner = summaries[0];
      sections.push('## 🏆 K6 Test Winner\n');
      sections.push(
        `**${winner.framework}** with ${winner.avgRps} average RPS`
      );
      sections.push(`- **Average p95 Latency**: ${winner.avgP95}ms`);
      sections.push(`- **Average p99 Latency**: ${winner.avgP99}ms\n`);
    }

    // NextRush Analysis
    const nextrush = summaries.find(s => s.framework === 'nextrush');
    if (nextrush) {
      sections.push('## NextRush v2 K6 Performance\n');

      const express = summaries.find(s => s.framework === 'express');
      const koa = summaries.find(s => s.framework === 'koa');
      const fastify = summaries.find(s => s.framework === 'fastify');

      if (express) {
        const diff = ((nextrush.avgRps / express.avgRps - 1) * 100).toFixed(1);
        const emoji = diff > 0 ? '🚀' : '📉';
        sections.push(
          `${emoji} **${diff > 0 ? '+' : ''}${diff}%** vs Express (${express.avgRps} RPS)`
        );
      }

      if (koa) {
        const diff = ((nextrush.avgRps / koa.avgRps - 1) * 100).toFixed(1);
        const emoji = diff > 0 ? '🚀' : '📉';
        sections.push(
          `${emoji} **${diff > 0 ? '+' : ''}${diff}%** vs Koa (${koa.avgRps} RPS)`
        );
      }

      if (fastify) {
        const diff = ((nextrush.avgRps / fastify.avgRps - 1) * 100).toFixed(1);
        const emoji = diff > 0 ? '🚀' : '📉';
        sections.push(
          `${emoji} **${diff > 0 ? '+' : ''}${diff}%** vs Fastify (${fastify.avgRps} RPS)`
        );
      }

      sections.push('\n');
    }

    sections.push('## Methodology\n');
    sections.push(
      '- **Load Pattern**: Constant 100 virtual users for 60 seconds'
    );
    sections.push('- **Think Time**: 100ms pause between requests');
    sections.push('- **Warmup**: 30 seconds before measurement starts');
    sections.push('- **Protocol**: HTTP/1.1');
    sections.push('- **Timeout**: 30 seconds per request\n');

    sections.push('## Notes\n');
    sections.push(
      '- All tests performed with identical configuration across frameworks'
    );
    sections.push('- Production mode enabled (NODE_ENV=production)');
    sections.push('- No logging middleware active during tests');
    sections.push('- Results represent real-world load testing scenarios\n');

    sections.push('---\n');
    sections.push(
      '*Load testing performed using [Grafana K6](https://k6.io/)*\n'
    );

    return sections.join('\n');
  }

  saveReport() {
    const reportPath = path.join(RESULTS_DIR, 'K6_BENCHMARK_REPORT.md');
    const report = this.generateK6Report();

    fs.writeFileSync(reportPath, report);
    console.log(`\n✅ K6 report saved to: ${reportPath}`);

    return reportPath;
  }

  async run() {
    await this.loadAllResults();
    const reportPath = this.saveReport();

    console.log('\n✨ K6 report generation complete!');
    console.log(`📖 View your results: ${reportPath}\n`);
  }
}

// Run K6 parser
const parser = new K6Parser();
parser.run().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
