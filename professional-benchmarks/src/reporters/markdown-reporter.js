#!/usr/bin/env node

/**
 * Markdown Report Generator for Professional Benchmarks
 * Creates beautiful markdown reports for GitHub/documentation
 */

import chalk from 'chalk';
import fs from 'node:fs/promises';
import path from 'node:path';

export class MarkdownReporter {
  constructor(resultsDir) {
    this.resultsDir = resultsDir;
  }

  async generateReport() {
    console.log(chalk.cyan('📝 Generating Beautiful Markdown Report...'));

    const results = await this.loadAllResults();
    const markdown = await this.createMarkdown(results);

    const reportPath = path.join(this.resultsDir, 'benchmark-report.md');
    await fs.writeFile(reportPath, markdown);

    console.log(chalk.green(`✅ Markdown Report generated: ${reportPath}`));
    return reportPath;
  }

  async loadAllResults() {
    const results = {
      frameworks: {},
      summary: {},
      timestamp: new Date().toISOString(),
    };

    // Load Autocannon results
    try {
      const autocannonDir = path.join(this.resultsDir, 'autocannon');
      const files = await fs.readdir(autocannonDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const framework = file.replace('.json', '');
          const data = JSON.parse(
            await fs.readFile(path.join(autocannonDir, file), 'utf8')
          );

          if (!results.frameworks[framework]) {
            results.frameworks[framework] = {};
          }

          results.frameworks[framework].autocannon = {
            rps: Math.round(data.requests?.average || 0),
            latency: parseFloat((data.latency?.average || 0).toFixed(2)),
            throughput: Math.round(data.throughput?.average || 0),
            errors: data.errors || 0,
            duration: data.duration || 0,
            p95: parseFloat((data.latency?.p95 || 0).toFixed(2)),
            p99: parseFloat((data.latency?.p99 || 0).toFixed(2)),
          };
        }
      }
    } catch (error) {
      console.warn('Could not load Autocannon results:', error.message);
    }

