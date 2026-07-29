import assert from 'node:assert/strict';
import { test } from 'node:test';

import { scoreboardSection } from '../report/sections-scoreboard.js';

/** Minimal scoreboard shape scoreboardSection reads from. */
function scoreboardFixture({ frameworkCount = 2, positionControl, order } = {}) {
  const frameworks = Array.from({ length: frameworkCount }, (_, i) => ({ id: `fw${i}`, name: `FW ${i}` }));
  const cells = Object.fromEntries(frameworks.map((f) => [f.id, { 'hello-world': { 64: null } }]));
  return {
    configuration: { positionControl, order },
    frameworks,
    scenarios: [{ id: 'hello-world', name: 'Hello World', identicalWork: true }],
    connections: [64],
    baselineId: 'fw0',
    cells,
    rankings: { 'hello-world': { 64: [] } },
    overall: {
      likeForLike: { rows: [], maxPoints: 0, scenarioCount: 1, connectionCount: 1 },
      all: { rows: [], maxPoints: 0, scenarioCount: 1 },
    },
    pointsPerConnection: { 64: { rows: [] } },
    primaryConnection: 64,
  };
}

test('scoreboardSection renders "not a ranking" when positionControl is explicitly "fixed"', () => {
  const lines = scoreboardSection(scoreboardFixture({ positionControl: 'fixed' }));
  assert.ok(lines.some((l) => l.includes('Not a ranking')));
});

test('scoreboardSection renders "not a ranking" when positionControl is missing but order is "fixed" (the metadata-table fallback)', () => {
  const lines = scoreboardSection(scoreboardFixture({ positionControl: undefined, order: 'fixed' }));
  assert.ok(
    lines.some((l) => l.includes('Not a ranking')),
    'must use the same positionControl ?? order fallback the Load Configuration table already uses'
  );
});

test('scoreboardSection renders "not a ranking" when positionControl is null (unrecorded), not only when explicitly "fixed"', () => {
  const lines = scoreboardSection(scoreboardFixture({ positionControl: null }));
  assert.ok(lines.some((l) => l.includes('Not a ranking')));
});

test('scoreboardSection renders a ranked scoreboard when positionControl is "rotated"', () => {
  const lines = scoreboardSection(scoreboardFixture({ positionControl: 'rotated' }));
  assert.ok(!lines.some((l) => l.includes('Not a ranking')));
  assert.ok(lines.some((l) => l.includes('## Scoreboard')));
});

test('scoreboardSection does not render "not a ranking" for a single-framework report regardless of position control', () => {
  const lines = scoreboardSection(scoreboardFixture({ frameworkCount: 1, positionControl: 'fixed' }));
  assert.ok(!lines.some((l) => l.includes('Not a ranking')));
});
