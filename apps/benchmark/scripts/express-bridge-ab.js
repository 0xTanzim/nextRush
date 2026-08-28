#!/usr/bin/env node

/**
 * RFC-035 A/B/C bridged-path comparison — CLI harness.
 *
 * Boots the three express-bridge benchmark arms on separate ports and measures
 * the hello-world lifecycle with autocannon:
 *
 *   A — native NextRush                (servers/nextrush-v3.js)
 *   B — NextRush + compat(morgan)      (servers/express-bridge-morgan.js)
 *   C — native Express + morgan        (servers/express-morgan.js)
 *
 * Reports p50/p99 latency + RPS for each arm and the B↔A and B↔C deltas. It is
 * a DELTA-DOCUMENTATION tool, not a ranking gate (RFC-035 §8.10): the bridge
 * does not need to beat native NextRush and must never be marketed as faster
 * than native. The purpose is to make the bridged-path cost observable and
 * reproducibly re-measurable after changes.
 *
 * Requires current builds of the workspace packages the servers import:
 *   pnpm --filter @nextrush/core --filter @nextrush/adapter-node \
 *        --filter @nextrush/body-parser --filter @nextrush/router \
 *        --filter @nextrush/express-bridge build
 *
 * Usage:
 *   node scripts/express-bridge-ab.js                    # hello-world, 10s, 100 conn
 *   node scripts/express-bridge-ab.js --n 5 --duration 5
 *   node scripts/express-bridge-ab.js --no-save           # don't write results/
 *
 * Results are saved under results/express-bridge-ab-<timestamp>/.
 */

import { join } from 'node:path';

import { runAutocannon } from './lib/tools/autocannon.js';
import { ensureDir, saveResults } from './lib/fsx.js';
import { RESULTS_DIR } from './lib/paths.js';
import { logError, logHeader, logResult, logStep, parseArgs } from './utils.js';
import { startServer, stopServer } from './lib/server.js';
import { timestamp } from './lib/time.js';

const args = parseArgs();
const durationSecs = Number.parseInt(String(args.duration ?? '10'), 10);
const connections = Number.parseInt(String(args.connections ?? '100'), 10);
const pipelining = Number.parseInt(String(args.pipelining ?? '1'), 10);
const noSave = Boolean(args['no-save']);
const duration = `${durationSecs}s`; // autocannon/parseDuration require a unit

/** Arms: id, server file, label. Ports are auto-assigned sequential. */
const ARMS = [
  { id: 'A-native', file: 'nextrush-v3.js', label: 'native NextRush' },
  { id: 'B-bridged-morgan', file: 'express-bridge-morgan.js', label: 'NextRush + compat(morgan)' },
  { id: 'C-express-morgan', file: 'express-morgan.js', label: 'native Express + morgan' },
];

const basePort = 19_000;

async function measureArm(arm, port) {
  logStep(`Booting ${arm.label} on :${port}...`);
  const handle = await startServer(arm.file, port);
  try {
    logStep(`Measuring ${arm.label} (autocannon ${duration} @ ${connections} conn)...`);
    const result = await runAutocannon({
      url: `http://127.0.0.1:${port}/`,
      connections,
      duration,
      pipelining,
    });
    return {
      arm: arm.id,
      label: arm.label,
      rps: result.rps,
      requests: result.requests,
      latencyMs: {
        avg: result.latency.avg,
        p50: result.latency.p50,
        p75: result.latency.p75,
        p90: result.latency.p90,
        p99: result.latency.p99,
        max: result.latency.max,
      },
      errors: result.errors,
    };
  } finally {
    await stopServer(handle);
  }
}

function toMs(value) {
  return typeof value === 'number' ? value : parseFloat(String(value).replace('ms', ''));
}

function deltaPercent(base, curr) {
  if (!isFinite(base) || base === 0) return null;
  return ((curr - base) / base) * 100;
}

function main() {
  logHeader('Express-Bridge A/B/C — bridged-path delta (RFC-035 §8.10)');
  logResult('Duration', `${durationSecs}s`);
  logResult('Connections', connections);
  const results = {};
  for (const arm of ARMS) results[arm.id] = undefined;

  Promise.allSettled(ARMS.map(async (arm, i) => {
    results[arm.id] = await measureArm(arm, basePort + i * 10);
  })).then(() => {
    const A = results['A-native'];
    const B = results['B-bridged-morgan'];
    const C = results['C-express-morgan'];

    logHeader('Results');
    for (const arm of ARMS) {
      const r = results[arm.id];
      if (!r) {
        logError(`${arm.id} failed to measure.`);
        continue;
      }
      logResult(
        arm.id,
        `${r.rps.toFixed(0)} rps · p50 ${toMs(r.latencyMs.p50).toFixed(2)}ms · p99 ${toMs(r.latencyMs.p99).toFixed(2)}ms`
      );
    }

    if (A && B) {
      logStep('Bridged-path delta (B vs native A):');
      logResult('RPS delta', `${(deltaPercent(A.rps, B.rps) ?? 0).toFixed(1)}%`);
      logResult('p50 delta', `${(deltaPercent(toMs(A.latencyMs.p50), toMs(B.latencyMs.p50)) ?? 0).toFixed(1)}%`);
      logResult('p99 delta', `${(deltaPercent(toMs(A.latencyMs.p99), toMs(B.latencyMs.p99)) ?? 0).toFixed(1)}%`);
    }
    if (C && B) {
      logStep('Bridged-path delta (B vs Express arm C):');
      logResult('RPS delta', `${(deltaPercent(C.rps, B.rps) ?? 0).toFixed(1)}%`);
      logResult('p50 delta', `${(deltaPercent(toMs(C.latencyMs.p50), toMs(B.latencyMs.p50)) ?? 0).toFixed(1)}%`);
      logResult('p99 delta', `${(deltaPercent(toMs(C.latencyMs.p99), toMs(B.latencyMs.p99)) ?? 0).toFixed(1)}%`);
    }

    if (noSave) return;
    const resultsDir = join(RESULTS_DIR, `express-bridge-ab-${timestamp()}`);
    ensureDir(resultsDir);
    saveResults(resultsDir, 'express-bridge-ab.json', {
      timestamp: new Date().toISOString(),
      duration,
      connections,
      pipelining,
      deltas: {
        'B-vs-A': A && B
          ? {
              rpsPct: deltaPercent(A.rps, B.rps),
              p50Pct: deltaPercent(toMs(A.latencyMs.p50), toMs(B.latencyMs.p50)),
              p99Pct: deltaPercent(toMs(A.latencyMs.p99), toMs(B.latencyMs.p99)),
            }
          : null,
        'B-vs-C': C && B
          ? {
              rpsPct: deltaPercent(C.rps, B.rps),
              p50Pct: deltaPercent(toMs(C.latencyMs.p50), toMs(B.latencyMs.p50)),
              p99Pct: deltaPercent(toMs(C.latencyMs.p99), toMs(B.latencyMs.p99)),
            }
          : null,
      },
      arms: results,
    });
    logResult('Saved to', resultsDir);
  });
}

main();
