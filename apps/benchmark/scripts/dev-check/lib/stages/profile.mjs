// Profile stage: where does the per-request time actually go?
//
// `node check.mjs profile [--entry inproc-nextrush]` bundles any
// `entries/<name>.ts` unminified, runs it under the runtime's own CPU profiler,
// and prints the top self-time rows as a table. Look at NextRush's own frames;
// `Request`/`Response`/`Headers` rows are the platform and the harness.
//
// Slow on purpose and never part of the default stage set — it answers "what
// should I change next", not "is this change safe", which is what the budgeted
// stages are for.

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function bundle(ctx, entry, target, file) {
  const r = spawnSync(
    'bun',
    [join(ctx.here, 'lib/build.ts'), join(ctx.here, 'entries', `${entry}.ts`), file, target, '--no-minify'],
    { encoding: 'utf8' }
  );
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
}

function newest(dir, pattern) {
  const r = spawnSync('sh', ['-c', `ls -t ${dir}/${pattern} | head -1`], { encoding: 'utf8' });
  return (r.stdout || '').trim();
}

export function stageProfile(ctx) {
  if (ctx.rt === 'deno') {
    return ctx.row('WARN', 'profile', 'skipped', 'Deno CPU profiling is not supported by this stage');
  }
  const entry = ctx.flag('entry', 'inproc-nextrush');
  const file = join(ctx.out, `prof-${entry}.${ctx.rt}.js`);
  bundle(ctx, entry, ctx.rt, file);

  if (ctx.rt === 'node') return profileOnNode(ctx, entry, file);

  const dir = join(ctx.out, 'prof');
  mkdirSync(dir, { recursive: true });
  const r = spawnSync('bun', ['--cpu-prof-md', `--cpu-prof-dir=${dir}`, file], {
    env: { ...process.env, N: process.env.N ?? '150000' },
    encoding: 'utf8',
  });
  const md = newest(dir, '*.md');
  if (!md) throw new Error(`no profile written: ${r.stderr}`);
  const lines = readFileSync(md, 'utf8').split('\n');
  console.log(`\nProfile of ${entry} (full file: ${md})\n`);
  console.log(lines.find((l) => l.startsWith('**Top 10')) ?? '');
  const start = lines.findIndex((l) => l.startsWith('| Self%'));
  console.log(lines.slice(start, start + 16).map((l) => l.replace(/\/home\/[^`]*\//g, '')).join('\n'));
  ctx.row('INFO', 'profile', md);
}

function profileOnNode(ctx, entry, file) {
  const dir = join(ctx.out, 'prof-node');
  mkdirSync(dir, { recursive: true });
  spawnSync('node', ['--cpu-prof', `--cpu-prof-dir=${dir}`, file], {
    env: { ...process.env, N: process.env.N ?? '150000' },
    encoding: 'utf8',
  });
  const raw = newest(dir, '*.cpuprofile');
  if (!raw) throw new Error('node wrote no .cpuprofile');
  console.log(`\nNode profile of ${entry} (raw file: ${raw})\n`);
  console.log(spawnSync('node', [join(ctx.here, 'lib/cpuprofile-top.mjs'), raw, '15'], { encoding: 'utf8' }).stdout);
  ctx.row('INFO', 'profile', raw);
}
