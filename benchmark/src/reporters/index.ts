/**
 * 📊 Report Generator
 *
 * Generate comprehensive benchmark reports in multiple formats
 */

import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import * as path from 'path';
import { BenchmarkReport, BenchmarkResult } from '../core/types.js';
import { createTable, formatNumber, log } from '../utils/logger.js';

export class ReportGenerator {
  private resultsDir = './results';

  constructor(resultsDir?: string) {
    if (resultsDir) {
      this.resultsDir = resultsDir;
    }
  }

  /**
   * Generate all report formats
   */
  async generateReports(results: BenchmarkResult[]): Promise<void> {
    if (!existsSync(this.resultsDir)) {
      await mkdir(this.resultsDir, { recursive: true });
    }

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .split('T')[0];
    const baseFilename = `benchmark-${timestamp}`;

    // Generate report data
    const reportData = await this.generateReportData(results);

    // Generate different formats
    await Promise.all([
      this.generateJsonReport(reportData, `${baseFilename}.json`),
      this.generateMarkdownReport(reportData, `${baseFilename}.md`),
      this.generateCsvReport(results, `${baseFilename}.csv`),
    ]);

    // Print summary to console
    this.printConsoleSummary(reportData);

    log.success('All reports generated successfully!');
  }

  /**
   * Generate structured report data
   */
  private async generateReportData(
    results: BenchmarkResult[]
  ): Promise<BenchmarkReport> {
    const os = await import('os');
    const cpus = os.cpus();

    return {
      meta: {
        benchmarkVersion: '3.0.0',
        timestamp: new Date().toISOString(),
        date: new Date().toLocaleDateString(),
        nodeVersion: process.version,
        v8Version: process.versions.v8,
        platform: `${os.platform()} ${os.release()}`,
        cpu: cpus[0].model,
        cores: cpus.length,
        totalMemoryGB: (os.totalmem() / 1024 / 1024 / 1024).toFixed(2),
      },
      results,
      summary: this.generateSummary(results),
      comparison: this.generateComparison(results),
    };
  }

  /**
   * Generate summary statistics
   */
  private generateSummary(results: BenchmarkResult[]): any {
    const frameworkSet = new Set(results.map((r) => r.framework));
    const frameworks = Array.from(frameworkSet);

    const summary = {
      frameworks: frameworks.length,
      totalTests: results.length,
      successfulTests: results.filter((r) => r.status === 'success').length,
      partialTests: results.filter((r) => r.status === 'partial').length,
      failedTests: results.filter((r) => r.status === 'failed').length,
      byFramework: frameworks.map((framework) => {
        const frameworkResults = results.filter(
          (r) => r.framework === framework
        );
        const avgRps =
          frameworkResults.reduce((sum, r) => sum + r.requestsPerSecond, 0) /
          frameworkResults.length;
        const avgLatency =
          frameworkResults.reduce((sum, r) => sum + r.averageLatency, 0) /
          frameworkResults.length;

        return {
          framework,
          version: frameworkResults[0]?.version || 'unknown',
          averageRPS: Math.round(avgRps),
          averageLatency: Math.round(avgLatency * 100) / 100,
          tests: frameworkResults.length,
          successRate: (
            (frameworkResults.filter((r) => r.status === 'success').length /
              frameworkResults.length) *
            100
          ).toFixed(1),
          bestRPS: Math.max(
            ...frameworkResults.map((r) => r.requestsPerSecond)
          ),
          worstLatency: Math.max(
            ...frameworkResults.map((r) => r.averageLatency)
          ),
        };
      }),
    };

    return summary;
  }

  /**
   * Generate framework comparison
   */
  private generateComparison(results: BenchmarkResult[]): any {
    const testNameSet = new Set(results.map((r) => r.test));
    const frameworkSet = new Set(results.map((r) => r.framework));
    const testNames = Array.from(testNameSet);
    const frameworks = Array.from(frameworkSet);

    return testNames.map((testName) => {
      const testResults = results.filter((r) => r.test === testName);
      const comparison: any = { test: testName };

      frameworks.forEach((framework) => {
        const result = testResults.find((r) => r.framework === framework);
        if (result) {
          comparison[framework] = {
            rps: Math.round(result.requestsPerSecond),
            latency: Math.round(result.averageLatency * 100) / 100,
            status: result.status,
            memoryMB: Math.round(
              result.memoryUsage.peak.heapUsed / 1024 / 1024
            ),
            cpuPercent:
              Math.round(
                (result.cpuUsage.userPercent + result.cpuUsage.systemPercent) *
                  100
              ) / 100,
          };
        } else {
          comparison[framework] = { rps: 0, latency: 0, status: 'not-tested' };
        }
      });

      return comparison;
    });
  }

