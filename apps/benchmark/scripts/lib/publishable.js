/**
 * Publishable-run derivation — computed from what a run actually did, never
 * copied from a profile's static declaration (reconciliation report F-06: a
 * `--profile full` invocation combined with dev-scale overrides previously
 * still stamped `publishable: true` on a 1-run, 1-concurrency-level, 5-second
 * sweep with per-cell socket timeouts).
 */

const MIN_RUNS = 3;
const MIN_CONCURRENCY_LEVELS = 2;
const MIN_DURATION_SECONDS = 10;

/**
 * Highest 1-minute load average a host may carry when a publishable run STARTS.
 *
 * A publishable comparison needs a near-idle machine. Competing work on the same
 * cores inflates run-to-run variance well past the gaps being ranked: on this
 * project's own reference laptop at load average 1.0-3.5, five counterbalanced
 * A/B runs of one unchanged binary with a single Node flag toggled produced
 * apparent effects from -25% to +4.6%, direction reversing (audit F-20). The
 * `quick`/`verify`/`stress` profiles are unconditionally non-publishable already,
 * so this only constrains `standard` and `full`.
 */
const MAX_HOST_LOAD_AVG_AT_START = 1.0;

function parseDurationSeconds(duration) {
  if (typeof duration !== 'string') return 0;
  const match = duration.match(/^([\d.]+)\s*(s|m)?$/);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  return match[2] === 'm' ? value * 60 : value;
}

function countSocketTimeouts(results) {
  let total = 0;
  for (const framework of Object.values(results)) {
    for (const scenario of Object.values(framework.scenarios ?? {})) {
      for (const cell of Object.values(scenario.concurrencyResults ?? {})) {
        for (const run of cell.runs ?? []) {
          total += run.errors?.timeout ?? 0;
        }
      }
    }
  }
  return total;
}

function countMeasuredFrameworks(results) {
  return Object.values(results).filter((framework) => !framework.error).length;
}

/**
 * @param {{ runs: number, connections: number[], duration: string, positionControl?: string }} config
 *   The run's actually-recorded configuration — never the profile's declared
 *   defaults, so an override that shrinks the effective run is caught.
 * @param {Record<string, unknown>} results The run's raw per-framework results.
 * @param {{ diagnosticSaturation?: boolean }} [options]
 *   `diagnosticSaturation: true` is an explicit opt-out for a deliberately
 *   adversarial-load run — it forces non-publishable regardless of the other
 *   criteria, and never masquerades as a publishable comparison.
 * @returns {{ publishable: boolean, reason: string | null }}
 */
export function derivePublishable(config, results, options = {}) {
  if (options.diagnosticSaturation) {
    return { publishable: false, reason: 'diagnostic-saturation run — never publishable by definition' };
  }

  if ((config.runs ?? 0) < MIN_RUNS) {
    return {
      publishable: false,
      reason: `only ${config.runs ?? 0} run(s) recorded — a publishable run needs at least ${MIN_RUNS} to report variance`,
    };
  }

  const levelCount = config.connections?.length ?? 0;
  if (levelCount < MIN_CONCURRENCY_LEVELS) {
    return {
      publishable: false,
      reason: `only ${levelCount} concurrency level(s) recorded — a publishable run needs at least ${MIN_CONCURRENCY_LEVELS}`,
    };
  }

  const durationSeconds = parseDurationSeconds(config.duration);
  if (durationSeconds < MIN_DURATION_SECONDS) {
    return {
      publishable: false,
      reason: `duration ${config.duration} is below the ${MIN_DURATION_SECONDS}s minimum for a publishable run`,
    };
  }

  // A cross-framework ranking requires rotated measurement position — a
  // fixed order was measured to score whichever framework goes first lower,
  // independent of that framework's actual behavior, so a missing or fixed
  // value is never treated as passing by omission.
  const measuredFrameworks = countMeasuredFrameworks(results);
  if (measuredFrameworks > 1 && config.positionControl !== 'rotated') {
    return {
      publishable: false,
      reason:
        `position control was "${config.positionControl ?? 'not recorded'}" — a cross-framework ` +
        'ranking requires rotation (see run.js --rotate)',
    };
  }

  // Rotation only balances position EXACTLY when `runs` is a multiple of the
  // framework count. With 6 frameworks and 3 runs each framework visits only 3 of
  // 6 positions and mean position spreads across 3 slots, so "rotated" alone was
  // never sufficient — the gate previously passed such a run by omission
  // (audit F-22).
  if (measuredFrameworks > 1 && (config.runs ?? 0) % measuredFrameworks !== 0) {
    return {
      publishable: false,
      reason:
        `${config.runs} run(s) across ${measuredFrameworks} frameworks does not balance measurement ` +
        `position (rotation is exact only when runs is a multiple of the framework count) — use ` +
        `--runs ${measuredFrameworks} or a multiple of it`,
    };
  }

  // A publishable comparison needs a near-idle host; competing work inflates
  // variance past the gaps being ranked (audit F-20).
  const loadAvg = config.hostLoadAvgAtStart;
  if (typeof loadAvg === 'number' && loadAvg > MAX_HOST_LOAD_AVG_AT_START) {
    return {
      publishable: false,
      reason:
        `host 1-minute load average was ${loadAvg} at run start, above the ` +
        `${MAX_HOST_LOAD_AVG_AT_START} ceiling for a publishable run — competing work on the same ` +
        'cores inflates run-to-run variance beyond the differences being compared',
    };
  }

  // A starved /proc sampler produces CPU/RSS aggregates that describe the idle
  // gaps between runs rather than the load (audit F-19). Throughput is unaffected,
  // so this is not a hard failure — but a run whose resource figures are invalid
  // must not be stamped publishable while still rendering them.
  const starved = Object.values(results)
    .filter((framework) => framework?.sampleCoverage?.starved)
    .length;
  if (starved > 0) {
    return {
      publishable: false,
      reason:
        `metrics sampling was starved for ${starved} framework(s) — CPU/RSS aggregates describe ` +
        'idle gaps, not load (see analyzeSampleCoverage)',
    };
  }

  const timeouts = countSocketTimeouts(results);
  if (timeouts > 0) {
    return {
      publishable: false,
      reason: `${timeouts} socket timeout(s) recorded across cells — a saturated run is not a fair comparison`,
    };
  }

  return { publishable: true, reason: null };
}

/**
 * Re-derive a stored report's `publishable`/`publishableReason` fields from
 * its own recorded configuration and results, rather than trusting whatever
 * was written at measurement time. Used by report generation/regeneration so
 * a stale or pre-fix artifact self-corrects on every render instead of
 * propagating a wrong flag forever (design.md D1: computed at generation
 * time, never merely asserted). Reports with no configuration/results (e.g.
 * a malformed or partial artifact) are returned unchanged.
 * @param {{ configuration?: object, results?: object }} report
 * @returns {object} The report with `publishable`/`publishableReason` recomputed.
 */
export function withRecomputedPublishable(report) {
  if (!report.configuration || !report.results) return report;
  const outcome = derivePublishable(report.configuration, report.results);
  return { ...report, publishable: outcome.publishable, publishableReason: outcome.reason };
}
