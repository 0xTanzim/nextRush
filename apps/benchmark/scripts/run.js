#!/usr/bin/env node

/**
 * NextRush benchmark orchestrator.
 *
 * Usage:
 *   node scripts/run.js                          # quick, NextRush only, wrk
 *   node scripts/run.js --compare                # all frameworks
 *   node scripts/run.js --profile full           # publishable profile
 *   node scripts/run.js --tool wrk|autocannon        # explicit tool (validated)
 *   node scripts/run.js --tools autocannon           # alias for --tool
 *   node scripts/run.js --framework fastify      # specific framework
 *   node scripts/run.js --frameworks nextrush-v3,nextrush-v3-class  # explicit set (targeted comparison / CI gate)
 *   node scripts/run.js --scenario hello-world   # specific scenario
 *
 *   # --connections works with EVERY profile (quick, standard, full, stress) —
 *   # replaces just that profile's connection ladder, everything else (duration,
 *   # runs, threads) stays as the profile declares it.
 *   node scripts/run.js --connections 256              # one custom level, e.g. dev checking 256c
 *   node scripts/run.js --connections 512              # or 512c — any positive integer
 *   node scripts/run.js --profile standard --connections 256   # standard profile, only 256c
 *   node scripts/run.js --compare --connections 64,256,512     # comma list, several custom levels
 *
 *   # --duration and --time are the same flag; --time is the more discoverable
 *   # alias. Combine with --runs for a fast but still multi-run measurement.
 *   node scripts/run.js --time 5 --runs 3        # 5s per run, 3 runs — fast checkup
 *   node scripts/run.js --duration 3 --runs 3    # equivalent, --duration spelling
 *
 *   node scripts/run.js --pin 0-3                # pin servers to CPU cores (taskset)
 *   node scripts/run.js --pin 2-7 --client-pin 0-1  # ALSO pin the wrk client to a
 *                                                  # disjoint core set — isolates server
 *                                                  # CPU from client/loopback contention
 *                                                  # on one machine (router-highload-
 *                                                  # harness-fixes, performance-gate)
 *   node scripts/run.js --no-validate            # skip the parity pre-flight (not advised)
 *   node scripts/run.js --rotate                 # force position-bias counterbalancing (on by
 *                                                 # default for publishable, multi-run, multi-
 *                                                 # framework comparisons — see fix-benchmark-
 *                                                 # position-bias). Restarts every framework's
 *                                                 # server once per repeat, rotating who goes
 *                                                 # first, so no framework's mean absorbs the
 *                                                 # whole first-measured-in-the-invocation penalty.
 *   node scripts/run.js --stress --diagnostic-saturation  # explicit opt-in for adversarial-load
 *                                                  # runs — forces publishable:false regardless
 *                                                  # of run size, never masquerades as a comparison
 *
 * Quick dev/AI-agent checkup (seconds, not the full multi-hour suite):
 *   node scripts/run.js --compare --connections 256 --time 5 --runs 1
 *   node scripts/generate-report.js --stdout     # inspect the resulting report immediately
 */

import { execSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import { PORT } from '../config/constants.js';
import { DEFAULT_FRAMEWORKS, FRAMEWORKS } from '../config/frameworks.js';
import { DEFAULT_PROFILE, PROFILES } from '../config/profiles.js';
import { QUICK_SCENARIOS, SCENARIOS } from '../config/scenarios.js';
import { benchmarkFramework } from './bench-exec-single.js';
import { runRotatedComparison } from './bench-rotation.js';
import { generateArtifacts, printSummaryTable } from './report-md.js';
import { readInstalledFrameworkVersions as readFrameworkVersions } from './lib/installed-versions.js';
import { derivePublishable } from './lib/publishable.js';
import { captureGitProvenance, captureNextRushEffectiveOptions } from './lib/provenance.js';
import { checkRunIdCollision } from './lib/run-collision.js';
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

import {
  getRequestedTool,
  parseConnectionsOverride,
  parseDurationOverride,
  parseRunsOverride,
  resolveToolName,
} from './lib/run-options.js';

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

const requestedTool = getRequestedTool(args);
let toolName;
try {
  toolName = resolveToolName(requestedTool, detectWrk);
} catch (error) {
  logError(`${error.message}.`);
  process.exit(1);
}

const pinCores = typeof args.pin === 'string' ? args.pin : null;
const clientPinCores = typeof args['client-pin'] === 'string' ? args['client-pin'] : null;
const skipValidate = args['no-validate'] === true;
const enableTraceGc = args['trace-gc'] === true;

let connectionsOverride;
try {
  connectionsOverride = parseConnectionsOverride(args.connections);
} catch (error) {
  logError(`${error.message}.`);
  process.exit(1);
}

const durationOverride = (() => {
  try {
    return parseDurationOverride(args);
  } catch (error) {
    logError(`${error.message}.`);
    process.exit(1);
  }
})();

const runsOverride = (() => {
  try {
    return parseRunsOverride(args.runs);
  } catch (error) {
    logError(`${error.message}.`);
    process.exit(1);
  }
})();

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

// F-L06 / fix-benchmark-position-bias: `--shuffle` randomizes the STARTING
// rotation offset once per invocation — it varies which absolute position
// each framework begins in across separate runs, but does NOT by itself
// counterbalance position within one reported comparison (a direct A/B
// showed the framework measured first in an invocation scores materially
// lower than the same framework measured later). `useRotation` below is what
// actually counterbalances; `--rotate` forces it, and it defaults on for any
// publishable, multi-run, multi-framework comparison.
const shuffleOrder = args.shuffle === true;
const diagnosticSaturation = args['diagnostic-saturation'] === true;
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
    if (requestedTool === 'wrk') {
      throw new Error('requested tool "wrk" is not installed; install wrk or use --tool autocannon');
    }
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
  log(`Publishable:  ${profile.publishable ? 'yes, if this run stays compliant' : 'NO (dev/stress profile)'}`);
  log(`Tool:         ${activeTool}`);
  log(`Duration:     ${durationOverride || profile.duration} per test`);
  log(`Connections:  ${connections.join(', ')}`);
  log(`Runs:         ${runsOverride || profile.runs} per configuration`);
  log(`Scenarios:    ${scenarios.length}`);
  log(`Frameworks:   ${frameworkIds.map((id) => FRAMEWORKS[id].name).join(', ')}`);
  log(`CPU pinning:  ${pinCores ? `cores ${pinCores}` : 'off'}`);
  log(`Client pin:   ${clientPinCores ? `cores ${clientPinCores}` : 'off'}`);
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

  const runs = runsOverride || profile.runs;

  // `fix-benchmark-position-bias`: a direct A/B showed the framework measured
  // FIRST in an invocation scores materially lower than the same framework
  // measured later, reversible by swapping which one goes first. A fixed
  // order therefore cannot back a cross-framework ranking. Rotation
  // counterbalances it by restarting every framework once per repeat and
  // rotating who goes first — the correct default whenever a result might be
  // read as a ranking (more than one framework, more than one repeat).
  const rotationRequested = args.rotate === true;
  const useRotation = frameworkIds.length > 1 && runs > 1 && (rotationRequested || profile.publishable);
  log(
    `Position control: ${useRotation ? 'rotated (counterbalanced across repeats)' : shuffleOrder ? 'shuffled (one-shot, not counterbalanced)' : 'fixed — NOT publishable as a ranking'}`
  );

  const allResults = {};
  const passOpts = {
    port: PORT,
    scenarios,
    connections,
    duration: durationOverride || profile.duration,
    threads: profile.threads,
    profile,
    pinCores,
    clientPinCores,
    traceGc: enableTraceGc,
  };

  let positionLog = null;
  if (useRotation) {
    const frameworksById = Object.fromEntries(frameworkIds.map((id) => [id, FRAMEWORKS[id]]));
    const { resultsByFramework, positionLog: log_ } = await runRotatedComparison(
      activeTool,
      frameworksById,
      frameworkIds,
      { ...passOpts, runs }
    );
    positionLog = log_;
    for (const frameworkId of frameworkIds) {
      allResults[frameworkId] = resultsByFramework[frameworkId];
      saveResults(resultsDir, `${frameworkId}.json`, resultsByFramework[frameworkId]);
    }
  } else {
    for (const frameworkId of frameworkIds) {
      logHeader(`Benchmarking: ${FRAMEWORKS[frameworkId].name}`);
      const frameworkResults = await benchmarkFramework(activeTool, FRAMEWORKS[frameworkId], {
        ...passOpts,
        frameworkId,
        runs,
      });

      allResults[frameworkId] = frameworkResults;
      saveResults(resultsDir, `${frameworkId}.json`, frameworkResults);

      if (frameworkIds.indexOf(frameworkId) < frameworkIds.length - 1) {
        logStep(`Cooling down ${profile.cooldownMs / 1000}s...`);
        await sleep(profile.cooldownMs);
      }
    }
  }

  logHeader('Generating Report');
  const runConfiguration = {
    duration: durationOverride || profile.duration,
    connections,
    runs,
    threads: profile.threads,
    warmupDuration: profile.warmupDuration,
    scenarioWarmupDuration: profile.scenarioWarmupDuration,
    cooldownMs: profile.cooldownMs,
    pauseBetweenTestsMs: profile.pauseBetweenTestsMs,
    pinCores,
    clientPinCores,
    traceGc: enableTraceGc,
    positionControl: useRotation ? 'rotated' : shuffleOrder ? 'shuffled' : 'fixed',
    positionLog,
    order: shuffleOrder ? 'shuffled' : 'fixed',
    scenarios: scenarios.map((s) => s.id),
    frameworkVersions: readFrameworkVersions(),
    nextrushEffectiveOptions: captureNextRushEffectiveOptions({}),
  };
  const publishableOutcome = derivePublishable(runConfiguration, allResults, { diagnosticSaturation });
  if (!publishableOutcome.publishable) {
    logWarn(`Not publishable: ${publishableOutcome.reason}`);
  }

  const report = {
    runId,
    timestamp: new Date().toISOString(),
    profile: profileName,
    publishable: publishableOutcome.publishable,
    publishableReason: publishableOutcome.reason,
    git: captureGitProvenance(),
    tool: activeTool,
    system: sysInfo,
    configuration: runConfiguration,
    results: allResults,
  };

  const collision = checkRunIdCollision(RESULTS_DIR, runId, report);
  if (collision.collision && !collision.identical) {
    logError(
      `Run ID "${runId}" collides with existing directory "${collision.existingDir}" (different content). ` +
        'Refusing to overwrite or duplicate — this is the exact defect that produced ' +
        '2026-07-27T15-42-22/15-42-50 as two directories embedding the same run_id.'
    );
    process.exit(1);
  }
  if (collision.collision && collision.identical) {
    logWarn(`Run ID "${runId}" already exists as "${collision.existingDir}" with identical content — not duplicating.`);
    rmSync(resultsDir, { recursive: true, force: true });
    process.exit(0);
  }

  saveResults(resultsDir, 'results.json', report);
  for (const [filename, contents] of Object.entries(
    generateArtifacts(report, {
      frameworkVersions: report.configuration.frameworkVersions,
      versionSource: 'recorded at run time',
    })
  )) {
    saveReport(resultsDir, filename, contents);
  }

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
