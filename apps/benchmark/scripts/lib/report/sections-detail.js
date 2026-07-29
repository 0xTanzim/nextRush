/** Report sections that describe the run itself rather than rank it. */

import { METRICS_INTERVAL_MS } from '../../../config/constants.js';
import { int, rps, table } from './format.js';

const MEGABYTE_FACTOR = { B: 1 / 1048576, KB: 1 / 1024, MB: 1, GB: 1024 };

/** Parse a `formatBytes()` string ("150.0 MB") back into megabytes. */
function parseMegabytes(text) {
  const match = /^([\d.]+)\s*(B|KB|MB|GB)$/.exec(String(text || '').trim());
  if (!match) return null;
  return parseFloat(match[1]) * MEGABYTE_FACTOR[match[2]];
}

export function headerSection(scoreboard) {
  const lines = [];
  lines.push('# NextRush Benchmark Report');
  lines.push('');
  lines.push(
    `**Run ID:** \`${scoreboard.runId}\` · **Date:** ${scoreboard.timestamp} · ` +
      `**Profile:** ${scoreboard.profile}${scoreboard.publishable ? '' : ' (NOT publishable)'} · ` +
      `**Tool:** ${scoreboard.tool}`
  );
  lines.push('');
  lines.push(
    `**Frameworks:** ${scoreboard.frameworks.map((f) => f.name).join(' · ')}` +
      (scoreboard.failed.length ? ` · **Failed:** ${scoreboard.failed.map((f) => f.name).join(', ')}` : '')
  );
  lines.push('');

  if (!scoreboard.publishable) {
    const reason = scoreboard.publishableReason;
    lines.push(
      reason
        ? `> ⚠️ This profile is NOT publishable: ${reason}`
        : '> ⚠️ This profile is NOT publishable. Single-run or stress profiles carry no meaningful ' +
            'variance. Use `--profile full` (5 runs) for numbers that leave this repo.'
    );
    lines.push('');
  }

  lines.push(
    '> Every table and chart below is derived from `results.json` in this directory. ' +
      'Regenerate any of it without re-measuring: `pnpm report:generate --id ' +
      `${scoreboard.runId}\`.`
  );
  lines.push('');
  return lines;
}

export function resourcesSection(scoreboard) {
  const sampled = scoreboard.frameworks.filter(
    (fw) => fw.memory?.samples > 0 || fw.cpu?.samples > 1 || fw.gc?.count > 0
  );
  if (sampled.length === 0) return [];

  const lines = ['## Resource Usage', ''];
  lines.push(
    `Sampled from \`/proc\` every ${METRICS_INTERVAL_MS / 1000}s for the server process only — the load ` +
      'generator runs in a separate process and is not counted.'
  );
  lines.push('');
  lines.push(
    ...table(
      ['Framework', 'RSS peak', 'RSS avg', 'CPU avg', 'CPU peak', 'GC events', 'GC pause total'],
      sampled.map((fw) => [
        fw.name,
        fw.memory?.rssPeak || '—',
        fw.memory?.rssAvg || '—',
        fw.cpu?.samples > 1 ? `${fw.cpu.cpuAvgPct}%` : '—',
        fw.cpu?.samples > 1 ? `${fw.cpu.cpuMaxPct}%` : '—',
        fw.gc?.count ? int(fw.gc.count) : '—',
        fw.gc?.count ? `${fw.gc.totalPauseMs}ms` : '—',
      ])
    )
  );
  lines.push('');

  for (const fw of sampled) {
    lines.push(`### ${fw.name}`, '');
    lines.push(
      ...table(
        ['Metric', 'Value'],
        [
          ['RSS peak', fw.memory?.rssPeak || '—'],
          ['RSS avg', fw.memory?.rssAvg || '—'],
          [
            'RSS min / max',
            fw.memory?.rssMin && fw.memory?.rssMax ? `${fw.memory.rssMin} / ${fw.memory.rssMax}` : '—',
          ],
          [
            'CPU avg / peak',
            fw.cpu?.samples > 1 ? `${fw.cpu.cpuAvgPct}% / ${fw.cpu.cpuMaxPct}%` : '—',
          ],
          ['Samples', fw.memory?.samples ?? fw.cpu?.samples ?? '—'],
          [
            'GC events',
            fw.gc?.count
              ? `${int(fw.gc.count)} (${fw.gc.scavenges ?? 0} scavenge / ${fw.gc.markCompacts ?? 0} mark-compact)`
              : 'not traced (enable with --trace-gc)',
          ],
          [
            'GC pause',
            fw.gc?.count
              ? `${fw.gc.totalPauseMs}ms total · ${fw.gc.maxPauseMs}ms max · ${fw.gc.avgPauseMs ?? '—'}ms avg`
              : '—',
          ],
        ]
      )
    );
    lines.push('');
  }

  return lines;
}

