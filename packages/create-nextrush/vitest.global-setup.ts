import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('.', import.meta.url));

/**
 * The process-level suites spawn `bin/create-nextrush.js`, which imports the
 * built bundle. Build once here, in the main process, before any worker
 * starts: per-file `beforeAll` builds ran in parallel workers and tsdown's
 * `clean` deleted the bundle out from under another worker's spawn.
 */
export default function setup(): void {
  const build = spawnSync('pnpm', ['build'], { cwd: packageRoot, stdio: 'pipe' });

  if (build.status !== 0) {
    throw new Error(`create-nextrush build failed:\n${build.stderr?.toString() ?? ''}`);
  }
}
