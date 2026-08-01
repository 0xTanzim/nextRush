import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { summarizeGcEvents } from '../gc-summary.js';

test('summarizeGcEvents counts events and totals pause duration by type', () => {
  const gcEvents = [
    { timestamp: 100, type: 'Scavenge', pauseMs: 1.2, totalMs: 500 },
    { timestamp: 200, type: 'Scavenge', pauseMs: 0.8, totalMs: 501 },
    { timestamp: 300, type: 'Mark-Compact', pauseMs: 5.5, totalMs: 510 },
  ];

  const summary = summarizeGcEvents(gcEvents);

  assert.equal(summary.count, 3);
  assert.equal(summary.totalPauseMs, 1.2 + 0.8 + 5.5);
  assert.deepEqual(summary.byType, {
    Scavenge: { count: 2, pauseMs: 1.2 + 0.8 },
    'Mark-Compact': { count: 1, pauseMs: 5.5 },
  });
});

test('summarizeGcEvents returns zeroed summary for an empty input', () => {
  const summary = summarizeGcEvents([]);

  assert.deepEqual(summary, { count: 0, totalPauseMs: 0, byType: {} });
});
