/**
 * Pure statistics helpers — no I/O, unit-tested in __tests__/stats.test.js.
 */

/** Coefficient-of-variation-aware summary stats over an array of numbers. */
export function computeStats(values) {
  if (values.length === 0) return { mean: 0, stddev: 0, min: 0, max: 0, cv: 0, values: [] };

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  // Sample stddev (N-1) for N>1; population (N) for N=1.
  const divisor = values.length > 1 ? values.length - 1 : 1;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / divisor;
  const stddev = Math.sqrt(variance);

  return {
    mean: Math.round(mean * 100) / 100,
    stddev: Math.round(stddev * 100) / 100,
    min: Math.min(...values),
    max: Math.max(...values),
    cv: mean > 0 ? Math.round((stddev / mean) * 100 * 100) / 100 : 0,
    values,
  };
}

/**
 * A run is invalid when a success scenario (expectStatus < 400) returned any
 * non-2xx/3xx response. Error scenarios (expectStatus >= 400) are never invalid
 * on non-2xx — that IS their expected outcome (audit F-H01).
 */
export function isInvalidRun(scenario, result) {
  if (scenario.expectStatus && scenario.expectStatus >= 400) return false;
  return (result.errors?.nonOk || 0) > 0;
}

/**
 * Partition runs into valid/invalid for a scenario. Invalid runs are EXCLUDED
 * from the published mean so fast-erroring requests never inflate RPS (F-H01).
 */
export function filterValidRuns(scenario, runResults) {
  const valid = runResults.filter((r) => !isInvalidRun(scenario, r));
  return {
    valid,
    anyInvalid: valid.length < runResults.length,
    allInvalid: runResults.length > 0 && valid.length === 0,
  };
}

const median = (nums) => {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/**
 * Parse a latency string (wrk uses us/ms/s, autocannon uses ms) into milliseconds.
 * Returns null for unparseable input.
 */
export function parseLatencyToMs(str) {
  if (typeof str !== 'string') return null;
  const m = str.match(/^([\d.]+)\s*(us|µs|ms|s|m)?$/);
  if (!m) return null;
  const v = parseFloat(m[1]);
  if (Number.isNaN(v)) return null;
  switch (m[2]) {
    case 'us':
    case 'µs':
      return v / 1000;
    case 's':
      return v * 1000;
    case 'm':
      return v * 60000;
    default:
      return v; // 'ms' or unitless
  }
}

const formatMs = (n) => `${(Math.round(n * 100) / 100).toFixed(2)}ms`;

/**
 * Aggregate latency across runs by taking the median of each percentile — so a
 * multi-run report shows representative latency, not just the first run (F-M04).
 */
export function aggregateLatency(runs) {
  const collect = (key) =>
    runs.map((r) => parseLatencyToMs(r?.latency?.[key])).filter((n) => n !== null);
  const p50 = collect('p50');
  const p99 = collect('p99');
  return {
    p50: p50.length ? formatMs(median(p50)) : 'N/A',
    p99: p99.length ? formatMs(median(p99)) : 'N/A',
  };
}
