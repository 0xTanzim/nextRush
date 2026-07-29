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
  if (countMeasuredFrameworks(results) > 1 && config.positionControl !== 'rotated') {
    return {
      publishable: false,
      reason:
        `position control was "${config.positionControl ?? 'not recorded'}" — a cross-framework ` +
        'ranking requires rotation (see run.js --rotate)',
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
