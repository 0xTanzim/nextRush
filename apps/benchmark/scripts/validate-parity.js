#!/usr/bin/env node

/**
 * Parity validator — the fairness integrity gate.
 *
 * Boots each server, hits every endpoint, and asserts that all frameworks
 * return:
 *   - the same HTTP status as the scenario's `expectStatus`, and
 *   - byte-identical response bodies (after normalizing non-deterministic
 *     fields) for scenarios marked `identicalWork`, and
 *   - the same five middleware headers (values, X-Timestamp presence) on
 *     the middleware scenario.
 *
 * A benchmark that has not passed this check is comparing unknown workloads.
 * Run standalone (`pnpm bench:validate`) or as run.js's pre-flight.
 *
 * Usage:
 *   node scripts/validate-parity.js                 # all frameworks
 *   node scripts/validate-parity.js nextrush-v3 koa # subset
 */

import { BASE_URL, PORT } from '../config/constants.js';
import { DEFAULT_FRAMEWORKS, FRAMEWORKS } from '../config/frameworks.js';
import { SCENARIOS } from '../config/scenarios.js';
import { MIDDLEWARE_HEADERS } from '../servers/_shared/payloads.js';
import { checkBacklogParity, checkFramingParity, readListenBacklog } from './lib/parity.js';
import { log, logError, logHeader, logStep, sleep, startServer, stopServer } from './utils.js';

const REFERENCE = 'raw-node';

/** Replace non-deterministic fields so equal work produces equal strings. */
function normalizeBody(scenarioId, text) {
  if (scenarioId === 'post-json') {
    return text
      .replace(/"id":\s*\d+/, '"id":0')
      .replace(/"createdAt":\s*"[^"]*"/, '"createdAt":"NORMALIZED"');
  }
  return text;
}

async function collectResponses(frameworkId) {
  const fw = FRAMEWORKS[frameworkId];
  const handle = await startServer(fw.file, PORT);
  const out = {};
  // Read the EFFECTIVE accept-queue depth from the OS while this server is the
  // one listening. Captured here because the harness runs servers one at a time
  // on a shared port, so it cannot be read after they have all stopped.
  out.__backlog = readListenBacklog(PORT);
  try {
    for (const s of SCENARIOS) {
      const opts = { method: s.method };
      if (s.body) {
        opts.body = s.body;
        opts.headers = s.headers;
      }
      const res = await fetch(`${BASE_URL}${s.path}`, opts);
      out[s.id] = {
        status: res.status,
        body: normalizeBody(s.id, await res.text()),
        headers: Object.fromEntries([...res.headers.entries()].map(([k, v]) => [k.toLowerCase(), v])),
      };
    }
  } finally {
    await stopServer(handle);
    await sleep(300);
  }
  return out;
}

function checkMiddlewareHeaders(headers) {
  const problems = [];
  for (const h of MIDDLEWARE_HEADERS) {
    const key = h.name.toLowerCase();
    if (!(key in headers)) {
      problems.push(`missing header ${h.name}`);
      continue;
    }
    if (h.value !== null && headers[key] !== h.value) {
      problems.push(`${h.name}="${headers[key]}" (expected "${h.value}")`);
    }
  }
  return problems;
}

/**
 * Run the full parity check across the given frameworks.
 * @returns {Promise<{ ok: boolean, failures: string[] }>}
 */
