/**
 * Mermaid chart builders for benchmark reports (mermaid 11 — xychart-beta and
 * radar-beta both render on GitHub and the docs site).
 *
 * Pure string builders: no I/O, no scoreboard mutation. Every builder returns ''
 * when the requested slice has no data, so a caller can concatenate freely
 * without guarding each call.
 *
 * Mermaid's parser has no escape sequence for a double quote inside a quoted
 * label, so labels normalize `"` to `'` rather than emitting unparseable output.
 */

import { parseLatencyToMs } from '../stats.js';

const FENCE_OPEN = '```mermaid';
const FENCE_CLOSE = '```';

const label = (text) => `"${String(text).replace(/"/g, "'")}"`;
const identifier = (text) => String(text).replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
const headroom = (max) => Math.ceil((max * 1.1) / 10) * 10 || 1;
const fence = (body) => `${FENCE_OPEN}\n${body.join('\n')}\n${FENCE_CLOSE}`;

function rankedCells(scoreboard, scenarioId, connection) {
  return scoreboard.rankings[scenarioId]?.[connection] || [];
}

/** Horizontal RPS bars for one scenario at one concurrency level, fastest first. */
export function scenarioRpsChart(scoreboard, scenarioId, connection) {
  const ranked = rankedCells(scoreboard, scenarioId, connection);
  if (ranked.length === 0) return '';

  const scenario = scoreboard.scenarios.find((s) => s.id === scenarioId);
  const values = ranked.map((r) => Math.round(r.rps));

  return fence([
    '---',
    'config:',
    '  xyChart:',
    '    showDataLabel: true',
    '    width: 900',
    '---',
    'xychart-beta horizontal',
    `    title ${label(`${scenario?.name || scenarioId} — RPS @ ${connection} connections`)}`,
    `    x-axis [${ranked.map((r) => label(r.name)).join(', ')}]`,
    `    y-axis ${label('Requests/sec')} 0 --> ${headroom(Math.max(...values))}`,
    `    bar [${values.join(', ')}]`,
  ]);
}

/** Horizontal p99 latency bars for one scenario, lowest (best) first. */
export function latencyChart(scoreboard, scenarioId, connection) {
  const entries = rankedCells(scoreboard, scenarioId, connection)
    .map((r) => ({ name: r.name, ms: parseLatencyToMs(r.p99) }))
    .filter((e) => e.ms !== null)
    .sort((a, b) => a.ms - b.ms);
  if (entries.length === 0) return '';

  const scenario = scoreboard.scenarios.find((s) => s.id === scenarioId);

  return fence([
    '---',
    'config:',
    '  xyChart:',
    '    showDataLabel: true',
    '    width: 900',
    '---',
    'xychart-beta horizontal',
    `    title ${label(`${scenario?.name || scenarioId} — p99 latency @ ${connection} connections`)}`,
    `    x-axis [${entries.map((e) => label(e.name)).join(', ')}]`,
    `    y-axis ${label('p99 latency (ms) — lower is better')} 0 --> ${headroom(entries[entries.length - 1].ms)}`,
    `    bar [${entries.map((e) => Math.round(e.ms * 100) / 100).join(', ')}]`,
  ]);
}

/**
 * A fixed, colorblind-distinguishable palette (Okabe-Ito) so up to 8 lines stay
 * visually distinct — mermaid's default theme palette repeats/blends past 3-4
 * series (observed: framework 1 and 4, and 2 and 5, rendered as nearly the same
 * hue in this run's 6-line chart).
 */
export const LINE_PALETTE = [
  '#E69F00',
  '#56B4E9',
  '#009E73',
  '#D55E00',
  '#CC79A7',
  '#0072B2',
  '#F0E442',
  '#000000',
];

