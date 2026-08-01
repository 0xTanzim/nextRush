/**
 * Generic allocation-regression comparator — recursively walks two allocation
 * harness result objects and flags any leaf `{ mean, cv }` metric whose
 * `mean` increased beyond `tolerance` versus the baseline (design.md: the
 * tight allocation gate, `cv≈0`, so any real increase is signal, not noise —
 * unlike the loose throughput gate this deliberately tolerates near-zero
 * drift). Generic over shape so one comparator serves every `*-alloc.js`
 * harness's own result structure (`{ lazy, eager }`, `{ variants: {...} }`,
 * etc.) without a per-harness schema.
 */

function isMetricLeaf(value) {
  return value !== null && typeof value === 'object' && typeof value.mean === 'number';
}

/**
 * @param {object} baseline
 * @param {object} latest
 * @param {{ tolerance: number }} options Fractional tolerance (0.05 = 5%).
 * @returns {string[]} Human-readable regressions, empty when none found.
 */
export function findAllocRegressions(baseline, latest, { tolerance }) {
  const regressions = [];

  function walk(base, curr, path) {
    if (isMetricLeaf(base) && isMetricLeaf(curr)) {
      const increase = base.mean > 0 ? (curr.mean - base.mean) / base.mean : 0;
      if (increase > tolerance) {
        regressions.push(
          `${path}: ${base.mean} → ${curr.mean} B/op (+${(increase * 100).toFixed(1)}%, tolerance ${(tolerance * 100).toFixed(0)}%)`
        );
      }
      return;
    }

    if (typeof base !== 'object' || base === null || typeof curr !== 'object' || curr === null) return;

    for (const key of Object.keys(base)) {
      if (!(key in curr)) continue; // present only on one side — not a regression signal
      walk(base[key], curr[key], path ? `${path}.${key}` : key);
    }
  }

  walk(baseline, latest, '');
  return regressions;
}
