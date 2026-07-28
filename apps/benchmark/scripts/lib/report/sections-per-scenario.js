/** Per-scenario podium tables, charts, and the cross-scenario latency view. */

import {
  LINE_PALETTE,
  concurrencyScalingChart,
  latencyChart,
  scenarioRpsChart,
  throughputLatencyQuadrant,
} from './charts.js';
import { delta, fairnessTag, int, medal, rps, table } from './format.js';

/**
 * Text-table legend for `concurrencyScalingChart`, in the palette's own order.
 *
 * The chart intentionally contains no in-plot framework labels: labels collide
 * when series converge and clip at the plot boundary. This table is the
 * guaranteed-visible mapping from color to framework, including viewers that
 * do not render Mermaid.
 */
function scalingLegend(scoreboard, scenarioId) {
  const series = scoreboard.frameworks.filter((fw) =>
    scoreboard.connections.some((conn) => scoreboard.cells[fw.id]?.[scenarioId]?.[conn])
  );
  return table(
    ['Line color', 'Framework'],
    series.map((fw, i) => [LINE_PALETTE[i % LINE_PALETTE.length], fw.name])
  );
}

function scenarioMatrix(scoreboard, scenario, singleRun) {
  const header = ['Framework', ...scoreboard.connections.map((c) => `${c}c — RPS`), 'Non-2xx'];

  const rows = scoreboard.frameworks.map((fw) => {
    const cells = scoreboard.connections.map((conn) => {
      const cell = scoreboard.cells[fw.id][scenario.id][conn];
      const ranked = scoreboard.rankings[scenario.id][conn]?.find((r) => r.fwId === fw.id);
      return `${rps(cell, singleRun)}${ranked?.rank === 1 ? ' 🥇' : ''}${cell?.invalid ? ' ⚠️' : ''}`;
    });
    const nonOk = scoreboard.connections.reduce(
      (n, conn) => n + (scoreboard.cells[fw.id][scenario.id][conn]?.nonOk || 0),
      0
    );
    return [fw.name, ...cells, int(nonOk)];
  });

  return table(header, rows);
}

function podium(scoreboard, scenario, singleRun) {
  const ranked = scoreboard.rankings[scenario.id][scoreboard.primaryConnection];
  const overhead = scoreboard.overhead[scenario.id][scoreboard.primaryConnection];

  return table(
    ['Rank', 'Framework', 'RPS', 'CV%', 'p50', 'p99', 'vs Raw Node.js', 'Pts'],
    ranked.map((entry) => [
      `${medal(entry.rank)}${entry.withinNoiseOfNext ? ' ≈' : ''}`,
      entry.fwId === scoreboard.baselineId ? `${entry.name} *(baseline)*` : entry.name,
      rps(entry, singleRun),
      `${entry.cv}%`,
      entry.p50,
      entry.p99,
      delta(overhead[entry.fwId]),
      entry.points,
    ])
  );
}

export function perScenarioSections(scoreboard, { singleRun }) {
  const ranked = scoreboard.frameworks.length > 1;
  const lines = [ranked ? '## Per-scenario rankings' : '## Per-scenario results', ''];
  lines.push(
    ranked
      ? `Ranked at **${scoreboard.primaryConnection} connections** — the throughput regime. ` +
          'Every concurrency level is in the collapsed matrix under each scenario.'
      : `Headline figures are at **${scoreboard.primaryConnection} connections**; every ` +
          'concurrency level is in the collapsed matrix under each scenario.'
  );
  lines.push('');

  scoreboard.scenarios.forEach((scenario, index) => {
    lines.push(
      `### ${index + 1}. ${scenario.name} — \`${scenario.id}\` · ${fairnessTag(scenario.identicalWork)}`
    );
    lines.push('');
    if (scenario.description) {
      lines.push(`_${scenario.description}_`);
      lines.push('');
    }

    if ((scoreboard.rankings[scenario.id][scoreboard.primaryConnection] || []).length === 0) {
      lines.push('No data for this scenario in this run.');
      lines.push('');
      return;
    }

    lines.push(...podium(scoreboard, scenario, singleRun));
    lines.push('');

    const chart = scenarioRpsChart(scoreboard, scenario.id, scoreboard.primaryConnection);
    if (chart) {
      lines.push(chart, '');
    }

    lines.push('<details>');
    lines.push(`<summary>All concurrency levels — ${scenario.name}</summary>`);
    lines.push('');
    lines.push(...scenarioMatrix(scoreboard, scenario, singleRun));
    lines.push('');
    const scaling = concurrencyScalingChart(scoreboard, scenario.id);
    if (scaling) {
      lines.push(scaling, '', ...scalingLegend(scoreboard, scenario.id), '');
    }
    lines.push('</details>');
    lines.push('');
  });

  return lines;
}

export function latencySection(scoreboard) {
  const conn = scoreboard.primaryConnection;
  const lines = [`## Latency @ ${conn} connections`, ''];

  lines.push(
    ...table(
      ['Framework (p99)', ...scoreboard.scenarios.map((s) => s.name)],
      scoreboard.frameworks.map((fw) => [
        fw.name,
        ...scoreboard.scenarios.map((s) => scoreboard.cells[fw.id][s.id][conn]?.p99 || '—'),
      ])
    )
  );
  lines.push('');

  const chart = latencyChart(scoreboard, scoreboard.scenarios[0]?.id, conn);
  if (chart) {
    lines.push(chart, '');
  }

  const quadrant = throughputLatencyQuadrant(scoreboard, scoreboard.scenarios[0]?.id, conn);
  if (quadrant) {
    lines.push('### Throughput against latency', '');
    lines.push(
      'Positions are relative to the frameworks in this run — the axes are normalized to the ' +
        "run's own minimum and maximum, so a point moving between runs means the field changed, " +
        'not that absolute performance did.'
    );
    lines.push('', quadrant, '');
  }
  return lines;
}
