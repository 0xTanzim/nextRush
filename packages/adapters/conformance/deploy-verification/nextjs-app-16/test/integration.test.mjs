/**
 * Real-server proof for the Next.js 16 fixture.
 *
 * Builds nothing itself: `pnpm --filter nextjs-app-16 test:integration` runs
 * `next build` first, then `node --test test/integration.test.mjs`. This file
 * starts `next start` on a free loopback port, waits for it to serve requests,
 * and drives the conference-room API over real HTTP. Child stderr is captured
 * so a failed boot produces a diagnostic instead of a hang.
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const FIXTURE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOST = '127.0.0.1';
const READY_TIMEOUT_MS = 30_000;
const READY_POLL_MS = 100;
const STOP_TIMEOUT_MS = 10_000;
const STDERR_TAIL_LINES = 40;

const require = createRequire(import.meta.url);

let child;
let baseUrl;
let stderr = '';
let exitState;

const JSON_HEADERS = { 'content-type': 'application/json' };

function stderrTail() {
  if (stderr.length === 0) return '(empty)';
  return stderr.trimEnd().split('\n').slice(-STDERR_TAIL_LINES).join('\n');
}

function acquireFreePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.unref();
    probe.once('error', reject);
    probe.listen(0, HOST, () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function waitForReady(url) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  let lastError;

  while (Date.now() < deadline) {
    if (exitState) {
      throw new Error(
        `next start exited (${exitState.describe}) before serving ${url}.\n` +
          `--- next start stderr ---\n${stderrTail()}`
      );
    }
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (res.status < 500) return;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, READY_POLL_MS));
  }

  throw new Error(
    `next start on ${url} did not answer within ${READY_TIMEOUT_MS}ms ` +
      `(last error: ${lastError?.message ?? 'none'}).\n` +
      `--- next start stderr ---\n${stderrTail()}`
  );
}

async function stopServer() {
  if (!child || exitState) return;
  const exited = new Promise((resolve) => child.once('exit', resolve));
  const killTimer = setTimeout(() => child.kill('SIGKILL'), STOP_TIMEOUT_MS);
  child.kill('SIGTERM');
  await exited;
  clearTimeout(killTimer);
}

before(async () => {
  assert.ok(
    existsSync(path.join(FIXTURE_ROOT, '.next')),
    `No production build at ${path.join(FIXTURE_ROOT, '.next')}. ` +
      'Run "pnpm --filter nextjs-app-16 build" before the integration test.'
  );

  const port = await acquireFreePort();
  const nextBin = require.resolve('next/dist/bin/next');

  child = spawn(process.execPath, [nextBin, 'start', '-H', HOST, '-p', String(port)], {
    cwd: FIXTURE_ROOT,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  child.once('exit', (code, signal) => {
    exitState = { describe: `code=${String(code)} signal=${String(signal)}` };
  });

  baseUrl = `http://${HOST}:${port}`;
  await waitForReady(`${baseUrl}/api/rooms`);
});

after(async () => {
  await stopServer();
});

const nextId = (() => {
  let counter = 0;
  return () => {
    counter += 1;
    return `${process.pid}-${counter}`;
  };
})();

async function createRoom(overrides = {}) {
  const input = { name: `Room ${nextId()}`, capacity: 4, ...overrides };
  const res = await fetch(`${baseUrl}/api/rooms`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  });
  assert.equal(res.status, 201, 'setup: create should return 201');
  return { input, room: await res.json() };
}

async function removeRoom(id) {
  await fetch(`${baseUrl}/api/rooms/${id}`, { method: 'DELETE' });
}

function allowSet(res) {
  const header = res.headers.get('allow');
  assert.ok(header, 'expected an Allow header');
  return new Set(
    header
      .split(',')
      .map((method) => method.trim())
      .filter(Boolean)
  );
}

describe('rooms API happy path', () => {
  it('lists the seeded rooms as JSON', async () => {
    const res = await fetch(`${baseUrl}/api/rooms`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /^application\/json/);

    const rooms = await res.json();
    assert.ok(Array.isArray(rooms));
    const ids = rooms.map((room) => room.id);
    assert.ok(ids.includes('atlas'), 'expected seeded room atlas');
    assert.ok(ids.includes('orion'), 'expected seeded room orion');

    const atlas = rooms.find((room) => room.id === 'atlas');
    assert.deepEqual(
      { name: atlas.name, capacity: atlas.capacity },
      { name: 'Atlas', capacity: 12 }
    );
  });

  it('creates a room with 201 and a generated id', async () => {
    const { input, room } = await createRoom({ name: 'Created', capacity: 8 });
    try {
      assert.equal(typeof room.id, 'string');
      assert.ok(room.id.length > 0);
      assert.equal(room.name, input.name);
      assert.equal(room.capacity, input.capacity);
    } finally {
      await removeRoom(room.id);
    }
  });

  it('gets a room by id', async () => {
    const { room } = await createRoom({ name: 'Fetch me', capacity: 3 });
    try {
      const res = await fetch(`${baseUrl}/api/rooms/${room.id}`);
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type') ?? '', /^application\/json/);
      assert.deepEqual(await res.json(), room);
    } finally {
      await removeRoom(room.id);
    }
  });

  it('replaces a room with PUT', async () => {
    const { room } = await createRoom({ name: 'Before', capacity: 5 });
    try {
      const replacement = { name: 'After', capacity: 20 };
      const res = await fetch(`${baseUrl}/api/rooms/${room.id}`, {
        method: 'PUT',
        headers: JSON_HEADERS,
        body: JSON.stringify(replacement),
      });
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { id: room.id, ...replacement });
    } finally {
      await removeRoom(room.id);
    }
  });

  it('patches only the supplied fields', async () => {
    const { room } = await createRoom({ name: 'Patch me', capacity: 6 });
    try {
      const res = await fetch(`${baseUrl}/api/rooms/${room.id}`, {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify({ capacity: 9 }),
      });
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { id: room.id, name: 'Patch me', capacity: 9 });
    } finally {
      await removeRoom(room.id);
    }
  });

  it('deletes a room with 204 and an empty body', async () => {
    const { room } = await createRoom({ name: 'Delete me', capacity: 7 });

    const res = await fetch(`${baseUrl}/api/rooms/${room.id}`, { method: 'DELETE' });
    assert.equal(res.status, 204);
    assert.equal(await res.text(), '');
  });

  it('returns 404 for an unknown id on GET, PUT, PATCH and DELETE', async () => {
    const unknownId = `missing-${nextId()}`;
    const cases = [
      { method: 'GET', body: undefined },
      { method: 'PUT', body: JSON.stringify({ name: 'X', capacity: 2 }) },
      { method: 'PATCH', body: JSON.stringify({ capacity: 2 }) },
      { method: 'DELETE', body: undefined },
    ];

    for (const { method, body } of cases) {
      const res = await fetch(`${baseUrl}/api/rooms/${unknownId}`, {
        method,
        headers: body === undefined ? undefined : JSON_HEADERS,
        body,
      });
      assert.equal(res.status, 404, `${method} /api/rooms/${unknownId} should be 404`);
    }
  });
});

describe('handler return settlement (RFC-050)', () => {
  it('answers a returned array as JSON', async () => {
    const res = await fetch(`${baseUrl}/api/returned-array`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/json');
    assert.equal(await res.text(), '[{"id":1,"name":"Atlas"},{"id":2,"name":"Orion"}]');
  });

  it('preserves a returned Response status, headers and body', async () => {
    const res = await fetch(`${baseUrl}/api/returned-response`);
    assert.equal(res.status, 201);
    assert.equal(res.headers.get('content-type'), 'application/json');
    assert.equal(res.headers.get('x-made'), 'yes');
    assert.equal(await res.text(), '{"id":1}');
  });

  it('keeps the committed response over the returned value', async () => {
    const res = await fetch(`${baseUrl}/api/committed`);
    assert.equal(res.status, 202);
    assert.deepEqual(await res.json(), { committed: true });
  });
});

describe('rooms API failure matrix', () => {
  it('rejects malformed JSON with the body-parser envelope', async () => {
    const res = await fetch(`${baseUrl}/api/rooms`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: '{"name": ',
    });
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), {
      error: 'BodyParserError',
      message: 'Invalid JSON',
      code: 'INVALID_JSON',
      status: 400,
    });
  });

  it('rejects a body missing a required field', async () => {
    const res = await fetch(`${baseUrl}/api/rooms`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ capacity: 4 }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, 'Invalid room input');
    assert.deepEqual(
      body.issues.map((issue) => issue.field),
      ['name']
    );
  });

  it('rejects a wrong field type', async () => {
    const res = await fetch(`${baseUrl}/api/rooms`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ name: 'Wrong', capacity: 'many' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, 'Invalid room input');
    assert.deepEqual(
      body.issues.map((issue) => issue.field),
      ['capacity']
    );
  });

  it('rejects an unsupported content type with 415', async () => {
    const res = await fetch(`${baseUrl}/api/rooms`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'name=Wrong',
    });
    assert.equal(res.status, 415);
    const body = await res.json();
    assert.equal(body.error, 'BodyParserError');
    assert.equal(body.code, 'UNSUPPORTED_CONTENT_TYPE');
    assert.equal(body.status, 415);
  });

  it('returns 405 with Allow for a method the path does not support', async () => {
    const res = await fetch(`${baseUrl}/api/rooms`, { method: 'DELETE' });
    assert.equal(res.status, 405);
    const allowed = allowSet(res);
    for (const method of ['GET', 'HEAD', 'POST']) {
      assert.ok(allowed.has(method), `Allow should contain ${method}`);
    }
  });

  it('answers OPTIONS with 200 and Allow', async () => {
    const res = await fetch(`${baseUrl}/api/rooms`, { method: 'OPTIONS' });
    assert.equal(res.status, 200);
    const allowed = allowSet(res);
    for (const method of ['GET', 'HEAD', 'POST']) {
      assert.ok(allowed.has(method), `Allow should contain ${method}`);
    }
    assert.equal(await res.text(), '');
  });

  it('answers HEAD with GET headers and an empty body', async () => {
    const getRes = await fetch(`${baseUrl}/api/rooms`);
    const getBody = await getRes.text();
    const headRes = await fetch(`${baseUrl}/api/rooms`, { method: 'HEAD' });

    assert.equal(headRes.status, 200);
    assert.equal(
      headRes.headers.get('content-type'),
      getRes.headers.get('content-type')
    );
    // GET streams chunked (no Content-Length); HEAD advertises the byte length
    // of the body GET would have sent.
    assert.equal(
      headRes.headers.get('content-length'),
      String(new TextEncoder().encode(getBody).length)
    );
    assert.equal(await headRes.text(), '');
  });
});

describe('rooms API sequential state', () => {
  it('observes POST, PATCH, DELETE across requests to the same store', async () => {
    const { room } = await createRoom({ name: 'Lifecycle', capacity: 2 });

    const afterCreate = await fetch(`${baseUrl}/api/rooms/${room.id}`);
    assert.equal(afterCreate.status, 200);
    assert.equal((await afterCreate.json()).capacity, 2);

    const patched = await fetch(`${baseUrl}/api/rooms/${room.id}`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({ capacity: 11 }),
    });
    assert.equal(patched.status, 200);

    const afterPatch = await fetch(`${baseUrl}/api/rooms/${room.id}`);
    assert.equal(afterPatch.status, 200);
    const patchedRoom = await afterPatch.json();
    assert.equal(patchedRoom.capacity, 11);
    assert.equal(patchedRoom.name, 'Lifecycle');

    const deleted = await fetch(`${baseUrl}/api/rooms/${room.id}`, { method: 'DELETE' });
    assert.equal(deleted.status, 204);

    const afterDelete = await fetch(`${baseUrl}/api/rooms/${room.id}`);
    assert.equal(afterDelete.status, 404, 'GET after DELETE should be 404');
  });
});
