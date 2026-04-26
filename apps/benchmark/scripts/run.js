#!/usr/bin/env node

/**
 * NextRush Professional Benchmark Orchestrator
 *
 * Usage:
 *   node scripts/run.js                          # Quick benchmark, NextRush only, wrk
 *   node scripts/run.js --profile standard       # Standard profile
 *   node scripts/run.js --compare                # All frameworks
 *   node scripts/run.js --tool autocannon        # Use autocannon instead of wrk
 *   node scripts/run.js --framework fastify      # Specific framework
 *   node scripts/run.js --scenario hello-world   # Specific scenario
 *   node scripts/run.js --connections 256         # Override connections
 */

import { execSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';

import { DEFAULT_FRAMEWORKS, FRAMEWORKS } from '../config/frameworks.js';
import { DEFAULT_PROFILE, PROFILES } from '../config/profiles.js';
import { QUICK_SCENARIOS, SCENARIOS } from '../config/scenarios.js';
import {
  analyzeGcEvents,
  analyzeMemorySamples,
  computeStats,
  ensureDir,
  log,
  logError,
  logHeader,
  logResult,
  logStep,
  logWarn,
  parseArgs,
  parseDuration,
  RESULTS_DIR,
  runAutocannon,
  runWrk,
  saveReport,
  saveResults,
  sleep,
  startMetricsSampling,
  startServer,
  stopServer,
  timestamp,
} from './utils.js';

// ─── Parse CLI Arguments ───

const args = parseArgs();

const profileName = args.profile || DEFAULT_PROFILE;
const profile = PROFILES[profileName];
if (!profile) {
  logError(`Unknown profile: ${profileName}. Available: ${Object.keys(PROFILES).join(', ')}`);
  process.exit(1);
}

function detectWrk() {
  try {
    execSync('command -v wrk', { stdio: 'ignore' });
    return 'wrk';
  } catch {
    return 'autocannon';
  }
}

const toolName = args.tool || detectWrk();
const isCompare = args.compare === true;
const specificFramework = args.framework;
const specificScenario = args.scenario;
const connectionsOverride = args.connections ? [parseInt(args.connections, 10)] : null;
const enableTraceGc = args['trace-gc'] === true;

// Determine frameworks to test
let frameworkIds;
if (specificFramework) {
  if (!FRAMEWORKS[specificFramework]) {
    logError(
      `Unknown framework: ${specificFramework}. Available: ${Object.keys(FRAMEWORKS).join(', ')}`
    );
    process.exit(1);
  }
  frameworkIds = [specificFramework];
} else if (isCompare) {
  frameworkIds = [...DEFAULT_FRAMEWORKS];
} else {
  frameworkIds = ['nextrush-v3'];
}

// Determine scenarios to test
let scenarios;
if (specificScenario) {
  const found = SCENARIOS.find((s) => s.id === specificScenario);
  if (!found) {
    logError(
      `Unknown scenario: ${specificScenario}. Available: ${SCENARIOS.map((s) => s.id).join(', ')}`
    );
    process.exit(1);
  }
  scenarios = [found];
} else if (profileName === 'quick') {
  scenarios = SCENARIOS.filter((s) => QUICK_SCENARIOS.includes(s.id));
} else {
  scenarios = [...SCENARIOS];
}

const connections = connectionsOverride || profile.connections;
const runs = profile.runs;
const duration = profile.duration;
const threads = profile.threads;

// ─── Main Execution ───

async function main() {
  const runId = timestamp();
  const resultsDir = join(RESULTS_DIR, runId);
  ensureDir(resultsDir);

  // Verify wrk availability — fall back to autocannon if missing
  let activeTool = toolName;
  if (activeTool === 'wrk') {
    try {
      execSync('command -v wrk', { stdio: 'ignore' });
    } catch {
      logWarn('wrk is not installed. Install it: sudo apt install wrk  OR  brew install wrk');
      logWarn('Falling back to autocannon...');
      activeTool = 'autocannon';
    }
  }

  logHeader('NextRush Professional Benchmark');
  log(`Profile:      ${profileName} — ${profile.description}`);
  log(`Tool:         ${activeTool}`);
  log(`Duration:     ${duration} per test`);
  log(`Connections:  ${connections.join(', ')}`);
  log(`Runs:         ${runs} per configuration`);
  log(`Scenarios:    ${scenarios.length}`);
  log(`Frameworks:   ${frameworkIds.map((id) => FRAMEWORKS[id].name).join(', ')}`);
  log(`Run ID:       ${runId}`);

  // System info
  logHeader('System Information');
  const sysInfo = {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    cpuModel: os.cpus()[0]?.model || 'unknown',
    cpuCores: os.cpus().length,
    totalMemory: `${(os.totalmem() / 1073741824).toFixed(1)} GB`,
    freeMemory: `${(os.freemem() / 1073741824).toFixed(1)} GB`,
    toolVersion: getToolVersion(activeTool),
  };

  for (const [key, val] of Object.entries(sysInfo)) {
    logResult(key, val);
  }

  const allResults = {};

  // ─── Benchmark Each Framework ───

  for (const frameworkId of frameworkIds) {
    const fw = FRAMEWORKS[frameworkId];
    logHeader(`Benchmarking: ${fw.name}`);

    const frameworkResults = {
      framework: fw.name,
      frameworkId,
      scenarios: {},
    };

    let serverHandle;
    try {
      logStep(`Starting ${fw.name} server...`);
      serverHandle = await startServer(fw.file, 3000, { traceGc: enableTraceGc });
      logStep(`Server started (PID: ${serverHandle.child.pid})`);

      // Warmup phase
      logStep(`Warming up (${profile.warmupDuration})...`);
      await warmup(activeTool, profile.warmupDuration, threads);

      // Start metrics sampling
      const metrics = startMetricsSampling(serverHandle.child.pid, 500);

      // Run each scenario
      for (const scenario of scenarios) {
        logStep(`Scenario: ${scenario.name} (${scenario.description})`);

        const scenarioResults = {
          scenario: scenario.name,
          scenarioId: scenario.id,
          concurrencyResults: {},
        };

        for (const conn of connections) {
          log(`  Connections: ${conn}`);

          const runResults = [];
          for (let run = 0; run < runs; run++) {
            log(`    Run ${run + 1}/${runs}...`, 'dim');

            const result = await runBenchmark(activeTool, {
              url: buildUrl(scenario, 3000),
              connections: conn,
              threads,
              duration,
              scenario,
            });

            runResults.push(result);
            logResult('    RPS', Math.round(result.rps).toLocaleString());
            logResult('    Latency p50', result.latency.p50 || 'N/A');
            logResult('    Latency p99', result.latency.p99 || 'N/A');

            if (runs > 1 && run < runs - 1) {
              await sleep(profile.pauseBetweenTestsMs);
            }
          }

          // Compute statistics across runs
          const rpsValues = runResults.map((r) => r.rps);
          const stats = computeStats(rpsValues);

          scenarioResults.concurrencyResults[conn] = {
            connections: conn,
            runs: runResults,
            stats,
            summary: {
              rpsMean: stats.mean,
              rpsStddev: stats.stddev,
              rpsMin: stats.min,
              rpsMax: stats.max,
              cv: stats.cv,
            },
          };

          if (runs > 1) {
            logResult(
              '    Mean RPS',
              `${Math.round(stats.mean).toLocaleString()} ± ${Math.round(stats.stddev).toLocaleString()}`,
              `(CV: ${stats.cv}%)`
            );
          }
        }

        frameworkResults.scenarios[scenario.id] = scenarioResults;

        // Pause between scenarios
        await sleep(profile.pauseBetweenTestsMs);
      }

      // Stop metrics sampling
      const memorySamples = metrics.stop();
      frameworkResults.memory = analyzeMemorySamples(memorySamples);
      frameworkResults.gc = analyzeGcEvents(serverHandle.gcEvents);
    } catch (err) {
      logError(`Failed benchmarking ${fw.name}: ${err.message}`);
      frameworkResults.error = err.message;
    } finally {
      if (serverHandle) {
        logStep(`Stopping ${fw.name} server...`);
        await stopServer(serverHandle);
      }
    }

    allResults[frameworkId] = frameworkResults;

    // Save per-framework results
    saveResults(resultsDir, `${frameworkId}.json`, frameworkResults);

    // Cooldown between frameworks
    if (frameworkIds.indexOf(frameworkId) < frameworkIds.length - 1) {
      logStep(`Cooling down ${profile.cooldownMs / 1000}s...`);
      await sleep(profile.cooldownMs);
    }
  }

  // ─── Generate Report ───

  logHeader('Generating Report');

  const report = {
    runId,
    timestamp: new Date().toISOString(),
    profile: profileName,
    tool: activeTool,
    system: sysInfo,
    configuration: {
      duration,
      connections,
      runs,
      threads,
      scenarios: scenarios.map((s) => s.id),
    },
    results: allResults,
  };

  saveResults(resultsDir, 'results.json', report);

  // Generate markdown report
  const markdown = generateMarkdownReport(report);
  saveReport(resultsDir, 'REPORT.md', markdown);

  // Copy to latest
  const latestDir = join(RESULTS_DIR, 'latest');
  if (existsSync(latestDir)) {
    rmSync(latestDir, { recursive: true });
  }
  cpSync(resultsDir, latestDir, { recursive: true });

  logHeader('Benchmark Complete');
  log(`Results: ${resultsDir}`);
  log(`Report:  ${join(resultsDir, 'REPORT.md')}`);

  // Print summary table
  printSummaryTable(allResults, scenarios);
}

// ─── Benchmark Execution ───

async function runBenchmark(tool, opts) {
  if (tool === 'wrk') {
    const wrkOpts = {
      url: opts.url,
      connections: opts.connections,
      threads: opts.threads,
      duration: opts.duration,
      latency: true,
    };

    // Use Lua script for POST
    if (opts.scenario.method === 'POST') {
      wrkOpts.script = 'post-json.lua';
    }

    return runWrk(wrkOpts);
  }

  // autocannon fallback
  return runAutocannon({
    url: opts.url,
    connections: opts.connections,
    duration: opts.duration,
    pipelining: 1, // No pipelining by default for fair comparison
    method: opts.scenario.method,
    body: opts.scenario.body,
    headers: opts.scenario.headers,
  });
}

async function warmup(tool, warmupDuration, threads) {
  const warmupDurationSec = parseDuration(warmupDuration);
  try {
    if (tool === 'wrk') {
      execSync(`wrk -c 10 -t 2 -d ${warmupDurationSec}s http://localhost:3000/`, {
        stdio: 'ignore',
        timeout: (warmupDurationSec + 10) * 1000,
      });
    } else {
      const { default: autocannon } = await import('autocannon');
      await new Promise((resolve) => {
        autocannon(
          {
            url: 'http://localhost:3000/',
            connections: 10,
            duration: warmupDurationSec,
          },
          resolve
        );
      });
    }
  } catch {
    logWarn('Warmup phase encountered an error (non-fatal)');
  }
}

function buildUrl(scenario, port) {
  return `http://localhost:${port}${scenario.path}`;
}

function getToolVersion(tool) {
  try {
    if (tool === 'wrk') {
      // wrk --version exits with code 1 but prints version to stdout/stderr.
      // Handle non-zero exit by capturing output via shell redirection.
      const output = execSync('wrk --version 2>&1; exit 0', {
        encoding: 'utf-8',
        timeout: 3000,
      });
      const match = output.match(/wrk\s+([\d.]+[\w.-]*)/);
      return match ? `wrk ${match[1]}` : 'wrk (version unknown)';
    }
    return 'autocannon 8.x (Node.js-based)';
  } catch {
    return `${tool} (version unknown)`;
  }
}

// ─── Report Generation ───

function generateMarkdownReport(report) {
  const lines = [];

  lines.push('# NextRush Benchmark Report');
  lines.push('');
  lines.push(`**Run ID:** ${report.runId}`);
  lines.push(`**Date:** ${report.timestamp}`);
  lines.push(`**Profile:** ${report.profile}`);
  lines.push(`**Tool:** ${report.tool}`);
  lines.push('');

  // System info
  lines.push('## System Information');
  lines.push('');
  lines.push('| Property | Value |');
  lines.push('|----------|-------|');
  for (const [key, val] of Object.entries(report.system)) {
    lines.push(`| ${key} | ${val} |`);
  }
  lines.push('');

  // Configuration
  lines.push('## Configuration');
  lines.push('');
  lines.push(`- **Duration:** ${report.configuration.duration}`);
  lines.push(`- **Connections:** ${report.configuration.connections.join(', ')}`);
  lines.push(`- **Runs per config:** ${report.configuration.runs}`);
  lines.push(`- **Threads:** ${report.configuration.threads}`);
  lines.push(`- **Pipelining:** 1 (no pipelining — realistic)`);
  lines.push('');

  // Results per framework
  for (const [fwId, fwResult] of Object.entries(report.results)) {
    if (fwResult.error) {
      lines.push(`## ${fwResult.framework} — ERROR`);
      lines.push('');
      lines.push(`Error: ${fwResult.error}`);
      lines.push('');
      continue;
    }

    lines.push(`## ${fwResult.framework}`);
    lines.push('');

    // Memory info
    if (fwResult.memory && fwResult.memory.samples > 0) {
      lines.push('### Memory');
      lines.push('');
      lines.push(`- **RSS Peak:** ${fwResult.memory.rssPeak}`);
      lines.push(`- **RSS Avg:** ${fwResult.memory.rssAvg}`);
      lines.push(`- **Samples:** ${fwResult.memory.samples}`);
      lines.push('');
    }

    // Results table
    for (const [scenarioId, scenarioResult] of Object.entries(fwResult.scenarios)) {
      lines.push(`### ${scenarioResult.scenario}`);
      lines.push('');
      lines.push('| Connections | RPS (mean ± stddev) | CV% | Latency p50 | Latency p99 |');
      lines.push('|-------------|---------------------|-----|-------------|-------------|');

      for (const [conn, connResult] of Object.entries(scenarioResult.concurrencyResults)) {
        const { summary, runs } = connResult;
        const latencyP50 = runs[0]?.latency?.p50 || 'N/A';
        const latencyP99 = runs[0]?.latency?.p99 || 'N/A';
        const rpsStr =
          report.configuration.runs > 1
            ? `${Math.round(summary.rpsMean).toLocaleString()} ± ${Math.round(summary.rpsStddev).toLocaleString()}`
            : Math.round(summary.rpsMean).toLocaleString();
        lines.push(`| ${conn} | ${rpsStr} | ${summary.cv}% | ${latencyP50} | ${latencyP99} |`);
      }
      lines.push('');
    }
  }

  // Comparison summary (if multiple frameworks)
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
        if (!hw) return null;
        const connResult = hw.concurrencyResults[firstConn];
        if (!connResult) return null;
        return {
          id,
          name: report.results[id].framework,
          rps: connResult.stats.mean,
          p50: connResult.runs[0]?.latency?.p50 || 'N/A',
          p99: connResult.runs[0]?.latency?.p99 || 'N/A',
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.rps - a.rps);

    const medals = ['🥇', '🥈', '🥉'];
    ranked.forEach((fw, i) => {
      const rank = medals[i] || `${i + 1}`;
      lines.push(
        `| ${rank} | ${fw.name} | ${Math.round(fw.rps).toLocaleString()} | ${fw.p50} | ${fw.p99} |`
      );
    });
    lines.push('');

    // Framework overhead vs raw Node
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

  // Methodology note
  lines.push('---');
  lines.push('');
  lines.push('## Methodology');
  lines.push('');
  lines.push(
    `- **Tool:** ${report.tool} (${report.tool === 'wrk' ? 'C-based, does not share Node.js runtime' : 'Node.js-based, shares runtime'})`
  );
  lines.push('- **Pipelining:** Disabled (pipelining=1) for realistic client simulation');
  lines.push(
    `- **Statistical rigor:** ${report.configuration.runs} run(s) per configuration, mean ± stddev reported`
  );
  lines.push('- **Warmup:** Actual HTTP traffic warmup before measurement');
  lines.push('- **Memory:** RSS sampled via /proc during benchmark');
  lines.push(
    '- **Fairness:** All servers implement identical endpoints with equivalent per-request work'
  );
  lines.push('');

  return lines.join('\n');
}

function printSummaryTable(allResults, scenarios) {
  logHeader('Summary');

  const fwIds = Object.keys(allResults).filter((id) => !allResults[id].error);

  // Find hello-world RPS for quick summary
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

// ─── Execute ───

main().catch((err) => {
  logError(`Benchmark failed: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
