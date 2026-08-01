#!/usr/bin/env node

/**
 * Mount-scaling micro-benchmark — closes the measurement gap that let the
 * prefix-mount cost stay invisible (G-1 / F-7).
 *
 * Every scenario in the comparison suite mounts at the ROOT
 * (`app.route('/', router)`), which takes `Application.route`'s root
 * short-circuit and never installs a `createPrefixMount`. So the entire
 * prefix-mount path — the shape `registerModule`/`@Module` actively encourages,
 * and the shape every real multi-feature app has — is unbenchmarked. This
 * harness measures it directly.
 *
 * Measures TIME, not allocation, deliberately: the original investigation found
 * the heap-delta approach inconclusive here (cv 33.2%, non-monotonic series)
 * because retained context arrays dominate. ns/req is the decisive metric.
 *
 * The headline number is the SLOPE — nanoseconds added per mounted router.
 * O(1) in mount count is the goal; a positive slope is the defect.
 *
 * Rounds are INTERLEAVED (every variant measured once per round, then repeated)
 * so machine drift moves all variants together and the paired slope survives a
 * noisy host.
 *
 * Usage:
 *   node scripts/alloc/mount-scaling.js
 *   node scripts/alloc/mount-scaling.js --rounds 7 --n 40000
 */

import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { createNodeContext } from '@nextrush/adapter-node';

import { computeStats } from '../lib/stats.js';
import { logHeader, logResult, logStep, parseArgs } from '../utils.js';

const args = parseArgs();
const ROUNDS = args.rounds ? Number.parseInt(String(args.rounds), 10) : 5;
const N = args.n ? Number.parseInt(String(args.n), 10) : 40_000;

/** The request every variant dispatches — matches the LAST mount (worst case). */
const TARGET_PATH = '/api/v1/users/42';

function makeReq() {
  return {
    method: 'GET',
    url: TARGET_PATH,
    headers: {},
    socket: {},
    on() {},
    once() {},
    removeListener() {},
  };
}

function makeRes() {
  let sent = false;
  return {
    get headersSent() {
      return sent;
    },
    statusCode: 200,
    setHeader() {},
    getHeader() {},
    writeHead() {
      sent = true;
      return this;
    },
    end() {
      sent = true;
    },
    write() {
      return true;
    },
    on() {},
    once() {},
    removeListener() {},
  };
}

/**
 * Build an app whose LAST mount serves TARGET_PATH.
 *
 * `mounts === 0` is the benchmark suite's own shape: one router at the root,
 * taking `Application.route`'s root short-circuit. `mounts >= 1` installs that
 * many `createPrefixMount` layers, with the matching router last.
 */
function buildApp(mounts) {
  const app = createApp();

  if (mounts === 0) {
    const router = createRouter();
    router.get('/api/v1/users/:id', (ctx) => ctx.json({ id: ctx.params.id }));
    app.route('/', router);
    return app;
  }

  // Non-matching mounts first, so a request must fall through all of them.
  for (let i = 0; i < mounts - 1; i++) {
    const filler = createRouter();
    filler.get('/users/:id', (ctx) => ctx.json({ id: ctx.params.id }));
    app.route(`/feature-${String(i)}`, filler);
  }

  const matching = createRouter();
  matching.get('/users/:id', (ctx) => ctx.json({ id: ctx.params.id }));
  app.route('/api/v1', matching);
  return app;
}

/** Fail loudly rather than measuring a 404 loop. */
async function assertServes(handler, label) {
  const ctx = createNodeContext(makeReq(), makeRes(), {});
  await handler(ctx);
  if (ctx.status !== 200 || !ctx.responded) {
    throw new Error(
      `${label}: expected status 200 and responded=true, got status=${String(ctx.status)} responded=${String(ctx.responded)}`
    );
  }
}

