/**
 * Guards the wire POST entries.
 *
 * `wrk` counts whatever the server answers, so an entry that 404s or throws
 * produces a fast, plausible, meaningless number. These checks start each entry
 * and send the same 1 KB JSON POST the load script sends.
 */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { runtimeArgs } from '../harness.mjs';
import { rawRequest } from '../raw-http.mjs';
import { WIRE_POST_BODY } from '../wrk.mjs';

const DEVCHECK = resolve(import.meta.dirname, '..', '..');
const ENTRIES = join(DEVCHECK, 'entries');
const BUNDLER = join(DEVCHECK, 'lib', 'build.ts');
const RUNTIMES = ['bun', 'node'];
const ENTRIES_UNDER_TEST = [
  { name: 'serve-nextrush-post', runtimes: RUNTIMES },
  { name: 'serve-hono-post', runtimes: RUNTIMES },
  { name: 'serve-elysia-post', runtimes: ['bun'] },
];

const bunAvailable = spawnSync('bun', ['--version'], { encoding: 'utf8' }).status === 0;
const skipBun = bunAvailable ? false : 'bun is required by the dev-check toolkit';

const workdir = mkdtempSync(join(tmpdir(), 'nextrush-wire-post-'));
process.on('exit', () => rmSync(workdir, { recursive: true, force: true }));

function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolvePort(port));
    });
  });
}

async function waitForPort(port, timeoutMs = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const open = await new Promise((resolveOpen) => {
      const socket = net.connect(port, '127.0.0.1');
      socket.on('connect', () => { socket.destroy(); resolveOpen(true); });
      socket.on('error', () => { socket.destroy(); resolveOpen(false); });
    });
    if (open) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 50));
  }
  throw new Error(`port ${port} was not served within ${timeoutMs} ms`);
}

function bundle(entry, runtime) {
  const out = join(workdir, `${entry}.${runtime}.mjs`);
  const result = spawnSync('bun', [BUNDLER, join(ENTRIES, `${entry}.ts`), out, runtime, '--no-minify'], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `bundle failed for ${entry} (${runtime}):\n${result.stderr}`);
  return out;
}

for (const { name: entry, runtimes } of ENTRIES_UNDER_TEST) {
  for (const runtime of runtimes) {
    test(`${entry} answers the wire POST on ${runtime}`, { skip: skipBun, timeout: 30_000 }, async () => {
      const file = bundle(entry, runtime);
      const port = await freePort();
      const child = spawn(runtime, runtimeArgs(runtime, file), {
        env: { ...process.env, PORT: String(port) },
        stdio: 'ignore',
      });
      try {
        await waitForPort(port);
        const response = await rawRequest(port, {
          method: 'POST',
          target: '/',
          headers: { 'content-type': 'application/json' },
          body: WIRE_POST_BODY,
        });
        assert.equal(response.status, 200, `${entry} (${runtime}) answered ${response.status}`);
        assert.deepEqual(JSON.parse(response.body), { ok: true });
      } finally {
        child.kill('SIGKILL');
      }
    });
  }
}
