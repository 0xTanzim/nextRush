import assert from 'node:assert/strict';
import { test } from 'node:test';

// autocannon itself is not invoked here — we stub its default export via the
// module cache is not practical for a dynamic `import('autocannon')` call, so
// this test exercises runAutocannon's SHAPING logic directly by constructing
// the equivalent of what the real library callback receives and checking the
// documented transformation. A full integration test would require a live
// server; that is covered by bench:validate elsewhere.
import { runAutocannon } from '../tools/autocannon.js';

test('runAutocannon result exposes errors.timeout (singular) equal to errors.timeouts (plural)', async () => {
  // Exercise the real function against a server that never responds, forcing
  // a fast connect/read timeout within a very short duration — deterministic
  // enough to assert the error SHAPE without depending on exact counts.
  const { createServer } = await import('node:net');
  const server = createServer((socket) => {
    // Accept the connection but never write a response — guarantees a client-side timeout.
    socket.on('error', () => {});
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const result = await runAutocannon({ url: `http://127.0.0.1:${port}`, connections: 1, duration: '1s' });
    assert.equal(
      result.errors.timeout,
      result.errors.timeouts,
      'errors.timeout (singular, read by derivePublishable) must mirror errors.timeouts (plural)'
    );
    assert.equal(typeof result.errors.timeout, 'number');
  } finally {
    server.close();
  }
});

test('runAutocannon result always has a numeric errors.timeout field, even when zero', async () => {
  const { createServer } = await import('node:http');
  const server = createServer((req, res) => res.end('ok'));
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const result = await runAutocannon({ url: `http://127.0.0.1:${port}`, connections: 1, duration: '1s' });
    assert.equal(typeof result.errors.timeout, 'number');
    assert.equal(result.errors.timeout, result.errors.timeouts);
  } finally {
    server.close();
  }
});
