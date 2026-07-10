/**
 * Process metrics: RSS + CPU sampling from /proc (Linux), and pure analyzers.
 * The pure analyzers (memory/gc/cpu) are unit-tested in __tests__/metrics.test.js.
 */

import { readFileSync } from 'node:fs';

import { logWarn } from './logging.js';
import { formatBytes } from './system.js';

/** Linux USER_HZ — clock ticks per second for /proc utime+stime accounting. */
const USER_HZ = 100;

export function startMetricsSampling(pid, intervalMs = 1000) {
  if (process.platform !== 'linux') {
    logWarn(
      'Memory/CPU sampling requires Linux (/proc filesystem). Skipping on ' + process.platform + '.'
    );
    return { stop: () => [] };
  }

  const samples = [];
  const timer = setInterval(() => {
    try {
      const status = readFileSync(`/proc/${pid}/status`, 'utf-8');
      const rssMatch = status.match(/VmRSS:\s+(\d+)\s+kB/);
      const rss = rssMatch ? parseInt(rssMatch[1], 10) * 1024 : 0;

      const procStat = readFileSync(`/proc/${pid}/stat`, 'utf-8');
      const fields = procStat.split(' ');
      const utime = parseInt(fields[13], 10);
      const stime = parseInt(fields[14], 10);

      samples.push({ timestamp: Date.now(), rss, cpuTicks: utime + stime });
    } catch {
      // Process may have died between samples.
    }
  }, intervalMs);

  return {
    stop() {
      clearInterval(timer);
      return samples;
    },
    getSamples() {
      return [...samples];
    },
  };
}

export function analyzeMemorySamples(samples) {
  if (samples.length === 0) return { rssMin: 0, rssMax: 0, rssAvg: 0, rssPeak: 0 };

  const rssValues = samples.map((s) => s.rss);
  return {
    rssMin: formatBytes(Math.min(...rssValues)),
    rssMax: formatBytes(Math.max(...rssValues)),
    rssAvg: formatBytes(rssValues.reduce((a, b) => a + b, 0) / rssValues.length),
    rssPeak: formatBytes(Math.max(...rssValues)),
    samples: samples.length,
  };
}

/**
 * Derive CPU utilization (%) from consecutive tick samples (audit F-L01).
 * pct = (Δticks / USER_HZ) / Δseconds * 100. Reported avg + peak across the window.
 */
export function analyzeCpuSamples(samples, hz = USER_HZ) {
  if (samples.length < 2) return { cpuAvgPct: 0, cpuMaxPct: 0, samples: samples.length };

  const pcts = [];
  for (let i = 1; i < samples.length; i++) {
    const dtSec = (samples[i].timestamp - samples[i - 1].timestamp) / 1000;
    const dTicks = samples[i].cpuTicks - samples[i - 1].cpuTicks;
    if (dtSec > 0 && dTicks >= 0) pcts.push((dTicks / hz / dtSec) * 100);
  }
  if (pcts.length === 0) return { cpuAvgPct: 0, cpuMaxPct: 0, samples: samples.length };

  const avg = pcts.reduce((a, b) => a + b, 0) / pcts.length;
  return {
    cpuAvgPct: Math.round(avg * 10) / 10,
    cpuMaxPct: Math.round(Math.max(...pcts) * 10) / 10,
    samples: samples.length,
  };
}

export function analyzeGcEvents(events) {
  if (events.length === 0) return { count: 0, totalPauseMs: 0, maxPauseMs: 0, avgPauseMs: 0 };

  const pauses = events.map((e) => e.pauseMs);
  return {
    count: events.length,
    totalPauseMs: pauses.reduce((a, b) => a + b, 0).toFixed(2),
    maxPauseMs: Math.max(...pauses).toFixed(2),
    avgPauseMs: (pauses.reduce((a, b) => a + b, 0) / pauses.length).toFixed(2),
    scavenges: events.filter((e) => e.type === 'Scavenge' || e.type === 'MinorGC').length,
    markCompacts: events.filter((e) => e.type === 'Mark-Compact' || e.type === 'MajorGC').length,
  };
}
