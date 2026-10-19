import test from 'node:test';
import assert from 'node:assert/strict';
import { runtimeArgs } from '../harness.mjs';

test('Bun runs a bundled entry directly', () => {
  assert.deepEqual(runtimeArgs('bun', '/tmp/entry.js'), ['/tmp/entry.js']);
});

test('Node runs a bundled entry directly', () => {
  assert.deepEqual(runtimeArgs('node', '/tmp/entry.js'), ['/tmp/entry.js']);
});

test('Deno needs the run subcommand and permissions for a bundled entry', () => {
  assert.deepEqual(runtimeArgs('deno', '/tmp/entry.js'), [
    'run',
    '--allow-all',
    '--quiet',
    '/tmp/entry.js',
  ]);
});

test('rejects an unknown runtime', () => {
  assert.throws(() => runtimeArgs('workers', '/tmp/entry.js'), /unknown runtime/);
});
