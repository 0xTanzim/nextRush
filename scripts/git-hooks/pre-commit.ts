/// <reference types="node" />

/**
 * pre-commit gate. Runs `verify-release-state` ONLY when the staged diff
 * touches a file that can actually break release state — a `package.json`
 * (any package's version could have changed) or anything under
 * `.changeset/` (config, or a new/edited changeset). Everything else
 * commits at normal speed; there's no reason to pay this check's cost on a
 * commit that only touches source files.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const RELEASE_RELEVANT = /(^|\/)package\.json$|(^|\/)\.changeset\//;

async function getStagedFiles(): Promise<string[]> {
  const { stdout } = await execFileAsync('git', [
    'diff',
    '--cached',
    '--name-only',
    '--diff-filter=ACM',
  ]);
  return stdout.split('\n').filter(Boolean);
}

async function main(): Promise<void> {
  const staged = await getStagedFiles();
  const touchesReleaseState = staged.some((file) => RELEASE_RELEVANT.test(file));

  if (!touchesReleaseState) {
    // eslint-disable-next-line no-console
    console.log(
      'ℹ pre-commit: no package.json / .changeset/ changes staged — skipping release-state guard.'
    );
    return;
  }

  // eslint-disable-next-line no-console
  console.log(
    'ℹ pre-commit: package.json or .changeset/ changes detected — running release-state guard...'
  );
  await execFileAsync('pnpm', ['verify:release-state'], { stdio: 'inherit' } as never).catch(
    (err: unknown) => {
      // eslint-disable-next-line no-console
      console.error(
        '❌ pre-commit blocked: release-state guard failed. Fix the problem above before committing.'
      );
      throw err;
    }
  );
}

main().catch(() => {
  process.exitCode = 1;
});
