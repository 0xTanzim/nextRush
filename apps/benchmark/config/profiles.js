/** Benchmark profiles — determines duration, concurrency levels, and run count */

import os from 'node:os';

const cpuThreads = Math.max(2, Math.min(os.cpus().length, 16));

export const PROFILES = {
  /** Fast feedback during development. Single run, low concurrency. */
  quick: {
    duration: '10s',
    connections: [64],
    threads: Math.min(cpuThreads, 4),
    runs: 1,
    warmupDuration: '5s',
    cooldownMs: 2000,
    pauseBetweenTestsMs: 1000,
    description: 'Quick dev iteration (single run, 64 connections)',
  },

  /** Regular CI testing. Multiple concurrency levels, 3 runs for statistics. */
  standard: {
    duration: '30s',
    connections: [1, 64, 256],
    threads: Math.min(cpuThreads, 4),
    runs: 3,
    warmupDuration: '10s',
    cooldownMs: 3000,
    pauseBetweenTestsMs: 2000,
    description: 'Standard CI benchmark (3 runs, 3 concurrency levels incl. serial baseline)',
  },

  /** Release validation. Full concurrency sweep, 5 runs for high confidence. */
  full: {
    duration: '60s',
    connections: [1, 64, 256, 512],
    threads: cpuThreads,
    runs: 5,
    warmupDuration: '15s',
    cooldownMs: 5000,
    pauseBetweenTestsMs: 3000,
    description: 'Full release benchmark (5 runs, 4 concurrency levels)',
  },

  /** Breaking-point analysis. High concurrency, long duration, stress patterns. */
  stress: {
    duration: '120s',
    connections: [256, 512, 1024],
    threads: cpuThreads,
    runs: 3,
    warmupDuration: '15s',
    cooldownMs: 5000,
    pauseBetweenTestsMs: 5000,
    description: 'Stress test (3 runs, high concurrency, 2min duration)',
  },
};

export const DEFAULT_PROFILE = 'quick';
