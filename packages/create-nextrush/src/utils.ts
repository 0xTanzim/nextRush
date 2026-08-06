import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

import { PACKAGE_NAME_REGEX } from './constants.js';
import type { FileMap, PackageManager } from './types.js';

/** Validates a project name for npm compatibility. */
export function validateProjectName(name: string): string | undefined {
  if (!name) return 'Project name is required';
  if (!PACKAGE_NAME_REGEX.test(name)) {
    return 'Invalid package name. Use lowercase letters, digits, hyphens, dots, or underscores.';
  }
  return undefined;
}

/** Writes all files from a FileMap to a target directory. */
export function writeFiles(targetDir: string, files: FileMap): void {
  const absDir = resolve(targetDir);

  for (const [relativePath, content] of files) {
    const filePath = join(absDir, relativePath);
    const dir = dirname(filePath);
    mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, content, 'utf-8');
  }
}

/** Checks if a directory is empty or doesn't exist. */
export function isDirectoryEmpty(dir: string): boolean {
  if (!existsSync(dir)) return true;
  const entries = readdirSync(dir);
  return entries.length === 0;
}

/** Returns the install command argv (for execFileSync — no shell interpolation) for a package manager. */
export function getInstallArgv(pm: PackageManager): readonly [string, ...string[]] {
  switch (pm) {
    case 'pnpm':
      return ['pnpm', 'install'];
    case 'yarn':
      return ['yarn'];
    case 'bun':
      return ['bun', 'install'];
    case 'npm':
      return ['npm', 'install'];
  }
}

/** Returns the human-readable install command label for a package manager (for retry messages). */
export function getInstallCommandLabel(pm: PackageManager): string {
  return getInstallArgv(pm).join(' ');
}

/** Returns the run command prefix for a package manager. */
export function getRunCommand(pm: PackageManager): string {
  switch (pm) {
    case 'npm':
      return 'npm run';
    case 'pnpm':
      return 'pnpm';
    case 'yarn':
      return 'yarn';
    case 'bun':
      return 'bun run';
  }
}

/** Returns the production start command for a package manager (e.g. `npm start`). */
export function getStartCommand(pm: PackageManager): string {
  return pm === 'npm' ? 'npm start' : `${getRunCommand(pm)} start`;
}

/** Detects the preferred package manager from the environment. */
export function detectPackageManager(): PackageManager {
  const userAgent = process.env.npm_config_user_agent ?? '';

  if (userAgent.startsWith('pnpm')) return 'pnpm';
  if (userAgent.startsWith('yarn')) return 'yarn';
  // capability-exempt: 'bun' here identifies a PACKAGE MANAGER choice
  // (npm/pnpm/yarn/bun), not a NextRush JS-runtime capability decision —
  // collides with a runtime name in RUNTIME_NAMES, but this function never
  // branches on which JS runtime is executing.
  if (userAgent.startsWith('bun')) return 'bun';
  return 'npm';
}

/** How the resolved package manager was chosen — the observable provenance (F-09). */
export type PackageManagerSource = 'explicit' | 'detected' | 'runtime-policy';

/**
 * Resolves the package manager together with its provenance, so the CLI can state
 * "Using pnpm (detected)" before install (task 2.5 / F-09).
 *
 * - `explicit`: the caller passed `--pm`.
 * - `runtime-policy`: the bun runtime implies the bun package manager.
 * - `detected`: inferred from the invoking environment (`npm_config_user_agent`).
 */
export function resolvePackageManagerWithSource(
  runtime: 'node' | 'bun' | 'deno',
  explicit?: PackageManager
): { packageManager: PackageManager; source: PackageManagerSource } {
  if (explicit) {
    return { packageManager: explicit, source: 'explicit' };
  }

  // capability-exempt: 'bun' here identifies the PACKAGE MANAGER implied by a scaffold-time
  // runtime choice, not a capability decision in this CLI's own request path.
  if (runtime === 'bun') {
    return { packageManager: 'bun', source: 'runtime-policy' };
  }

  return { packageManager: detectPackageManager(), source: 'detected' };
}

/** Converts a directory name to a valid package name. */
export function toPackageName(dir: string): string {
  return dir
    .toLowerCase()
    .replace(/[^a-z0-9-._~]/g, '-')
    .replace(/^[._]/, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Resolves the package name from target directory (supports `.` scaffolding). */
export function deriveProjectName(directory: string, cwd: string = process.cwd()): string {
  const normalizedDirectory = directory.trim();

  if (normalizedDirectory === '.' || normalizedDirectory === './') {
    return toPackageName(basename(resolve(cwd)));
  }

  return toPackageName(normalizedDirectory.replace(/^\.\//, ''));
}