  /**
   * Generate JSON report
   */
  private async generateJsonReport(
    data: BenchmarkReport,
    filename: string
  ): Promise<void> {
    const filePath = path.join(this.resultsDir, filename);
    await writeFile(filePath, JSON.stringify(data, null, 2));
    log.info(`📄 JSON report: ${filePath}`);
  }

  /**
   * Generate Markdown report
   */
  private async generateMarkdownReport(
    data: BenchmarkReport,
    filename: string
  ): Promise<void> {
    let markdown = `# 🚀 NextRush Benchmark Report\n\n`;
    markdown += `**Generated:** ${new Date(
      data.meta.timestamp
    ).toLocaleString()}\n`;
    markdown += `**Benchmark Version:** ${data.meta.benchmarkVersion}\n`;
    markdown += `**Node.js:** ${data.meta.nodeVersion}\n`;
    markdown += `**Platform:** ${data.meta.platform}\n`;
    markdown += `**CPU:** ${data.meta.cpu} (${data.meta.cores} cores)\n`;
    markdown += `**Memory:** ${data.meta.totalMemoryGB} GB\n\n`;

    // Executive Summary
    markdown += `## 📊 Executive Summary\n\n`;
    markdown += `- **Frameworks Tested:** ${data.summary.frameworks}\n`;
    markdown += `- **Total Tests:** ${data.summary.totalTests}\n`;
    markdown += `- **Success Rate:** ${(
      (data.summary.successfulTests / data.summary.totalTests) *
      100
    ).toFixed(1)}%\n\n`;

    // Framework Performance Ranking
    markdown += `## 🏆 Framework Performance Ranking\n\n`;
    markdown += `| Rank | Framework | Version | Avg RPS | Avg Latency (ms) | Success Rate | Tests |\n`;
    markdown += `|------|-----------|---------|---------|------------------|--------------|-------|\n`;

    data.summary.byFramework
      .sort((a: any, b: any) => b.averageRPS - a.averageRPS)
      .forEach((fw: any, index: number) => {
        markdown += `| ${index + 1} | **${fw.framework}** | ${
          fw.version
        } | ${formatNumber(fw.averageRPS)} | ${fw.averageLatency} | ${
          fw.successRate
        }% | ${fw.tests} |\n`;
      });

    // Test Comparison Matrix
    markdown += `\n## 📈 Test Performance Matrix\n\n`;

    data.comparison.forEach((test: any) => {
      markdown += `### ${test.test}\n\n`;
      markdown += `| Framework | RPS | Latency (ms) | Memory (MB) | CPU (%) | Status |\n`;
      markdown += `|-----------|-----|--------------|-------------|---------|--------|\n`;

      const frameworks = Object.keys(test).filter((k) => k !== 'test');
      frameworks.forEach((framework) => {
        const result = test[framework];
        const statusEmoji =
          result.status === 'success'
            ? '✅'
            : result.status === 'partial'
            ? '⚠️'
            : '❌';
        markdown += `| ${framework} | ${formatNumber(result.rps)} | ${
          result.latency
        } | ${result.memoryMB} | ${result.cpuPercent} | ${statusEmoji} |\n`;
      });
      markdown += `\n`;
    });

    // Performance Insights
    markdown += `## 🔍 Performance Insights\n\n`;
    const winner = data.summary.byFramework[0];
    markdown += `🥇 **Performance Leader:** ${
      winner.framework
    } with ${formatNumber(winner.averageRPS)} RPS\n\n`;

    const fastestLatency = data.summary.byFramework.reduce(
      (best: any, current: any) =>
        current.averageLatency < best.averageLatency ? current : best
    );
    markdown += `⚡ **Fastest Response:** ${fastestLatency.framework} with ${fastestLatency.averageLatency} ms\n\n`;

    // NextRush Analysis
    const nextRushStats = data.summary.byFramework.find(
      (fw: any) => fw.framework === 'NextRush'
    );
    if (nextRushStats) {
      markdown += `## 🚀 NextRush Performance Analysis\n\n`;
      if (nextRushStats.framework === winner.framework) {
        markdown += `🎉 **NextRush achieved the best overall performance!**\n\n`;
      } else {
        const rpsRatio = (
          (nextRushStats.averageRPS / winner.averageRPS) *
          100
        ).toFixed(1);
        markdown += `📊 NextRush Performance vs Leader (${winner.framework}):\n`;
        markdown += `- RPS Performance: ${rpsRatio}% of leader\n`;
        markdown += `- Average Latency: ${nextRushStats.averageLatency} ms\n`;
        markdown += `- Success Rate: ${nextRushStats.successRate}%\n\n`;
      }
    }

    // Recommendations
    markdown += `## 💡 Recommendations\n\n`;
    markdown += `Based on benchmark results:\n\n`;
    markdown += `1. **${winner.framework}** - Best overall throughput\n`;
    markdown += `2. **${fastestLatency.framework}** - Fastest response times\n`;

    const mostReliable = data.summary.byFramework.reduce(
      (best: any, current: any) =>
        parseFloat(current.successRate) > parseFloat(best.successRate)
          ? current
          : best
    );
    markdown += `3. **${mostReliable.framework}** - Most reliable (${mostReliable.successRate}% success)\n\n`;

    markdown += `---\n`;
    markdown += `*Generated by NextRush Benchmark Suite v${data.meta.benchmarkVersion}*\n`;

    const filePath = path.join(this.resultsDir, filename);
    await writeFile(filePath, markdown);
    log.info(`📝 Markdown report: ${filePath}`);
  }

