/**
 * The overall score.
 *
 * Only `identicalWork` scenarios feed the headline number. `middleware-stack` and
 * `error-handling` exercise each framework's own idiomatic mechanism, so blending
 * them in would present a mechanism difference as a performance difference; they
 * get a separate, labelled table.
 */

import { overallPointsChart, scenarioProfileRadar } from './charts.js';
import { medal, table } from './format.js';

function overallTable(overall, scoreboard, { perConnection = false } = {}) {
  const conns = scoreboard.connections;
  const header = ['Rank', 'Framework', 'Points', 'of max', 'Scenario wins', 'Avg rank'];
  if (perConnection) header.push(...conns.map((c) => `@${c}c`));

  const rows = overall.rows.map((row) => {
    const cells = [
      medal(row.rank),
      row.fwId === scoreboard.baselineId ? `${row.name} *(baseline)*` : row.name,
      `**${row.points}**`,
      overall.maxPoints,
      row.wins,
      row.avgRank ?? '—',
    ];
    if (perConnection) {
      for (const conn of conns) {
        const perConn = scoreboard.pointsPerConnection[conn].rows.find((r) => r.fwId === row.fwId);
        cells.push(perConn ? perConn.points : '—');
      }
    }
    return cells;
  });

  return table(header, rows);
}

function headline(scoreboard) {
  const { likeForLike } = scoreboard.overall;
  const winner = likeForLike.rows[0];
  const target = likeForLike.rows.find((r) => r.fwId.startsWith('nextrush'));
  const lines = [];

  if (winner) {
    lines.push(
      `- **Overall (like-for-like): ${medal(1)} ${winner.name}** — ` +
        `${winner.points}/${likeForLike.maxPoints} pts, ${winner.wins} scenario win(s)`
    );
  }
  if (target && target.fwId !== winner?.fwId) {
    lines.push(
      `- **NextRush: #${target.rank}** — ${target.points}/${likeForLike.maxPoints} pts, ` +
        `${target.wins} scenario win(s), average rank ${target.avgRank}`
    );
  }
  lines.push(
    `- **Scored on:** ${likeForLike.scenarioCount} like-for-like scenarios × ` +
      `${likeForLike.connectionCount} concurrency levels × ${scoreboard.frameworks.length} frameworks`
  );
  return lines;
}

export function scoreboardSection(scoreboard) {
  const positionControl = scoreboard.configuration?.positionControl;

  // fix-benchmark-position-bias: a direct A/B showed the framework measured
  // FIRST in an invocation scores materially lower than the same framework
  // measured later, reversible by swapping which one goes first. A `fixed`
  // order run therefore cannot back a ranking — render a plain warning
  // instead of a scoreboard that would misrepresent measurement noise as a
  // framework result.
  if (positionControl === 'fixed') {
    return [
      '## Scoreboard',
      '',
      '> ⚠️ **Not a ranking.** This run used a fixed measurement order (no rotation, no ' +
        'shuffle). A direct A/B on this harness showed the framework measured first in an ' +
        "invocation scores materially lower than the same framework measured later — reversible " +
        'by swapping which one goes first. Re-run with `--rotate` (on by default for publishable, ' +
        'multi-run, multi-framework comparisons) before drawing any cross-framework conclusion.',
      '',
    ];
  }

  const { likeForLike, all } = scoreboard.overall;
  const lines = ['## Scoreboard', ''];

  lines.push(
    `Every framework is ranked in **each of the ${scoreboard.scenarios.length} scenarios at each ` +
      `of the ${scoreboard.connections.length} concurrency levels** ` +
      `(${scoreboard.connections.join('c, ')}c). A win is worth ${scoreboard.frameworks.length} ` +
      'points, last place 1 point.'
  );
  lines.push('');
  lines.push(...headline(scoreboard));
  lines.push('');

  lines.push('### Overall ranking — like-for-like scenarios only');
  lines.push('');
  lines.push(...overallTable(likeForLike, scoreboard, { perConnection: true }));
  lines.push('');

  const chart = overallPointsChart(scoreboard);
  if (chart) {
    lines.push(chart, '');
  }

  lines.push(`### Overall ranking — all ${all.scenarioCount} scenarios`);
  lines.push('');
  lines.push(
    'Includes `middleware-stack` and `error-handling`, which are **not like-for-like** — each ' +
      "framework uses its own mechanism (middleware chain vs. hook vs. manual call). Shown for " +
      'completeness, not as the headline number.'
  );
  lines.push('');
  lines.push(...overallTable(all, scoreboard));
  lines.push('');

  const radar = scenarioProfileRadar(scoreboard);
  if (radar) {
    lines.push(`### Shape of the results @ ${scoreboard.primaryConnection} connections`);
    lines.push('');
    lines.push(
      "Each axis is one like-for-like scenario, normalized to that scenario's fastest result."
    );
    lines.push('');
    lines.push(radar, '');
  }

  return lines;
}
