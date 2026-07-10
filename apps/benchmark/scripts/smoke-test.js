#!/usr/bin/env node

/**
 * Smoke test — verifies every server responds correctly to every scenario.
 * Endpoints are derived from config/scenarios.js and servers from
 * config/frameworks.js so this never drifts from the benchmark matrix.
 *
 * Usage:
 *   node scripts/smoke-test.js              # all servers
 *   node scripts/smoke-test.js nextrush-v3  # one server
 */

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BASE_URL, PORT } from '../config/constants.js';
import { DEFAULT_FRAMEWORKS, FRAMEWORKS } from '../config/frameworks.js';
import { SCENARIOS } from '../config/scenarios.js';
import { MIDDLEWARE_HEADERS } from '../servers/_shared/payloads.js';
import { waitForServer } from './lib/server.js';
import { sleep } from './lib/time.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVERS_DIR = join(__dirname, '..', 'servers');

const filterServer = process.argv[2];

async function checkEndpoint(scenario) {
  const opts = { method: scenario.method };
  if (scenario.body) {
    opts.body = scenario.body;
    opts.headers = scenario.headers || { 'Content-Type': 'application/json' };
  }
  const res = await fetch(`${BASE_URL}${scenario.path}`, opts);

  const statusOk = res.status === scenario.expectStatus;
  let detail = `→ ${res.status}`;
  let ok = statusOk;

  // For the middleware scenario, also assert the 5 headers are present.
  if (scenario.id === 'middleware-stack' && statusOk) {
    const missing = MIDDLEWARE_HEADERS.filter((h) => res.headers.get(h.name) === null).map((h) => h.name);
    if (missing.length) {
      ok = false;
      detail += ` (missing headers: ${missing.join(', ')})`;
    }
  }
  if (!statusOk) detail += ` (expected ${scenario.expectStatus})`;
  return { ok, detail };
}

async function testServer(id) {
  const server = FRAMEWORKS[id];
  console.log(`\n  ╔══ ${id} ══╗`);

  const child = spawn('node', [join(SERVERS_DIR, server.file)], {
    env: { ...process.env, PORT: String(PORT), NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  child.stderr.on('data', (d) => {
    stderr += d.toString();
  });

  const ready = await waitForServer(`${BASE_URL}/`, 10000);
  if (!ready) {
    child.kill('SIGKILL');
    console.log(`  ✗ Failed to start (${id})`);
    if (stderr) console.log(`    stderr: ${stderr.slice(0, 200)}`);
    return false;
  }

  let passed = 0;
  let failed = 0;
  for (const scenario of SCENARIOS) {
    try {
      const { ok, detail } = await checkEndpoint(scenario);
      console.log(`  ${ok ? '✓' : '✗'} ${scenario.name} (${scenario.method} ${scenario.path}) ${detail}`);
      ok ? passed++ : failed++;
    } catch (err) {
      console.log(`  ✗ ${scenario.name} (${scenario.method} ${scenario.path}) → ERROR: ${err.message}`);
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

  console.log(`  ── ${passed}/${SCENARIOS.length} passed${failed > 0 ? ` (${failed} failed)` : ''}`);
  return failed === 0;
}

async function main() {
  console.log('═══ Benchmark Server Smoke Tests ═══');

  const ids = filterServer ? [filterServer] : DEFAULT_FRAMEWORKS;
  for (const id of ids) {
    if (!FRAMEWORKS[id]) {
      console.error(`Unknown server: ${id}. Available: ${Object.keys(FRAMEWORKS).join(', ')}`);
      process.exit(1);
    }
  }

  let allPassed = true;
  for (const id of ids) {
    const ok = await testServer(id);
    if (!ok) allPassed = false;
    await sleep(1000);
  }

  console.log('\n═══ Summary ═══');
  console.log(allPassed ? '✓ All servers passed' : '✗ Some servers failed');
  process.exit(allPassed ? 0 : 1);
}

main();
