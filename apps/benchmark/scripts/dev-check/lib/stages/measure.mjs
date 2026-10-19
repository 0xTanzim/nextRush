// Measurement stages: cost the request path in the three ways that map onto the
// three ways a user feels it — bytes shipped (bundle), time before the first
// request is served (cold), and per-request cost in the steady state (inproc),
// plus real requests per second over a socket (wire).

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { has, median, runtimeArgs } from '../harness.mjs';
import { rawRequest } from '../raw-http.mjs';
import { summarizeWire } from '../wire-summary.mjs';
import { WIRE_POST_BODY, parseWrkRps, wrkArgs, wrkPostScript } from '../wrk.mjs';

/** Bundle size per entry, in KB, as the bundler produces it. */
export function stageBundle(ctx) {
  const deno = ctx.rt === 'deno';
  const entries = deno
    ? [
        ['hello-nextrush-root', 'bun'],
        ['hello-nextrush-deno', 'bun'],
        ['hello-hono', 'bun'],
      ]
    : [
        ['hello-nextrush-root', 'bun'],
        ['hello-nextrush-bun', 'bun'],
        ['hello-nextrush-node', 'node'],
        ['hello-hono', 'bun'],
        ['hello-hono-node', 'node'],
        ['hello-fastify', 'node'],
      ];
  if (ctx.rt === 'bun') entries.push(['hello-elysia', 'bun']);
  for (const [name, target] of entries) {
    const { kb } = ctx.build(name, target);
    if (deno) ctx.row('INFO', `bundle.${name}.kb`, `${String(kb)} KB (INFO on deno)`);
    else if (name === 'hello-elysia') ctx.row('INFO', `bundle.${name}.kb`, `${String(kb)} KB (Bun-only)`);
    else ctx.gate(`bundle.${name}.kb`, kb, ctx.budgets.bundleKb?.[name], ' KB');
  }
  if (deno) ctx.row('WARN', 'bundle.hello-fastify.kb', 'skipped', 'Fastify has no Deno target');
}

