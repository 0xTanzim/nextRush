import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  coversRuntime,
  declaredIds,
  findOrphanIds,
  findStaleExemptions,
} from '../known-failures.mjs';

test('coversRuntime: "*" applies to every runtime, an array only to the named ones', () => {
  assert.equal(coversRuntime('*', 'bun'), true);
  assert.equal(coversRuntime('*', 'node'), true);
  assert.equal(coversRuntime(['bun'], 'bun'), true);
  assert.equal(coversRuntime(['bun'], 'node'), false);
  assert.equal(coversRuntime(['bun', 'node'], 'node'), true);
  assert.equal(coversRuntime(undefined, 'bun'), false);
});

test('declaredIds: lists every declared exemption id', () => {
  assert.deepEqual(declaredIds({ A: '*', B: ['node'] }), ['A', 'B']);
  assert.deepEqual(declaredIds(undefined), []);
});

test('findOrphanIds: an id no probe references is reported', () => {
  const probes = [{ id: 'p1', bug: 'FB-01' }];

  assert.deepEqual(findOrphanIds(probes, { 'FB-01': '*' }), []);
  assert.deepEqual(findOrphanIds(probes, { 'FB-01': '*', 'FB-06': '*' }), ['FB-06']);
});

test('findOrphanIds: scans the whole registry, so a runtime-scoped id is not an orphan', () => {
  // The Bun-only create-handler probe never runs on a Node run, but the id is
  // still backed by it — that is a scoping decision, not an orphan.
  const probes = [{ id: 'p1', bug: 'FB-02' }];

  assert.deepEqual(findOrphanIds(probes, { 'FB-02': ['bun'] }), []);
});

test('findOrphanIds: a probe with no bug id backs no exemption', () => {
  const probes = [{ id: 'not-found-shape', bug: null }];

  assert.deepEqual(findOrphanIds(probes, { 'FB-09': '*' }), ['FB-09']);
});

test('findStaleExemptions: an applying id whose probe failed is still live', () => {
  const probes = [{ id: 'p1', bug: 'FB-01' }];

  assert.deepEqual(findStaleExemptions(probes, { 'FB-01': '*' }, 'bun', ['FB-01']), []);
});

test('findStaleExemptions: an applying id whose probes all passed must be deleted', () => {
  const probes = [{ id: 'p1', bug: 'FB-01' }];

  assert.deepEqual(findStaleExemptions(probes, { 'FB-01': '*' }, 'bun', []), ['FB-01']);
});

test('findStaleExemptions: an id scoped to another runtime is not stale here', () => {
  const probes = [{ id: 'p1', bug: 'FB-04' }];

  assert.deepEqual(findStaleExemptions(probes, { 'FB-04': ['node'] }, 'bun', []), []);
  assert.deepEqual(findStaleExemptions(probes, { 'FB-04': ['node'] }, 'node', []), ['FB-04']);
});

test('findStaleExemptions: a failing sibling probe keeps the id live', () => {
  // Two probes share a bug id; only one of them can observe the defect on a given
  // platform, so the id stays live as long as either still reports the failure.
  const probes = [
    { id: 'p1', bug: 'FB-03' },
    { id: 'p2', bug: 'FB-03' },
  ];

  assert.deepEqual(findStaleExemptions(probes, { 'FB-03': '*' }, 'bun', ['FB-03']), []);
});
