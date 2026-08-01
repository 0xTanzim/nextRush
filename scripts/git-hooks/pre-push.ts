/// <reference types="node" />

/**
 * pre-push gate — the final checkpoint before anything reaches origin.
 * Unlike pre-commit, this runs unconditionally on every push: a bad release
 * state reaching a shared branch is worse than a slightly slower push, and
 * pushes happen far less often than commits.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('ℹ pre-push: running release-state guard...');
  await execFileAsync('pnpm', ['verify:release-state'], { stdio: 'inherit' } as never).catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error('❌ pre-push blocked: release-state guard failed. Fix the problem above before pushing.');
    throw err;
  });
}

main().catch(() => {
  process.exitCode = 1;
});