export async function runParityCheck(frameworkIds = DEFAULT_FRAMEWORKS) {
  const ids = frameworkIds.includes(REFERENCE) ? frameworkIds : [REFERENCE, ...frameworkIds];
  const failures = [];

  logHeader('Parity Validation');
  const collected = {};
  for (const id of ids) {
    logStep(`Probing ${FRAMEWORKS[id].name}...`);
    collected[id] = await collectResponses(id);
  }

  const reference = collected[REFERENCE];

  for (const s of SCENARIOS) {
    for (const id of ids) {
      const r = collected[id][s.id];

      // 1. Status parity.
      if (s.expectStatus && r.status !== s.expectStatus) {
        failures.push(`${id} · ${s.id}: status ${r.status} (expected ${s.expectStatus})`);
      }

      // 2. Body parity for identical-work scenarios (against raw-node reference).
      if (s.identicalWork && id !== REFERENCE) {
        const ref = reference[s.id];
        if (r.body !== ref.body) {
          failures.push(
            `${id} · ${s.id}: body differs from ${REFERENCE}\n    ${id}: ${r.body.slice(0, 120)}\n    ref: ${ref.body.slice(0, 120)}`
          );
        }
      }

      // 2b. Content-Type parity for identical-work JSON scenarios (audit F-M02).
      // Scoped to 200-status JSON bodies; the 204 empty scenario has no body, so
      // its Content-Type is semantically irrelevant. Compared case-insensitively.
      if (s.identicalWork && s.expectStatus === 200 && id !== REFERENCE) {
        const ct = (r.headers['content-type'] || '').toLowerCase();
        const refCt = (reference[s.id].headers['content-type'] || '').toLowerCase();
        if (ct !== refCt) {
          failures.push(`${id} · ${s.id}: content-type "${ct}" (expected "${refCt}")`);
        }
      }

      // 3. Middleware header parity.
      if (s.id === 'middleware-stack') {
        const problems = checkMiddlewareHeaders(r.headers);
        if (problems.length) {
          failures.push(`${id} · middleware headers: ${problems.join(', ')}`);
        }
      }
    }

    // 4. Response-framing parity (Content-Length/Transfer-Encoding) — checked once
    // per scenario across every collected server, not per-id (reconciliation
    // report F-03: a chunked-vs-fixed-length mismatch invalidates every
    // throughput comparison for that scenario, and the odd server out is not
    // necessarily the reference).
    if (s.identicalWork) {
      const headersById = {};
      for (const id of ids) headersById[id] = collected[id][s.id].headers;
      const framingProblems = checkFramingParity(headersById, {
        skip: s.expectStatus === 204,
        strictLength: !s.variableLength,
      });
      for (const p of framingProblems) failures.push(`${s.id} · framing: ${p}`);
    }
  }

  // 5. Server-CONSTRUCTION parity: equal TCP accept-queue depth. Checked
  // separately from the response loop because it is a property of how each
  // server was built, not of any one response — the blind spot that let a 2x
  // backlog skew pass every response-level check
  // (`equalize-benchmark-server-config`).
  const backlogById = {};
  for (const id of ids) backlogById[id] = collected[id].__backlog;
  for (const p of checkBacklogParity(backlogById)) failures.push(`config · ${p}`);

  if (failures.length === 0) {
    const shown = ids.map((id) => `${id}=${String(backlogById[id])}`).join(', ');
    log(`\n✓ Parity OK — ${ids.length} servers agree on bodies, content types, statuses, and middleware headers.`);
    log(`  Accept-queue backlog equal across all servers: ${shown}`);
  } else {
    logError(`Parity FAILED with ${failures.length} mismatch(es):`);
    for (const f of failures) log(`  ✗ ${f}`);
  }

  return { ok: failures.length === 0, failures };
}

// ─── CLI ───
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const requested = process.argv.slice(2);
  const ids = requested.length ? requested : DEFAULT_FRAMEWORKS;
  for (const id of ids) {
    if (!FRAMEWORKS[id]) {
      logError(`Unknown framework: ${id}. Available: ${Object.keys(FRAMEWORKS).join(', ')}`);
      process.exit(1);
    }
  }
  runParityCheck(ids)
    .then(({ ok }) => process.exit(ok ? 0 : 1))
    .catch((err) => {
      logError(`Parity validation crashed: ${err.message}`);
      console.error(err.stack);
      process.exit(1);
    });
}
