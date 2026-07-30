/// <reference types="node" />

/**
 * T006 coverage gate — enforces the steering-mandated 90% lines / 85% branches bar
 * (`~/.kiro/steering/engineering-standards.md`, `project-rules.instructions.md` §7) per
 * package, wired into the same `pnpm verify` pipeline developers already check (design.md D3),
 * not a separate CI job.
 *
 * Coverage is measured per package (design.md D4), never a repo-wide average — one
 * well-covered package must never offset another's shortfall.
 *
 * KNOWN_BELOW_THRESHOLD is a temporary, explicit exclusion list for packages the initial
 * gate wiring (T006) found already below threshold. Per design.md's Risk mitigation, these
 * are real test-writing exercises (30-80% coverage gaps), not trivial missing-test-case
 * fixes, so they are scoped out here rather than forced green with speculative tests.
 * Follow-up: openspec/changes/fix-dependency-claim-router-naming-coverage-gate — see
 * tasks.md 3.5 note. Remove an entry the moment that package's coverage clears threshold.
 */

import { readdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const LINE_THRESHOLD = 90;
const BRANCH_THRESHOLD = 85;

/**
 * Packages already below the 90/85 bar at the time the gate was wired (T006, 2026-07-16).
 * Each entry names the real measured numbers so a future re-run can tell at a glance how
 * much work remains, and is NOT a license to regress further — the exclusion only skips
 * *enforcement*, `check-coverage.ts` still runs and reports these packages' real numbers.
 */
const KNOWN_BELOW_THRESHOLD: ReadonlySet<string> = new Set([
  '@nextrush/router', // 90.02% lines / 78.49% branches — branches gap
  '@nextrush/runtime', // 76.66% lines / 66.86% branches
  '@nextrush/dev', // 30.45% lines / 26.16% branches
  '@nextrush/adapter-node', // 52.09% lines / 46% branches
  '@nextrush/adapter-bun', // 58.06% lines / 50.72% branches
  '@nextrush/adapter-deno', // 66.98% lines / 62.26% branches
  '@nextrush/adapter-edge', // 74.74% lines / 65.85% branches
  '@nextrush/adapter-serverless', // 90% lines / 63.31% branches — branches gap
  '@nextrush/websocket', // 32.71% lines / 26.76% branches
  '@nextrush/compression', // 82.63% lines / 71.28% branches
  '@nextrush/cors', // 65.78% lines / 76.82% branches
  '@nextrush/helmet', // 84.68% lines / 86.34% branches — lines gap
  '@nextrush/form-data', // 81.38% lines / 66.78% branches
  '@nextrush/openapi', // 79.16% lines / 60.46% branches
  '@nextrush/rate-limit', // 81.43% lines / 70.73% branches
  '@nextrush/template', // 59.88% lines / 52.59% branches
  '@nextrush/cookies', // 74.12% lines / 70.26% branches (validation.ts is the main gap)
  '@nextrush/testing', // 81.25% lines / 58.33% branches
  '@nextrush/di', // 86.18% lines / 69.89% branches
  '@nextrush/class', // below threshold; also has a pre-existing failing test
  // unrelated to coverage (circular-dependency-detection timeout in container.errors /
  // registrar tests) — tracked separately, not fixed by this gate.
  'nextrush', // 75.92% lines / 67.56% branches (meta package; postinstall.js is the gap)
]);

interface PackageInfo {
  readonly name: string;
  readonly dir: string;
  readonly hasTestScript: boolean;
}

interface CoverageTotals {
  readonly lines: number;
  readonly branches: number;
}

interface PackageResult {
  readonly name: string;
  readonly dir: string;
  readonly totals: CoverageTotals | null;
  readonly skipped: boolean;
  readonly excluded: boolean;
  readonly passed: boolean;
  readonly error?: string;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Walks `packages/` for every directory containing a `package.json` with a `test` script. */
async function discoverPackages(rootDir: string): Promise<PackageInfo[]> {
  const packagesDir = path.join(rootDir, 'packages');
  const work: string[] = [packagesDir];
  const results: PackageInfo[] = [];

  while (work.length > 0) {
    const current = work.pop();
    if (!current) break;

    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name === 'dist') continue;

      const dir = path.join(current, entry.name);
      const pkgJsonPath = path.join(dir, 'package.json');

      if (await pathExists(pkgJsonPath)) {
        const pkg = JSON.parse(await readFile(pkgJsonPath, 'utf8')) as {
          name?: string;
          scripts?: Record<string, string>;
          private?: boolean;
        };
        if (pkg.name && pkg.scripts?.test) {
          results.push({ name: pkg.name, dir, hasTestScript: true });
        }
      } else {
        work.push(dir);
      }
    }
  }

  return results;
}