/** One line per framework showing how RPS scales across concurrency levels. */
export function concurrencyScalingChart(scoreboard, scenarioId) {
  const { connections, frameworks } = scoreboard;
  const series = frameworks
    .map((fw) => ({
      name: fw.name,
      values: connections.map((conn) => scoreboard.cells[fw.id]?.[scenarioId]?.[conn]?.rps ?? null),
    }))
    .filter((s) => s.values.some((v) => v !== null));
  if (series.length === 0 || connections.length < 2) return '';

  const scenario = scoreboard.scenarios.find((s) => s.id === scenarioId);
  const peak = Math.max(...series.flatMap((s) => s.values.filter((v) => v !== null)));
  const palette = LINE_PALETTE.slice(0, series.length).join(', ');

  const omittedCells = [];
  for (const s of series) {
    for (let i = 0; i < connections.length; i++) {
      if (s.values[i] === null) {
        omittedCells.push(`${s.name} @ ${connections[i]}c`);
      }
    }
  }

  const chart = fence([
    '---',
    'config:',
    '  xyChart:',
    '    width: 900',
    '  themeVariables:',
    '    xyChart:',
    `      plotColorPalette: '${palette}'`,
    '---',
    'xychart-beta',
    `    title ${label(`${scenario?.name || scenarioId} — concurrency scaling`)}`,
    `    x-axis ${label('Concurrent connections')} [${connections.map((c) => label(c)).join(', ')}]`,
    `    y-axis ${label('Requests/sec')} 0 --> ${headroom(peak)}`,
    // Mermaid's line-end labels collide when series converge and clip at the
    // plot boundary. Keep attribution in the stable legend table emitted next
    // to the chart instead of placing text inside the data area.
    ...series.map((s) => {
      const points = s.values.filter((v) => v !== null).map((v) => Math.round(v));
      return `    line [${points.join(', ')}]`;
    }),
  ]);

  if (omittedCells.length === 0) return chart;

  const caption =
    omittedCells.length === 1
      ? `\n> **Note:** ${omittedCells[0]} had no valid measurement and would have rendered as zero.\n`
      : `\n> **Note:** The following cells had no valid measurement and would have rendered as zero: ${omittedCells.join(', ')}.\n`;
  return `${chart}${caption}`;
}

/**
 * Multi-dimensional shape comparison: each like-for-like scenario is one axis,
 * normalized to percent of that scenario's fastest framework, so a framework's
 * strengths and weaknesses read at a glance instead of as ten separate tables.
 */
export function scenarioProfileRadar(scoreboard, connection = scoreboard.primaryConnection) {
  const axes = scoreboard.scenarios.filter(
    (s) => s.identicalWork && rankedCells(scoreboard, s.id, connection).length > 0
  );
  if (axes.length === 0) return '';

  const best = new Map(
    axes.map((s) => [s.id, rankedCells(scoreboard, s.id, connection)[0].rps])
  );

  const omittedCells = [];
  const curves = scoreboard.frameworks
    .map((fw) => {
      const values = axes.map((s) => {
        const rps = scoreboard.cells[fw.id]?.[s.id]?.[connection]?.rps;
        const top = best.get(s.id);
        return rps && top ? Math.round((rps / top) * 100) : null;
      });
      const filtered = values.filter((v) => v !== null);
      if (filtered.length < values.length) {
        axes.forEach((s, i) => {
          if (values[i] === null) omittedCells.push(`${fw.name} / ${s.name}`);
        });
      }
      return { fw, values: filtered };
    })
    .filter((c) => c.values.length > 0);

  if (curves.length === 0) return '';

  const caption = omittedCells.length
    ? `> **Note:** Omitted from radar profile — ${[...new Set(omittedCells)].join(', ')}. ${omittedCells.length === 1 ? 'This cell' : 'These cells'} had no valid measurement and would have rendered as zero.`
    : null;

  return [
    ...fence([
      '---',
      'config:',
      '  radar:',
      '    width: 700',
      '    height: 700',
      '---',
      'radar-beta',
      `    title ${label(`Scenario profile @ ${connection} connections (% of scenario best)`)}`,
      ...axes.map((s) => `    axis ${identifier(s.id)}[${label(s.name)}]`),
      ...curves.map(
        (c) => `    curve ${identifier(c.fw.id)}[${label(c.fw.name)}]{${c.values.join(', ')}}`
      ),
      '    graticule polygon',
      '    max 100',
      '    min 0',
    ]),
    caption ? `\n${caption}\n` : '',
  ].join('');
}

