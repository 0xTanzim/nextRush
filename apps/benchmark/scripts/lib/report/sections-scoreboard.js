/**
 * The overall score.
 *
 * Only `identicalOutput` scenarios feed the headline number. `middleware-stack` and
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
      `${likeForLike.connectionCount} concurrency levels × ${scoreboard.frameworks.length} frameworks ` +
      `= ${likeForLike.maxPoints} points available`
  );
  const unscored = likeForLike.unscoredScenarioIds ?? [];
  if (unscored.length > 0) {
    lines.push(
      `- **Not scored:** \`${unscored.join('`, `')}\` — like-for-like, but ` +
        'measured only below the headline concurrency levels (see the per-scenario connection caps), ' +
        'so it contributes no ranked cells and is excluded from the points total rather than counted ' +
        'as points nobody could score'
    );
  }
  return lines;
}

/**
 * States how balanced measurement position actually was, rather than letting
 * "rotated" imply it was balanced (audit F-22).
 */
function positionBalanceLines(scoreboard) {
  const positions = scoreboard.positions;
  if (!positions) return [];

  const detail = positions.rows
    .slice()
    .sort((a, b) => a.meanPosition - b.meanPosition)
    .map((row) => `${row.fwId} ${row.meanPosition}`)
    .join(' · ');

  const lines = ['### Measurement position balance', ''];
  if (positions.balanced) {
    lines.push(
      `Every framework occupied every measurement position an equal number of times ` +
        `(${scoreboard.configuration?.runs} runs across ${positions.frameworkCount} frameworks). ` +
        `Mean position: ${detail}.`
    );
  } else {
    lines.push(
      `> ⚠️ **Position is not fully balanced.** ${scoreboard.configuration?.runs} runs across ` +
        `${positions.frameworkCount} frameworks means each framework visits only ` +
        `${scoreboard.configuration?.runs} of ${positions.frameworkCount} positions, and mean position ` +
        `spreads ${positions.spread} slots: ${detail}. Rotation balances position exactly only when ` +
        'the run count is a multiple of the framework count.'
    );
  }
  lines.push('');
  return lines;
}

/**
 * Names the adjacent orderings this run could not resolve, so a noise-sized gap
 * is never read as a result (audit F-20).
 */
function resolutionLines(scoreboard) {
  const resolution = scoreboard.resolution;
  if (!resolution || resolution.count === 0) return [];

  const lines = ['### Orderings this run could not resolve', ''];
  lines.push(
    `${resolution.count} adjacent headline comparison(s) have a gap smaller than the two ` +
      "frameworks' combined standard deviation. Those orderings reflect measurement noise, not " +
      'performance — they are scored as the ties they are, and must not be cited as a ranking.'
  );
  lines.push('');
  lines.push(
    ...table(
      ['Frameworks within noise of each other', 'Cells'],
      resolution.tiedFrameworkPairs.map((pair) => [`\`${pair.key}\``, pair.cells])
    )
  );
  lines.push('');
  return lines;
}

export function scoreboardSection(scoreboard) {
  const positionControl = scoreboard.configuration?.positionControl ?? scoreboard.configuration?.order;

  // fix-benchmark-position-bias / fix-benchmark-harness-integrity: a direct A/B
  // showed the framework measured FIRST in an invocation scores materially
  // lower than the same framework measured later, reversible by swapping which
  // one goes first. Anything other than a recorded rotation therefore cannot
  // back a ranking — a missing value is treated the same as an explicit
  // "fixed", using the same `positionControl ?? order` fallback the Load
  // Configuration table already uses, so the two sections of one report can
  // never disagree about whether the run backs a ranking. A single-framework
  // report is exempt — there is no cross-framework position to counterbalance.
  if (scoreboard.frameworks.length > 1 && positionControl !== 'rotated') {
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

  lines.push(...resolutionLines(scoreboard));
  lines.push(...positionBalanceLines(scoreboard));

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
