/**
 * Real-workerd conformance — edge adapter (task 3.3).
 *
 * Bundles the worker entry (edge adapter + app) with esbuild and loads it into a
 * REAL workerd isolate via miniflare, then dispatches requests and asserts the
 * same core behaviors the cross-adapter suite pins — proving the edge adapter
 * on-runtime, not simulated under Node/vitest.
 *
 * @remarks
 * **Architectural limit, not an oversight (F-01 follow-up).** Unlike Bun/Deno
 * (which run their real binary IN-PROCESS with the test, so
 * `defineConformanceSuite`'s per-test `configure` closures work normally),
 * workerd only ever runs as a genuinely separate isolate reached over HTTP via
 * `miniflare.dispatchFetch`. The shared suite's `configure: (app) => void`
 * closures are built fresh per test case in the Node test process and cannot
 * cross that isolate boundary — there is no mechanism to transmit an arbitrary
 * function into a running workerd isolate at request time. Running the FULL
 * shared suite here would require redefining the `ConformanceDriver.dispatch`
 * contract as data (a named/serializable configuration) instead of a closure —
 * a breaking change to the driver contract every built-in and external driver
 * uses, and its own RFC-gated decision, not something this change makes
 * unilaterally. This file instead hand-curates a widened set of real-isolate
 * assertions that a static worker script CAN express, closing part of the gap
 * honestly rather than claiming full parity it cannot deliver.
 *
 * Requires `miniflare` and `esbuild` (installed in CI). Run:
 *   node --test conformance.workerd.test.mjs
 */

import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';

const here = dirname(fileURLToPath(import.meta.url));

/** Bundle worker.mjs (resolving @nextrush/* via node_modules) into one ESM module. */
async function bundleWorker() {
  const result = await build({
    entryPoints: [join(here, 'worker.mjs')],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    conditions: ['workerd', 'worker', 'import'],
    write: false,
  });
  return result.outputFiles[0].text;
}

/** One miniflare instance per test run, sharing the bundled worker. */
let mf;
async function getMf() {
  if (!mf) {
    mf = new Miniflare({ modules: true, script: await bundleWorker(), compatibilityDate: '2024-11-01' });
  }
  return mf;
}

test.after(async () => {
  await mf?.dispose();
});

test('GET dispatch: method + path + query on real workerd', async () => {
  const res = await (await getMf()).dispatchFetch('http://localhost/users?a=1');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.method, 'GET');
  assert.equal(body.path, '/users');
  assert.equal(body.a, '1');
});

test('route params: a case-insensitive match binds the case the client sent on real workerd', async () => {
  const instance = await getMf();

  const paramRes = await instance.dispatchFetch('http://localhost/API/Users/ABC123');
  assert.equal(paramRes.status, 200);
  const paramBody = await paramRes.json();
  // The value is data the handler acts on, so it keeps the client's casing...
  assert.equal(paramBody.name, 'ABC123');
  // ...while the route decision stays folded, including through the mount prefix.
  assert.equal(paramBody.path, '/users/abc123');

  const wildcardRes = await instance.dispatchFetch('http://localhost/API/Files/Foo/Bar.TXT');
  assert.equal((await wildcardRes.json()).wildcard, 'Foo/Bar.TXT');
});

test('POST body JSON round-trip on real workerd', async () => {
  const res = await (await getMf()).dispatchFetch('http://localhost/echo', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{"n":7}',
  });
  const body = await res.json();
  assert.equal(body.echo.n, 7);
});

test('thrown HttpError maps to status on real workerd', async () => {
  const res = await (await getMf()).dispatchFetch('http://localhost/boom');
  assert.equal(res.status, 404);
});

test('F-03 (widened): HEAD carries Content-Length equal to the GET body length on real workerd', async () => {
  const instance = await getMf();
  const getRes = await instance.dispatchFetch('http://localhost/');
  const getBody = await getRes.text();
  const headRes = await instance.dispatchFetch('http://localhost/', { method: 'HEAD' });
  assert.equal(await headRes.text(), '');
  assert.equal(headRes.headers.get('content-length'), String(new TextEncoder().encode(getBody).length));
});

test('F-05 (widened): a framework 404 carries application/json; charset=utf-8 on real workerd', async () => {
  const res = await (await getMf()).dispatchFetch('http://localhost/boom');
  assert.equal(res.status, 404);
  assert.equal(res.headers.get('content-type'), 'application/json; charset=utf-8');
});

test('response conformance: Set-Cookie array sets multiple cookies on real workerd', async () => {
  const res = await (await getMf()).dispatchFetch('http://localhost/cookies');
  assert.deepEqual(res.headers.getSetCookie(), ['a=1; Path=/', 'b=2; Path=/']);
});

test('error propagation: an unknown thrown Error maps to 500 with no message leak on real workerd', async () => {
  const res = await (await getMf()).dispatchFetch('http://localhost/crash');
  assert.equal(res.status, 500);
  const text = await res.text();
  assert.ok(!text.includes('secret-leak-123'));
});

test('never unanswered: a serialization failure is answered with a 500 on real workerd', async () => {
  const res = await (await getMf()).dispatchFetch('http://localhost/unserializable');
  assert.equal(res.status, 500);
  assert.equal(res.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.notEqual(await res.text(), '');
});

test('never unanswered: an error status that nothing wrote is answered on real workerd', async () => {
  const res = await (await getMf()).dispatchFetch('http://localhost/nothing-written');
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { error: 'Service Unavailable' });
});

test('boot-before-dispatch: a route declared on the app router is reached on real workerd', async () => {
  // The worker's handler is built on first request and `ready()` is never
  // awaited, so this route is only reachable if the entry point booted the
  // application (and thereby mounted its own router) before dispatching. Without
  // that boot the request falls through to an empty 200.
  const res = await (await getMf()).dispatchFetch('http://localhost/booted');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { booted: true });
});

test('boot-before-dispatch: an unrouted path is a 404, not an empty 200, on real workerd', async () => {
  const res = await (await getMf()).dispatchFetch('http://localhost/unrouted');
  assert.equal(res.status, 404);
  assert.equal(res.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.deepEqual(await res.json(), { error: 'Not Found' });
});

test('error body: a malformed body answers one framework body, with no engine text, on real workerd', async () => {
  const res = await (await getMf()).dispatchFetch('http://localhost/bad-json', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{ "unterminated": ',
  });

  assert.equal(res.status, 400);
  assert.equal(res.headers.get('content-type'), 'application/json; charset=utf-8');
  // The exact body the cross-adapter suite pins on every other adapter.
  assert.equal(
    await res.text(),
    '{"error":"BodyParserError","message":"Invalid JSON","code":"INVALID_JSON","status":400}'
  );
});

test('unparsed content type: the rejecting policy answers 415 before the handler on real workerd', async () => {
  const res = await (await getMf()).dispatchFetch('http://localhost/reject-xml', {
    method: 'POST',
    headers: { 'content-type': 'application/xml' },
    body: '<note/>',
  });

  assert.equal(res.status, 415);
  assert.equal((await res.json()).code, 'UNSUPPORTED_CONTENT_TYPE');
});

test('unparsed content type: the default policy leaves the body undefined and continues on real workerd', async () => {
  const res = await (await getMf()).dispatchFetch('http://localhost/ignore-xml', {
    method: 'POST',
    headers: { 'content-type': 'application/xml' },
    body: '<note/>',
  });

  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { body: null });
});
