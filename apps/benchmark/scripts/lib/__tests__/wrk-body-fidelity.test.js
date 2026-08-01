import assert from 'node:assert/strict';
import { test } from 'node:test';

import { WRK_DIR } from '../paths.js';
import { buildWrkPostScript, generatedScriptPath } from '../tools/wrk.js';

test('buildWrkPostScript embeds the exact given body and content-type as a Lua literal', () => {
  const body = JSON.stringify({ items: [{ id: 1 }, { id: 2 }] });
  const script = buildWrkPostScript({ body, headers: { 'Content-Type': 'application/json' } });

  assert.match(script, /wrk\.method\s*=\s*"POST"/);
  const bodyLineMatch = script.match(/wrk\.body\s*=\s*"((?:[^"\\]|\\.)*)"/);
  assert.ok(bodyLineMatch, 'wrk.body assignment must be a single valid Lua string literal');
  const unescaped = bodyLineMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  assert.equal(unescaped, body, 'the generated script must contain the exact scenario body, not a placeholder');
  assert.match(script, /wrk\.headers\["Content-Type"\]\s*=\s*"application\/json"/);
});

test('buildWrkPostScript escapes embedded double quotes and backslashes so the Lua literal stays valid', () => {
  const body = '{"name":"O\\"Brien"}';
  const script = buildWrkPostScript({ body, headers: {} });
  const bodyLineMatch = script.match(/wrk\.body\s*=\s*"((?:[^"\\]|\\.)*)"/);
  assert.ok(bodyLineMatch, 'wrk.body assignment must be a single valid Lua string literal');
});

test('two different scenario ids produce two different generated script paths for the same run', () => {
  const a = generatedScriptPath('post-json', 'run-1');
  const b = generatedScriptPath('large-post', 'run-1');
  assert.notEqual(a, b);
});

test('a scenario body differing only in size still preserves every item when escaped into the script', () => {
  const largeBody = JSON.stringify({ items: Array.from({ length: 5000 }, (_, i) => ({ id: i })) });
  const script = buildWrkPostScript({ body: largeBody, headers: { 'Content-Type': 'application/json' } });
  const bodyLineMatch = script.match(/wrk\.body\s*=\s*"((?:[^"\\]|\\.)*)"/);
  assert.ok(bodyLineMatch, 'wrk.body assignment must be a single valid Lua string literal');
  const unescaped = bodyLineMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  assert.equal(unescaped, largeBody, 'the full declared body must round-trip exactly, not be truncated or replaced');
});

test('generatedScriptPath is scoped under WRK_DIR by run id, not a shared static filename', () => {
  const a = generatedScriptPath('post-json', 'run-1');
  assert.ok(a.startsWith(WRK_DIR));
  assert.ok(a.includes('run-1'));
  assert.ok(a.includes('post-json'));
});
