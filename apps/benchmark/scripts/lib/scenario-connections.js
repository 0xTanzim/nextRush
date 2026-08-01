/**
 * Per-scenario concurrency ceiling.
 *
 * A scenario carrying an MB-scale request body queues past wrk's 2s default
 * socket timeout long before a profile's top concurrency level is reached
 * (measured: 17-25 timeouts in 5s at 64 connections on every framework), and a
 * single socket timeout makes the entire run non-publishable via
 * `derivePublishable`. Capping the level for that scenario alone keeps the gate
 * satisfiable without weakening it, instead of failing every publishable run
 * for a reason unrelated to framework behaviour.
 */

/**
 * @param {{ maxConnections?: number }} scenario
 * @param {number[]} connections The profile's declared connection ladder.
 * @returns {number[]} Levels this scenario may be measured at.
 */
export function connectionsForScenario(scenario, connections) {
  const cap = scenario?.maxConnections;
  if (typeof cap !== 'number' || !Number.isFinite(cap)) return [...connections];

  const allowed = connections.filter((level) => level <= cap);
  // Never return an empty ladder: a scenario whose cap excludes every declared
  // level is still measured at the lowest one, so the cell exists and is
  // visibly attributable rather than silently missing from the report.
  return allowed.length > 0 ? allowed : [Math.min(...connections)];
}

/**
 * Warmup concurrency for a scenario — the same ceiling applies, so warming a
 * capped scenario cannot itself saturate the server it is about to measure.
 *
 * @param {{ maxConnections?: number }} scenario
 * @param {number} defaultConnections
 * @returns {number}
 */
export function warmupConnectionsForScenario(scenario, defaultConnections) {
  const cap = scenario?.maxConnections;
  if (typeof cap !== 'number' || !Number.isFinite(cap)) return defaultConnections;
  return Math.min(defaultConnections, cap);
}