/** Runs `vitest run --coverage` for one package, forcing a json-summary reporter via CLI. */
async function runCoverage(pkg: PackageInfo): Promise<CoverageTotals | { error: string }> {
  try {
    await execFileAsync(
      'npx',
      ['vitest', 'run', '--coverage', '--coverage.reporter=json-summary', '--reporter=dot'],
      { cwd: pkg.dir, maxBuffer: 1024 * 1024 * 32 }
    );
  } catch (err: unknown) {
    // vitest exits non-zero on a real test failure OR a coverage threshold configured
    // locally — either way, still try to read the summary that was written before failing.
    const summaryPath = path.join(pkg.dir, 'coverage', 'coverage-summary.json');
    if (!(await pathExists(summaryPath))) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: `test run failed before producing coverage: ${message.slice(0, 500)}` };
    }
  }

  const summaryPath = path.join(pkg.dir, 'coverage', 'coverage-summary.json');
  if (!(await pathExists(summaryPath))) {
    return { error: 'no coverage-summary.json produced' };
  }

  const summary = JSON.parse(await readFile(summaryPath, 'utf8')) as {
    total: { lines: { pct: number }; branches: { pct: number } };
  };

  return { lines: summary.total.lines.pct, branches: summary.total.branches.pct };
}

function meetsThreshold(totals: CoverageTotals): boolean {
  return totals.lines >= LINE_THRESHOLD && totals.branches >= BRANCH_THRESHOLD;
}

async function checkPackage(pkg: PackageInfo): Promise<PackageResult> {
  const outcome = await runCoverage(pkg);

  if ('error' in outcome) {
    const excluded = KNOWN_BELOW_THRESHOLD.has(pkg.name);
    return { name: pkg.name, dir: pkg.dir, totals: null, skipped: false, excluded, passed: excluded, error: outcome.error };
  }

  const excluded = KNOWN_BELOW_THRESHOLD.has(pkg.name);
  const passed = excluded || meetsThreshold(outcome);
  return { name: pkg.name, dir: pkg.dir, totals: outcome, skipped: false, excluded, passed };
}

function formatResult(result: PackageResult): string {
  const totalsStr = result.totals
    ? `lines ${result.totals.lines.toFixed(2)}% / branches ${result.totals.branches.toFixed(2)}%`
    : `error: ${result.error ?? 'unknown'}`;
  const tag = result.excluded ? '⚠ EXCLUDED (tracked follow-up)' : result.passed ? '✅ PASS' : '❌ FAIL';
  return `${tag} ${result.name} — ${totalsStr}`;
}

async function main(): Promise<void> {
  const repoRoot = process.cwd();
  const packages = await discoverPackages(repoRoot);

  console.log(`Checking coverage for ${packages.length} packages (≥${LINE_THRESHOLD}% lines / ≥${BRANCH_THRESHOLD}% branches)...\n`);

  const results: PackageResult[] = [];
  for (const pkg of packages) {
    const result = await checkPackage(pkg);
    console.log(formatResult(result));
    results.push(result);
  }

  const failures = results.filter((r) => !r.passed);

  console.log('');
  if (failures.length > 0) {
    console.error(`❌ Coverage gate failed for ${failures.length} package(s):`);
    for (const f of failures) {
      console.error(`  - ${f.name}: ${f.totals ? `lines ${f.totals.lines.toFixed(2)}% / branches ${f.totals.branches.toFixed(2)}%` : f.error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('✅ Coverage gate passed for all non-excluded packages.');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