async function measure(handler) {
  // A context can only respond once, so each dispatch needs a fresh one. That
  // constant is identical across variants, so it cancels out of the slope.
  const start = process.hrtime.bigint();
  for (let i = 0; i < N; i++) {
    const ctx = createNodeContext(makeReq(), makeRes(), {});
    await handler(ctx);
  }
  return Number(process.hrtime.bigint() - start) / N;
}

const VARIANTS = [
  { mounts: 0, label: "root mount — app.route('/', r)" },
  { mounts: 1, label: '1 prefix mount' },
  { mounts: 5, label: '5 prefix mounts' },
  { mounts: 10, label: '10 prefix mounts' },
];

async function main() {
  logHeader('Mount-Scaling Micro-Bench — prefix-mount dispatch cost (G-1 / F-7)');
  logResult('Rounds (interleaved)', String(ROUNDS));
  logResult('Dispatches per round', N.toLocaleString());
  logResult('Request path', TARGET_PATH);

  const handlers = new Map();
  for (const v of VARIANTS) {
    const handler = buildApp(v.mounts).callback();
    await assertServes(handler, v.label);
    handlers.set(v.mounts, handler);
  }
  logStep('All variants serve 200 — measuring...');

  const samples = new Map(VARIANTS.map((v) => [v.mounts, []]));
  // Warm each variant so JIT state is comparable before the first timed round.
  for (const v of VARIANTS) await measure(handlers.get(v.mounts));

  for (let r = 0; r < ROUNDS; r++) {
    for (const v of VARIANTS) {
      samples.get(v.mounts).push(await measure(handlers.get(v.mounts)));
    }
  }

  const stats = new Map();
  for (const v of VARIANTS) stats.set(v.mounts, computeStats(samples.get(v.mounts)));

  const root = stats.get(0).mean;
  process.stdout.write('\n');
  for (const v of VARIANTS) {
    const s = stats.get(v.mounts);
    const vsRoot = v.mounts === 0 ? '—' : `${((s.mean / root - 1) * 100).toFixed(1)}%`;
    process.stdout.write(
      `  ${v.label.padEnd(32)} ${s.mean.toFixed(1).padStart(9)} ns/req  ` +
        `(cv ${s.cv.toFixed(1)}%)   vs root ${vsRoot.padStart(7)}\n`
    );
  }

  // Slope over the 1 -> 10 mount range: the O(mounts) signal itself.
  const perMount = (stats.get(10).mean - stats.get(1).mean) / 9;
  const firstMount = stats.get(1).mean - root;
  process.stdout.write('\n');
  logResult('Cost of the first prefix mount', `${firstMount.toFixed(1)} ns/req`);
  logResult('Slope per ADDITIONAL mount', `${perMount.toFixed(1)} ns/req/mount`);
  process.stdout.write('\n');

  // REGRESSION gate, not an O(1) gate. Removing the two per-mount
  // canonicalizations took the slope from ~557 to ~130-190 ns/mount. The
  // residual is structural: each mount is its own `async` middleware, and an
  // async pass-through frame measured ~71 ns on its own. Driving it to zero
  // needs one dispatcher over all mount prefixes (design C), which trades
  // mount-order transparency for asymptotics and is not justified yet.
  //
  // So this threshold catches a return to per-mount canonicalization — the
  // actual defect — while accepting the async-frame floor.
  const THRESHOLD_NS_PER_MOUNT = 320;
  if (perMount > THRESHOLD_NS_PER_MOUNT) {
    process.stdout.write(
      `  GATE FAILED: dispatch cost grows ${perMount.toFixed(1)} ns per mounted router ` +
        `(threshold ${String(THRESHOLD_NS_PER_MOUNT)}). Per-mount canonicalization has likely ` +
        `returned — mount dispatch is O(mounts) again.\n\n`
    );
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    `  GATE PASSED: ${perMount.toFixed(1)} ns per added mount (< ${String(THRESHOLD_NS_PER_MOUNT)}).\n` +
      `  The residual is one async mount frame per mount, not canonicalization.\n\n`
  );
}

void main();
