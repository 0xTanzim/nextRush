#!/usr/bin/env node

/**
 * Benchmark Report Generator
 * Creates comprehensive markdown report from all test results
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const RESULTS_DIR = path.join(__dirname, '../results');
const FRAMEWORKS = ['nextrush', 'express', 'koa', 'fastify'];
const TESTS = ['hello', 'params', 'query', 'post', 'mixed'];

class ReportGenerator {
  constructor() {
    this.autocannonResults = {};
    this.k6Results = {};
    this.timestamp = new Date().toISOString();
  }

  loadResults() {
    console.log('📂 Loading all benchmark results...\n');

    for (const framework of FRAMEWORKS) {
      this.autocannonResults[framework] = {};
      this.k6Results[framework] = {};

      for (const test of TESTS) {
        // Load autocannon results
        const autocannonFile = `${framework}-${test}-autocannon.json`;
        const autocannonPath = path.join(RESULTS_DIR, autocannonFile);

        if (fs.existsSync(autocannonPath)) {
          this.autocannonResults[framework][test] = JSON.parse(
            fs.readFileSync(autocannonPath, 'utf8')
          );
          console.log(`✅ Loaded ${autocannonFile}`);
        }

        // Load k6 results
        const k6File = `${framework}-${test}-k6.json`;
        const k6Path = path.join(RESULTS_DIR, k6File);

        if (fs.existsSync(k6Path)) {
          try {
            // K6 outputs line-delimited JSON, parse last line (summary)
            const content = fs.readFileSync(k6Path, 'utf8');
            const lines = content.trim().split('\n');
            const summary = JSON.parse(lines[lines.length - 1]);
            this.k6Results[framework][test] = summary;
            console.log(`✅ Loaded ${k6File}`);
          } catch (err) {
            console.log(`⚠️  Failed to parse ${k6File}`);
          }
        }
      }
    }

    console.log('\n');
  }

  generateSystemInfo() {
    const cpus = os.cpus();
    return [
      '## Test Environment\n',
      `- **Date**: ${this.timestamp}`,
      `- **Node.js**: ${process.version}`,
      `- **Platform**: ${os.platform()} ${os.arch()}`,
      `- **CPU**: ${cpus[0].model}`,
      `- **Cores**: ${cpus.length} (${os.cpus().length} threads)`,
      `- **Memory**: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
      `- **OS**: ${os.type()} ${os.release()}`,
      '\n',
    ].join('\n');
  }

  generateAutocannonReport() {
    const sections = [];

    sections.push('## Autocannon Results\n');
    sections.push(
      '**Configuration**: 100 connections, 40s duration, pipelining 10\n'
    );

    for (const test of TESTS) {
      sections.push(`### ${test.toUpperCase()}\n`);
      sections.push(
        '| Framework | RPS | Latency p50 | Latency p95 | Latency p99 | Throughput |'
      );
      sections.push(
        '|-----------|-----|-------------|-------------|-------------|------------|'
      );

      const results = [];

      for (const framework of FRAMEWORKS) {
        if (this.autocannonResults[framework][test]) {
          const data = this.autocannonResults[framework][test];
          results.push({
            framework,
            rps: data.rps,
            p50: data.latency.p50,
            p95: data.latency.p95,
            p99: data.latency.p99,
            throughput: data.throughput,
          });
        }
      }

      results.sort((a, b) => b.rps - a.rps);

      for (const result of results) {
        const throughputMB = (result.throughput / 1024 / 1024).toFixed(2);
        sections.push(
          `| **${result.framework}** | ${Math.round(result.rps).toLocaleString()} | ${result.p50}ms | ${result.p95}ms | ${result.p99}ms | ${throughputMB} MB/s |`
        );
      }
      sections.push('\n');
    }

    return sections.join('\n');
  }

  generateK6Report() {
    const sections = [];

    sections.push('## K6 Results\n');
    sections.push('**Configuration**: 100 VUs, 60s duration\n');

    for (const test of TESTS) {
      const hasData = FRAMEWORKS.some(fw => this.k6Results[fw][test]);

      if (hasData) {
        sections.push(`### ${test.toUpperCase()}\n`);
        sections.push(
          '| Framework | Iterations | RPS | p95 Latency | Failed Requests |'
        );
        sections.push(
          '|-----------|------------|-----|-------------|-----------------|'
        );

        for (const framework of FRAMEWORKS) {
          if (this.k6Results[framework][test]) {
            const data = this.k6Results[framework][test];
            const metrics = data.metrics || {};

            const iterations = metrics.iterations?.values?.count || 0;
            const duration = metrics.iterations?.values?.rate || 0;
            const rps = duration.toFixed(2);
            const p95 = metrics.http_req_duration?.values?.['p(95)'] || 0;
            const failed = metrics.http_req_failed?.values?.rate || 0;

            sections.push(
              `| **${framework}** | ${iterations.toLocaleString()} | ${rps} | ${p95.toFixed(2)}ms | ${(failed * 100).toFixed(2)}% |`
            );
          }
        }
        sections.push('\n');
      }
    }

    return sections.join('\n');
  }

  generateAnalysis() {
    const sections = [];

    sections.push('## Performance Analysis\n');

    // Calculate averages across all tests
    const avgStats = {};

    for (const framework of FRAMEWORKS) {
      let totalRps = 0;
      let totalLatency = 0;
      let count = 0;

      for (const test of TESTS) {
        if (this.autocannonResults[framework][test]) {
          totalRps += this.autocannonResults[framework][test].rps;
          totalLatency += this.autocannonResults[framework][test].latency.p95;
          count++;
        }
      }

      if (count > 0) {
        avgStats[framework] = {
          avgRps: Math.round(totalRps / count),
          avgLatency: Math.round(totalLatency / count),
        };
      }
    }

    // Sort by RPS
    const sorted = Object.entries(avgStats).sort(
      ([, a], [, b]) => b.avgRps - a.avgRps
    );

    if (sorted.length > 0) {
      const [winner, winnerStats] = sorted[0];
      sections.push(`### 🏆 Overall Winner: **${winner}**\n`);
      sections.push(
        `- **Average RPS**: ${winnerStats.avgRps.toLocaleString()}`
      );
      sections.push(`- **Average p95 Latency**: ${winnerStats.avgLatency}ms\n`);
    }

    // Comparative analysis for NextRush
    if (avgStats.nextrush) {
      sections.push('### NextRush v2 Performance\n');

      const nextrushRps = avgStats.nextrush.avgRps;

      if (avgStats.express) {
        const vsExpress = (
          (nextrushRps / avgStats.express.avgRps - 1) *
          100
        ).toFixed(1);
        const emoji = vsExpress > 0 ? '🚀' : '📉';
        sections.push(
          `${emoji} **${vsExpress > 0 ? '+' : ''}${vsExpress}%** vs Express`
        );
      }

      if (avgStats.koa) {
        const vsKoa = ((nextrushRps / avgStats.koa.avgRps - 1) * 100).toFixed(
          1
        );
        const emoji = vsKoa > 0 ? '🚀' : '📉';
        sections.push(`${emoji} **${vsKoa > 0 ? '+' : ''}${vsKoa}%** vs Koa`);
      }

      if (avgStats.fastify) {
        const vsFastify = (
          (nextrushRps / avgStats.fastify.avgRps - 1) *
          100
        ).toFixed(1);
        const emoji = vsFastify > 0 ? '🚀' : '📉';
        sections.push(
          `${emoji} **${vsFastify > 0 ? '+' : ''}${vsFastify}%** vs Fastify`
        );
      }

      sections.push('\n');
    }

    return sections.join('\n');
  }

  generateFullReport() {
    const report = [];

    report.push('# 🚀 NextRush v2 Performance Benchmark Results\n');
    report.push(`*Generated: ${this.timestamp}*\n`);

    report.push(this.generateSystemInfo());
    report.push(this.generateAutocannonReport());
    report.push(this.generateK6Report());
    report.push(this.generateAnalysis());

    report.push('## Methodology\n');
    report.push('### Autocannon Tests');
    report.push('- **Connections**: 100 concurrent');
    report.push('- **Duration**: 40 seconds');
    report.push('- **Pipelining**: 10 requests per connection');
    report.push('- **Warmup**: 30 seconds before each test\n');

    report.push('### K6 Tests');
    report.push('- **Virtual Users**: 100');
    report.push('- **Duration**: 60 seconds');
    report.push('- **Think Time**: 100ms between requests\n');

    report.push('### Test Scenarios');
    report.push('1. **Hello World**: Simple GET request');
    report.push('2. **Route Params**: Dynamic parameter parsing');
    report.push('3. **Query Strings**: Query parameter handling');
    report.push('4. **POST JSON**: JSON body parsing');
    report.push(
      '5. **Mixed Workload**: Realistic traffic simulation (60% GET, 40% mixed)\n'
    );

    report.push('### Configuration');
    report.push('- All servers run in **production mode**');
    report.push('- **No logging middleware** enabled');
    report.push('- **Identical routes and logic** across all frameworks');
    report.push('- **Fair comparison** with minimal overhead\n');

    report.push('---\n');
    report.push(
      '*Benchmarks performed using [autocannon](https://github.com/mcollina/autocannon) and [k6](https://k6.io/)*\n'
    );

    return report.join('\n');
  }

  saveReport() {
    const reportPath = path.join(RESULTS_DIR, 'BENCHMARK_REPORT.md');
    const report = this.generateFullReport();

    fs.writeFileSync(reportPath, report);
    console.log(`✅ Comprehensive report saved to: ${reportPath}\n`);

    return reportPath;
  }

  run() {
    this.loadResults();
    const reportPath = this.saveReport();

    console.log('✨ Report generation complete!\n');
    console.log(`📖 View your results: ${reportPath}\n`);
  }
}

// Run report generator
const generator = new ReportGenerator();
generator.run();
