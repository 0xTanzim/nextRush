/**
 * Cross-run history.
 *
 * A trend line is only honest between runs measured the same way. A run with a
 * different framework set, connection ladder, scenario set, or load tool is not
 * on the same scale — a single-framework run scores 100% of its own maximum and
 * would otherwise read as a regression against a six-framework run. Such runs
 * stay in the table with the reason they were excluded, and only runs matching
 * the newest publishable run's shape feed the charts.
 */

import { trendChart } from './charts.js';
import { int, table } from './format.js';
import { buildScoreboard } from './scoreboard.js';

const TARGET_PREFIX = 'nextrush';

function summarize(report) {
  const scoreboard = buildScoreboard(report);
  const target = scoreboard.overall.likeForLike.rows.find((r) => r.fwId.startsWith(TARGET_PREFIX));
  const targetRps = target
    ? scoreboard.cells[target.fwId]?.['hello-world']?.[scoreboard.primaryConnection]?.rps ?? null
    : null;

  return {
    runId: scoreboard.runId,
    profile: scoreboard.profile,
    publishable: scoreboard.publishable,
    tool: scoreboard.tool,
    primaryConnection: scoreboard.primaryConnection,
    frameworkIds: scoreboard.frameworks.map((f) => f.id).sort(),
    connections: [...scoreboard.connections],
    scenarioIds: scoreboard.scenarios.map((s) => s.id).sort(),
    maxPoints: scoreboard.overall.likeForLike.maxPoints,
    overallWinner: scoreboard.overall.likeForLike.rows[0]?.name || '—',
    targetRank: target?.rank ?? null,
    targetPoints: target?.points ?? null,
    targetRps,
  };
}

/** Why a run cannot share a trend line with the anchor run, or null if it can. */
function incomparableReason(run, anchor) {
  if (!run.publishable) return 'not publishable';
  if (run.tool !== anchor.tool) return `different tool (${run.tool})`;
  if (run.frameworkIds.join('+') !== anchor.frameworkIds.join('+')) {
    return `different framework set (${run.frameworkIds.length})`;
  }
  if (run.connections.join('/') !== anchor.connections.join('/')) {
    return `different concurrency ladder (${run.connections.join('/')})`;
  }
  if (run.scenarioIds.join('+') !== anchor.scenarioIds.join('+')) {
    return `different scenario set (${run.scenarioIds.length})`;
  }
  return null;
}

function describeAnchor(anchor) {
  return (
    `${anchor.frameworkIds.length} framework(s), ${anchor.scenarioIds.length} scenario(s), ` +
    `connections ${anchor.connections.join('/')}, ${anchor.tool}`
  );
}

export function buildHistory(reports) {
  const runs = reports.map(summarize).sort((a, b) => a.runId.localeCompare(b.runId));
  const anchor = [...runs].reverse().find((run) => run.publishable) || runs[runs.length - 1];
  for (const run of runs) run.reason = anchor ? incomparableReason(run, anchor) : 'no anchor run';

  const comparable = runs.filter((run) => run.reason === null);
  const lines = ['# NextRush Benchmark History', ''];

  lines.push(
    `Derived from ${runs.length} stored run(s). Regenerate with \`pnpm report:history\` — no ` +
      're-measurement involved.'
  );
  lines.push('');
  if (anchor) {
    lines.push(
      `Trend lines are **anchored to \`${anchor.runId}\`** (${describeAnchor(anchor)}). ` +
        'A run measured differently is listed below but not plotted — its score is not on the ' +
        'same scale.'
    );
    lines.push('');
  }

  lines.push(
    ...table(
      ['Run', 'Profile', 'Tool', 'Frameworks', 'Overall winner', 'NextRush rank', 'NextRush score', 'Hello World RPS', 'Comparable'],
      runs.map((run) => [
        `\`${run.runId}\``,
        run.profile,
        run.tool,
        run.frameworkIds.length,
        run.overallWinner,
        run.targetRank ? `#${run.targetRank}` : '—',
        run.targetPoints !== null ? `${run.targetPoints} / ${run.maxPoints}` : '—',
        run.targetRps ? `${int(run.targetRps)} @${run.primaryConnection}c` : '—',
        run.reason === null ? '✓' : `✗ ${run.reason}`,
      ])
    )
  );
  lines.push('');

  const scoreTrend = trendChart(
    comparable
      .filter((run) => run.targetPoints !== null && run.maxPoints > 0)
      .map((run) => ({
        runId: run.runId.slice(0, 16),
        value: Math.round((run.targetPoints / run.maxPoints) * 1000) / 10,
      })),
    { title: 'NextRush overall score (% of maximum)', yTitle: 'Score %' }
  );
  if (scoreTrend) {
    lines.push('## Overall score trend', '');
    lines.push(
      'Normalized to percent of the maximum achievable score, so the line stays readable if the ' +
        'scenario count changes within the anchored shape.'
    );
    lines.push('', scoreTrend, '');
  }

  const rpsTrend = trendChart(
    comparable
      .filter((run) => run.targetRps)
      .map((run) => ({ runId: run.runId.slice(0, 16), value: run.targetRps })),
    { title: 'NextRush Hello World RPS', yTitle: 'Requests/sec' }
  );
  if (rpsTrend) {
    lines.push(`## Throughput trend — Hello World @ ${anchor.primaryConnection} connections`, '');
    lines.push(
      'Same hardware assumption as any trend: a machine change invalidates the comparison even ' +
        'when the configuration matches.'
    );
    lines.push('', rpsTrend, '');
  }

  if (comparable.length < 2) {
    lines.push(
      '> Not enough comparable runs to plot a trend yet. Two runs with the same frameworks, ' +
        'scenarios, connection ladder and tool are needed.'
    );
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}