  /**
   * Generate CSV report
   */
  private async generateCsvReport(
    results: BenchmarkResult[],
    filename: string
  ): Promise<void> {
    const headers = [
      'Framework',
      'Version',
      'Test',
      'RPS',
      'Avg_Latency_ms',
      'P50_Latency_ms',
      'P95_Latency_ms',
      'P99_Latency_ms',
      'Max_Latency_ms',
      'Min_Latency_ms',
      'Total_Requests',
      'Duration_s',
      'Error_Count',
      'Throughput_MBps',
      'Memory_Peak_MB',
      'Memory_Leaked_MB',
      'CPU_User_%',
      'CPU_System_%',
      'GC_Pauses',
      'Concurrency',
      'Status',
    ];

    let csv = headers.join(',') + '\n';

    results.forEach((result) => {
      const row = [
        result.framework,
        result.version,
        `"${result.test}"`,
        result.requestsPerSecond.toFixed(2),
        result.averageLatency.toFixed(2),
        result.p50Latency.toFixed(2),
        result.p95Latency.toFixed(2),
        result.p99Latency.toFixed(2),
        result.maxLatency.toFixed(2),
        result.minLatency.toFixed(2),
        result.totalRequests,
        result.duration.toFixed(2),
        result.errorCount,
        result.throughputMBps.toFixed(3),
        (result.memoryUsage.peak.heapUsed / 1024 / 1024).toFixed(2),
        (result.memoryUsage.leaked / 1024 / 1024).toFixed(2),
        result.cpuUsage.userPercent.toFixed(2),
        result.cpuUsage.systemPercent.toFixed(2),
        result.gcPauses,
        result.concurrency || '',
        result.status,
      ];
      csv += row.join(',') + '\n';
    });

    const filePath = path.join(this.resultsDir, filename);
    await writeFile(filePath, csv);
    log.info(`📊 CSV report: ${filePath}`);
  }

  /**
   * Print summary to console
   */
  private printConsoleSummary(data: BenchmarkReport): void {
    console.log('\n🏆 Framework Performance Ranking:\n');

    const tableData = data.summary.byFramework
      .sort((a: any, b: any) => b.averageRPS - a.averageRPS)
      .map((fw: any, index: number) => [
        (index + 1).toString(),
        fw.framework,
        fw.version,
        formatNumber(fw.averageRPS),
        fw.averageLatency.toString(),
        `${fw.successRate}%`,
        fw.tests.toString(),
      ]);

    createTable(
      [
        'Rank',
        'Framework',
        'Version',
        'Avg RPS',
        'Avg Latency (ms)',
        'Success Rate',
        'Tests',
      ],
      tableData
    );

    // Performance champions
    const winner = data.summary.byFramework[0];
    const fastestLatency = data.summary.byFramework.reduce(
      (best: any, current: any) =>
        current.averageLatency < best.averageLatency ? current : best
    );

    console.log('\n🎖️  Performance Champions:');
    log.success(
      `🥇 Highest RPS: ${winner.framework} (${formatNumber(
        winner.averageRPS
      )} req/s)`
    );
    log.success(
      `⚡ Fastest Response: ${fastestLatency.framework} (${fastestLatency.averageLatency} ms)`
    );

    // NextRush specific analysis
    const nextRushStats = data.summary.byFramework.find(
      (fw: any) => fw.framework === 'NextRush'
    );
    if (nextRushStats) {
      if (nextRushStats.framework === winner.framework) {
        log.success('🎉 NextRush achieved the best overall performance!');
      } else {
        const rpsRatio = (
          (nextRushStats.averageRPS / winner.averageRPS) *
          100
        ).toFixed(1);
        log.info(
          `💡 NextRush: ${rpsRatio}% of leader's RPS (${nextRushStats.averageRPS} vs ${winner.averageRPS})`
        );
      }
    }
  }
}
