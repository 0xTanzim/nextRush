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
