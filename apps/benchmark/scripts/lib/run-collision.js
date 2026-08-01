/**
 * Run-ID collision detection — a new result set is rejected (or treated as
 * the existing session) rather than silently duplicated under a different
 * directory name. Reconciliation report F-05/D2: `2026-07-27T15-42-22` and
 * `2026-07-27T15-42-50` embedded the same `run_id` in two directories with
 * byte-identical content — a directory-name-only check would never catch
 * this, since the identity that matters is the embedded `run_id`, not the
 * timestamp used as the folder name.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function readExistingReport(dir) {
  const file = join(dir, 'results.json');
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * @param {string} resultsDir The parent directory containing all run directories.
 * @param {string} newDirName The directory name about to be created for this run.
 * @param {{ runId: string }} report The report about to be written.
 * @returns {{ collision: boolean, identical?: boolean, existingDir?: string }}
 */
export function checkRunIdCollision(resultsDir, newDirName, report) {
  if (!existsSync(resultsDir)) return { collision: false };

  for (const entry of readdirSync(resultsDir)) {
    if (entry === newDirName || entry === 'latest' || entry === 'baseline') continue;
    const entryPath = join(resultsDir, entry);
    if (!statSync(entryPath).isDirectory()) continue;

    const existing = readExistingReport(entryPath);
    if (!existing || existing.runId !== report.runId) continue;

    return {
      collision: true,
      identical: JSON.stringify(existing) === JSON.stringify(report),
      existingDir: entry,
    };
  }

  return { collision: false };
}
