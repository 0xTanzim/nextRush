/** System information and byte formatting. */

import { execSync } from 'node:child_process';
import os from 'node:os';

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

export function getSystemInfo() {
  return {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    cpuModel: os.cpus()[0]?.model || 'unknown',
    cpuCores: os.cpus().length,
    totalMemory: formatBytes(os.totalmem()),
    freeMemory: formatBytes(os.freemem()),
    kernelVersion: os.release(),
    uptime: `${Math.floor(os.uptime() / 3600)}h`,
    timestamp: new Date().toISOString(),
  };
}

/** Whether the `taskset` binary is available (Linux CPU pinning). */
export function hasTaskset() {
  try {
    execSync('command -v taskset', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Count the logical CPUs a `taskset -c` spec selects.
 *
 * Accepts the same forms taskset does: `2`, `0-3`, `0,2,4`, `0-1,4-5`.
 *
 * @param {string | null | undefined} spec
 * @returns {number | null} the CPU count, or null when the spec is absent/unparseable
 */
export function countPinnedCpus(spec) {
  if (typeof spec !== 'string' || spec.trim() === '') return null;

  let total = 0;
  for (const part of spec.split(',')) {
    const range = part.trim();
    if (range === '') continue;
    const match = /^(\d+)(?:-(\d+))?$/.exec(range);
    if (!match) return null;
    const start = Number(match[1]);
    const end = match[2] === undefined ? start : Number(match[2]);
    if (end < start) return null;
    total += end - start + 1;
  }
  return total > 0 ? total : null;
}

/**
 * Load-generator thread count, capped to the CPUs it is actually pinned to.
 *
 * Thread count (a profile setting) and client pinning (a CLI flag) were chosen
 * independently, so a `standard` run pinned wrk's 4 threads onto 2 logical CPUs.
 * Measured on one unchanged raw-node process at 256 connections: 4 threads on
 * cores 0-1 gave 27,381 and 28,391 RPS, while a SINGLE thread on core 0 gave
 * 29,384 — the measuring instrument was contending with itself and adding
 * variance to every cell (audit F-25).
 *
 * @param {number} requested The profile's declared thread count.
 * @param {string | null} clientPinCores The `--client-pin` spec, if any.
 * @returns {{ threads: number, capped: boolean, pinnedCpus: number | null }}
 */
export function resolveClientThreads(requested, clientPinCores) {
  const pinnedCpus = countPinnedCpus(clientPinCores);
  if (pinnedCpus === null || requested <= pinnedCpus) {
    return { threads: requested, capped: false, pinnedCpus };
  }
  return { threads: pinnedCpus, capped: true, pinnedCpus };
}

/**
 * Host 1-minute load average at a point in time, or null off Linux/macOS.
 *
 * Recorded at run start so `derivePublishable` can refuse to stamp a comparison
 * publishable when it was measured on a busy machine (audit F-20).
 */
export function hostLoadAverage() {
  const [oneMinute] = os.loadavg();
  return typeof oneMinute === 'number' && Number.isFinite(oneMinute)
    ? Math.round(oneMinute * 100) / 100
    : null;
}
