#!/usr/bin/env node
// NextRush dev-mode check: compare NextRush against Hono (and a raw floor) in
// SECONDS, straight from source — no `pnpm build`, no 30-minute benchmark profile.
//
//   node scripts/dev-check/check.mjs                 # every stage except profile
//   node scripts/dev-check/check.mjs probe           # only correctness probes
//   node scripts/dev-check/check.mjs cold inproc
//   node scripts/dev-check/check.mjs all --rt node   # run the runtime stages on Node instead of Bun
//
// `bundle cold inproc probe` measures ~5 s on Bun and ~25 s on Node; `wire` adds
// ~25 s. `profile` is minutes and is excluded from the default stage set.
//
// Stages: bundle | cold | inproc | wire | probe | bookkeeping | hygiene | profile
// Flags:  --rt bun|node (default bun), --entry <name> (profile only)
// Prereqs: bun (bundler + default runtime), node >= 22, wrk (only for `wire`), taskset optional.
//
// Results are saved to .out/last-run.<runtime>.json; the next run prints the delta
// vs the previous run, so "before my change / after my change" is just running the
// command twice.
//
// Exit code 1 = a budget FAILED, a probe FAILED that is not a declared exemption
// for this runtime, an exemption that no longer covers anything, or an added
// source comment that points at a planning artifact instead of explaining itself.
// See README.md for the stages, the ratios, and how to read a run.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHarness, printSummary, readJsonIfPresent } from './lib/harness.mjs';
import { stageBundle, stageCold, stageInproc, stageWire } from './lib/stages/measure.mjs';
import { stageProbe } from './lib/stages/probe.mjs';
import { stageBookkeeping, stageHygiene } from './lib/stages/static-checks.mjs';
import { stageProfile } from './lib/stages/profile.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);

// `--rt node` and any bare stage name share one flat argv, so the runtime name is
// excluded from stage selection rather than consumed positionally.
const stages = argv.filter((a) => !a.startsWith('--') && !['bun', 'node'].includes(a));
const rt = argv.includes('--rt') ? argv[argv.indexOf('--rt') + 1] : 'bun';
if (!['bun', 'node'].includes(rt)) throw new Error(`--rt must be bun or node, got ${rt}`);

/** `profile` is opt-in: it is slow by design and answers a different question. */
const want = (s) => (stages.length === 0 || stages.includes('all') ? s !== 'profile' : stages.includes(s));

const ctx = createHarness({
  here: HERE,
  repoRoot: resolve(HERE, '../../../..'),
  rt,
  budgets: JSON.parse(readFileSync(join(HERE, 'budgets.json'), 'utf8')),
  prev: readJsonIfPresent(join(HERE, '.out', `last-run.${rt}.json`)),
  argv,
});

const startedAt = Date.now();
if (stages.includes('profile')) stageProfile(ctx);
if (want('hygiene')) stageHygiene(ctx);
if (want('bookkeeping')) stageBookkeeping(ctx);
if (want('bundle')) stageBundle(ctx);
if (want('cold')) stageCold(ctx);
if (want('inproc')) stageInproc(ctx);
if (want('wire')) await stageWire(ctx);
if (want('probe')) await stageProbe(ctx);

printSummary(ctx, startedAt);
ctx.save();
process.exit(ctx.failures.length > 0 ? 1 : 0);
