import assert from 'node:assert/strict';
import { test } from 'node:test';

import { findAllocRegressions } from '../alloc-regression.js';

test('finds no regression when latest mean equals baseline mean', () => {
  const baseline = { lazy: { mean: 8.0, cv: 0.1 } };
  const latest = { lazy: { mean: 8.0, cv: 0.1 } };

  assert.deepEqual(findAllocRegressions(baseline, latest, { tolerance: 0 }), []);
});

test('flags a regression when latest mean exceeds baseline by more than tolerance', () => {
  const baseline = { lazy: { mean: 8.0, cv: 0.1 } };
  const latest = { lazy: { mean: 20.0, cv: 0.1 } };

  const regressions = findAllocRegressions(baseline, latest, { tolerance: 0.05 });

  assert.equal(regressions.length, 1);
  assert.match(regressions[0], /lazy/);
  assert.match(regressions[0], /8/);
  assert.match(regressions[0], /20/);
});

test('tolerates a small increase within the tight tolerance (measurement jitter)', () => {
  const baseline = { lazy: { mean: 8.0, cv: 0.1 } };
  const latest = { lazy: { mean: 8.2, cv: 0.1 } }; // +2.5%

  assert.deepEqual(findAllocRegressions(baseline, latest, { tolerance: 0.05 }), []);
});

test('finds regressions in nested variant shapes (e.g. variants.enabled.mean)', () => {
  const baseline = { variants: { enabled: { mean: 650, cv: 1 }, disabled: { mean: 700, cv: 1 } } };
  const latest = { variants: { enabled: { mean: 900, cv: 1 }, disabled: { mean: 700, cv: 1 } } };

  const regressions = findAllocRegressions(baseline, latest, { tolerance: 0.05 });

  assert.equal(regressions.length, 1);
  assert.match(regressions[0], /variants\.enabled/);
});

test('a decrease (improvement) is never flagged as a regression', () => {
  const baseline = { lazy: { mean: 20.0, cv: 0.1 } };
  const latest = { lazy: { mean: 8.0, cv: 0.1 } };

  assert.deepEqual(findAllocRegressions(baseline, latest, { tolerance: 0 }), []);
});

test('a metric present only in one side is skipped, not a false positive', () => {
  const baseline = { lazy: { mean: 8.0, cv: 0.1 } };
  const latest = { lazy: { mean: 8.0, cv: 0.1 }, eager: { mean: 48.0, cv: 0 } };

  assert.deepEqual(findAllocRegressions(baseline, latest, { tolerance: 0 }), []);
});
