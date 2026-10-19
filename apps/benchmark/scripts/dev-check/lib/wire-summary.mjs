// Summary for repeated wire runs.
//
// A single wrk number moves several percent between runs on a shared machine, so
// the stage reports the median and the observed range instead of one sample. The
// row is informational: `wire` measures real listeners, and a slow run is not
// evidence of a code regression the way an in-process ratio is.

export function summarizeWire(runs) {
  if (!Array.isArray(runs) || runs.length === 0) {
    throw new TypeError('summarizeWire requires at least one run');
  }
  const values = runs.map(Number);
  if (values.some((value) => !Number.isFinite(value))) {
    throw new TypeError('summarizeWire runs must be finite numbers');
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  return {
    median,
    min,
    max,
    display: `${String(Math.round(median))} rps (${String(Math.round(min))}–${String(Math.round(max))})`,
  };
}
