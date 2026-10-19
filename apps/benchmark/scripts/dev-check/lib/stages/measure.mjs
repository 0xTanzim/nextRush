// Measurement stages: cost the request path in the three ways that map onto the
// three ways a user feels it — bytes shipped (bundle), time before the first
// request is served (cold), and per-request cost in the steady state (inproc),
// plus real requests per second over a socket (wire).

import { spawnSync } from 'node:child_process';
import { has, median } from '../harness.mjs';

/** Bundle size per entry, in KB, as the bundler produces it. */
export function stageBundle(ctx) {
  const entries = [
    ['hello-nextrush-root', 'bun'],
    ['hello-nextrush-bun', 'bun'],
    ['hello-nextrush-node', 'node'],
    ['hello-hono', 'bun'],
    ['hello-hono-node', 'node'],
    ['hello-fastify', 'node'],
  ];
  for (const [name, target] of entries) {
    const { kb } = ctx.build(name, target);
    ctx.gate(`bundle.${name}.kb`, kb, ctx.budgets.bundleKb?.[name], ' KB');
  }
}

/** Start the app N times in a fresh process; report the median of T and RSS. */
function runN(ctx, file, env, n) {
  const T = [];
  const R = [];
  for (let i = 0; i < n; i++) {
    const r = spawnSync(ctx.rt, [file], { env: { ...process.env, ...env }, encoding: 'utf8' });
    const m = /T=([\d.]+) RSS=([\d.]+)/.exec(r.stdout);
    if (m) { T.push(Number(m[1])); R.push(Number(m[2])); }
  }
  return { t: median(T), rss: median(R) };
}

/**
 * Cold start at two route counts: 25 is an app, 1000 is where registration work
 * becomes visible in the startup time.
 */
export function stageCold(ctx) {
  const nr = ctx.build('coldstart-nextrush', ctx.target).out;
  const hono = ctx.build('coldstart-hono', ctx.target).out;
  for (const n of [25, 1000]) {
    const a = runN(ctx, nr, { N: n }, 7);
    const b = runN(ctx, hono, { N: n }, 7);
    ctx.row('INFO', `cold.n${n}.nextrush`, `${a.t.toFixed(1)} ms, ${a.rss.toFixed(1)} MB RSS`);
    ctx.row('INFO', `cold.n${n}.hono`, `${b.t.toFixed(1)} ms, ${b.rss.toFixed(1)} MB RSS`);
    ctx.gate(`cold.n${n}.vs_hono`, Number((a.t / b.t).toFixed(2)), ctx.budgets.ratios?.[`cold.n${n}.vs_hono`]);
  }
}

/** Microseconds per request from a fixed request count in-process. */
function inprocUs(ctx, file, env) {
  const r = spawnSync(ctx.rt, [file], {
    env: { ...process.env, N: '100000', HEADERS: '4', ...env },
    encoding: 'utf8',
  });
  const m = /US=([\d.]+)/.exec(r.stdout);
  if (!m) throw new Error(`inproc failed: ${r.stderr}`);
  const adapter = /ADAPTER=(\S+) RUNTIME=(\S+)/.exec(r.stdout);
  return { us: Number(m[1]), adapter: adapter ? `${adapter[1]} on ${adapter[2]}` : 'unreported' };
}

