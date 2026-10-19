// Shared harness for the dev-check stages.
//
// Extracted from `check.mjs` so that (a) the orchestrator is a dispatcher rather
// than the owner of every stage body, and (b) a stage receives one context object
// instead of reaching into script-level mutable state. The result table, the
// budget gate, the bundler step, and the child-process helpers all live here;
// each stage module owns only its own measurement.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { join } from 'node:path';
import { appliesTo } from './budget-rules.mjs';
import { coversRuntime } from './known-failures.mjs';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
export const has = (cmd) => spawnSync('sh', ['-c', `command -v ${cmd}`]).status === 0;

/** Runtime-specific argv for executing an already-bundled file. */
export function runtimeArgs(rt, file) {
  if (rt === 'bun' || rt === 'node') return [file];
  if (rt === 'deno') return ['run', '--allow-all', '--quiet', file];
  throw new Error(`unknown runtime: ${rt}`);
}

/**
 * @param {{ here: string, repoRoot: string, rt: 'bun'|'node', budgets: object,
 *           prev: object, argv: string[], selectedStages?: string[], built?: boolean }} options
 */
export function createHarness({ here, repoRoot, rt, budgets, prev, argv, selectedStages = [], built = false }) {
  const out = join(here, '.out');
  mkdirSync(out, { recursive: true });

  const rows = [];
  const metrics = {};
  const failures = [];
  const evaluated = new Set();
  const finalizers = [];

  const flag = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);

  function row(status, name, value, note = '') {
    rows.push({ status, name, value, note });
    if (status === 'FAIL') failures.push(name);
  }

  function record(name, value, unit = '') {
    metrics[name] = value;
    const p = prev[name];
    const delta = p ? ` (${((value - p) / p) * 100 >= 0 ? '+' : ''}${(((value - p) / p) * 100).toFixed(1)}% vs last run)` : '';
    return `${value}${unit}${delta}`;
  }

  /** Report `value` against a committed rule: over `max` / under `min` fails, a missed `target` warns. */
  function gate(name, value, rule, unit = '') {
    const shown = record(name, value, unit);
    if (!rule) return row('INFO', name, shown);
    if (!appliesTo(rule, rt)) {
      const scope = Array.isArray(rule.runtimes) ? rule.runtimes.join(', ') : 'no runtime';
      return row('FAIL', name, shown, `rule is scoped to ${scope}, not ${rt}`);
    }
    evaluated.add(name);
    if (rule.max !== undefined && value > rule.max) return row('FAIL', name, shown, `max ${rule.max}`);
    if (rule.min !== undefined && value < rule.min) return row('FAIL', name, shown, `min ${rule.min}`);
    const t = rule.target;
    const missed = t !== undefined && (rule.max !== undefined ? value > t : value < t);
    row(missed ? 'WARN' : 'PASS', name, shown, t !== undefined ? `target ${t}` : '');
  }

  /** Register a check that runs after every stage, before the summary. */
  function onFinalize(fn) {
    finalizers.push(fn);
  }

  function finalize() {
    for (const fn of finalizers) fn();
  }

  /** Bundle an entry from source, or from `dist/` when `built` is set. */
  function build(entry, target, options = {}) {
    const useBuilt = options.built ?? false;
    const file = join(out, `${entry}.${target}${useBuilt ? '.built' : ''}.js`);
    const args = [join(here, 'lib/build.ts'), join(here, 'entries', `${entry}.ts`), file, target];
    if (useBuilt) args.push('--built');
    const r = spawnSync('bun', args, { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`build ${entry} failed:\n${r.stderr || r.stdout}`);
    return { out: file, kb: JSON.parse(r.stdout.trim().split('\n').pop()).kb };
  }

  function waitPort(port, ms = 8000) {
    const t0 = Date.now();
    return new Promise((resolve, reject) => {
      const tryOnce = () => {
        const s = net.connect(port, '127.0.0.1');
        s.on('connect', () => { s.destroy(); resolve(); });
        s.on('error', () => {
          s.destroy();
          if (Date.now() - t0 > ms) reject(new Error(`port ${port} not up`));
          else setTimeout(tryOnce, 80);
        });
      };
      tryOnce();
    });
  }

  /** Run `file` as a server on `port`, wait for the socket, then `fn()`, always killing it. */
  async function withServer(file, port, env, fn) {
    const child = spawn(rt, runtimeArgs(rt, file), {
      env: { ...process.env, PORT: String(port), ...env },
      stdio: 'ignore',
    });
    try { await waitPort(port); return await fn(); } finally { child.kill('SIGKILL'); await sleep(150); }
  }

  /** Runtime-wide exemption lookup for a bug id, honouring per-runtime scoping. */
  const isKnown = (bug) => Boolean(bug) && coversRuntime(budgets.knownFailures?.[bug], rt);

  /** Persist this run's metrics so the next run can print a delta. */
  function save() {
    writeFileSync(join(out, `last-run.${rt}.json`), JSON.stringify({ ...prev, ...metrics }, null, 2));
  }

  return {
    rt,
    target: rt === 'node' ? 'node' : 'bun',
    here,
    repoRoot,
    out,
    budgets,
    argv,
    selectedStages,
    evaluated,
    built,
    flag,
    row,
    record,
    gate,
    onFinalize,
    finalize,
    build,
    waitPort,
    withServer,
    isKnown,
    save,
    rows,
    metrics,
    failures,
  };
}

/** Print the run's table and totals. */
/**
 * Context for the built pass: every row is INFO and every metric key is prefixed
 * `built.`, so a published-output measurement can never satisfy or fail a source
 * gate. `build()` switches the bundler to the packages' `dist/` entry points.
 */
export function builtContext(ctx) {
  const prefix = (name) => `built.${name}`;
  return {
    ...ctx,
    built: true,
    row: (_status, name, value, note = '') => ctx.row('INFO', prefix(name), value, note),
    record: (name, value, unit = '') => ctx.record(prefix(name), value, unit),
    gate: (name, value, _rule, unit = '') => {
      const shown = ctx.record(prefix(name), value, unit);
      ctx.row('INFO', prefix(name), shown);
    },
    build: (entry, target) => ctx.build(entry, target, { built: true }),
  };
}

export function printSummary(harness, startedAt) {
  const pad = (s, n) => String(s).padEnd(n);
  console.log(`\nNextRush dev-check  runtime=${harness.rt}  (${((Date.now() - startedAt) / 1000).toFixed(0)} s)\n`);
  for (const r of harness.rows) console.log(`${pad(r.status, 6)} ${pad(r.name, 38)} ${pad(r.value, 52)} ${r.note}`);
  const count = (s) => harness.rows.filter((r) => r.status === s).length;
  console.log(`\nPASS ${count('PASS')}  WARN ${count('WARN')}  KNOWN ${count('KNOWN')}  FAIL ${count('FAIL')}  INFO ${count('INFO')}`);
}

export const readJsonIfPresent = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {});
