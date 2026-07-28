/**
 * Copy-paste tables for package READMEs and the docs site.
 *
 * npm renders no Mermaid, so this artifact is deliberately chart-free — the rich
 * charts live in REPORT.md (GitHub) and the docs site.
 */

import { fairnessTag, int, medal, table } from './format.js';

export function buildReadmeTables(scoreboard) {
  const lines = [];
  const { likeForLike } = scoreboard.overall;

  lines.push('<!-- Generated from results.json — do not hand-edit. -->');
  lines.push(`<!-- Run ${scoreboard.runId} · profile ${scoreboard.profile} · ${scoreboard.tool} -->`);
  lines.push('');
  lines.push('### Overall benchmark score');
  lines.push('');
  lines.push(
    `${likeForLike.scenarioCount} like-for-like scenarios × ${likeForLike.connectionCount} ` +
      `concurrency levels × ${scoreboard.frameworks.length} frameworks. A scenario win is worth ` +
      `${scoreboard.frameworks.length} points, last place 1 point.`
  );
  lines.push('');
  lines.push(
    ...table(
      ['Rank', 'Framework', 'Score', 'Wins'],
      likeForLike.rows.map((row) => [
        medal(row.rank),
        row.name,
        `${row.points} / ${likeForLike.maxPoints}`,
        row.wins,
      ])
    )
  );
  lines.push('');

  lines.push(`### Scenario winners @ ${scoreboard.primaryConnection} connections`);
  lines.push('');
  lines.push(
    ...table(
      ['Scenario', 'Winner', 'RPS', 'Fairness'],
      scoreboard.scenarios.map((scenario) => {
        const top = scoreboard.rankings[scenario.id][scoreboard.primaryConnection]?.[0];
        return [
          scenario.name,
          top ? `${medal(1)} ${top.name}` : '—',
          top ? int(top.rps) : '—',
          fairnessTag(scenario.identicalWork),
        ];
      })
    )
  );
  lines.push('');
  lines.push(
    `Measured on ${scoreboard.system.cpuModel || 'unknown CPU'} · Node ` +
      `${scoreboard.system.nodeVersion || '?'} · ${scoreboard.tool} ` +
      `${scoreboard.system.toolVersion || ''} · CPU pinning ${scoreboard.system.cpuPinning || 'off'}.`
  );
  lines.push('');
  return `${lines.join('\n')}\n`;
}
