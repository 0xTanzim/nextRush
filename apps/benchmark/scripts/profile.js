#!/usr/bin/env node

/**
 * CPU/allocation profiling entry point — captures a CPU profile, before/after
 * heap snapshots, a GC-event summary, and an event-loop-utilization sample
 * for one named scenario against one running benchmark server.
 *
 * Distinct from run.js's six-server throughput comparison (design.md D1):
 * this profiles ONE server on ONE scenario in depth, rather than comparing
 * many servers' throughput. Diagnostic-only — never wired into CI.
 *
 * Usage:
 *   node scripts/profile.js --scenario hello-world
 *   node scripts/profile.js --scenario route-params --duration 30s
 *   node scripts/profile.js --scenario post-json --server nextrush-v3.js
 */

import { spawn } from 'node:child_process';
import { readdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { SCENARIOS } from '../config/scenarios.js';
import { BASE_URL, PORT } from '../config/constants.js';
import { summarizeGcEvents } from './lib/gc-summary.js';
import { takeHeapSnapshot } from './lib/inspector-client.js';
import { parseArgs } from './lib/args.js';
import { parseProfileArgs } from './lib/profile-args.js';
import { captureGitProvenance, captureNextRushEffectiveOptions } from './lib/provenance.js';
import { ensureDir, saveResults } from './lib/fsx.js';
import { logError, logHeader, logResult, logStep, log } from './lib/logging.js';
import { RESULTS_DIR } from './lib/paths.js';
import { parseWrkOutput } from './lib/tools/wrk.js';
import { startServer, stopServer } from './lib/server.js';
import { timestamp } from './lib/time.js';

const INSPECT_PORT = 9339;
const ELU_POLL_INTERVAL_MS = 1000;

/** Polls the diagnostic /__elu-sample route until stopped, returning an ELU summary. */
function pollElu(baseUrl) {
  const samples = [];
  const interval = setInterval(async () => {
    try {
      const res = await fetch(`${baseUrl}/__elu-sample`);
      samples.push(await res.json());
    } catch {
      // server may be between requests during shutdown; drop the sample
    }
  }, ELU_POLL_INTERVAL_MS);

  return {
    stop() {
      clearInterval(interval);
      if (samples.length === 0) return { samples: 0, avgUtilization: 0 };
      const avgUtilization = samples.reduce((sum, s) => sum + s.utilization, 0) / samples.length;
      return { samples: samples.length, avgUtilization };
    },
  };
}

/**
 * Async wrk runner, local to this script only. lib/tools/wrk.js's `runWrk` is
 * synchronous (`execSync`) by design for the six-server comparison in
 * run.js, where nothing else needs to run concurrently. This profiling
 * script needs the load run to happen WHILE the ELU poller's `setInterval`
 * keeps firing — a synchronous call would block this process's own event
 * loop for the run's full duration, starving the poller. Reuses
 * `parseWrkOutput` (already exported) rather than duplicating its parsing.
 */
function runWrkAsync({ url, connections, threads, duration }) {
  return new Promise((resolve, reject) => {
    const child = spawn('wrk', ['-c', String(connections), '-t', String(threads), '-d', duration, '--latency', url]);
    let stdout = '';
    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`wrk exited with code ${code}`));
        return;
      }
      resolve(parseWrkOutput(stdout));
    });
  });
}

async function main() {
  const rawArgs = parseArgs();
  let profileArgs;
  try {
    profileArgs = parseProfileArgs(rawArgs);
  } catch (error) {
    logError(error.message);
    process.exit(1);
  }

  const scenario = SCENARIOS.find((s) => s.id === profileArgs.scenario);
  if (!scenario) {
    logError(`Unknown scenario "${profileArgs.scenario}". Available: ${SCENARIOS.map((s) => s.id).join(', ')}`);
    process.exit(1);
  }

  logHeader('CPU / Allocation Profiling');
  logResult('Scenario', scenario.id);
  logResult('Server', profileArgs.server);
  logResult('Duration', profileArgs.duration);

  const runId = timestamp();
  const profileDir = join(RESULTS_DIR, runId, 'profile');
  ensureDir(profileDir);

  logStep('Starting server...');
  const handle = await startServer(profileArgs.server, PORT, {
    traceGc: true,
    inspectPort: profileArgs.cpuProf ? INSPECT_PORT : null,
    cpuProfDir: profileArgs.cpuProf ? profileDir : null,
  });

  const baseUrl = `${BASE_URL}`;
  let heapBefore = null;
  let elu = null;

  try {
    if (profileArgs.heapSnapshot) {
      logStep('Taking before-load heap snapshot...');
      heapBefore = await takeHeapSnapshot(INSPECT_PORT);
    }

    if (profileArgs.heapSnapshot) elu = pollElu(baseUrl);

    logStep(`Running load generator for ${profileArgs.duration}...`);
    const wrkResult = await runWrkAsync({
      url: `${baseUrl}${scenario.path}`,
      connections: 64,
      threads: 4,
      duration: profileArgs.duration,
    });
    logResult('Requests/sec', wrkResult.rps.toFixed(1));

    const eluSummary = elu ? elu.stop() : { samples: 0, avgUtilization: 0 };

    let heapAfter = null;
    if (profileArgs.heapSnapshot) {
      logStep('Taking after-load heap snapshot...');
      heapAfter = await takeHeapSnapshot(INSPECT_PORT);
    }

    if (heapBefore) writeFileSync(join(profileDir, `${scenario.id}.heapsnapshot-before`), heapBefore, 'utf-8');
    if (heapAfter) writeFileSync(join(profileDir, `${scenario.id}.heapsnapshot-after`), heapAfter, 'utf-8');

    logStep('Stopping server (flushing CPU profile)...');
    await stopServer(handle);

    if (profileArgs.cpuProf) {
      renameCpuProfile(profileDir, scenario.id);
    }

    const gcSummary = summarizeGcEvents(handle.gcEvents);

    const summary = {
      runId,
      timestamp: new Date().toISOString(),
      scenario: scenario.id,
      server: profileArgs.server,
      duration: profileArgs.duration,
      requestsPerSec: wrkResult.rps,
      gc: gcSummary,
      eventLoopUtilization: eluSummary,
      git: captureGitProvenance(),
      nextrushEffectiveOptions: captureNextRushEffectiveOptions({}),
    };
    saveResults(profileDir, 'profile-summary.json', summary);

    log(`\nProfile written to ${profileDir}`);
  } catch (error) {
    logError(`Profiling run failed: ${error.message}`);
    await stopServer(handle);
    process.exit(1);
  }
}

/** Node's --cpu-prof writes a generated filename; rename it to the scenario id for discoverability. */
function renameCpuProfile(profileDir, scenarioId) {
  const files = readdirSync(profileDir).filter((f) => f.endsWith('.cpuprofile'));
  if (files.length === 0) return;
  renameSync(join(profileDir, files[0]), join(profileDir, `${scenarioId}.cpuprofile`));
}

main();
