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
import net from 'node:net';
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
/** A second instance, bound to a real port for hand-written request lines. */
let socketInstance;
async function getMf() {
  if (!mf) {
    mf = new Miniflare({ modules: true, script: await bundleWorker(), compatibilityDate: '2024-11-01' });
  }
  return mf;
}

test.after(async () => {
  await mf?.dispose();
  await socketInstance?.mf.dispose();
});

/** A free loopback port, so the socket instance never collides with another run. */
async function getFreePort() {
  const probe = net.createServer();
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const { port } = probe.address();
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

/**
 * A second instance that listens on a real port.
 *
 * @remarks
 * Needed because `dispatchFetch` builds its `Request` from a URL in THIS process,
 * so it is Node's URL parser — not workerd's — that decides what a dot segment in
 * the string becomes. Observing what the platform does with a request line
 * therefore requires writing the request line by hand over a socket.
 */
async function getSocketInstance() {
  if (socketInstance !== undefined) return socketInstance;
  const port = await getFreePort();
  const worker = new Miniflare({
    modules: true,
    port,
    host: '127.0.0.1',
    script: await bundleWorker(),
    compatibilityDate: '2024-11-01',
  });
  await worker.ready;
  socketInstance = { mf: worker, port };
  return socketInstance;
}

/**
 * Write a request line by hand and parse the response.
 *
 * @remarks
 * Resolves as soon as the promised body is complete instead of waiting for EOF:
 * the platform keeps the connection alive for its idle timeout even after
 * `Connection: close`, which would make every case here cost seconds. Lengths are
 * compared in UTF-16 units, which is exact for the ASCII bodies these requests
 * produce.
 */
function rawRequest(port, target) {
  const parse = (raw) => {
    const separator = raw.indexOf('\r\n\r\n');
    const head = separator === -1 ? raw : raw.slice(0, separator);
    return {
      status: Number.parseInt(head.split(' ')[1] ?? '0', 10),
      body: separator === -1 ? '' : raw.slice(separator + 4),
    };
  };

  return new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1', () => {
      socket.write(
        `GET ${target} HTTP/1.1\r\nHost: 127.0.0.1:${String(port)}\r\nConnection: close\r\n\r\n`
      );
    });
    let raw = '';
    socket.setEncoding('utf8');
    socket.on('data', (chunk) => {
      raw += chunk;
      const separator = raw.indexOf('\r\n\r\n');
      if (separator === -1) return;
      const length = /content-length: *(\d+)/i.exec(raw.slice(0, separator));
      if (length !== null && raw.length >= separator + 4 + Number(length[1])) {
        socket.destroy();
        resolve(parse(raw));
      }
    });
    socket.on('end', () => resolve(parse(raw)));
    socket.on('error', reject);
  });
}

test('platform limit: workerd resolves a dot segment before the framework sees it on real workerd', async () => {
  const { port } = await getSocketInstance();

  // Every spelling, the encoded ones included: workerd's own URL parser runs before
  // any application code, which is the measured basis for the edge adapter declaring
  // `rawRequestTarget: false` rather than claiming a rejection it never performs.
  // The framework still rejects the same target on a runtime that preserves it —
  // see the socket-required conformance scenario.
  const cases = [
    ['/files/../admin', '/admin'],
    ['/files/%2e%2e/admin', '/admin'],
    ['/files/%2E%2E/admin', '/admin'],
    ['/a/./b', '/a/b'],
  ];
  for (const [target, resolved] of cases) {
    const { status, body } = await rawRequest(port, target);
    assert.equal(status, 200, `${target} did not reach the handler as a resolved path`);
    assert.equal(JSON.parse(body).path, resolved);
  }

  // A dot as filename content is not a dot segment and must survive untouched —
  // the control that keeps the rule from widening into "any dotted path".
  const dotted = await rawRequest(port, '/files/..hidden');
  assert.equal(dotted.status, 200);
  assert.equal(JSON.parse(dotted.body).path, '/files/..hidden');
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