/**
 * Throughput normalized by the resources it consumed.
 *
 * Raw RPS says nothing about cost: two frameworks at the same throughput can sit
 * a long way apart on CPU and RSS, which is what decides how many instances a
 * deployment needs. Coarse by construction — `/proc` sampling is 1 Hz and RSS
 * includes the heap V8 has not yet reclaimed.
 */
export function efficiencySection(scoreboard) {
  const scenarioId = scoreboard.scenarios[0]?.id;
  const conn = scoreboard.primaryConnection;
  const rows = scoreboard.frameworks
    .filter((fw) => fw.memory?.samples > 0 || fw.cpu?.samples > 1)
    .map((fw) => {
      const rps = scoreboard.cells[fw.id]?.[scenarioId]?.[conn]?.rps;
      const cpuPct = fw.cpu?.samples > 1 ? fw.cpu.cpuAvgPct : null;
      const rssMb = parseMegabytes(fw.memory?.rssPeak);
      return {
        name: fw.name,
        rps,
        cpuPct,
        rssPeak: fw.memory?.rssPeak || '—',
        perCpu: rps && cpuPct ? Math.round(rps / cpuPct) : null,
        perMb: rps && rssMb ? Math.round(rps / rssMb) : null,
      };
    })
    .filter((row) => row.rps);
  if (rows.length === 0) return [];

  const scenarioName = scoreboard.scenarios[0]?.name || scenarioId;
  const lines = [`## Efficiency — ${scenarioName} throughput vs. whole-run CPU/RSS`, ''];
  lines.push(
    ...table(
      ['Framework', 'RPS', 'CPU avg', 'RPS per CPU%', 'RSS peak', 'RPS per MB'],
      rows.map((row) => [
        row.name,
        int(row.rps),
        row.cpuPct !== null ? `${row.cpuPct}%` : '—',
        row.perCpu ?? '—',
        row.rssPeak,
        row.perMb ?? '—',
      ])
    )
  );
  lines.push('');
  lines.push(
    `RPS is ${scenarioName}'s figure at ${conn} connections; CPU and RSS are a **whole-run aggregate** ` +
      "sampled across every scenario and concurrency level this run measured, not scoped to this " +
      'one scenario. CPU can exceed 100% — it is summed across cores. RSS peak includes heap V8 has ' +
      'not yet reclaimed. Treat both ratio columns as an order-of-magnitude comparison across ' +
      'mismatched measurement windows, not a precise per-scenario cost model.'
  );
  lines.push('');
  return lines;
}

