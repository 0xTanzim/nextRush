import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  getRequestedTool,
  parseConnectionsOverride,
  parseDurationOverride,
  parseRunsOverride,
  resolveToolName,
} from '../run-options.js';

test('parseConnectionsOverride returns null when not passed', () => {
  assert.equal(parseConnectionsOverride(undefined), null);
});

test('parseConnectionsOverride accepts a single custom concurrency level', () => {
  assert.deepEqual(parseConnectionsOverride('256'), [256]);
  assert.deepEqual(parseConnectionsOverride('512'), [512]);
});

test('parseConnectionsOverride accepts a comma-separated list, deduplicated and sorted', () => {
  assert.deepEqual(parseConnectionsOverride('512,64,256,64'), [64, 256, 512]);
});

test('parseConnectionsOverride rejects a non-numeric or non-positive value with a clear message', () => {
  assert.throws(() => parseConnectionsOverride('abc'), /invalid --connections value: "abc"/);
  assert.throws(() => parseConnectionsOverride('0'), /invalid --connections value: "0"/);
  assert.throws(() => parseConnectionsOverride('-5'), /invalid --connections value: "-5"/);
  assert.throws(() => parseConnectionsOverride('64,abc'), /invalid --connections value: "abc"/);
});

test('parseDurationOverride accepts --duration or --time, --time taking precedence when both are given', () => {
  assert.equal(parseDurationOverride({ duration: '10' }), '10s');
  assert.equal(parseDurationOverride({ time: '10' }), '10s');
  assert.equal(parseDurationOverride({ duration: '5', time: '20' }), '20s');
  assert.equal(parseDurationOverride({}), null);
});

test('parseDurationOverride passes a unit-suffixed value through unchanged', () => {
  assert.equal(parseDurationOverride({ time: '3s' }), '3s');
  assert.equal(parseDurationOverride({ time: '2m' }), '2m');
});

test('resolveToolName rejects an unknown tool instead of silently falling through', () => {
  assert.throws(() => resolveToolName('curl', () => 'wrk'), /unknown --tool "curl"/);
});

test('resolveToolName accepts wrk or autocannon explicitly', () => {
  assert.equal(resolveToolName('wrk', () => 'autocannon'), 'wrk');
  assert.equal(resolveToolName('autocannon', () => 'wrk'), 'autocannon');
});

test('resolveToolName auto-detects when not passed', () => {
  assert.equal(resolveToolName(undefined, () => 'wrk'), 'wrk');
});

test('parseDurationOverride rejects malformed or non-positive values before measurement starts', () => {
  assert.throws(() => parseDurationOverride({ time: 'abc' }), /invalid duration value: "abc"/);
  assert.throws(() => parseDurationOverride({ duration: '0' }), /invalid duration value: "0"/);
  assert.throws(() => parseDurationOverride({ time: '0s' }), /invalid duration value: "0s"/);
  assert.throws(() => parseDurationOverride({ time: '3x' }), /invalid duration value: "3x"/);
});

test('parseRunsOverride accepts positive integers and rejects malformed values', () => {
  assert.equal(parseRunsOverride(undefined), null);
  assert.equal(parseRunsOverride('3'), 3);
  assert.throws(() => parseRunsOverride('0'), /invalid --runs value: "0"/);
  assert.throws(() => parseRunsOverride('abc'), /invalid --runs value: "abc"/);
  assert.throws(() => parseRunsOverride('2.5'), /invalid --runs value: "2.5"/);
});

test('getRequestedTool supports --tool and the plural --tools alias', () => {
  assert.equal(getRequestedTool({ tool: 'wrk' }), 'wrk');
  assert.equal(getRequestedTool({ tools: 'autocannon' }), 'autocannon');
  assert.equal(getRequestedTool({ tool: 'wrk', tools: 'autocannon' }), 'wrk');
  assert.equal(getRequestedTool({}), undefined);
});
