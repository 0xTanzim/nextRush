/**
 * Markdown report composition.
 *
 * A benchmark run costs hours; a report costs milliseconds. `results.json` is the
 * source of truth and every artifact here is a pure derivation of it, so any view
 * can be regenerated or added without re-measuring (`scripts/generate-report.js`).
 */

import { getScenario } from '../config/scenarios.js';
import { log, logHeader } from './utils.js';
import { toCsv } from './lib/report/csv.js';
import { buildReadmeTables } from './lib/report/readme-tables.js';
import { buildScoreboard } from './lib/report/scoreboard.js';
import {
  efficiencySection,
  headerSection,
  methodologySection,
  rawResultsSection,
  resourcesSection,
} from './lib/report/sections-detail.js';
import {
  frameworksSection,
  loadConfigurationSection,
  scenariosSection,
  singleFrameworkNotice,
  systemSection,
} from './lib/report/sections-metadata.js';
import {
  latencySection,
  perScenarioSections,
} from './lib/report/sections-per-scenario.js';
import { scoreboardSection } from './lib/report/sections-scoreboard.js';
import { winnersSection } from './lib/report/sections-winners.js';

/**
 * Render the full Markdown report for a persisted run.
 *
 * @param {object} report Parsed `results.json`.
 * @param {{ rankAt?: number, frameworkVersions?: Record<string,string>,
 *   versionSource?: string }} [options] `rankAt` picks the headline concurrency
 *   level (default: the highest in the run). `frameworkVersions`/`versionSource`
 *   are passed in rather than read from disk so the report never implies the
 *   current environment was the measured one.
 */
export function generateMarkdownReport(report, options = {}) {
  const scoreboard = buildScoreboard(report, options);
  const context = { singleRun: (report.configuration?.runs ?? 1) < 2 };
  const ranked = scoreboard.frameworks.length > 1;

  const lines = [
    ...headerSection(scoreboard),
    ...systemSection(scoreboard),
    ...loadConfigurationSection(scoreboard),
    ...frameworksSection(scoreboard, options),
    ...scenariosSection(scoreboard),
    ...(ranked ? scoreboardSection(scoreboard) : singleFrameworkNotice(scoreboard)),
    ...(ranked ? winnersSection(scoreboard) : []),
    ...perScenarioSections(scoreboard, context),
    ...latencySection(scoreboard),
    ...resourcesSection(scoreboard),
    ...efficiencySection(scoreboard),
    ...rawResultsSection(scoreboard, context),
    ...methodologySection(scoreboard, context),
  ];

  return lines.join('\n');
}

/**
 * Every artifact derivable from one run, keyed by filename.
 *
 * @returns {Record<string, string>} filename → file contents.
 */
export function generateArtifacts(report, options = {}) {
  const scoreboard = buildScoreboard(report, options);

  return {
    'REPORT.md': generateMarkdownReport(report, options),
    'README-TABLES.md': buildReadmeTables(scoreboard),
    'results.csv': toCsv(scoreboard),
    'scoreboard.json': `${JSON.stringify(toScoreboardJson(scoreboard), null, 2)}\n`,
  };
}

/** Machine-readable ranking summary — the input for CI gates and trend charts. */
function toScoreboardJson(scoreboard) {
  return {
    runId: scoreboard.runId,
    timestamp: scoreboard.timestamp,
    profile: scoreboard.profile,
    publishable: scoreboard.publishable,
    tool: scoreboard.tool,
    primaryConnection: scoreboard.primaryConnection,
    connections: scoreboard.connections,
    frameworks: scoreboard.frameworks.map((f) => ({ id: f.id, name: f.name })),
    likeForLikeScenarioIds: scoreboard.likeForLikeScenarioIds,
    overall: scoreboard.overall,
    pointsPerConnection: scoreboard.pointsPerConnection,
    winners: Object.fromEntries(
      Object.entries(scoreboard.winners).map(([scenarioId, winner]) => [
        scenarioId,
        { fwId: winner.fwId, name: winner.name, rps: winner.rps, connection: winner.connection },
      ])
    ),
    rankings: scoreboard.rankings,
    system: scoreboard.system,
  };
}

export function printSummaryTable(allResults) {
  logHeader('Summary');
  for (const [fwId, fw] of Object.entries(allResults)) {
    if (fw.error) {
      log(`  ${(fw.framework || fwId).padEnd(20)} ERROR: ${fw.error}`);
      continue;
    }
    const scenario = fw.scenarios['hello-world'] || fw.scenarios[Object.keys(fw.scenarios)[0]];
    if (!scenario) continue;

    const levels = Object.keys(scenario.concurrencyResults);
    const highest = levels[levels.length - 1];
    const result = scenario.concurrencyResults[highest];
    if (!result) continue;

    const rps = Math.round(result.stats.mean).toLocaleString('en-US');
    log(
      `  ${fw.framework.padEnd(20)} ${rps.padStart(10)} RPS @${highest}c    ` +
        `Memory: ${fw.memory?.rssPeak || 'N/A'}`
    );
  }
}

export { getScenario };
