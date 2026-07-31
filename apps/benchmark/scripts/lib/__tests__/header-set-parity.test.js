import assert from 'node:assert/strict';
import { test } from 'node:test';

import { checkHeaderSetParity } from '../parity.js';

const base = { 'content-type': 'application/json; charset=utf-8', 'content-length': '25' };

test('identical header sets produce no problems', () => {
  assert.deepEqual(checkHeaderSetParity({ a: { ...base }, b: { ...base } }), []);
});

test('an extra header on one server is reported', () => {
  const problems = checkHeaderSetParity({ a: { ...base }, b: { ...base, etag: 'W/"x"' } });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /b: emits headers no other server emits: etag/);
});

test('a differing header VALUE is reported', () => {
  const problems = checkHeaderSetParity({
    a: { ...base, 'keep-alive': 'timeout=5' },
    b: { ...base, 'keep-alive': 'timeout=72' },
  });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /keep-alive/);
});

test('always-dynamic headers are ignored', () => {
  assert.deepEqual(
    checkHeaderSetParity({
      a: { ...base, date: 'Thu, 30 Jul 2026 17:00:00 GMT' },
      b: { ...base, date: 'Thu, 30 Jul 2026 18:00:00 GMT' },
    }),
    []
  );
});

test('content-length values are exempt when the scenario declares variable length', () => {
  const headersById = { a: { ...base, 'content-length': '117' }, b: { ...base, 'content-length': '119' } };
  assert.deepEqual(checkHeaderSetParity(headersById, { strictLength: false }), []);
  assert.equal(checkHeaderSetParity(headersById, { strictLength: true }).length, 1);
});

test('extra ignored names are honoured', () => {
  assert.deepEqual(
    checkHeaderSetParity({ a: { ...base }, b: { ...base, etag: 'W/"x"' } }, { ignore: ['etag'] }),
    []
  );
});

test('a single server cannot be compared and is reported as unverified', () => {
  const problems = checkHeaderSetParity({ a: { ...base } });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /NOT verified/);
});
