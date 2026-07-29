/**
 * Regression test for check-regression.js's missing-baseline behavior
 * (fix-benchmark-measurement-integrity task 7.5): the gate must fail loudly
 * — a nonzero, distinguishable exit code and an explicit error message — not
 * silently pass, when no baseline exists to compare against.
 */
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { ROOT_DIR } from '../paths.js';

test('check-regression.js exits nonzero with an explicit error when the baseline directory is missing', () => {
  const missingBaselineDir = join(mkdtempSync(join(tmpdir(), 'bench-no-baseline-')), 'baseline');
  const latestDir = mkdtempSync(join(tmpdir(), 'bench-latest-'));
  writeFileSync(join(latestDir, 'results.json'), JSON.stringify({ results: {} }), 'utf-8');

  try {
    execFileSync(
      process.execPath,
      [join(ROOT_DIR, 'scripts/check-regression.js'), '--baseline', missingBaselineDir, '--latest', latestDir],
      { encoding: 'utf-8', stdio: 'pipe' }
    );
    assert.fail('expected check-regression.js to exit nonzero when the baseline is missing');
  } catch (err) {
    assert.notEqual(err.status, 0, 'a missing baseline must not exit 0');
    assert.match(String(err.stderr), /no baseline/i);
  } finally {
    rmSync(latestDir, { recursive: true, force: true });
  }
});

/**
 * fix-benchmark-harness-integrity (D5): a stored report's `publishable` field
 * can be stale (written before a later fix to the publishability criteria).
 * check-regression.js must warn based on the RECOMPUTED verdict, not the
 * value stored at measurement time.
 */
test('check-regression.js warns about non-publishable data using the recomputed verdict, not the stale stored field', () => {
  const baselineDir = mkdtempSync(join(tmpdir(), 'bench-baseline-'));
  const latestDir = mkdtempSync(join(tmpdir(), 'bench-latest-'));

  // Stored as publishable:true, but its OWN configuration/results fail the
  // current criteria (1 run, 1 concurrency level) — a stale flag from before
  // a stricter check existed, or from a version mismatch.
  const staleBaseline = {
    publishable: true,
    configuration: { runs: 1, connections: [256], duration: '5s' },
    results: {
      'raw-node': {
        scenarios: { 'hello-world': { concurrencyResults: { 256: { stats: { mean: 1000 }, runs: [{ errors: {} }] } } } },
      },
    },
  };
  const cleanLatest = {
    publishable: true,
    configuration: { runs: 3, connections: [64, 256], duration: '30s' },
    results: {
      'raw-node': {
        scenarios: { 'hello-world': { concurrencyResults: { 256: { stats: { mean: 1000 }, runs: [{ errors: {} }] } } } },
      },
    },
  };
  writeFileSync(join(baselineDir, 'results.json'), JSON.stringify(staleBaseline), 'utf-8');
  writeFileSync(join(latestDir, 'results.json'), JSON.stringify(cleanLatest), 'utf-8');

  try {
    const result = spawnSync(
      process.execPath,
      [join(ROOT_DIR, 'scripts/check-regression.js'), '--baseline', baselineDir, '--latest', latestDir],
      { encoding: 'utf-8' }
    );
    assert.match(
      result.stderr,
      /non-publishable/i,
      'must warn about non-publishable data even though the stored baseline.publishable was true'
    );
  } finally {
    rmSync(baselineDir, { recursive: true, force: true });
    rmSync(latestDir, { recursive: true, force: true });
  }
});
