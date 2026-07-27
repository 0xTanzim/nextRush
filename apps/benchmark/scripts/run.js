#!/usr/bin/env node

/**
 * NextRush benchmark orchestrator.
 *
 * Usage:
 *   node scripts/run.js                          # quick, NextRush only, wrk
 *   node scripts/run.js --compare                # all frameworks
 *   node scripts/run.js --profile full           # publishable profile
 *   node scripts/run.js --tool autocannon        # force autocannon
 *   node scripts/run.js --framework fastify      # specific framework
 *   node scripts/run.js --frameworks nextrush-v3,nextrush-v3-class  # explicit set (targeted comparison / CI gate)
 *   node scripts/run.js --scenario hello-world   # specific scenario
 *   node scripts/run.js --connections 256        # override connections
 *   node scripts/run.js --duration 3 --runs 3    # override per-run duration + run count (fast multi-run / CI smoke)
 *   node scripts/run.js --pin 0-3                # pin servers to CPU cores (taskset)
 *   node scripts/run.js --pin 2-7 --client-pin 0-1  # ALSO pin the wrk client to a
 *                                                  # disjoint core set — isolates server
 *                                                  # CPU from client/loopback contention
 *                                                  # on one machine (router-highload-
 *                                                  # harness-fixes, performance-gate)
 *   node scripts/run.js --no-validate            # skip the parity pre-flight (not advised)
 */

import { execSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import { PORT } from '../config/constants.js';
import { DEFAULT_FRAMEWORKS, FRAMEWORKS } from '../config/frameworks.js';
import { DEFAULT_PROFILE, PROFILES } from '../config/profiles.js';
import { QUICK_SCENARIOS, SCENARIOS } from '../config/scenarios.js';
import { benchmarkFramework } from './bench-exec.js';
import { generateMarkdownReport, printSummaryTable } from './report-md.js';
import { runParityCheck } from './validate-parity.js';
import { selectFrameworkIds } from './lib/framework-selection.js';
import {
  ensureDir,
  getSystemInfo,
  getToolVersion,
  log,
  logError,
  logHeader,
  logResult,
  logStep,
  logWarn,
  parseArgs,
  RESULTS_DIR,
  saveReport,
  saveResults,
  sleep,
  timestamp,
} from './utils.js';

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
const pinCores = typeof args.pin === 'string' ? args.pin : null;
const clientPinCores = typeof args['client-pin'] === 'string' ? args['client-pin'] : null;
const skipValidate = args['no-validate'] === true;
const enableTraceGc = args['trace-gc'] === true;
const connectionsOverride = args.connections ? [parseInt(args.connections, 10)] : null;

// Optional overrides for a fast, still-multi-run measurement (a targeted
// class-vs-functional comparison, or the CI perf-gate smoke) without authoring
// a new profile. `--duration 3` is normalized to "3s" so parseDuration/wrk
// accept it; a unit-suffixed value ("3s"/"2m"/"1h") passes through unchanged.
const durationOverride = args.duration
  ? /^\d+$/.test(String(args.duration))
    ? `${args.duration}s`
    : String(args.duration)
  : null;
const runsOverride = args.runs ? parseInt(args.runs, 10) : null;

let frameworkIds;
try {
  frameworkIds = selectFrameworkIds({
    args,
    profileName,
    frameworks: FRAMEWORKS,
    defaultFrameworks: DEFAULT_FRAMEWORKS,
  });
} catch (error) {
  logError(`${error.message}.`);
  process.exit(1);
}

// F-L06: optionally randomize framework execution order to cancel position/thermal
// bias across a comparison. Off by default so the default run stays reproducible.
const shuffleOrder = args.shuffle === true;
if (shuffleOrder && frameworkIds.length > 1) {
  for (let i = frameworkIds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [frameworkIds[i], frameworkIds[j]] = [frameworkIds[j], frameworkIds[i]];
  }
}

let scenarios;
if (args.scenario) {
  const found = SCENARIOS.find((s) => s.id === args.scenario);
  if (!found) {
    logError(`Unknown scenario: ${args.scenario}. Available: ${SCENARIOS.map((s) => s.id).join(', ')}`);
    process.exit(1);
  }
  scenarios = [found];
} else if (profileName === 'quick') {
  scenarios = SCENARIOS.filter((s) => QUICK_SCENARIOS.includes(s.id));
} else {
  scenarios = [...SCENARIOS];
}

const connections = connectionsOverride || profile.connections;

function resolveTool() {
  if (toolName !== 'wrk') return toolName;
  try {
    execSync('command -v wrk', { stdio: 'ignore' });
    return 'wrk';
  } catch {
    logWarn('wrk is not installed. Falling back to autocannon...');
    return 'autocannon';
  }
}

async function main() {
  const runId = timestamp();
  const resultsDir = join(RESULTS_DIR, runId);
  ensureDir(resultsDir);

  const activeTool = resolveTool();

  logHeader('NextRush Professional Benchmark');
  log(`Profile:      ${profileName} — ${profile.description}`);
  log(`Publishable:  ${profile.publishable ? 'yes' : 'NO (dev/stress profile)'}`);
  log(`Tool:         ${activeTool}`);
  log(`Duration:     ${durationOverride || profile.duration} per test`);
  log(`Connections:  ${connections.join(', ')}`);
  log(`Runs:         ${runsOverride || profile.runs} per configuration`);
  log(`Scenarios:    ${scenarios.length}`);
  log(`Frameworks:   ${frameworkIds.map((id) => FRAMEWORKS[id].name).join(', ')}`);
  log(`CPU pinning:  ${pinCores ? `cores ${pinCores}` : 'off'}`);
  log(`Client pin:   ${clientPinCores ? `cores ${clientPinCores}` : 'off'}`);
  log(`Order:        ${shuffleOrder ? 'shuffled' : 'fixed'}`);
  log(`Run ID:       ${runId}`);

  if (!profile.publishable) {
    logWarn('This profile is NOT publishable — use --profile full for numbers that leave the repo.');
  }

  // Fairness integrity gate: servers must return identical bodies/statuses first.
  if (!skipValidate && frameworkIds.length > 1) {
    const { ok } = await runParityCheck(frameworkIds);
    if (!ok) {
      logError('Parity validation failed — servers are not doing identical work. Aborting.');
      logError('Fix the mismatches (or re-run with --no-validate to bypass, not advised).');
      process.exit(1);
    }
  }

  logHeader('System Information');
  const sysInfo = {
    ...getSystemInfo(),
    toolVersion: getToolVersion(activeTool),
    cpuPinning: pinCores ? `cores ${pinCores}` : 'off',
  };
  for (const [key, val] of Object.entries(sysInfo)) logResult(key, val);

  const allResults = {};
  for (const frameworkId of frameworkIds) {
    logHeader(`Benchmarking: ${FRAMEWORKS[frameworkId].name}`);
    const frameworkResults = await benchmarkFramework(activeTool, FRAMEWORKS[frameworkId], {
      frameworkId,
      port: PORT,
      scenarios,
      connections,
      runs: runsOverride || profile.runs,
      duration: durationOverride || profile.duration,
      threads: profile.threads,
      profile,
      pinCores,
      clientPinCores,
      traceGc: enableTraceGc,
    });

    allResults[frameworkId] = frameworkResults;
    saveResults(resultsDir, `${frameworkId}.json`, frameworkResults);

    if (frameworkIds.indexOf(frameworkId) < frameworkIds.length - 1) {
      logStep(`Cooling down ${profile.cooldownMs / 1000}s...`);
      await sleep(profile.cooldownMs);
    }
  }

  logHeader('Generating Report');
  const report = {
    runId,
    timestamp: new Date().toISOString(),
    profile: profileName,
    publishable: profile.publishable,
    tool: activeTool,
    system: sysInfo,
    configuration: {
      duration: durationOverride || profile.duration,
      connections,
      runs: runsOverride || profile.runs,
      threads: profile.threads,
      pinCores,
      order: shuffleOrder ? 'shuffled' : 'fixed',
      scenarios: scenarios.map((s) => s.id),
    },
    results: allResults,
  };

  saveResults(resultsDir, 'results.json', report);
  saveReport(resultsDir, 'REPORT.md', generateMarkdownReport(report));

  const latestDir = join(RESULTS_DIR, 'latest');
  if (existsSync(latestDir)) rmSync(latestDir, { recursive: true });
  cpSync(resultsDir, latestDir, { recursive: true });

  logHeader('Benchmark Complete');
  log(`Results: ${resultsDir}`);
  log(`Report:  ${join(resultsDir, 'REPORT.md')}`);
  printSummaryTable(allResults);
}

main().catch((err) => {
  logError(`Benchmark failed: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