/** Start the app N times in a fresh process; report the median of T and RSS. */
function runN(ctx, file, env, n) {
  const T = [];
  const R = [];
  for (let i = 0; i < n; i++) {
    const r = spawnSync(ctx.rt, runtimeArgs(ctx.rt, file), {
      env: { ...process.env, ...env },
      encoding: 'utf8',
    });
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
  const elysia = ctx.rt === 'bun' ? ctx.build('coldstart-elysia', 'bun').out : null;
  for (const n of [25, 1000]) {
    const a = runN(ctx, nr, { N: n }, 7);
    const b = runN(ctx, hono, { N: n }, 7);
    ctx.row('INFO', `cold.n${n}.nextrush`, `${a.t.toFixed(1)} ms, ${a.rss.toFixed(1)} MB RSS`);
    ctx.row('INFO', `cold.n${n}.hono`, `${b.t.toFixed(1)} ms, ${b.rss.toFixed(1)} MB RSS`);
    const ratio = Number((a.t / b.t).toFixed(2));
    if (ctx.rt === 'deno') ctx.row('INFO', `cold.n${n}.vs_hono`, `${String(ratio)} (not gated on deno)`);
    else ctx.gate(`cold.n${n}.vs_hono`, ratio, ctx.budgets.ratios?.[`cold.n${n}.vs_hono`]);
    if (elysia) {
      const e = runN(ctx, elysia, { N: n }, 7);
      ctx.row('INFO', `cold.n${n}.elysia`, `${e.t.toFixed(1)} ms, ${e.rss.toFixed(1)} MB RSS (Bun-only)`);
    }
  }
}

/** Microseconds per request from a fixed request count in-process. */
function inprocUs(ctx, file, env) {
  const r = spawnSync(ctx.rt, runtimeArgs(ctx.rt, file), {
    env: { ...process.env, N: '100000', HEADERS: '4', ...env },
    encoding: 'utf8',
  });
  const m = /US=([\d.]+)/.exec(r.stdout);
  if (!m) throw new Error(`inproc failed: ${r.stderr}`);
  const adapter = /ADAPTER=(\S+) RUNTIME=(\S+)/.exec(r.stdout);
  const count = /COUNT=(\d+)/.exec(r.stdout);
  return {
    us: Number(m[1]),
    adapter: adapter ? `${adapter[1]} on ${adapter[2]}` : 'unreported',
    count: count ? Number(count[1]) : null,
  };
}

export function stageInproc(ctx) {
  const files = {
    raw: ctx.build('inproc-raw', ctx.target).out,
    hono: ctx.build('inproc-hono', ctx.target).out,
    nr: ctx.build('inproc-nextrush', ctx.target).out,
    web: ctx.build('inproc-nextrush-web', ctx.target).out,
    post: ctx.build('inproc-nextrush-post', ctx.target).out,
    postHono: ctx.build('inproc-hono-post', ctx.target).out,
  };
  // Best of three: a single run can eat a GC pause or a scheduling hiccup
  // unrelated to the code under test, and the ratio this feeds is a gate — two
  // samples leaves a 40% spread on a loaded machine, three halves it.
  const best = (f, env) => {
    const runs = [inprocUs(ctx, f, env), inprocUs(ctx, f, env), inprocUs(ctx, f, env)];
    return {
      us: Math.min(...runs.map((run) => run.us)),
      adapter: runs[0].adapter,
      count: runs[0].count,
    };
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

  const post = best(files.post, {});
  const postHono = best(files.postHono, {});
  if (post.count !== postHono.count) {
    throw new Error(`POST arms measured different request counts: ${post.count} vs ${postHono.count}`);
  }
  ctx.row('INFO', 'inproc.post.nextrush.us', `${post.us.toFixed(2)} us/req (${String(post.count)} req)`);
  ctx.row('INFO', 'inproc.post.hono.us', `${postHono.us.toFixed(2)} us/req (${String(postHono.count)} req)`);
  const postRatio = Number((post.us / postHono.us).toFixed(2));
  if (ctx.rt === 'bun') {
    ctx.gate('inproc.post.nextrush.vs_hono', postRatio, ctx.budgets.ratios?.['inproc.post.nextrush.vs_hono']);
  } else {
    ctx.row('INFO', 'inproc.post.nextrush.vs_hono', `${postRatio} (not gated on ${ctx.rt})`);
  }

  const nr12 = best(files.nr, { HEADERS: '12' });
  const hono12 = best(files.hono, { HEADERS: '12' });
  ctx.row('INFO', 'inproc.nextrush.h12.us', `${nr12.us.toFixed(2)} us/req`);
  ctx.row('INFO', 'inproc.hono.h12.us', `${hono12.us.toFixed(2)} us/req`);
  const ratio12 = Number((nr12.us / hono12.us).toFixed(2));
  if (ctx.rt === 'bun') {
    ctx.gate('inproc.nextrush.vs_hono.h12', ratio12, ctx.budgets.ratios?.['inproc.nextrush.vs_hono.h12']);
  } else {
    ctx.row('INFO', 'inproc.nextrush.vs_hono.h12', `${ratio12} (not gated on ${ctx.rt})`);
  }
}

function wrkRps(port, options = {}) {
  // Pin away from the server's own cores when the tool is available: an
  // unpinned client competes with the process being measured.
  const pin = has('taskset') ? ['taskset', '-c', '4-7'] : [];
  const cmd = [...pin, 'wrk', ...wrkArgs({ url: `http://127.0.0.1:${port}/`, ...options })];
  const r = spawnSync(cmd[0], cmd.slice(1), { encoding: 'utf8' });
  return parseWrkRps(r.stdout);
}

/** Three runs per case: one socket sample moves several percent on a shared machine. */
function threeRuns(port, options) {
  return [wrkRps(port, options), wrkRps(port, options), wrkRps(port, options)];
}

/** Fail loudly when a POST entry answers the wrong thing; wrk would count an error loop. */
async function assertPostAnswers(port, entry) {
  const probe = await rawRequest(port, {
    method: 'POST',
    target: '/',
    headers: { 'content-type': 'application/json' },
    body: WIRE_POST_BODY,
  });
  if (probe.status !== 200) throw new Error(`wire POST ${entry} answered ${probe.status}`);
  let parsed;
  try {
    parsed = JSON.parse(probe.body);
  } catch {
    throw new Error(`wire POST ${entry} answered non-JSON: ${probe.body.slice(0, 80)}`);
  }
  if (parsed?.ok !== true) throw new Error(`wire POST ${entry} answered ${probe.body.slice(0, 80)}`);
}

/** Requests per second through a real listener, median of three runs per case. */
export async function stageWire(ctx) {
  if (!has('wrk')) return ctx.row('WARN', 'wire', 'skipped', 'wrk not installed');
  const postScript = join(ctx.out, 'wrk-post.lua');
  writeFileSync(postScript, wrkPostScript());
  const res = {};
  let port = 4300;
  const run = async (entry, env = {}, options = {}) => {
    const { out } = ctx.build(entry, ctx.target);
    port += 1;
    return ctx.withServer(out, port, env, () => threeRuns(port, options));
  };
  const runPost = async (entry) => {
    const { out } = ctx.build(entry, ctx.target);
    port += 1;
    return ctx.withServer(out, port, {}, async () => {
      await assertPostAnswers(port, entry);
      return threeRuns(port, { script: postScript });
    });
  };
  const cases = [
    ['raw', 'serve-raw', {}],
    ['hono', 'serve-hono', {}],
    ['nr', 'serve-nextrush', {}],
    ['nr0', 'serve-nextrush', { TIMEOUT: '0' }],
  ];
  if (ctx.rt === 'bun') cases.push(['elysia', 'serve-elysia', {}]);
  for (const [key, entry, env] of cases) {
    res[key] = await run(entry, env);
  }
  const raw = summarizeWire(res.raw);
  const hono = summarizeWire(res.hono);
  const nr = summarizeWire(res.nr);
  const nr0 = summarizeWire(res.nr0);
  ctx.row('INFO', 'wire.raw.rps', `${raw.display} (floor, client may saturate)`);
  ctx.row('INFO', 'wire.hono.rps', hono.display);
  const nrText = ctx.record('wire.nextrush.rps', Math.round(nr.median));
  ctx.row('INFO', 'wire.nextrush.rps', `${nrText} rps (${String(Math.round(nr.min))}–${String(Math.round(nr.max))})`);
  ctx.row('INFO', 'wire.nextrush.no-timeout.rps', nr0.display);
  if (res.elysia) {
    const elysia = summarizeWire(res.elysia);
    ctx.row('INFO', 'wire.elysia.rps', `${elysia.display} (Bun-only)`);
  }

  const postHono = summarizeWire(await runPost('serve-hono-post'));
  const postNr = summarizeWire(await runPost('serve-nextrush-post'));
  ctx.row('INFO', 'wire.post.hono.rps', postHono.display);
  const postNrText = ctx.record('wire.post.nextrush.rps', Math.round(postNr.median));
  ctx.row('INFO', 'wire.post.nextrush.rps', `${postNrText} rps (${String(Math.round(postNr.min))}–${String(Math.round(postNr.max))})`);
  const postRatio = postHono.median > 0 ? Number((postNr.median / postHono.median).toFixed(2)) : 0;
  ctx.row('INFO', 'wire.post.nextrush.vs_hono', ctx.record('wire.post.nextrush.vs_hono', postRatio));
}
