#!/usr/bin/env node

/**
 * Smoke test — verifies all servers respond correctly to all scenarios.
 */

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVERS_DIR = join(__dirname, '..', 'servers');

const ENDPOINTS = [
  { method: 'GET', path: '/', expect: 200, label: 'Hello World' },
  { method: 'GET', path: '/json', expect: 200, label: 'JSON Serialize' },
  { method: 'GET', path: '/users/12345', expect: 200, label: 'Route Params' },
  { method: 'GET', path: '/search?q=test&limit=3', expect: 200, label: 'Query String' },
  { method: 'POST', path: '/users', expect: 200, label: 'POST JSON', body: '{"name":"test"}' },
  { method: 'GET', path: '/api/v1/orgs/1/teams/2/members/3', expect: 200, label: 'Deep Route' },
  { method: 'GET', path: '/middleware', expect: 200, label: 'Middleware Stack' },
  { method: 'GET', path: '/error', expect: 500, label: 'Error Handler' },
  { method: 'GET', path: '/large-json', expect: 200, label: 'Large JSON' },
  { method: 'GET', path: '/empty', expect: 204, label: 'Empty Response' },
];

const SERVERS = [
  { id: 'raw-node', file: 'raw-node.js' },
  { id: 'nextrush-v3', file: 'nextrush-v3.js' },
  { id: 'express', file: 'express.js' },
  { id: 'fastify', file: 'fastify.js' },
  { id: 'koa', file: 'koa.js' },
  { id: 'hono', file: 'hono.js' },
];

// Allow filtering via CLI
const filterServer = process.argv[2];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(port, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await fetch(`http://localhost:${port}/`);
      // Any response means the server is up
      return true;
    } catch {
      // not ready
    }
    await sleep(200);
  }
  return false;
}

async function testServer(server) {
  const port = 3000;
  const serverPath = join(SERVERS_DIR, server.file);

  console.log(`\n  ╔══ ${server.id} ══╗`);

  const child = spawn('node', [serverPath], {
    env: { ...process.env, PORT: String(port), NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  child.stderr.on('data', (d) => {
    stderr += d.toString();
  });

  const ready = await waitForServer(port);
  if (!ready) {
    child.kill('SIGKILL');
    console.log(`  ✗ Failed to start (${server.id})`);
    if (stderr) console.log(`    stderr: ${stderr.slice(0, 200)}`);
    return false;
  }

  let passed = 0;
  let failed = 0;

  for (const ep of ENDPOINTS) {
    try {
      const opts = { method: ep.method };
      if (ep.body) {
        opts.body = ep.body;
        opts.headers = { 'Content-Type': 'application/json' };
      }

      const res = await fetch(`http://localhost:${port}${ep.path}`, opts);

      if (res.status === ep.expect) {
        console.log(`  ✓ ${ep.label} (${ep.method} ${ep.path}) → ${res.status}`);
        passed++;
      } else {
        console.log(
          `  ✗ ${ep.label} (${ep.method} ${ep.path}) → ${res.status} (expected ${ep.expect})`
        );
        failed++;
      }
    } catch (err) {
      console.log(`  ✗ ${ep.label} (${ep.method} ${ep.path}) → ERROR: ${err.message}`);
      failed++;
    }
  }

  child.kill('SIGTERM');
  await sleep(500);
  try {
    child.kill('SIGKILL');
  } catch {
    /* already dead */
  }

  console.log(
    `  ── ${passed}/${ENDPOINTS.length} passed${failed > 0 ? ` (${failed} failed)` : ''}`
  );
  return failed === 0;
}

async function main() {
  console.log('═══ Benchmark Server Smoke Tests ═══');

  const servers = filterServer ? SERVERS.filter((s) => s.id === filterServer) : SERVERS;

  if (servers.length === 0) {
    console.error(`Unknown server: ${filterServer}`);
    process.exit(1);
  }

  let allPassed = true;
  for (const server of servers) {
    const ok = await testServer(server);
    if (!ok) allPassed = false;
    await sleep(1000); // cooldown between servers
  }

  console.log('\n═══ Summary ═══');
  console.log(allPassed ? '✓ All servers passed' : '✗ Some servers failed');
  process.exit(allPassed ? 0 : 1);
}

main();