export function rawResultsSection(scoreboard, { singleRun }) {
  const lines = [];
  lines.push('## Raw results per framework');
  lines.push('');

  for (const fw of scoreboard.frameworks) {
    lines.push('<details>');
    lines.push(`<summary>${fw.name} — all scenarios and concurrency levels</summary>`);
    lines.push('');
    lines.push(
      ...table(
        ['Scenario', 'Conn', 'RPS', 'CV%', 'p50', 'p99', 'Valid runs', 'Non-2xx'],
        scoreboard.scenarios.flatMap((scenario) =>
          scoreboard.connections
            .map((conn) => {
              const cell = scoreboard.cells[fw.id][scenario.id][conn];
              if (!cell) return null;
              return [
                scenario.name,
                conn,
                `${rps(cell, singleRun)}${cell.invalid ? ' ⚠️' : ''}`,
                `${cell.cv}%`,
                cell.p50,
                cell.p99,
                cell.validRuns,
                int(cell.nonOk),
              ];
            })
            .filter(Boolean)
        )
      )
    );
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  for (const failure of scoreboard.failed) {
    lines.push(`### ${failure.name} — ERROR`);
    lines.push('');
    lines.push(`\`\`\`\n${failure.error}\n\`\`\``);
    lines.push('');
  }
  return lines;
}

/** Derive the report's parity-claim sentence from what this run actually recorded. */
function parityClaimLine(scoreboard) {
  const parity = scoreboard.configuration?.parity;
  if (!parity) {
    return (
      '- **Parity:** not recorded for this run (predates parity-outcome tracking) — re-run ' +
      '`pnpm bench:validate` to confirm fairness independently'
    );
  }
  if (parity.failures?.length > 0) {
    return (
      `- **Parity:** validation FAILED for this run (${parity.failures.length} mismatch(es)) — ` +
      'do not treat this run as a fair comparison'
    );
  }
  if (!parity.validated) {
    return `- **Parity:** not validated for this run — ${parity.skippedReason || 'reason not recorded'}`;
  }
  return (
    '- **Parity:** validated — response bodies AND `Content-Type` confirmed byte-identical across ' +
    'servers before timing (`scripts/validate-parity.js`)'
  );
}

export function methodologySection(scoreboard, { singleRun }) {
  const lines = [];
  lines.push('---');
  lines.push('');
  lines.push('## Fairness and methodology');
  lines.push('');
  lines.push(
    `- **Tool:** ${scoreboard.tool} ` +
      `(${scoreboard.tool === 'wrk' ? 'C-based, separate process' : 'Node.js-based, shares the runtime'})`
  );
  lines.push('- **Pipelining:** disabled (pipelining=1)');
  lines.push(
    `- **Statistical rigor:** ${scoreboard.configuration.runs} run(s); ` +
      `${singleRun ? '**single run — no variance; not publishable**' : 'mean ± stddev and CV reported per data point'}`
  );
  lines.push('- **Warmup:** framework-level (root) plus per-scenario path warmup before measurement');
  lines.push(
    '- **Invalid-run handling:** any non-2xx in a success scenario excludes that run from the ' +
      'mean/stddev (not merely flagged)'
  );
  lines.push('- **Latency:** median of each percentile across valid runs, not a single run');
  lines.push(parityClaimLine(scoreboard));
  lines.push(
    `- **Ranking point:** ${scoreboard.primaryConnection} connections — the highest level in this ` +
      'run. The lowest level (often 1 connection) measures per-request latency, not throughput, ' +
      'so it is reported but not used as the headline.'
  );
  {
    const likeCount = scoreboard.likeForLikeScenarioIds.length;
    const excluded = scoreboard.scenarios.filter((s) => !s.identicalWork).map((s) => s.name);
    const summary =
      excluded.length > 0
        ? `${likeCount} scenario${likeCount === 1 ? '' : 's'} do${likeCount === 1 ? 'es' : ''} byte-identical work. ` +
          `\`${excluded.join('`, `')}\` use${excluded.length === 1 ? 's' : ''} each framework's own idiomatic ` +
          `mechanism and ${excluded.length === 1 ? 'is' : 'are'} **excluded from the headline score** — reported ` +
          'separately and tagged ⚠️ idiomatic.'
        : likeCount === 1
          ? 'The one scenario in this run does byte-identical work.'
          : `All ${likeCount} scenarios in this run do byte-identical work.`;
    lines.push(`- **Scenario fairness:** ${summary}`);
  }
  lines.push('');

  lines.push('## Reproduce this');
  lines.push('');
  lines.push('```bash');
  lines.push('cd apps/benchmark');
  lines.push('pnpm bench:validate                         # prove the servers do identical work');
  lines.push(`pnpm bench:compare --profile ${scoreboard.profile}   # re-measure (hours)`);
  lines.push(`pnpm report:generate --id ${scoreboard.runId}   # re-derive every artifact (seconds)`);
  lines.push('```');
  lines.push('');
  lines.push(
    'Performance varies by hardware. The only numbers that matter for your capacity planning ' +
      'are the ones you measure on your own machine.'
  );
  lines.push('');
  return lines;
}
