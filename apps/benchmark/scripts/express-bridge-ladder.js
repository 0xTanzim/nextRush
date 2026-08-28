#!/usr/bin/env node

/**
 * Express-bridge cost-isolation ladder.
 *
 * Boots a ladder of increasingly-expensive arms and measures hello-world with
 * autocannon so the bridged-path gap is DECOMPOSED into contributors rather
 * than asserted:
 *
 *   native               NextRush, 1 entry (compose fast path)
 *   native-noop          NextRush + native noop (2-entry compose)
 *   native-morgan-shape  NextRush + native morgan('tiny')-shaped logger
 *   bridge-noop          NextRush + compat((req,res,next)=>next())
 *   bridge-read          NextRush + compat(mw reading req.method/url/headers/get)
 *   bridge-write         NextRush + compat(mw writing res.setHeader/statusCode)
 *   bridge-mixed         NextRush + compat(mw reading req + writing res)
 *   bridge-morgan        NextRush + compat(morgan('tiny'))     [express-bridge-morgan.js]
 *   bridge-response-time NextRush + compat(response-time())    [express-bridge-response-time.js]
 *   express-morgan       Express 5 + morgan('tiny')             [express-morgan.js]
 *
 * Decomposition (difference of adjacent arms isolates one contributor):
 *   native-noop   − native          = compose fast-path drop (+1 middleware entry)
 *   bridge-noop   − native-noop     = pure bridge execution (proxy setup +
 *                                     continuation), NO property access
 *   bridge-read   − bridge-noop     = req property access through the proxy
 *   bridge-write  − bridge-noop     = res property access through the proxy
 *   bridge-mixed  − bridge-noop     = combined req+res access
 *   bridge-morgan − bridge-mixed    ≈ morgan's own behavior through the bridge
 *   bridge-morgan − native-morgan-shape ≈ bridge + morgan internals vs a native
 *                                     logger doing approximately the same work
 *   bridge-morgan − express-morgan  = headline interop gap vs native Express
 *   bridge-response-time − native   = a LIGHTER full-surface middleware through
 *                                     the bridge, showing the gap is
 *                                     middleware-dependent (access-count), not
 *                                     a flat bridge tax
 *   bridge-response-time − express-morgan  = the light-end of the interop gap
 *
 * This establishes the COST STRUCTURE of the current implementation. It does
 * not claim any component is theoretically irreducible — a materialized-facade
 * spike (pay compatibility cost once at the boundary instead of per access) is
 * the P1 follow-up to evaluate against these same arms.
 *
 * Requires current builds of the workspace packages the servers import:
 *   pnpm --filter @nextrush/core --filter @nextrush/adapter-node \
 *        --filter @nextrush/express-bridge build
 *
 * Usage:
 *   node scripts/express-bridge-ladder.js                   # 6s @ 50 conn, all 9 arms
 *   node scripts/express-bridge-ladder.js --duration 8 --connections 64
 *   node scripts/express-bridge-ladder.js --no-express       # skip bridge-morgan/express-morgan
 *   node scripts/express-bridge-ladder.js --no-save
 */

import { join } from 'node:path';

import { runAutocannon } from './lib/tools/autocannon.js';
import { ensureDir, saveResults } from './lib/fsx.js';
import { RESULTS_DIR } from './lib/paths.js';
import { logError, logHeader, logResult, logStep, parseArgs } from './utils.js';
import { startServer, stopServer } from './lib/server.js';
import { timestamp } from './lib/time.js';

const args = parseArgs();
const durationSecs = Number.parseInt(String(args.duration ?? '6'), 10);
const duration = `${durationSecs}s`;
const connections = Number.parseInt(String(args.connections ?? '50'), 10);
const pipelining = Number.parseInt(String(args.pipelining ?? '1'), 10);
const noSave = Boolean(args['no-save']);
const noExpress = Boolean(args['no-express']);

/** Arms served by the parameterized ladder server (LADDER_ARM env). */
const SYNTH_ARMS = [
  { id: 'native', env: 'native' },
  { id: 'native-noop', env: 'native-noop' },
  { id: 'native-morgan-shape', env: 'native-morgan-shape' },
  { id: 'bridge-noop', env: 'bridge-noop' },
  { id: 'bridge-read', env: 'bridge-read' },
  { id: 'bridge-write', env: 'bridge-write' },
  { id: 'bridge-mixed', env: 'bridge-mixed' },
];

/** Arms served by dedicated server files (real-package middleware variants). */
const FILE_ARMS = [
  { id: 'bridge-morgan', file: 'express-bridge-morgan.js' },
  { id: 'bridge-response-time', file: 'express-bridge-response-time.js' },
  { id: 'express-morgan', file: 'express-morgan.js' },
];