export function stageInproc(ctx) {
  const files = {
    raw: ctx.build('inproc-raw', ctx.target).out,
    hono: ctx.build('inproc-hono', ctx.target).out,
    nr: ctx.build('inproc-nextrush', ctx.target).out,
    web: ctx.build('inproc-nextrush-web', ctx.target).out,
  };
  // Best of three: a single run can eat a GC pause or a scheduling hiccup
  // unrelated to the code under test, and the ratio this feeds is a gate — two
  // samples leaves a 40% spread on a loaded machine, three halves it.
  const best = (f, env) => {
    const runs = [inprocUs(ctx, f, env), inprocUs(ctx, f, env), inprocUs(ctx, f, env)];
    return { us: Math.min(...runs.map((run) => run.us)), adapter: runs[0].adapter };
  };
  const raw = best(files.raw, {}).us;
  const hono = best(files.hono, {}).us;
  const mine = best(files.nr, {});
  const nr = mine.us;
  const nrNt = best(files.nr, { TIMEOUT: '0' }).us;
  const web = best(files.web, {});
  ctx.row('INFO', 'inproc.raw.us', `${raw.toFixed(2)} us/req (floor)`);
  ctx.row('INFO', 'inproc.hono.us', `${hono.toFixed(2)} us/req`);
  ctx.row('INFO', 'inproc.nextrush.us', `${ctx.record('inproc.nextrush.us', nr)} us/req (${mine.adapter})`);
  ctx.row('INFO', 'inproc.nextrush.web.us', `${web.us.toFixed(2)} us/req (${web.adapter} — control, same runtime)`);
  ctx.row('INFO', 'inproc.nextrush.no-timeout.us', `${nrNt.toFixed(2)} us/req (timeout race cost = ${(nr - nrNt).toFixed(2)} us)`);
  const ratio = Number((nr / hono).toFixed(2));
  if (ctx.rt === 'bun') {
    ctx.gate('inproc.nextrush.vs_hono', ratio, ctx.budgets.ratios?.['inproc.nextrush.vs_hono']);
  } else {
    // Not a gate on Node: the NextRush arm now drives the Node adapter's own
    // handler, which takes node:http objects, while Hono's arm still builds a
    // `Request` per iteration. That platform cost dominates both the raw floor
    // and Hono, so the ratio would measure the harness difference, not the
    // frameworks. Compare NextRush to itself over time here, and use `wire` for
    // a cross-framework number on Node.
    ctx.row('INFO', 'inproc.nextrush.vs_hono', `${ratio} (not gated: arms use different request models — see inproc.*.web.us)`);
  }
}

function wrkRps(ctx, port) {
  // Pin away from the server's own cores when the tool is available: an
  // unpinned client competes with the process being measured.
  const pin = has('taskset') ? ['taskset', '-c', '4-7'] : [];
  const cmd = [...pin, 'wrk', '-t2', '-c64', '-d3s', `http://127.0.0.1:${port}/`];
  const r = spawnSync(cmd[0], cmd.slice(1), { encoding: 'utf8' });
  const m = /Requests\/sec:\s+([\d.]+)/.exec(r.stdout);
  return m ? Number(m[1]) : 0;
}

/** Requests per second through a real listener, best of two runs. */
export async function stageWire(ctx) {
  if (!has('wrk')) return ctx.row('WARN', 'wire', 'skipped', 'wrk not installed');
  const res = {};
  let port = 4300;
  const cases = [
    ['raw', 'serve-raw', {}],
    ['hono', 'serve-hono', {}],
    ['nr', 'serve-nextrush', {}],
    ['nr0', 'serve-nextrush', { TIMEOUT: '0' }],
  ];
  for (const [key, entry, env] of cases) {
    const { out } = ctx.build(entry, ctx.target);
    port += 1;
    res[key] = await ctx.withServer(out, port, env, () => Math.max(wrkRps(ctx, port), wrkRps(ctx, port)));
  }
  ctx.row('INFO', 'wire.raw.rps', `${Math.round(res.raw)} rps (floor, client may saturate)`);
  ctx.row('INFO', 'wire.hono.rps', `${Math.round(res.hono)} rps`);
  ctx.row('INFO', 'wire.nextrush.rps', `${ctx.record('wire.nextrush.rps', Math.round(res.nr))} rps`);
  ctx.row('INFO', 'wire.nextrush.no-timeout.rps', `${Math.round(res.nr0)} rps`);
  ctx.gate('wire.nextrush.vs_hono', Number((res.nr / res.hono).toFixed(2)), ctx.budgets.ratios?.['wire.nextrush.vs_hono']);
}
