/** Benchmark profiles — determines duration, concurrency levels, and run count */

import os from 'node:os';

const cpuThreads = Math.max(2, Math.min(os.cpus().length, 16));

export const PROFILES = {
  /**
   * Fast feedback during development. Single run, low + high concurrency.
   * NOT publishable — a single run has no variance and must never back a
   * published number (audit FAIR-02).
   *
   * 128 was added alongside 64 (router-highload-matcher-optimize, D1) so a
   * single quick run shows BOTH regimes: c64 is I/O-bound on this hardware
   * (server has spare CPU, so CPU-side routing costs can't move RPS — see
   * report/route-params-profile.md D3, 23.95% idle at c64), while c128 is
   * intended to approach CPU saturation, making routing CPU cost observable
   * without needing the pinned, 30-minute `full` profile for dev iteration.
   * Each c128 result MUST be accompanied by a saturation check (a quick
   * --cpu-prof confirming the server's idle share is near zero) before it is
   * used to judge a routing optimization — an unsaturated c128 run is exactly
   * as inconclusive as c64 was.
   */
  quick: {
    duration: '10s',
    connections: [64, 128],
    threads: Math.min(cpuThreads, 4),
    runs: 1,
    warmupDuration: '5s',
    scenarioWarmupDuration: '2s',
    cooldownMs: 2000,
    pauseBetweenTestsMs: 1000,
    publishable: false,
    description: 'Quick dev iteration (single run, 64+128 connections) — NOT publishable',
  },

  /** Regular CI testing. Multiple concurrency levels, 3 runs for statistics. */
  standard: {
    duration: '30s',
    connections: [1, 64, 256],
    threads: Math.min(cpuThreads, 4),
    runs: 3,
    warmupDuration: '10s',
    scenarioWarmupDuration: '3s',
    cooldownMs: 3000,
    pauseBetweenTestsMs: 2000,
    publishable: true,
    description: 'Standard CI benchmark (3 runs, 3 concurrency levels incl. serial baseline)',
  },

  /** Release validation. Full concurrency sweep, 5 runs for high confidence. */
  full: {
    duration: '60s',
    connections: [1, 64, 256, 512],
    threads: cpuThreads,
    runs: 5,
    warmupDuration: '15s',
    scenarioWarmupDuration: '5s',
    cooldownMs: 5000,
    pauseBetweenTestsMs: 3000,
    publishable: true,
    description: 'Full release benchmark (5 runs, 4 concurrency levels)',
  },

  /** Breaking-point analysis. High concurrency, long duration, stress patterns. */
  stress: {
    duration: '120s',
    connections: [256, 512, 1024],
    threads: cpuThreads,
    runs: 3,
    warmupDuration: '15s',
    scenarioWarmupDuration: '5s',
    cooldownMs: 5000,
    pauseBetweenTestsMs: 5000,
    publishable: false,
    description: 'Stress test (3 runs, high concurrency, 2min duration) — NOT publishable',
  },
};

export const DEFAULT_PROFILE = 'quick';
