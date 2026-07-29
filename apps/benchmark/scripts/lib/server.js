/** Benchmark server process lifecycle: start, readiness, stop. */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  NODE_SERVER_FLAGS,
  SERVER_POLL_INTERVAL_MS,
  SERVER_START_TIMEOUT_MS,
} from '../../config/constants.js';
import { logWarn } from './logging.js';
import { SERVERS_DIR } from './paths.js';
import { hasTaskset } from './system.js';
import { sleep } from './time.js';

async function waitForServer(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await fetch(url);
      return true; // any response (even 404/500) means the server is up
    } catch {
      // not ready yet
    }
    await sleep(SERVER_POLL_INTERVAL_MS);
  }
  return false;
}

export { waitForServer };

export async function startServer(
  serverFile,
  port = 8080,
  { traceGc = false, pinCores = null, inspectPort = null, cpuProfDir = null } = {}
) {
  const serverPath = join(SERVERS_DIR, serverFile);
  if (!existsSync(serverPath)) {
    throw new Error(`Server file not found: ${serverPath}`);
  }

  const nodeArgs = [...NODE_SERVER_FLAGS];
  if (traceGc) nodeArgs.push('--trace-gc');
  // Diagnostic-only flags for scripts/profile.js (add-benchmark-cpu-allocation-
  // profiling) — additive, opt-in, and never set by run.js/validate-parity.js's
  // existing call sites, so this changes nothing for the throughput comparison.
  if (inspectPort) nodeArgs.push(`--inspect=${inspectPort}`);
  if (cpuProfDir) nodeArgs.push('--cpu-prof', `--cpu-prof-dir=${cpuProfDir}`);
  nodeArgs.push(serverPath);

  // Optional CPU pinning (taskset, Linux) to reduce scheduler noise on clean-env runs.
  let command = 'node';
  let commandArgs = nodeArgs;
  if (pinCores && process.platform === 'linux' && hasTaskset()) {
    command = 'taskset';
    commandArgs = ['-c', String(pinCores), 'node', ...nodeArgs];
  } else if (pinCores) {
    logWarn('CPU pinning requested but taskset is unavailable — running unpinned.');
  }

  const child = spawn(command, commandArgs, {
    env: { ...process.env, PORT: String(port), NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const gcEvents = [];
  let stderr = '';

  child.stderr.on('data', (data) => {
    const line = data.toString();
    stderr += line;

    const gcMatch = line.match(
      /\[(\d+):.*\]\s+(\d+)\s+ms:\s+(Scavenge|Mark-Compact|MinorGC|MajorGC)\s+[\d.]+\s+\([\d.]+\)\s+->\s+[\d.]+\s+\([\d.]+\)\s+MB,\s+([\d.]+)\s+\/\s+([\d.]+)\s+ms/
    );
    if (gcMatch) {
      gcEvents.push({
        timestamp: parseInt(gcMatch[2], 10),
        type: gcMatch[3],
        pauseMs: parseFloat(gcMatch[4]),
        totalMs: parseFloat(gcMatch[5]),
      });
    }
  });

  const ready = await waitForServer(`http://localhost:${port}/`, SERVER_START_TIMEOUT_MS);
  if (!ready) {
    child.kill('SIGKILL');
    throw new Error(`Server ${serverFile} failed to start.\nStderr: ${stderr}`);
  }

  return { child, port, gcEvents };
}

export async function stopServer(handle) {
  if (!handle?.child) return;

  return new Promise((resolve) => {
    handle.child.once('exit', () => {
      setTimeout(resolve, 200); // socket cleanup delay
    });

    handle.child.kill('SIGTERM');

    setTimeout(() => {
      try {
        handle.child.kill('SIGKILL');
      } catch {
        // already dead
      }
      resolve();
    }, 5000);
  });
}
