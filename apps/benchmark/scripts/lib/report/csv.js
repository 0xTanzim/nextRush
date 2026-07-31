/**
 * Flat CSV export of a scoreboard — one row per framework/scenario/connection,
 * so a run can be loaded into a spreadsheet or a plotting tool without anyone
 * re-deriving ranks and points from the nested JSON.
 */

const COLUMNS = [
  'run_id',
  'profile',
  'tool',
  'framework_id',
  'framework',
  'scenario_id',
  'scenario',
  'identical_work',
  'connections',
  'rps_mean',
  'rps_stddev',
  'cv_pct',
  'latency_p50',
  'latency_p99',
  'non_2xx',
  'valid_runs',
  'rank',
  'points',
];

function escapeField(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(scoreboard) {
  const rows = [COLUMNS.join(',')];

  for (const fw of scoreboard.frameworks) {
    for (const scenario of scoreboard.scenarios) {
      for (const conn of scoreboard.connections) {
        const cell = scoreboard.cells[fw.id]?.[scenario.id]?.[conn];
        if (!cell) continue;
        const ranked = scoreboard.rankings[scenario.id]?.[conn]?.find((r) => r.fwId === fw.id);

        rows.push(
          [
            scoreboard.runId,
            scoreboard.profile,
            scoreboard.tool,
            fw.id,
            fw.name,
            scenario.id,
            scenario.name,
            scenario.identicalOutput,
            conn,
            Math.round(cell.rps * 100) / 100,
            Math.round(cell.stddev * 100) / 100,
            cell.cv,
            cell.p50,
            cell.p99,
            cell.nonOk,
            cell.validRuns,
            ranked?.rank ?? '',
            ranked?.points ?? '',
          ]
            .map(escapeField)
            .join(',')
        );
      }
    }
  }

  return `${rows.join('\n')}\n`;
}
