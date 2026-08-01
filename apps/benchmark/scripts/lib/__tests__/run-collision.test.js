import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { checkRunIdCollision } from '../run-collision.js';

function makeResultsDir() {
  return mkdtempSync(join(tmpdir(), 'bench-collision-'));
}

function writeRun(resultsDir, dirName, runId, extra = {}) {
  const dir = join(resultsDir, dirName);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'results.json'), JSON.stringify({ runId, ...extra }), 'utf-8');
}

test('no collision when run_id is unique among existing directories', () => {
  const resultsDir = makeResultsDir();
  try {
    writeRun(resultsDir, '2026-01-01T00-00-00', '2026-01-01T00-00-00');
    const outcome = checkRunIdCollision(resultsDir, '2026-01-02T00-00-00', { runId: '2026-01-02T00-00-00' });
    assert.equal(outcome.collision, false);
  } finally {
    rmSync(resultsDir, { recursive: true, force: true });
  }
});

test('a colliding run_id with byte-identical content is treated as the same session', () => {
  const resultsDir = makeResultsDir();
  try {
    const report = { runId: '2026-01-01T00-00-00', profile: 'full' };
    writeRun(resultsDir, '2026-01-01T00-00-00', report.runId, { profile: 'full' });

    const outcome = checkRunIdCollision(resultsDir, '2026-01-01T00-00-01', report);

    assert.equal(outcome.collision, true);
    assert.equal(outcome.identical, true);
    assert.equal(outcome.existingDir, '2026-01-01T00-00-00');
  } finally {
    rmSync(resultsDir, { recursive: true, force: true });
  }
});

test('a colliding run_id with different content is a hard error, not a silent overwrite', () => {
  const resultsDir = makeResultsDir();
  try {
    writeRun(resultsDir, '2026-01-01T00-00-00', '2026-01-01T00-00-00', { profile: 'full' });
    const differentReport = { runId: '2026-01-01T00-00-00', profile: 'quick' };

    const outcome = checkRunIdCollision(resultsDir, '2026-01-01T00-00-01', differentReport);

    assert.equal(outcome.collision, true);
    assert.equal(outcome.identical, false);
    assert.equal(outcome.existingDir, '2026-01-01T00-00-00');
  } finally {
    rmSync(resultsDir, { recursive: true, force: true });
  }
});

test('directories with no results.json (or unparseable) are ignored, not treated as a collision', () => {
  const resultsDir = makeResultsDir();
  try {
    mkdirSync(join(resultsDir, 'latest'), { recursive: true });
    const outcome = checkRunIdCollision(resultsDir, '2026-01-01T00-00-01', { runId: 'anything' });
    assert.equal(outcome.collision, false);
  } finally {
    rmSync(resultsDir, { recursive: true, force: true });
  }
});
