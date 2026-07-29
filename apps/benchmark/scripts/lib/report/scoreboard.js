/**
 * Pure aggregation over a persisted benchmark report (`results.json`).
 *
 * A benchmark run is expensive (hours) while a report is cheap, so every view
 * the repo publishes is derived from the stored JSON — this module is the single
 * place that decides what "ranked" and "overall score" mean, and it performs no
 * I/O so it stays unit-testable.
 *
 * Fairness contract: `identicalWork: false` scenarios (middleware-stack,
 * error-handling) measure each framework's own idiomatic mechanism, so they are
 * scored separately from the like-for-like headline score rather than blended in.
 */

import { SCENARIOS, getScenario } from '../../../config/scenarios.js';

/** Points awarded to the slowest framework in a scenario; each rank above adds one. */
export const POINTS_FOR_LAST_PLACE = 1;

const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Rank RPS entries fastest-first and award `count..1` points.
 *
 * Exact ties share a rank and its points, and the next distinct value resumes at
 * its positional rank (standard competition ranking). `withinNoiseOfNext` marks a
 * gap narrower than the two entries' combined stddev — reported so a reader can
 * see which orderings are not statistically meaningful; it never alters points.
 */
export function rankEntries(entries) {
  const sorted = [...entries].sort((a, b) => b.rps - a.rps);
  const count = sorted.length;

  return sorted.map((entry, index) => {
    const prev = sorted[index - 1];
    const next = sorted[index + 1];
    const rank = prev && prev.rps === entry.rps ? prev.__rank : index + 1;
    entry.__rank = rank;

    return {
      ...entry,
      rank,
      points: count - (rank - 1),
      withinNoiseOfNext: next
        ? entry.rps - next.rps < (entry.stddev || 0) + (next.stddev || 0)
        : false,
    };
  });
}

function readCell(fwResult, scenarioId, conn) {
  const result = fwResult.scenarios?.[scenarioId]?.concurrencyResults?.[conn];
  if (!result || typeof result.stats?.mean !== 'number') return null;

  const runs = result.runs || [];
  return {
    rps: result.stats.mean,
    stddev: result.stats.stddev || 0,
    cv: result.stats.cv || 0,
    p50: result.latency?.p50 || runs[0]?.latency?.p50 || 'N/A',
    p99: result.latency?.p99 || runs[0]?.latency?.p99 || 'N/A',
    nonOk: runs.reduce((n, r) => n + (r.errors?.nonOk || 0), 0),
    validRuns: result.validRuns ?? runs.length,
    invalid: Boolean(result.invalid),
  };
}

function collectFrameworks(report) {
  const ok = [];
  const failed = [];

  for (const [id, fw] of Object.entries(report.results || {})) {
    if (fw.error) {
      failed.push({ id, name: fw.framework || id, error: fw.error });
      continue;
    }
    ok.push({
      id,
      name: fw.framework || id,
      memory: fw.memory || null,
      cpu: fw.cpu || null,
      gc: fw.gc || null,
    });
  }
  return { frameworks: ok, failed };
}

function collectConnections(report, frameworks) {
  const declared = report.configuration?.connections;
  if (Array.isArray(declared) && declared.length > 0) return [...declared];

  const seen = new Set();
  for (const fw of frameworks) {
    for (const scenario of Object.values(report.results[fw.id].scenarios || {})) {
      for (const conn of Object.keys(scenario.concurrencyResults || {})) seen.add(Number(conn));
    }
  }
  return [...seen].sort((a, b) => a - b);
}

function collectScenarios(report, frameworks) {
  const ids = report.configuration?.scenarios?.length
    ? report.configuration.scenarios
    : [...new Set(frameworks.flatMap((fw) => Object.keys(report.results[fw.id].scenarios || {})))];

  return ids.map((id) => {
    const config = getScenario(id);
    const observed = frameworks
      .map((fw) => report.results[fw.id].scenarios?.[id]?.scenario)
      .find(Boolean);
    return {
      id,
      name: config?.name || observed || id,
      category: config?.category || 'unknown',
      description: config?.description || '',
      // Unknown scenarios are treated as not-comparable rather than silently
      // promoted into the headline like-for-like score.
      identicalWork: config?.identicalWork === true,
      order: SCENARIOS.findIndex((s) => s.id === id),
    };
  });
}

function sumPoints(rankings, scenarioIds, connections) {
  const totals = new Map();
  const wins = new Map();
  const ranks = new Map();

  for (const scenarioId of scenarioIds) {
    for (const conn of connections) {
      for (const entry of rankings[scenarioId]?.[conn] || []) {
        totals.set(entry.fwId, (totals.get(entry.fwId) || 0) + entry.points);
        if (entry.rank === 1) wins.set(entry.fwId, (wins.get(entry.fwId) || 0) + 1);
        const seen = ranks.get(entry.fwId) || [];
        seen.push(entry.rank);
        ranks.set(entry.fwId, seen);
      }
    }
  }
  return { totals, wins, ranks };
}

