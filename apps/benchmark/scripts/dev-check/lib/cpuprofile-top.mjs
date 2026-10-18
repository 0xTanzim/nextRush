// Summarise a V8 `.cpuprofile` (node --cpu-prof) as a self-time table, like Bun's --cpu-prof-md.
// Usage: node lib/cpuprofile-top.mjs <file.cpuprofile> [rows=15]
import { readFileSync } from 'node:fs';

const [file, rowsArg] = process.argv.slice(2);
if (!file) {
  console.error('usage: node cpuprofile-top.mjs <file.cpuprofile> [rows]');
  process.exit(2);
}
const rows = Number(rowsArg ?? 15);
const prof = JSON.parse(readFileSync(file, 'utf8'));
const byId = new Map(prof.nodes.map((n) => [n.id, n]));
const self = new Map(); // node id -> microseconds
const deltas = prof.timeDeltas;
prof.samples.forEach((id, i) => self.set(id, (self.get(id) ?? 0) + (deltas[i] ?? 0)));
const total = [...self.values()].reduce((a, b) => a + b, 0) || 1;

const byFn = new Map();
for (const [id, us] of self) {
  const cf = byId.get(id).callFrame;
  const loc = cf.url ? `${cf.url.split('/').slice(-2).join('/')}:${cf.lineNumber + 1}` : '[native]';
  const key = `${cf.functionName || '(anonymous)'} ${loc}`;
  byFn.set(key, (byFn.get(key) ?? 0) + us);
}
const top = [...byFn.entries()].sort((a, b) => b[1] - a[1]).slice(0, rows);
console.log('| Self% | Self ms | Function | Location |\n|------:|--------:|----------|----------|');
for (const [key, us] of top) {
  const i = key.indexOf(' ');
  console.log(`| ${((us / total) * 100).toFixed(1)}% | ${(us / 1000).toFixed(1)} | \`${key.slice(0, i)}\` | ${key.slice(i + 1)} |`);
}
