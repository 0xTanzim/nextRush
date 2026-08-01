#!/usr/bin/env node
/**
 * Generates the internal @nextrush/* dependency graph from real package.json
 * `dependencies` fields — not hand-drawn. Run: `node apps/website/scripts/internals/generate-dependency-graph.mjs`
 * from the repo root. Prints a Mermaid `graph LR` block and a Markdown edge table to stdout.
 *
 * Scope: internal @nextrush/* workspace edges only. External deps (tsyringe,
 * reflect-metadata, @clack/prompts, etc.) are listed separately per package, not as graph
 * nodes, since the graph's job is to show the internal package hierarchy.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = new URL('../../../../', import.meta.url).pathname;
const PACKAGES_DIR = join(REPO_ROOT, 'packages');

/** Recursively find every package.json under packages/, skipping node_modules/dist. */
function findPackageJsonFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '__tests__') continue;
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...findPackageJsonFiles(fullPath));
    } else if (entry === 'package.json') {
      results.push(fullPath);
    }
  }
  return results;
}

const packageJsonPaths = findPackageJsonFiles(PACKAGES_DIR);

/** @type {Map<string, {version: string, deps: string[], externalDeps: string[], filePath: string}>} */
const registry = new Map();

for (const filePath of packageJsonPaths) {
  const pkg = JSON.parse(readFileSync(filePath, 'utf8'));
  if (!pkg.name) continue;
  const allDeps = { ...(pkg.dependencies ?? {}) };
  const internalDeps = Object.keys(allDeps).filter((d) => d.startsWith('@nextrush/'));
  const externalDeps = Object.keys(allDeps).filter((d) => !d.startsWith('@nextrush/'));
  registry.set(pkg.name, {
    version: pkg.version,
    deps: internalDeps,
    externalDeps,
    filePath: filePath.replace(REPO_ROOT, ''),
  });
}

// --- Output 1: raw edge list (for verification) ---
console.log('# Real @nextrush/* dependency edges (from package.json "dependencies")\n');
console.log(`Scanned ${registry.size} package.json files under packages/.\n`);

const sortedNames = [...registry.keys()].sort();
for (const name of sortedNames) {
  const info = registry.get(name);
  const depStr = info.deps.length > 0 ? info.deps.join(', ') : '(none)';
  const extStr = info.externalDeps.length > 0 ? ` [external: ${info.externalDeps.join(', ')}]` : '';
  console.log(`- **${name}** \`${info.version}\` → ${depStr}${extStr}`);
}

// --- Output 2: Mermaid graph LR ---
console.log('\n## Mermaid (generated)\n');
console.log('```mermaid');
console.log('graph LR');

/** Turn @nextrush/foo/bar into a mermaid-safe node id. */
function nodeId(pkgName) {
  return pkgName.replace('@nextrush/', '').replace(/[/-]/g, '_');
}

for (const name of sortedNames) {
  const id = nodeId(name);
  const label = name.replace('@nextrush/', '');
  console.log(`    ${id}["${label}"]`);
}
console.log('');
for (const name of sortedNames) {
  const info = registry.get(name);
  const fromId = nodeId(name);
  for (const dep of info.deps) {
    if (!registry.has(dep)) continue; // dep not in this scan (e.g. peer-only, not in workspace)
    console.log(`    ${fromId} --> ${nodeId(dep)}`);
  }
}
console.log('```');

// --- Output 3: edge count sanity check ---
let edgeCount = 0;
for (const info of registry.values()) edgeCount += info.deps.filter((d) => registry.has(d)).length;
console.log(`\n<!-- ${registry.size} nodes, ${edgeCount} internal @nextrush/* edges -->`);