function buildOverall(rankings, scenarioIds, connections, frameworks) {
  const { totals, wins, ranks } = sumPoints(rankings, scenarioIds, connections);

  const rows = frameworks
    .filter((fw) => totals.has(fw.id))
    .map((fw) => {
      const seen = ranks.get(fw.id) || [];
      return {
        fwId: fw.id,
        name: fw.name,
        points: totals.get(fw.id) || 0,
        wins: wins.get(fw.id) || 0,
        avgRank: seen.length ? round1(seen.reduce((a, b) => a + b, 0) / seen.length) : null,
        measurements: seen.length,
      };
    })
    .sort((a, b) => b.points - a.points || b.wins - a.wins || a.avgRank - b.avgRank);

  rows.forEach((row, index) => {
    const prev = rows[index - 1];
    row.rank = prev && prev.points === row.points ? prev.rank : index + 1;
  });

  return {
    rows,
    maxPoints: scenarioIds.length * connections.length * frameworks.length,
    scenarioCount: scenarioIds.length,
    connectionCount: connections.length,
  };
}

/**
 * Derive every ranking view from one persisted report.
 *
 * @param {object} report Parsed `results.json`.
 * @param {{ rankAt?: number }} [options] `rankAt` picks the headline concurrency
 *   level; it defaults to the highest level in the run (the throughput regime)
 *   rather than the first, which is usually a single-connection latency probe.
 */
export function buildScoreboard(report, options = {}) {
  const { frameworks, failed } = collectFrameworks(report);
  const connections = collectConnections(report, frameworks);
  const scenarios = collectScenarios(report, frameworks);

  const requested = options.rankAt != null ? Number(options.rankAt) : null;
  const primaryConnection =
    requested != null && connections.includes(requested)
      ? requested
      : connections[connections.length - 1];

  const cells = {};
  for (const fw of frameworks) {
    cells[fw.id] = {};
    for (const scenario of scenarios) {
      cells[fw.id][scenario.id] = {};
      for (const conn of connections) {
        cells[fw.id][scenario.id][conn] = readCell(report.results[fw.id], scenario.id, conn);
      }
    }
  }

  const rankings = {};
  for (const scenario of scenarios) {
    rankings[scenario.id] = {};
    for (const conn of connections) {
      const entries = frameworks
        .map((fw) => {
          const cell = cells[fw.id][scenario.id][conn];
          return cell ? { fwId: fw.id, name: fw.name, ...cell } : null;
        })
        .filter(Boolean);
      rankings[scenario.id][conn] = rankEntries(entries);
    }
  }

  const winners = {};
  for (const scenario of scenarios) {
    const top = rankings[scenario.id][primaryConnection]?.[0];
    if (top) winners[scenario.id] = { ...top, connection: primaryConnection };
  }

  const baseline = frameworks.find((fw) => fw.id === 'raw-node');
  const overhead = {};
  for (const scenario of scenarios) {
    overhead[scenario.id] = {};
    for (const conn of connections) {
      const baseRps = baseline ? cells[baseline.id][scenario.id][conn]?.rps : null;
      const perFramework = {};
      for (const fw of frameworks) {
        const cell = cells[fw.id][scenario.id][conn];
        perFramework[fw.id] =
          cell && baseRps > 0 ? round1((1 - cell.rps / baseRps) * 100) : null;
      }
      overhead[scenario.id][conn] = perFramework;
    }
  }

  const likeForLikeScenarioIds = scenarios.filter((s) => s.identicalWork).map((s) => s.id);
  const allScenarioIds = scenarios.map((s) => s.id);

  return {
    runId: report.runId,
    timestamp: report.timestamp,
    profile: report.profile,
    publishable: Boolean(report.publishable),
    git: report.git || { commit: null, dirty: null },
    tool: report.tool,
    system: report.system || {},
    configuration: report.configuration || {},
    frameworks,
    failed,
    baselineId: baseline?.id || null,
    connections,
    primaryConnection,
    scenarios,
    likeForLikeScenarioIds,
    cells,
    rankings,
    winners,
    overhead,
    pointsPerConnection: Object.fromEntries(
      connections.map((conn) => [
        conn,
        buildOverall(rankings, likeForLikeScenarioIds, [conn], frameworks),
      ])
    ),
    overall: {
      likeForLike: buildOverall(rankings, likeForLikeScenarioIds, connections, frameworks),
      all: buildOverall(rankings, allScenarioIds, connections, frameworks),
    },
  };
}
