/**
 * Benchmark execution — URL building, single measurement, and warmup.
 * Extracted from run.js to keep the orchestrator lean (audit ARCH-02).
 * The per-framework measurement loops live in `bench-exec-single.js`
 * (one process, internally repeating) and `bench-rotation.js` (counterbalanced
 * cross-framework comparison) — split out to stay under the 300-line cap once
 * rotation support was added (`fix-benchmark-position-bias`).
 */

import { execSync } from 'node:child_process';
import { join } from 'node:path';

import { WARMUP_CONNECTIONS, WARMUP_THREADS } from '../config/constants.js';
import {
  WRK_DIR,
  log,
  logStep,
  logWarn,
  parseDuration,
  runAutocannon,
  runWrk,
  sleep,
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
      pinCores: opts.clientPinCores ?? null,
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
 *
 * Retained for callers that measure a single framework in isolation (no
 * cross-framework ranking, so no position bias to counterbalance) — internally
 * repeats within ONE process, unlike `runRotatedComparison`. Lives in its own
 * file, `bench-exec-single.js`, imported directly by `run.js` — NOT
 * re-exported here, to avoid a circular import back into this module.
 */
