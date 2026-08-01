/**
 * Cold-start benchmark runner (task group 7.4).
 *
 * Spawns each entry in a FRESH Node process N times — one process is one cold
 * start (module load + app build + ready() + first invocation) — and reports
 * the distribution. Numbers are hardware- and Node-version-dependent; reproduce
 * on your own target. This is a local baseline, not a publishable figure.
 *
 * Usage: node bench/cold-start.mjs [samples]
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SAMPLES = Number(process.argv[2] ?? 20);

function measure(entry) {
  const times = [];
  for (let i = 0; i < SAMPLES; i++) {
    const r = spawnSync(process.execPath, [join(here, entry)], { encoding: 'utf8' });
    if (r.status !== 0) {
      process.stderr.write(r.stderr ?? '');
      throw new Error(`entry ${entry} exited ${r.status}`);
    }
    times.push(Number.parseFloat(r.stdout.trim()));
  }
  times.sort((a, b) => a - b);
  const sum = times.reduce((a, b) => a + b, 0);
  return {
    median: times[Math.floor(times.length / 2)],
    mean: sum / times.length,
    min: times[0],
    max: times[times.length - 1],
  };
}

const fn = measure('entry-functional.mjs');
const cls = measure('entry-class.mjs');
const fmt = (n) => `${n.toFixed(1)}ms`;

process.stdout.write(
  [
    `NextRush serverless cold start — Node ${process.version}, ${SAMPLES} fresh processes/path`,
    `(local hardware; reproduce on your target — not a published figure)`,
    ``,
    `  path                         median      mean       min       max`,
    `  functional              ${fmt(fn.median).padStart(10)}${fmt(fn.mean).padStart(10)}${fmt(fn.min).padStart(10)}${fmt(fn.max).padStart(10)}`,
    `  + class/DI runtime      ${fmt(cls.median).padStart(10)}${fmt(cls.mean).padStart(10)}${fmt(cls.min).padStart(10)}${fmt(cls.max).padStart(10)}`,
    `  delta (reflect-metadata)${fmt(cls.median - fn.median).padStart(10)}`,
    ``,
  ].join('\n'),
);
