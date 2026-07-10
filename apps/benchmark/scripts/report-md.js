/**
 * Markdown report generation for benchmark runs. Extracted from run.js (ARCH-02).
 */

import { getScenario } from '../config/scenarios.js';
import { log, logHeader } from './utils.js';

export function generateMarkdownReport(report) {
  const lines = [];
  const singleRun = report.configuration.runs < 2;

  lines.push('# NextRush Benchmark Report');
  lines.push('');
  lines.push(`**Run ID:** ${report.runId}`);
  lines.push(`**Date:** ${report.timestamp}`);
  lines.push(`**Profile:** ${report.profile}${report.publishable ? '' : ' (NOT publishable)'}`);
  lines.push(`**Tool:** ${report.tool}`);
  lines.push('');

  if (!report.publishable) {
    lines.push(
      '> ⚠️ This profile is NOT publishable. Single-run or stress profiles carry no ' +
        'meaningful variance. Use `--profile full` (5 runs) for numbers that leave this repo.'
    );
    lines.push('');
  }

  lines.push('## System Information');
  lines.push('');
  lines.push('| Property | Value |');
  lines.push('|----------|-------|');
  for (const [key, val] of Object.entries(report.system)) {
    lines.push(`| ${key} | ${val} |`);
  }
  lines.push('');

  lines.push('## Configuration');
  lines.push('');
  lines.push(`- **Duration:** ${report.configuration.duration}`);
  lines.push(`- **Connections:** ${report.configuration.connections.join(', ')}`);
  lines.push(`- **Runs per config:** ${report.configuration.runs}`);
  lines.push(`- **Threads (wrk only):** ${report.configuration.threads}`);
  lines.push('- **Pipelining:** 1 (no pipelining — realistic)');
  lines.push('');

  for (const [, fwResult] of Object.entries(report.results)) {
    if (fwResult.error) {
      lines.push(`## ${fwResult.framework} — ERROR`);
      lines.push('');
      lines.push(`Error: ${fwResult.error}`);
      lines.push('');
      continue;
    }

    lines.push(`## ${fwResult.framework}`);
    lines.push('');

    if (fwResult.memory && fwResult.memory.samples > 0) {
      lines.push('### Resources');
      lines.push('');
      lines.push(`- **RSS Peak:** ${fwResult.memory.rssPeak}`);
      lines.push(`- **RSS Avg:** ${fwResult.memory.rssAvg}`);
      if (fwResult.cpu && fwResult.cpu.samples > 1) {
        lines.push(`- **CPU Avg:** ${fwResult.cpu.cpuAvgPct}% · **CPU Peak:** ${fwResult.cpu.cpuMaxPct}%`);
      }
      lines.push(`- **Samples:** ${fwResult.memory.samples}`);
      if (fwResult.gc && fwResult.gc.count > 0) {
        lines.push(
          `- **GC:** ${fwResult.gc.count} events, ${fwResult.gc.totalPauseMs}ms total pause ` +
            `(max ${fwResult.gc.maxPauseMs}ms) — ${fwResult.gc.scavenges} scavenge / ` +
            `${fwResult.gc.markCompacts} mark-compact`
        );
      }
      lines.push('');
    }

    for (const [, scenarioResult] of Object.entries(fwResult.scenarios)) {
      lines.push(`### ${scenarioResult.scenario}`);
      lines.push('');
      lines.push('| Connections | RPS (mean ± stddev) | CV% | Latency p50 | Latency p99 | Non-2xx |');
      lines.push('|-------------|---------------------|-----|-------------|-------------|---------|');

      for (const [conn, connResult] of Object.entries(scenarioResult.concurrencyResults)) {
        const { summary, runs } = connResult;
        const latencyP50 = connResult.latency?.p50 || runs[0]?.latency?.p50 || 'N/A';
        const latencyP99 = connResult.latency?.p99 || runs[0]?.latency?.p99 || 'N/A';
        const nonOk = runs.reduce((n, r) => n + (r.errors?.nonOk || 0), 0);
        const rpsStr = singleRun
          ? Math.round(summary.rpsMean).toLocaleString()
          : `${Math.round(summary.rpsMean).toLocaleString()} ± ${Math.round(summary.rpsStddev).toLocaleString()}`;
        const flag = connResult.invalid ? ' ⚠️' : '';
        lines.push(
          `| ${conn} | ${rpsStr}${flag} | ${summary.cv}% | ${latencyP50} | ${latencyP99} | ${nonOk} |`
        );
      }
      lines.push('');
    }
  }

  const fwIds = Object.keys(report.results).filter((id) => !report.results[id].error);
  if (fwIds.length > 1) {
    lines.push('## Framework Comparison (Hello World, first concurrency level)');
    lines.push('');
    lines.push('| Rank | Framework | RPS | Latency p50 | Latency p99 |');
    lines.push('|------|-----------|-----|-------------|-------------|');

    const firstConn = report.configuration.connections[0];
    const ranked = fwIds
      .map((id) => {
        const hw = report.results[id].scenarios['hello-world'];
        const connResult = hw?.concurrencyResults[firstConn];
        if (!connResult) return null;
        return {
          id,
          name: report.results[id].framework,
          rps: connResult.stats.mean,
          p50: connResult.latency?.p50 || connResult.runs[0]?.latency?.p50 || 'N/A',
          p99: connResult.latency?.p99 || connResult.runs[0]?.latency?.p99 || 'N/A',
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.rps - a.rps);

    const medals = ['🥇', '🥈', '🥉'];
    ranked.forEach((fw, i) => {
      lines.push(
        `| ${medals[i] || `${i + 1}`} | ${fw.name} | ${Math.round(fw.rps).toLocaleString()} | ${fw.p50} | ${fw.p99} |`
      );
    });
    lines.push('');

    const rawNode = ranked.find((f) => f.id === 'raw-node');
    if (rawNode) {
      lines.push('### Framework Overhead (vs Raw Node.js)');
      lines.push('');
      lines.push('| Framework | RPS | Overhead |');
      lines.push('|-----------|-----|----------|');
      for (const fw of ranked) {
        const overhead =
          rawNode.rps > 0 ? `${((1 - fw.rps / rawNode.rps) * 100).toFixed(1)}%` : 'N/A';
        lines.push(
          `| ${fw.name} | ${Math.round(fw.rps).toLocaleString()} | ${fw.id === 'raw-node' ? 'baseline' : overhead} |`
        );
      }
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');
  lines.push('## Methodology');
  lines.push('');
  lines.push(
    `- **Tool:** ${report.tool} (${report.tool === 'wrk' ? 'C-based, separate process' : 'Node.js-based, shares runtime'})`
  );
  lines.push('- **Pipelining:** disabled (pipelining=1)');
  lines.push(
    `- **Statistical rigor:** ${report.configuration.runs} run(s); ${singleRun ? '**single run — no variance; not publishable**' : 'mean ± stddev + CV reported'}`
  );
  lines.push('- **Warmup:** framework-level (root) + per-scenario path warmup before measurement');
  lines.push(
    '- **Invalid-run handling:** any non-2xx in a success scenario excludes that run from the ' +
      'mean/stddev (not merely flagged)'
  );
  lines.push('- **Latency:** median of each percentile across valid runs (not a single run)');
  lines.push(
    '- **Parity:** response bodies AND Content-Type validated byte-identical across servers ' +
      'before timing (see validate-parity.js)'
  );
  lines.push(
    '- **Scenario fairness:** hello-world, json, route/deep params, query, POST, large-json, ' +
      'empty do identical work; **middleware-stack and error-handling use per-framework ' +
      'idiomatic mechanisms (chains vs hooks vs manual) and are NOT like-for-like** — see README.'
  );
  lines.push('');

  return lines.join('\n');
}

export function printSummaryTable(allResults) {
  logHeader('Summary');
  const fwIds = Object.keys(allResults).filter((id) => !allResults[id].error);
  for (const fwId of fwIds) {
    const fw = allResults[fwId];
    const hw = fw.scenarios['hello-world'] || fw.scenarios[Object.keys(fw.scenarios)[0]];
    if (!hw) continue;
    const firstConn = Object.keys(hw.concurrencyResults)[0];
    const result = hw.concurrencyResults[firstConn];
    if (!result) continue;
    const rps = Math.round(result.stats.mean).toLocaleString();
    const memory = fw.memory?.rssPeak || 'N/A';
    log(`  ${fw.framework.padEnd(20)} ${rps.padStart(10)} RPS    Memory: ${memory}`);
  }
}

// Keep the scenario lookup reachable for report tooling.
export { getScenario };