async function measure(arm, port, extraEnv = {}) {
  const prev = process.env.LADDER_ARM;
  if (extraEnv.LADDER_ARM) process.env.LADDER_ARM = extraEnv.LADDER_ARM;
  let handle;
  try {
    logStep(`Booting ${arm.id} on :${port}...`);
    handle = await startServer(arm.file ?? 'express-bridge-ladder-server.js', port);
    logStep(`Measuring ${arm.id} (autocannon ${duration} @ ${connections} conn)...`);
    const result = await runAutocannon({
      url: `http://127.0.0.1:${port}/`,
      connections,
      duration,
      pipelining,
    });
    return {
      arm: arm.id,
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
    if (handle) await stopServer(handle);
    if (prev === undefined) delete process.env.LADDER_ARM;
    else process.env.LADDER_ARM = prev;
  }
}

function toMs(value) {
  return typeof value === 'number' ? value : parseFloat(String(value).replace('ms', ''));
}

function deltaPct(base, curr) {
  if (!isFinite(base) || base === 0) return null;
  return ((curr - base) / base) * 100;
}
const basePort = 19_500;
function main() {
  logHeader('Express-Bridge Cost-Isolation Ladder (RFC-035 §8.10 / P0 decomposition)');
  logResult('Duration', `${durationSecs}s`);
  logResult('Connections', connections);
  if (noExpress) logResult('Express arms', 'skipped');

  const allArms = [
    ...SYNTH_ARMS.map((a) => ({ id: a.id, file: undefined, env: a.env })),
    ...FILE_ARMS.map((a) => ({ id: a.id, file: a.file, env: undefined })),
  ].filter((a) => !(noExpress && (a.id === 'bridge-morgan' || a.id === 'express-morgan')));

  const results = {};
  Promise.allSettled(
    allArms.map(async (arm, i) => {
      results[arm.id] = await measure(arm, basePort + i * 10, { LADDER_ARM: arm.env });
    })
  ).then(() => {
    logHeader('Ladder results');
    logResult('arm', 'rps · p50 · p99');
    for (const arm of allArms) {
      const r = results[arm.id];
      if (!r) {
        logError(`${arm.id} failed to measure.`);
        continue;
      }
      logResult(
        arm.id,
        `${r.rps.toFixed(0)} rps · ${toMs(r.latencyMs.p50).toFixed(1)}ms · ${toMs(r.latencyMs.p99).toFixed(1)}ms`
      );
    }

    const pairs = [
      ['native-noop', 'native', 'compose fast-path drop (+1 native middleware entry)'],
      ['bridge-noop', 'native-noop', 'pure bridge execution (proxy setup + continuation, no property access)'],
      ['bridge-read', 'bridge-noop', 'req property access through the proxy'],
      ['bridge-write', 'bridge-noop', 'res property access through the proxy'],
      ['bridge-mixed', 'bridge-noop', 'combined req+res access through the proxy'],
      ['bridge-morgan', 'bridge-mixed', "morgan's own behavior through the bridge"],
      ['bridge-morgan', 'native-morgan-shape', 'bridge + morgan internals vs a native equivalent logger'],
      ['bridge-morgan', 'express-morgan', 'headline interop gap vs native Express'],
      ['bridge-response-time', 'native', 'response-time (lighter Full middleware) through the bridge vs native NextRush'],
      ['bridge-response-time', 'express-morgan', 'light-end of the interop gap'],
    ];

    logHeader('Decomposition (deltas)');
    for (const [currId, baseId, label] of pairs) {
      const base = results[baseId];
      const curr = results[currId];
      if (!base || !curr) continue;
      const rps = deltaPct(base.rps, curr.rps);
      const p99 = deltaPct(toMs(base.latencyMs.p99), toMs(curr.latencyMs.p99));
      logResult(
        `${currId} − ${baseId}`,
        `rps ${(rps ?? 0).toFixed(1)}% · p99 ${(p99 ?? 0).toFixed(1)}%`,
        `— ${label}`
      );
    }

    if (noSave) return;
    const resultsDir = join(RESULTS_DIR, `express-bridge-ladder-${timestamp()}`);
    ensureDir(resultsDir);
    const deltas = {};
    for (const [currId, baseId, label] of pairs) {
      const base = results[baseId];
      const curr = results[currId];
      if (!base || !curr) continue;
      deltas[`${currId}-vs-${baseId}`] = {
        label,
        rpsPct: deltaPct(base.rps, curr.rps),
        p50Pct: deltaPct(toMs(base.latencyMs.p50), toMs(curr.latencyMs.p50)),
        p99Pct: deltaPct(toMs(base.latencyMs.p99), toMs(curr.latencyMs.p99)),
      };
    }
    saveResults(resultsDir, 'express-bridge-ladder.json', {
      timestamp: new Date().toISOString(),
      duration,
      connections,
      pipelining,
      deltas,
      arms: results,
    });
    logResult('Saved to', resultsDir);
  });
}

main();