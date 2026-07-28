/**
 * Winner views.
 *
 * Two tables, deliberately: one at the headline concurrency level, and one
 * showing every level side by side. Ranking a single level hides the common case
 * where a framework leads a serial (1-connection) latency test and loses the
 * saturated throughput test, or vice versa.
 */

import { fairnessTag, int, medal, table } from './format.js';

const NOISE_NOTE =
  "`≈` marks a gap smaller than the two frameworks' combined standard deviation — " +
  'the ordering there is not statistically meaningful.';

export function winnersSection(scoreboard) {
  const conn = scoreboard.primaryConnection;
  const lines = [`## Scenario winners @ ${conn} connections`, ''];

  const rows = scoreboard.scenarios.map((scenario) => {
    const [first, second] = scoreboard.rankings[scenario.id][conn] || [];
    const lead =
      first && second && second.rps > 0
        ? `${(((first.rps - second.rps) / second.rps) * 100).toFixed(1)}%`
        : '—';
    return [
      scenario.name,
      `\`${scenario.category}\``,
      fairnessTag(scenario.identicalWork),
      first ? `${medal(1)} **${first.name}**` : '—',
      first ? int(first.rps) : '—',
      second ? second.name : '—',
      first?.withinNoiseOfNext ? `≈ ${lead}` : lead,
    ];
  });

  lines.push(
    ...table(['Scenario', 'Category', 'Fairness', 'Winner', 'RPS', 'Runner-up', 'Lead'], rows)
  );
  lines.push('');
  lines.push(NOISE_NOTE);
  lines.push('');
  lines.push(...winnersByLevelSection(scoreboard));
  return lines;
}

/**
 * Winner per scenario at every concurrency level.
 *
 * The lowest level is usually a single connection, which measures per-request
 * latency rather than throughput — a lead there does not carry over to a
 * saturated server, so both are shown instead of one standing in for the other.
 */
export function winnersByLevelSection(scoreboard) {
  const { connections } = scoreboard;
  if (connections.length < 2) return [];

  const lines = ['### Winners by concurrency level', ''];
  lines.push(
    `Ranked independently at each level. \`${connections[0]}c\` is a latency probe; ` +
      `\`${connections[connections.length - 1]}c\` is the throughput regime and backs the headline score.`
  );
  lines.push('');

  const rows = scoreboard.scenarios.map((scenario) => [
    scenario.name,
    ...connections.map((conn) => {
      const top = scoreboard.rankings[scenario.id][conn]?.[0];
      if (!top) return '—';
      return `${top.name}${top.withinNoiseOfNext ? ' ≈' : ''}`;
    }),
  ]);

  lines.push(...table(['Scenario', ...connections.map((c) => `${c}c`)], rows));
  lines.push('');

  const tally = connections.map((conn) => {
    const counts = new Map();
    for (const scenario of scoreboard.scenarios) {
      const top = scoreboard.rankings[scenario.id][conn]?.[0];
      if (top) counts.set(top.name, (counts.get(top.name) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  });

  lines.push(
    ...table(
      ['Level', 'Wins by framework'],
      connections.map((conn, index) => [
        `${conn}c`,
        tally[index].map(([name, count]) => `${name} (${count})`).join(' · ') || '—',
      ])
    )
  );
  lines.push('');
  return lines;
}
