import assert from 'node:assert/strict';
import { test } from 'node:test';

import { checkFramingParity } from '../parity.js';

test('flags the odd-server-out that omits Content-Length while others set it', () => {
  const headersById = {
    'nextrush-v3': { 'content-length': '13' },
    fastify: { 'content-length': '13' },
    'raw-node': { 'transfer-encoding': 'chunked' },
  };

  const problems = checkFramingParity(headersById);

  assert.ok(
    problems.some((p) => p.includes('raw-node') && p.includes('chunked')),
    `expected a raw-node framing problem, got: ${JSON.stringify(problems)}`
  );
});

test('passes when every server sets an identical explicit Content-Length', () => {
  const headersById = {
    'raw-node': { 'content-length': '13' },
    'nextrush-v3': { 'content-length': '13' },
    fastify: { 'content-length': '13' },
  };

  assert.deepEqual(checkFramingParity(headersById), []);
});

test('flags a mismatched Content-Length value between two servers', () => {
  const headersById = {
    'raw-node': { 'content-length': '13' },
    'nextrush-v3': { 'content-length': '99' },
  };

  const problems = checkFramingParity(headersById);

  assert.ok(
    problems.some((p) => p.includes('nextrush-v3') && p.includes('13') && p.includes('99')),
    `expected a mismatched-length problem, got: ${JSON.stringify(problems)}`
  );
});

test('passes when no server sets Content-Length at all (nothing to compare against)', () => {
  const headersById = {
    'raw-node': { 'transfer-encoding': 'chunked' },
    'nextrush-v3': { 'transfer-encoding': 'chunked' },
  };

  assert.deepEqual(checkFramingParity(headersById), []);
});

test('204 No Content scenario is exempt from framing checks (no body to frame)', () => {
  const headersById = {
    'raw-node': {},
    'nextrush-v3': {},
  };

  assert.deepEqual(checkFramingParity(headersById, { skip: true }), []);
});

test('strictLength: false still catches chunked transfer-encoding on a variable-length scenario', () => {
  const headersById = {
    'raw-node': { 'content-length': '118' },
    express: { 'transfer-encoding': 'chunked' },
  };

  const problems = checkFramingParity(headersById, { strictLength: false });

  assert.ok(
    problems.some((p) => p.includes('express') && p.includes('chunked')),
    `expected a chunked problem even with strictLength off, got: ${JSON.stringify(problems)}`
  );
});

test('strictLength: false tolerates a different (but present) Content-Length value', () => {
  const headersById = {
    'raw-node': { 'content-length': '119' },
    express: { 'content-length': '118' },
  };

  assert.deepEqual(checkFramingParity(headersById, { strictLength: false }), []);
});