    // Load Artillery results
    try {
      const artilleryDir = path.join(this.resultsDir, 'artillery');
      const files = await fs.readdir(artilleryDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const framework = file.replace('-artillery-report.json', '');
          const data = JSON.parse(
            await fs.readFile(path.join(artilleryDir, file), 'utf8')
          );

          if (!results.frameworks[framework]) {
            results.frameworks[framework] = {};
          }

          results.frameworks[framework].artillery = {
            scenarios: data.aggregate?.scenariosCompleted || 0,
            requests: data.aggregate?.requestsCompleted || 0,
            errors: data.aggregate?.errors || 0,
            p95: Math.round(data.aggregate?.latency?.p95 || 0),
            p99: Math.round(data.aggregate?.latency?.p99 || 0),
            rps: Math.round(data.aggregate?.rps?.mean || 0),
          };
        }
      }
    } catch (error) {
      console.warn('Could not load Artillery results:', error.message);
    }

    return results;
  }

  getPerformanceBadge(value, type) {
    if (type === 'rps') {
      if (value > 1000) return '🟢 **EXCELLENT**';
      if (value > 500) return '🟡 **GOOD**';
      return '🔴 **NEEDS IMPROVEMENT**';
    }

    if (type === 'latency') {
      if (value < 10) return '🟢 **EXCELLENT**';
      if (value < 50) return '🟡 **GOOD**';
      return '🔴 **SLOW**';
    }

    return '';
  }

  createComparisonTable(results) {
    const frameworks = Object.keys(results.frameworks);

    let table = `| Framework | RPS | Latency (ms) | P95 (ms) | P99 (ms) | Performance |\n`;
    table += `|-----------|-----|--------------|----------|----------|-----------|\n`;

    frameworks.forEach((framework) => {
      const auto = results.frameworks[framework].autocannon || {};
      const rps = auto.rps || 0;
      const latency = auto.latency || 0;
      const p95 = auto.p95 || 0;
      const p99 = auto.p99 || 0;
      const badge = this.getPerformanceBadge(rps, 'rps');

      table += `| **${framework.toUpperCase()}** | ${rps.toLocaleString()} | ${latency} | ${p95} | ${p99} | ${badge} |\n`;
    });

    return table;
  }

  async createMarkdown(results) {
    const frameworks = Object.keys(results.frameworks);
    const topFramework = frameworks.sort(
      (a, b) =>
        (results.frameworks[b].autocannon?.rps || 0) -
        (results.frameworks[a].autocannon?.rps || 0)
    )[0];

    return `# 🚀 NextRush Professional Benchmark Report

> **Generated:** ${new Date(results.timestamp).toLocaleString()}
> **Tools Used:** Autocannon, Artillery, Clinic.js, K6
> **Environment:** Ubuntu Linux, Node.js ${process.version}

## 🏆 Executive Summary

${
  topFramework
    ? `**Winner:** ${topFramework.toUpperCase()} with ${
        results.frameworks[topFramework].autocannon?.rps || 0
      } RPS`
    : 'Analysis in progress...'
}

## 📊 Performance Comparison

${this.createComparisonTable(results)}

## 🔬 Detailed Analysis

${frameworks
  .map((framework) => {
    const auto = results.frameworks[framework].autocannon || {};
    const artillery = results.frameworks[framework].artillery || {};

    return `### ${framework.toUpperCase()} Framework

#### 🏃‍♂️ Autocannon HTTP Load Test
- **Requests per Second:** ${
      auto.rps?.toLocaleString() || 'N/A'
    } ${this.getPerformanceBadge(auto.rps, 'rps')}
- **Average Latency:** ${auto.latency || 'N/A'}ms ${this.getPerformanceBadge(
      auto.latency,
      'latency'
    )}
- **P95 Latency:** ${auto.p95 || 'N/A'}ms
- **P99 Latency:** ${auto.p99 || 'N/A'}ms
- **Throughput:** ${auto.throughput?.toLocaleString() || 'N/A'} bytes/sec
- **Errors:** ${auto.errors || 0}
- **Duration:** ${auto.duration || 'N/A'}s

#### 🎯 Artillery Stress Test
- **Scenarios Completed:** ${artillery.scenarios?.toLocaleString() || 'N/A'}
- **Total Requests:** ${artillery.requests?.toLocaleString() || 'N/A'}
- **Average RPS:** ${artillery.rps?.toLocaleString() || 'N/A'}
- **Errors:** ${artillery.errors || 0}
- **P95 Latency:** ${artillery.p95 || 'N/A'}ms
- **P99 Latency:** ${artillery.p99 || 'N/A'}ms

---`;
  })
  .join('\n')}

## 📈 Performance Insights

### 🎯 Key Metrics
- **Best RPS:** ${Math.max(
      ...frameworks.map((f) => results.frameworks[f].autocannon?.rps || 0)
    ).toLocaleString()}
- **Lowest Latency:** ${Math.min(
      ...frameworks.map(
        (f) => results.frameworks[f].autocannon?.latency || Infinity
      )
    )}ms
- **Total Requests Processed:** ${frameworks
      .reduce(
        (total, f) => total + (results.frameworks[f].artillery?.requests || 0),
        0
      )
      .toLocaleString()}

### 🔍 Analysis Notes
${frameworks
  .map((framework) => {
    const auto = results.frameworks[framework].autocannon || {};
    const rps = auto.rps || 0;
    const latency = auto.latency || 0;

    let notes = [];
    if (rps > 1000) notes.push('Excellent throughput performance');
    if (latency < 10) notes.push('Outstanding latency');
    if (rps < 500) notes.push('Consider performance optimizations');
    if (latency > 50) notes.push('High latency detected');

    return `- **${framework.toUpperCase()}:** ${
      notes.join(', ') || 'Standard performance'
    }`;
  })
  .join('\n')}

## 🛠️ Test Configuration

### Autocannon Setup
- **Connections:** 100
- **Duration:** 30 seconds
- **Rate:** Unlimited
- **Target:** Basic HTTP endpoints

### Artillery Setup
- **Phases:** Warm-up → Load Test → Cool-down
- **Max Users:** 100 concurrent
- **Duration:** 40 seconds total
- **Scenarios:** Mixed API endpoint testing

## 📋 Recommendations

${(() => {
  const recommendations = [];

  frameworks.forEach((framework) => {
    const auto = results.frameworks[framework].autocannon || {};
    const rps = auto.rps || 0;
    const latency = auto.latency || 0;

    if (rps < 500) {
      recommendations.push(
        `- **${framework.toUpperCase()}**: Investigate connection pooling and optimize middleware stack`
      );
    }
    if (latency > 50) {
      recommendations.push(
        `- **${framework.toUpperCase()}**: Profile async operations and consider caching strategies`
      );
    }
    if (auto.errors > 0) {
      recommendations.push(
        `- **${framework.toUpperCase()}**: Review error handling and stability`
      );
    }
  });

  if (recommendations.length === 0) {
    recommendations.push('- All frameworks show excellent performance! 🎉');
  }

  return recommendations.join('\n');
})()}

## 🔗 Additional Resources

- [NextRush Documentation](https://github.com/nextrush)
- [Autocannon Documentation](https://github.com/mcollina/autocannon)
- [Artillery Documentation](https://artillery.io/)
- [K6 Documentation](https://k6.io/)

---

*This report was automatically generated by the NextRush Professional Benchmarking Suite*
*For questions or issues, please refer to the project documentation*

`;
  }
}

export default MarkdownReporter;
