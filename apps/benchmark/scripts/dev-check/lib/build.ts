// Bundle an entry file straight from NextRush SOURCE (no `pnpm build` needed).
//
// Why: the workspace packages point at `dist/`, which does not exist in a fresh checkout.
// This script aliases `nextrush` and `@nextrush/*` to `packages/**/src/index.ts`, so a
// "dev mode" comparison against Hono/Fastify works in seconds.
//
// Usage: bun lib/build.ts <entry.ts> <out.js> <bun|node> [--no-minify] [--built]
//
// `--built` points the same alias at each package's `dist/index.js` instead of
// `src/index.ts`. check.mjs preflights those outputs before using it.
//
// Note: sizes are Bun-minifier sizes of the *source* graph. They are good for relative
// comparison and regression gating; they are NOT the numbers a published tsdown build gives.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dir, '../../../../..');
const map = new Map<string, string>();

function scan(dir: string, depth: number, kind: 'src' | 'dist'): void {
  if (depth > 2) return;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue;
    const p = join(dir, entry);
    if (!statSync(p).isDirectory()) continue;
    const pkgJson = join(p, 'package.json');
    if (existsSync(pkgJson)) {
      const name = JSON.parse(readFileSync(pkgJson, 'utf8')).name as string | undefined;
      const main = kind === 'src' ? join(p, 'src', 'index.ts') : join(p, 'dist', 'index.js');
      if (name && existsSync(main)) map.set(name, main);
      if (name === 'nextrush') {
        for (const sub of ['class', 'nextjs']) {
          const file = kind === 'src' ? join(p, 'src', `${sub}.ts`) : join(p, 'dist', `${sub}.js`);
          if (existsSync(file)) map.set(`nextrush/${sub}`, file);
        }
      }
    }
    scan(p, depth + 1, kind);
  }
}
const argv = process.argv.slice(2);
const built = argv.includes('--built');
scan(join(repoRoot, 'packages'), 0, built ? 'dist' : 'src');

const alias: Bun.BunPlugin = {
  name: 'nextrush-src-alias',
  setup(build) {
    build.onResolve({ filter: /^(nextrush|@nextrush\/.+)$/ }, (args) => {
      const hit = map.get(args.path);
      return hit ? { path: hit } : undefined;
    });
  },
};

const [entry, out, target = 'bun'] = argv;
if (!entry || !out) {
  console.error('usage: bun lib/build.ts <entry.ts> <out.js> <bun|node> [--no-minify] [--built]');
  process.exit(2);
}
const minify = !argv.includes('--no-minify');

const result = await Bun.build({
  entrypoints: [resolve(entry)],
  outdir: dirname(resolve(out)),
  naming: out.split('/').pop() as string,
  target: target as 'bun' | 'node',
  minify,
  plugins: [alias],
});

if (!result.success) {
  for (const log of result.logs) console.error(String(log));
  process.exit(1);
}
const bytes = result.outputs[0]?.size ?? 0;
console.log(JSON.stringify({ out, bytes, kb: Number((bytes / 1024).toFixed(1)) }));
