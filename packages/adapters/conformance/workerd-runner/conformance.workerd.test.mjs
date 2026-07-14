/**
 * Real-workerd conformance — edge adapter (task 3.3).
 *
 * Bundles the worker entry (edge adapter + app) with esbuild and loads it into a
 * REAL workerd isolate via miniflare, then dispatches requests and asserts the
 * same core behaviors the cross-adapter suite pins — proving the edge adapter
 * on-runtime, not simulated under Node/vitest.
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
