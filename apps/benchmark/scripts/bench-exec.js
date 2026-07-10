/**
 * Benchmark execution — URL building, single measurement, warmup, and the
 * per-framework measurement loop. Extracted from run.js to keep the
 * orchestrator lean (audit ARCH-02).
 */

import { execSync } from 'node:child_process';
import { join } from 'node:path';

import { METRICS_INTERVAL_MS, WARMUP_CONNECTIONS, WARMUP_THREADS } from '../config/constants.js';
import {
  WRK_DIR,
  aggregateLatency,
  analyzeCpuSamples,
  analyzeGcEvents,
  analyzeMemorySamples,
  computeStats,
  filterValidRuns,
  isInvalidRun,
  log,
  logError,
  logResult,
  logStep,
  logWarn,
  parseDuration,
  runAutocannon,
  runWrk,
  sleep,
  startMetricsSampling,
  startServer,
  stopServer,
} from './utils.js';

export function buildUrl(scenario, port) {
  return `http://localhost:${port}${scenario.path}`;
}

/** Run one measured benchmark for a scenario with a given tool. */
export async function runBenchmark(tool, opts) {
  if (tool === 'wrk') {
    const wrkOpts = {
      url: opts.url,
      connections: opts.connections,
      threads: opts.threads,
      duration: opts.duration,
      latency: true,
    };
    if (opts.scenario.method === 'POST') wrkOpts.script = 'post-json.lua';
    return runWrk(wrkOpts);
  }

  return runAutocannon({
    url: opts.url,
    connections: opts.connections,
    duration: opts.duration,
    pipelining: 1, // no pipelining — realistic client behavior
    method: opts.scenario.method,
    body: opts.scenario.body,
    headers: opts.scenario.headers,
  });
}

/** Warm a specific URL with real traffic (framework-level or per-scenario). */
async function warmupUrl(tool, { url, durationStr, method = 'GET', script }) {
  const seconds = parseDuration(durationStr);
  try {
    if (tool === 'wrk') {
      const scriptArg = script ? `-s ${join(WRK_DIR, script)} ` : '';
      execSync(
        `wrk -c ${WARMUP_CONNECTIONS} -t ${WARMUP_THREADS} -d ${seconds}s ${scriptArg}${url}`,
        { stdio: 'ignore', timeout: (seconds + 10) * 1000 }
      );
    } else {
      const { default: autocannon } = await import('autocannon');
      await new Promise((resolve) => {
        autocannon({ url, connections: WARMUP_CONNECTIONS, duration: seconds, method }, resolve);
      });
    }
  } catch {
    logWarn(`Warmup for ${url} encountered an error (non-fatal)`);
  }
}

/** Framework-level warmup — primes core dispatch via the root route. */
export async function warmup(tool, durationStr, port) {
  await warmupUrl(tool, { url: `http://localhost:${port}/`, durationStr });
}

/** Per-scenario warmup — primes the scenario's specific code path (FAIR-09). */
export async function warmupScenario(tool, scenario, durationStr, port) {
  if (!durationStr) return;
  await warmupUrl(tool, {
    url: buildUrl(scenario, port),
    durationStr,
    method: scenario.method,
    script: tool === 'wrk' && scenario.method === 'POST' ? 'post-json.lua' : undefined,
  });
  await sleep(200);
}

/**
 * Run the full measurement loop for one framework: start → warm → per-scenario
 * per-concurrency runs → memory/GC → stop. Returns the framework result object.
 */
export async function benchmarkFramework(tool, framework, opts) {
  const { frameworkId, port, scenarios, connections, runs, duration, threads, profile, pinCores, traceGc } = opts;
  const results = { framework: framework.name, frameworkId, scenarios: {} };

  let serverHandle;
  try {
    logStep(`Starting ${framework.name} server...`);
    serverHandle = await startServer(framework.file, port, { traceGc, pinCores });
    logStep(`Server started (PID: ${serverHandle.child.pid})`);

    logStep(`Warming up framework (${profile.warmupDuration})...`);
    await warmup(tool, profile.warmupDuration, port);

    const metrics = startMetricsSampling(serverHandle.child.pid, METRICS_INTERVAL_MS);

    for (const scenario of scenarios) {
      logStep(`Scenario: ${scenario.name}`);
      await warmupScenario(tool, scenario, profile.scenarioWarmupDuration, port);

      const scenarioResults = { scenario: scenario.name, scenarioId: scenario.id, concurrencyResults: {} };

      for (const conn of connections) {
        log(`  Connections: ${conn}`);
        const runResults = [];

        for (let run = 0; run < runs; run++) {
          log(`    Run ${run + 1}/${runs}...`, 'dim');
          const result = await runBenchmark(tool, {
            url: buildUrl(scenario, port),
            connections: conn,
            threads,
            duration,
            scenario,
          });
          if (isInvalidRun(scenario, result)) {
            logWarn(`    Non-2xx (${result.errors.nonOk}) in a success scenario — run excluded from stats.`);
          }
          runResults.push(result);
          logResult('    RPS', Math.round(result.rps).toLocaleString());
          logResult('    Latency p50', result.latency.p50 || 'N/A');
          logResult('    Latency p99', result.latency.p99 || 'N/A');
          if (runs > 1 && run < runs - 1) await sleep(profile.pauseBetweenTestsMs);
        }

        // Invalid runs (non-2xx in a success scenario) are EXCLUDED from the mean
        // so fast errors never inflate RPS (audit F-H01). If every run was invalid,
        // fall back to the raw set so the point still reports a (flagged) number.
        const { valid, anyInvalid, allInvalid } = filterValidRuns(scenario, runResults);
        const measured = valid.length ? valid : runResults;
        const stats = computeStats(measured.map((r) => r.rps));
        const latency = aggregateLatency(measured); // median across runs (audit F-M04)

        scenarioResults.concurrencyResults[conn] = {
          connections: conn,
          runs: runResults,
          validRuns: valid.length,
          stats,
          latency,
          invalid: anyInvalid,
          allInvalid,
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
            `(CV: ${stats.cv}%)${anyInvalid ? ` ⚠️ ${valid.length}/${runResults.length} valid` : ''}`
          );
        }
      }

      results.scenarios[scenario.id] = scenarioResults;
      await sleep(profile.pauseBetweenTestsMs);
    }

    const samples = metrics.stop();
    results.memory = analyzeMemorySamples(samples);
    results.cpu = analyzeCpuSamples(samples);
    results.gc = analyzeGcEvents(serverHandle.gcEvents);
  } catch (err) {
    logError(`Failed benchmarking ${framework.name}: ${err.message}`);
    results.error = err.message;
  } finally {
    if (serverHandle) {
      logStep(`Stopping ${framework.name} server...`);
      await stopServer(serverHandle);
    }
  }

  return results;
}
