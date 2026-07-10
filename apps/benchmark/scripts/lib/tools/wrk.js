/** wrk runner: invocation, output parsing, and version detection. */

import { execSync } from 'node:child_process';
import { join } from 'node:path';

import { WRK_DIR } from '../paths.js';
import { parseDuration } from '../time.js';

export function runWrk({ url, connections, threads, duration, script, latency = true }) {
  const args = ['-c', String(connections), '-t', String(Math.min(threads, connections)), '-d', duration];
  if (latency) args.push('--latency');
  if (script) args.push('-s', join(WRK_DIR, script));
  args.push(url);

  const result = execSync(`wrk ${args.join(' ')}`, {
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
