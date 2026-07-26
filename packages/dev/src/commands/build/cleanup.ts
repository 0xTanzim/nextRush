/**
 * Output directory cleanup with path guards
 *
 * Prevents destructive operations by refusing to delete:
 * - The current working directory
 * - Parent directories of cwd
 * - Paths outside cwd
 * - Special paths like '.' or ''
 */

import { getCwd } from '../../runtime/index.js';
import { getNodeFsPromises, getNodePath } from '../../runtime/node-modules.js';
import { error } from '../../utils/logger.js';

export async function cleanDirectory(dir: string, cwd?: string): Promise<void> {
  const fs = await getNodeFsPromises();
  const path = await getNodePath();

  const workingDir = cwd ?? getCwd();
  const resolvedDir = path.resolve(workingDir, dir);

  // Guard 1: Refuse special paths early
  if (dir === '.' || dir === '') {
    throw new Error(
      `Refusing to clean special path: ${dir}\n` +
      'The output directory must be a specific subdirectory, not cwd itself.'
    );
  }

  // Guard 2: Refuse to delete cwd itself
  if (path.normalize(resolvedDir) === path.normalize(workingDir)) {
    throw new Error(
      `Refusing to clean cwd: ${resolvedDir}\n` +
      'The output directory cannot be the current working directory.'
    );
  }

  // Guard 3: Refuse to delete parent of cwd or outside cwd
  const relative = path.relative(workingDir, resolvedDir);
  if (relative === '' || relative.startsWith('..')) {
    throw new Error(
      `Refusing to clean outside cwd: ${resolvedDir}\n` +
      `Relative path: ${relative}\n` +
      'The output directory must be strictly inside the project.'
    );
  }

  // Guard 4: All checks passed — safe to delete
  try {
    await fs.rm(resolvedDir, { recursive: true, force: true });
  } catch (err) {
    error(`Could not clean directory ${resolvedDir}: ${(err as Error).message}`);
    throw err;
  }
}
