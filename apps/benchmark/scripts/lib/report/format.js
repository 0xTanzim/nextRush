/** Presentation helpers shared by the report section builders. */

const MEDALS = ['🥇', '🥈', '🥉'];

export const medal = (rank) => MEDALS[rank - 1] || `${rank}`;

export const int = (n) => (typeof n === 'number' ? Math.round(n).toLocaleString('en-US') : 'N/A');

/** Signed throughput delta against the baseline; positive means faster. */
export function delta(overheadPct) {
  if (overheadPct === null || overheadPct === undefined) return '—';
  if (overheadPct === 0) return 'baseline';
  const signed = -overheadPct;
  return `${signed > 0 ? '+' : ''}${signed.toFixed(1)}%`;
}

/** RPS with dispersion — a single-run profile has no stddev worth printing. */
export function rps(cell, singleRun) {
  if (!cell) return '—';
  return singleRun
    ? int(cell.rps)
    : `${int(cell.rps)} ± ${int(cell.stddev)}`;
}

export const table = (header, rows) => [
  `| ${header.join(' | ')} |`,
  `|${header.map(() => '---').join('|')}|`,
  ...rows.map((cells) => `| ${cells.join(' | ')} |`),
];

export const fairnessTag = (identicalWork) => (identicalWork ? 'like-for-like' : '⚠️ idiomatic');
