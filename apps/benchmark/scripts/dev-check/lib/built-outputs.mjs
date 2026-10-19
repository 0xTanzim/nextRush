// Preflight for `check.mjs --built`.
//
// The source graph is the gate. A built pass answers a different question: does
// the published `dist/` still behave like the source it was built from? That
// answer is only meaningful when every built package is present and none is
// older than its own source, so the check fails fast on a missing output and
// warns on a stale one instead of quietly measuring yesterday's build.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MAX_PACKAGE_DEPTH = 2;

const isBuiltPackage = (pkg) =>
  typeof pkg.main === 'string' && pkg.main.includes('dist') ||
  typeof pkg.module === 'string' && pkg.module.includes('dist') ||
  JSON.stringify(pkg.exports ?? '').includes('dist');

function findPackages(root) {
  const packages = [];

  function scan(dir, depth) {
    if (depth > MAX_PACKAGE_DEPTH) return;
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules') continue;
      const current = join(dir, entry);
      if (!statSync(current).isDirectory()) continue;
      const manifest = join(current, 'package.json');
      if (existsSync(manifest) && existsSync(join(current, 'src', 'index.ts'))) {
        const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
        if (typeof pkg.name === 'string' && isBuiltPackage(pkg)) {
          packages.push({ name: pkg.name, dir: current, output: join(current, 'dist', 'index.js') });
        }
      }
      scan(current, depth + 1);
    }
  }

  scan(join(root, 'packages'), 0);
  return packages.sort((a, b) => a.name.localeCompare(b.name));
}

function newestSource(dir) {
  let newest = { path: '', mtime: 0 };
  for (const entry of readdirSync(dir)) {
    const current = join(dir, entry);
    const stat = statSync(current);
    if (stat.isDirectory()) {
      const nested = newestSource(current);
      if (nested.mtime > newest.mtime) newest = nested;
    } else if (stat.mtimeMs > newest.mtime) {
      newest = { path: current, mtime: stat.mtimeMs };
    }
  }
  return newest;
}

/** Packages whose source changed after their built entry point was written. */
export function findStaleOutputs(packages) {
  const stale = [];
  for (const pkg of packages) {
    const source = newestSource(join(pkg.dir, 'src'));
    if (source.mtime > statSync(pkg.output).mtimeMs) {
      stale.push({ name: pkg.name, output: pkg.output, source: source.path });
    }
  }
  return stale;
}

/**
 * Resolve every built workspace package and fail when one has no output.
 * Returns the packages plus the stale subset; a stale output is a WARN, not a
 * failure, because the source pass already answered the gate question.
 */
export function assertBuiltOutputs(root) {
  const packages = findPackages(root);
  if (packages.length === 0) {
    throw new Error(`No built workspace packages found under ${join(root, 'packages')}`);
  }

  const missing = packages.filter((pkg) => !existsSync(pkg.output));
  if (missing.length > 0) {
    const paths = missing.map((pkg) => `  ${pkg.output}`).join('\n');
    throw new Error(`Built output missing:\n${paths}\nRun \`pnpm build\` before \`check.mjs --built\`.`);
  }

  return { packages, stale: findStaleOutputs(packages) };
}
