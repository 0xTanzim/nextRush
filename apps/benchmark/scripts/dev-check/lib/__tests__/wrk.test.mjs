import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { WIRE_POST_BODY, parseWrkRps, wrkArgs, wrkPostScript } from '../wrk.mjs';

test('GET arguments keep the committed threads/connections/duration and end with the URL', () => {
  assert.deepEqual(wrkArgs({ url: 'http://127.0.0.1:4300/' }), [
    '-t',
    '2',
    '-c',
    '64',
    '-d',
    '3s',
    'http://127.0.0.1:4300/',
  ]);
});

test('a script is passed with -s before the URL', () => {
  const args = wrkArgs({ url: 'http://127.0.0.1:4300/', script: '/tmp/wrk-post.lua' });
  assert.deepEqual(args.slice(-3), ['-s', '/tmp/wrk-post.lua', 'http://127.0.0.1:4300/']);
});

test('requests per second is read from wrk output', () => {
  const stdout = 'Running 3s test @ http://127.0.0.1:4300/\n  2 threads and 64 connections\nRequests/sec:  34567.89\n';
  assert.equal(parseWrkRps(stdout), 34567.89);
});

test('missing requests per second parses as zero instead of NaN', () => {
  assert.equal(parseWrkRps('unable to connect to 127.0.0.1'), 0);
});

test('the POST body is the same 1 KB JSON payload the servers parse', () => {
  assert.equal(Buffer.byteLength(WIRE_POST_BODY), 1024);
  assert.equal(JSON.parse(WIRE_POST_BODY).name.length, 1013);
});

test('the POST script sets the method, body, and content type wrk needs', () => {
  const script = wrkPostScript();
  assert.match(script, /wrk\.method = "POST"/);
  assert.match(script, /wrk\.headers\["Content-Type"\] = "application\/json"/);
  const bodyLiteral = /wrk\.body = (".*")\n/.exec(script);
  assert.ok(bodyLiteral, 'script has no wrk.body assignment');
  assert.equal(JSON.parse(bodyLiteral[1]), WIRE_POST_BODY);
});