/** Overall like-for-like points total per framework. */
export function overallPointsChart(scoreboard) {
  const rows = scoreboard.overall.likeForLike.rows;
  if (rows.length === 0) return '';

  return fence([
    '---',
    'config:',
    '  xyChart:',
    '    showDataLabel: true',
    '    width: 900',
    '---',
    'xychart-beta horizontal',
    `    title ${label(`Overall score — ${scoreboard.overall.likeForLike.scenarioCount} like-for-like scenarios x ${scoreboard.overall.likeForLike.connectionCount} concurrency levels`)}`,
    `    x-axis [${rows.map((r) => label(r.name)).join(', ')}]`,
    `    y-axis ${label('Points')} 0 --> ${scoreboard.overall.likeForLike.maxPoints}`,
    `    bar [${rows.map((r) => r.points).join(', ')}]`,
  ]);
}

/**
 * Throughput against p99 latency at one concurrency level.
 *
 * A framework can buy throughput with latency (deeper queueing) or the reverse,
 * and a bar chart of either metric alone hides that trade. Both axes are
 * normalized to the run's own min/max because quadrant coordinates must be 0..1 —
 * so positions are relative to the frameworks in this run, not absolute.
 */
export function throughputLatencyQuadrant(scoreboard, scenarioId, connection) {
  const points = rankedCells(scoreboard, scenarioId, connection)
    .map((entry) => ({ name: entry.name, rps: entry.rps, ms: parseLatencyToMs(entry.p99) }))
    .filter((p) => p.ms !== null);
  if (points.length < 2) return '';

  const scenario = scoreboard.scenarios.find((s) => s.id === scenarioId);
  const span = (values) => {
    const min = Math.min(...values);
    const max = Math.max(...values);
    return { min, range: max - min };
  };
  const throughput = span(points.map((p) => p.rps));
  const latency = span(points.map((p) => p.ms));
  const place = (value, { min, range }, invert) => {
    if (range === 0) return 0.5;
    const scaled = (value - min) / range;
    return Math.round((0.1 + 0.8 * (invert ? 1 - scaled : scaled)) * 100) / 100;
  };

  return fence([
    'quadrantChart',
    `    title ${scenario?.name || scenarioId} — throughput vs p99 latency @ ${connection} connections`,
    '    x-axis Lower throughput --> Higher throughput',
    '    y-axis Higher p99 latency --> Lower p99 latency',
    '    quadrant-1 Fast and responsive',
    '    quadrant-2 Responsive but slower',
    '    quadrant-3 Slower and less responsive',
    '    quadrant-4 High throughput, higher latency',
    ...points.map(
      (p) =>
        `    ${p.name.replace(/[:[\]]/g, '')}: [${place(p.rps, throughput, false)}, ${place(p.ms, latency, true)}]`
    ),
  ]);
}

/** Historical trend of a single metric across runs. */
export function trendChart(points, { title = 'Trend across runs', yTitle = 'Value' } = {}) {  const usable = points.filter((p) => typeof p.value === 'number');
  if (usable.length < 2) return '';

  return fence([
    '---',
    'config:',
    '  xyChart:',
    '    width: 900',
    '---',
    'xychart-beta',
    `    title ${label(title)}`,
    `    x-axis [${usable.map((p) => label(p.runId)).join(', ')}]`,
    `    y-axis ${label(yTitle)} 0 --> ${headroom(Math.max(...usable.map((p) => p.value)))}`,
    `    line [${usable.map((p) => Math.round(p.value * 100) / 100).join(', ')}]`,
  ]);
}
