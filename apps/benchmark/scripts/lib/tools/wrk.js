/** wrk runner: invocation, output parsing, and version detection. */

import { execSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { WRK_DIR } from '../paths.js';
import { parseDuration } from '../time.js';
import { hasTaskset } from '../system.js';
import { logWarn } from '../logging.js';

/** Escape a string for embedding inside a double-quoted Lua string literal. */
function escapeLuaString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

/**
 * Generate a wrk Lua script's contents from a scenario's OWN declared body and
 * headers, so the request wrk sends can never drift from `config/scenarios.js`.
 *
 * @param {{ body: string, headers?: Record<string,string> }} scenario
 * @returns {string} A complete, self-contained wrk Lua script.
 */
export function buildWrkPostScript({ body, headers = {} }) {
  const lines = ['wrk.method = "POST"', `wrk.body   = "${escapeLuaString(body)}"`];
  for (const [name, value] of Object.entries(headers)) {
    lines.push(`wrk.headers["${escapeLuaString(name)}"] = "${escapeLuaString(value)}"`);
  }
  return lines.join('\n') + '\n';
}

/** Path for a scenario's generated wrk script, scoped by run id so concurrent runs never collide. */
export function generatedScriptPath(scenarioId, runId) {
  return join(WRK_DIR, '.generated', runId, `${scenarioId}.lua`);
}

/**
 * Write a scenario-derived wrk script to disk (creating its run-scoped
 * directory as needed) and return the absolute path wrk should load with `-s`.
 */
export function writeGeneratedScript(scenario, runId) {
  const path = generatedScriptPath(scenario.id, runId);
  mkdirSync(join(WRK_DIR, '.generated', runId), { recursive: true });
  writeFileSync(path, buildWrkPostScript(scenario));
  return path;
}

/** Remove a run's generated-script directory. Safe to call even if it was never created. */
export function cleanupGeneratedScripts(runId) {
  rmSync(join(WRK_DIR, '.generated', runId), { recursive: true, force: true });
}

export function runWrk({ url, connections, threads, duration, scriptPath, latency = true, pinCores = null }) {
  const args = ['-c', String(connections), '-t', String(Math.min(threads, connections)), '-d', duration];
  if (latency) args.push('--latency');
  if (scriptPath) args.push('-s', scriptPath);
  args.push(url);

  // Optional CPU pinning (taskset, Linux) for the LOAD GENERATOR — the server-side
  // equivalent already exists via `--pin` (see lib/server.js). Pinning wrk to a
  // disjoint core set from the server is what `router-highload-harness-fixes`
  // (performance-gate spec, "Dev-quick benchmarking can isolate server CPU from
  // client CPU on one machine") calls "core isolation": on a single dev machine,
  // client and server otherwise compete for the same cores, confounding any
  // conclusion about server-side CPU cost specifically (this is exactly what made
  // the c64->c128->c256 sweep in report/router-highload-saturation-findings.md
  // inconclusive about the router). Graceful skip, same pattern as server pinning:
  // taskset unavailable or non-Linux -> warn and run unpinned, never a hard failure.
  let command = 'wrk';
  let commandArgs = args;
  if (pinCores && process.platform === 'linux' && hasTaskset()) {
    command = 'taskset';
    commandArgs = ['-c', String(pinCores), 'wrk', ...args];
  } else if (pinCores) {
    logWarn('Client CPU pinning requested but taskset is unavailable (or non-Linux) — running unpinned.');
  }

  const result = execSync(`${command} ${commandArgs.join(' ')}`, {
    encoding: 'utf-8',
    timeout: parseDuration(duration) * 1000 + 30000,
  });

  return parseWrkOutput(result);
}

export function parseWrkOutput(output) {
  const result = { raw: output, requests: 0, rps: 0, transferPerSec: '', latency: {}, errors: {} };

  const rpsMatch = output.match(/Requests\/sec:\s+([\d.]+)/);
  if (rpsMatch) result.rps = parseFloat(rpsMatch[1]);

  const reqMatch = output.match(/(\d+)\s+requests\s+in/);
  if (reqMatch) result.requests = parseInt(reqMatch[1], 10);

  const transferMatch = output.match(/Transfer\/sec:\s+([\d.]+\w+)/);
  if (transferMatch) result.transferPerSec = transferMatch[1];

  const latencyLine = output.match(/Latency\s+([\d.]+\w+)\s+([\d.]+\w+)\s+([\d.]+\w+)/);
  if (latencyLine) {
    result.latency.avg = latencyLine[1];
    result.latency.stdev = latencyLine[2];
    result.latency.max = latencyLine[3];
  }

  const p50 = output.match(/50%\s+([\d.]+\w+)/);
  const p75 = output.match(/75%\s+([\d.]+\w+)/);
  const p90 = output.match(/90%\s+([\d.]+\w+)/);
  const p99 = output.match(/99%\s+([\d.]+\w+)/);
  if (p50) result.latency.p50 = p50[1];
  if (p75) result.latency.p75 = p75[1];
  if (p90) result.latency.p90 = p90[1];
  if (p99) result.latency.p99 = p99[1];

  const socketErrors = output.match(
    /Socket errors:\s+connect\s+(\d+),\s+read\s+(\d+),\s+write\s+(\d+),\s+timeout\s+(\d+)/
  );
  if (socketErrors) {
    result.errors = {
      connect: parseInt(socketErrors[1], 10),
      read: parseInt(socketErrors[2], 10),
      write: parseInt(socketErrors[3], 10),
      timeout: parseInt(socketErrors[4], 10),
    };
  }

  const nonOk = output.match(/Non-2xx or 3xx responses:\s+(\d+)/);
  if (nonOk) result.errors.nonOk = parseInt(nonOk[1], 10);

  return result;
}

/** Read wrk's version (wrk --version exits non-zero but prints to stderr). */
export function readWrkVersion() {
  try {
    const output = execSync('wrk --version 2>&1; exit 0', { encoding: 'utf-8', timeout: 3000 });
    const match = output.match(/wrk\s+([\d.]+[\w.-]*)/);
    return match ? `wrk ${match[1]}` : 'wrk (version unknown)';
  } catch {
    return 'wrk (version unknown)';
  }
}
