#!/usr/bin/env node

/**
 * 📊 NextRush Benchmark Comparison Tool
 *
 * Compare benchmark results between different versions or optimizations
 * Usage: npx tsx scripts/compare-benchmarks.ts [file1] [file2]
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

interface BenchmarkFile {
  meta: {
    benchmarkVersion: string;
    timestamp: string;
    date: string;
    nextRushVersion: string;
    optimizationsEnabled: boolean;
  };
  results: Array<{
    test: string;
    requestsPerSecond: number;
    averageLatency: number;
    routeCount?: number;
    routeComplexity?: string;
  }>;
  summary: {
    averageRequestsPerSecond: string;
    averageLatency: string;
    totalTests: number;
  };
  performance: {
    bestRPS: number;
    worstRPS: number;
    routingPerformance?: Record<string, any>;
  };
}

interface TestComparison {
  test: string;
  beforeRPS: number;
  afterRPS: number;
  rpsChange: number;
  beforeLatency: number;
  afterLatency: number;
  latencyChange: number;
}

interface RoutingComparison {
  complexity: string;
  beforeRPS: number;
  afterRPS: number;
  rpsChange: number;
  beforeLatency: number;
  afterLatency: number;
  latencyChange: number;
  routes: number;
}

class BenchmarkComparator {
  async compare(file1Path?: string, file2Path?: string): Promise<void> {
    console.log('📊 NextRush Benchmark Comparison Tool\n');

    let beforeFile: string;
    let afterFile: string;

    if (file1Path && file2Path) {
      beforeFile = file1Path;
      afterFile = file2Path;
    } else {
      // Auto-detect latest two benchmark files
      const files = this.getLatestBenchmarkFiles();
      if (files.length < 2) {
        console.error('❌ Need at least 2 benchmark files to compare');
        console.log('   Run benchmarks first: npm run benchmark');
        return;
      }
      [afterFile, beforeFile] = files; // Latest first
    }

    console.log(`🔍 Comparing benchmarks:`);
    console.log(`   Before: ${beforeFile}`);
    console.log(`   After:  ${afterFile}\n`);

    const beforeData = this.loadBenchmarkFile(beforeFile);
    const afterData = this.loadBenchmarkFile(afterFile);

    this.printVersionInfo(beforeData, afterData);
    this.printPerformanceComparison(beforeData, afterData);
    this.printRoutingComparison(beforeData, afterData);
    this.printSummary(beforeData, afterData);
  }

  private getLatestBenchmarkFiles(): string[] {
    const benchmarkDir = './benchmarks';
    try {
      const files = readdirSync(benchmarkDir)
        .filter(
          (f) =>
            (f.startsWith('nextrush-benchmark-') ||
              f.startsWith('NextRush-v')) &&
            f.endsWith('.json')
        )
        .sort()
        .reverse(); // Latest first

      console.log(`📁 Found ${files.length} benchmark files:`);
      files.slice(0, 5).forEach((file, index) => {
        const timestamp = file.match(
          /(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/
        )?.[1];
        if (timestamp) {
          const date = new Date(
            timestamp.replace(
              /T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/,
              'T$1:$2:$3.$4Z'
            )
          );
          const relativeTime = this.getRelativeTime(date);
          console.log(
            `   ${
              index === 0
                ? '📅 Latest:'
                : index === 1
                ? '📅 Previous:'
                : `   ${index + 1}.`
            } ${file} (${relativeTime})`
          );
        }
      });

      if (files.length > 5) {
        console.log(`   ... and ${files.length - 5} more files`);
      }

      return files.slice(0, 2).map((f) => join(benchmarkDir, f));
    } catch (error) {
      return [];
    }
  }

  private getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'just now';
    if (diffMins < 60)
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24)
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  }
  private loadBenchmarkFile(filePath: string): BenchmarkFile {
    try {
      const data = readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      throw new Error(`Failed to load benchmark file: ${filePath}`);
    }
  }

  private printVersionInfo(before: BenchmarkFile, after: BenchmarkFile): void {
    console.log('📋 Version Information:');
    console.log(
      `   Before: NextRush ${
        before.meta?.nextRushVersion || 'unknown'
      } | Optimizations: ${before.meta?.optimizationsEnabled ? '✅' : '❌'}`
    );
    console.log(
      `   After:  NextRush ${
        after.meta?.nextRushVersion || 'unknown'
      } | Optimizations: ${after.meta?.optimizationsEnabled ? '✅' : '❌'}`
    );

    const beforeDate = before.meta?.date ? new Date(before.meta.date) : null;
    const afterDate = after.meta?.date ? new Date(after.meta.date) : null;

    if (beforeDate && afterDate) {
      const timeDiff = afterDate.getTime() - beforeDate.getTime();
      const hoursDiff = Math.round(timeDiff / (1000 * 60 * 60));
      const daysDiff = Math.round(timeDiff / (1000 * 60 * 60 * 24));

      let timeDiffStr = '';
      if (Math.abs(hoursDiff) < 24) {
        timeDiffStr = `${Math.abs(hoursDiff)} hour${
          Math.abs(hoursDiff) !== 1 ? 's' : ''
        } apart`;
      } else {
        timeDiffStr = `${Math.abs(daysDiff)} day${
          Math.abs(daysDiff) !== 1 ? 's' : ''
        } apart`;
      }

      console.log(
        `   Time Range: ${beforeDate.toLocaleString()} → ${afterDate.toLocaleString()} (${timeDiffStr})`
      );
    } else {
      const beforeDateStr = beforeDate?.toLocaleDateString() || 'unknown';
      const afterDateStr = afterDate?.toLocaleDateString() || 'unknown';
      console.log(`   Date Range: ${beforeDateStr} → ${afterDateStr}`);
    }
    console.log('');
  }

  private printPerformanceComparison(
    before: BenchmarkFile,
    after: BenchmarkFile
  ): void {
    console.log('📈 Performance Comparison:\n');

    // Create a map of test results for easy comparison
    const beforeTests = new Map(before.results.map((r) => [r.test, r]));
    const afterTests = new Map(after.results.map((r) => [r.test, r]));

    const comparisons: TestComparison[] = [];

    // Compare tests that exist in both benchmarks
    for (const [testName, afterResult] of afterTests) {
      const beforeResult = beforeTests.get(testName);
      if (beforeResult) {
        const rpsImprovement =
          ((afterResult.requestsPerSecond - beforeResult.requestsPerSecond) /
            beforeResult.requestsPerSecond) *
          100;
        const latencyImprovement =
          ((beforeResult.averageLatency - afterResult.averageLatency) /
            beforeResult.averageLatency) *
          100;

        comparisons.push({
          test: testName,
          beforeRPS: Math.round(beforeResult.requestsPerSecond),
          afterRPS: Math.round(afterResult.requestsPerSecond),
          rpsChange: rpsImprovement,
          beforeLatency: Math.round(beforeResult.averageLatency * 100) / 100,
          afterLatency: Math.round(afterResult.averageLatency * 100) / 100,
          latencyChange: latencyImprovement,
        });
      }
    }

    // Sort by RPS improvement
    comparisons.sort((a, b) => b.rpsChange - a.rpsChange);

    console.table(
      comparisons.map((c) => ({
        Test: c.test,
        'Before RPS': c.beforeRPS,
        'After RPS': c.afterRPS,
        'RPS Change (%)': `${c.rpsChange > 0 ? '+' : ''}${c.rpsChange.toFixed(
          1
        )}%`,
        'Before Latency (ms)': c.beforeLatency,
        'After Latency (ms)': c.afterLatency,
        'Latency Change (%)': `${
          c.latencyChange > 0 ? '+' : ''
        }${c.latencyChange.toFixed(1)}%`,
      }))
    );

    // Overall performance summary
    const avgRpsImprovement =
      comparisons.reduce((sum, c) => sum + c.rpsChange, 0) / comparisons.length;
    const avgLatencyImprovement =
      comparisons.reduce((sum, c) => sum + c.latencyChange, 0) /
      comparisons.length;

    console.log(`\n📊 Overall Performance Change:`);
    console.log(
      `   Average RPS: ${
        avgRpsImprovement > 0 ? '+' : ''
      }${avgRpsImprovement.toFixed(1)}%`
    );
    console.log(
      `   Average Latency: ${
        avgLatencyImprovement > 0 ? '+' : ''
      }${avgLatencyImprovement.toFixed(1)}% (lower is better)`
    );

    // Performance verdict
    if (avgRpsImprovement > 10) {
      console.log(`   🎉 Significant improvement! Great optimization work!`);
    } else if (avgRpsImprovement > 0) {
      console.log(`   ✅ Performance improved! Keep optimizing!`);
    } else if (avgRpsImprovement > -5) {
      console.log(`   ⚖️  Performance is roughly equivalent`);
    } else {
      console.log(`   ⚠️  Performance regression detected - investigate!`);
    }
  }

  private printRoutingComparison(
    before: BenchmarkFile,
    after: BenchmarkFile
  ): void {
    const beforeRouting = before.performance?.routingPerformance;
    const afterRouting = after.performance?.routingPerformance;

    if (!beforeRouting || !afterRouting) {
      console.log(
        '\n🛣️  Routing Performance: No routing-specific data to compare\n'
      );
      return;
    }

    console.log('\n🛣️  Routing Performance Comparison:\n');

    const routingComparisons: RoutingComparison[] = [];
    const allComplexities = new Set([
      ...Object.keys(beforeRouting),
      ...Object.keys(afterRouting),
    ]);

    for (const complexity of allComplexities) {
      const before = beforeRouting[complexity];
      const after = afterRouting[complexity];

      if (before && after) {
        const rpsImprovement =
          ((after.averageRPS - before.averageRPS) / before.averageRPS) * 100;
        const latencyImprovement =
          ((before.averageLatency - after.averageLatency) /
            before.averageLatency) *
          100;

        routingComparisons.push({
          complexity,
          beforeRPS: before.averageRPS,
          afterRPS: after.averageRPS,
          rpsChange: rpsImprovement,
          beforeLatency: before.averageLatency,
          afterLatency: after.averageLatency,
          latencyChange: latencyImprovement,
          routes: after.totalRoutes || before.totalRoutes || 0,
        });
      }
    }

    if (routingComparisons.length > 0) {
      console.table(
        routingComparisons.map((c) => ({
          'Route Type': c.complexity,
          Routes: c.routes,
          'Before RPS': c.beforeRPS,
          'After RPS': c.afterRPS,
          'RPS Change (%)': `${c.rpsChange > 0 ? '+' : ''}${c.rpsChange.toFixed(
            1
          )}%`,
          'Latency Change (%)': `${
            c.latencyChange > 0 ? '+' : ''
          }${c.latencyChange.toFixed(1)}%`,
        }))
      );

      // Routing optimization verdict
      const avgRoutingImprovement =
        routingComparisons.reduce((sum, c) => sum + c.rpsChange, 0) /
        routingComparisons.length;
      console.log(
        `\n🛣️  Routing Optimization Result: ${
          avgRoutingImprovement > 0 ? '+' : ''
        }${avgRoutingImprovement.toFixed(1)}% RPS improvement`
      );
    }
  }

  private printSummary(before: BenchmarkFile, after: BenchmarkFile): void {
    console.log('\n🎯 Summary:\n');

    const beforeAvgRPS = parseFloat(before.summary.averageRequestsPerSecond);
    const afterAvgRPS = parseFloat(after.summary.averageRequestsPerSecond);
    const rpsImprovement = ((afterAvgRPS - beforeAvgRPS) / beforeAvgRPS) * 100;

    const beforeAvgLatency = parseFloat(before.summary.averageLatency);
    const afterAvgLatency = parseFloat(after.summary.averageLatency);
    const latencyImprovement =
      ((beforeAvgLatency - afterAvgLatency) / beforeAvgLatency) * 100;

    console.log(`   📊 Overall Performance Change:`);
    console.log(
      `      RPS: ${beforeAvgRPS} → ${afterAvgRPS} (${
        rpsImprovement > 0 ? '+' : ''
      }${rpsImprovement.toFixed(1)}%)`
    );
    console.log(
      `      Latency: ${beforeAvgLatency}ms → ${afterAvgLatency}ms (${
        latencyImprovement > 0 ? '+' : ''
      }${latencyImprovement.toFixed(1)}%)`
    );

    console.log(`\n   📈 Best Performance:`);
    console.log(`      Before: ${Math.round(before.performance.bestRPS)} RPS`);
    console.log(`      After: ${Math.round(after.performance.bestRPS)} RPS`);

    console.log(
      `\n   🎉 Result: ${this.getPerformanceVerdict(rpsImprovement)}`
    );
  }

  private getPerformanceVerdict(improvement: number): string {
    if (improvement > 50) return 'MASSIVE PERFORMANCE BOOST! 🚀🚀🚀';
    if (improvement > 25) return 'Excellent optimization! 🚀🚀';
    if (improvement > 10) return 'Great improvement! 🚀';
    if (improvement > 0) return 'Performance improved! ✅';
    if (improvement > -5) return 'Roughly equivalent performance ⚖️';
    return 'Performance regression - needs investigation ⚠️';
  }
}

// CLI usage
const args = process.argv.slice(2);
const comparator = new BenchmarkComparator();

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
📊 NextRush Benchmark Comparison Tool

Usage:
  npx tsx scripts/compare-benchmarks.ts                 # Compare latest 2 benchmarks
  npx tsx scripts/compare-benchmarks.ts file1.json file2.json  # Compare specific files
  npx tsx scripts/compare-benchmarks.ts --help          # Show this help

Examples:
  npx tsx scripts/compare-benchmarks.ts
  npx tsx scripts/compare-benchmarks.ts benchmarks/before.json benchmarks/after.json
`);
  process.exit(0);
}

comparator.compare(args[0], args[1]).catch(console.error);

export { BenchmarkComparator };
