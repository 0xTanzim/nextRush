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
import { coversRuntime } from './known-failures.mjs';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
export const has = (cmd) => spawnSync('sh', ['-c', `command -v ${cmd}`]).status === 0;

/**
 * @param {{ here: string, repoRoot: string, rt: 'bun'|'node', budgets: object,
 *           prev: object, argv: string[] }} options
 */
export function createHarness({ here, repoRoot, rt, budgets, prev, argv }) {
  const out = join(here, '.out');
  mkdirSync(out, { recursive: true });

  const rows = [];
  const metrics = {};
  const failures = [];

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
    if (rule.max !== undefined && value > rule.max) return row('FAIL', name, shown, `max ${rule.max}`);
    if (rule.min !== undefined && value < rule.min) return row('FAIL', name, shown, `min ${rule.min}`);
    const t = rule.target;
    const missed = t !== undefined && (rule.max !== undefined ? value > t : value < t);
    row(missed ? 'WARN' : 'PASS', name, shown, t !== undefined ? `target ${t}` : '');
  }

  /** Bundle an entry from source. Returns the output path and its size in KB. */
  function build(entry, target) {
    const file = join(out, `${entry}.${target}.js`);
    const r = spawnSync(
      'bun',
      [join(here, 'lib/build.ts'), join(here, 'entries', `${entry}.ts`), file, target],
      { encoding: 'utf8' }
    );
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
    const child = spawn(rt, [file], { env: { ...process.env, PORT: String(port), ...env }, stdio: 'ignore' });
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
    flag,
    row,
    record,
    gate,
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
export function printSummary(harness, startedAt) {
  const pad = (s, n) => String(s).padEnd(n);
  console.log(`\nNextRush dev-check  runtime=${harness.rt}  (${((Date.now() - startedAt) / 1000).toFixed(0)} s)\n`);
  for (const r of harness.rows) console.log(`${pad(r.status, 6)} ${pad(r.name, 38)} ${pad(r.value, 52)} ${r.note}`);
  const count = (s) => harness.rows.filter((r) => r.status === s).length;
  console.log(`\nPASS ${count('PASS')}  WARN ${count('WARN')}  KNOWN ${count('KNOWN')}  FAIL ${count('FAIL')}  INFO ${count('INFO')}`);
}

export const readJsonIfPresent = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {});
