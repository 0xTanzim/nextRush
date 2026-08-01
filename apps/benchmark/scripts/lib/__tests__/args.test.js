import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseArgs } from '../args.js';

test('parseArgs accepts both separated and equals-separated values', () => {
  const originalArgv = process.argv;
  process.argv = [
    'node',
    'run.js',
    '--connections=256',
    '--time=5s',
    '--tool',
    'wrk',
    '--compare',
  ];

  try {
    assert.deepEqual(parseArgs(), {
      connections: '256',
      time: '5s',
      tool: 'wrk',
      compare: true,
    });
  } finally {
    process.argv = originalArgv;
  }
});
