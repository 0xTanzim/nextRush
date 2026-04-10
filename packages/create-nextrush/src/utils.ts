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

/** Returns the install command for a package manager. */
export function getInstallCommand(pm: PackageManager): string {
  switch (pm) {
    case 'pnpm':
      return 'pnpm install';
    case 'yarn':
      return 'yarn';
    case 'bun':
      return 'bun install';
    case 'npm':
      return 'npm install';
  }
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

/** Detects the preferred package manager from the environment. */
export function detectPackageManager(): PackageManager {
  const userAgent = process.env.npm_config_user_agent ?? '';

  if (userAgent.startsWith('pnpm')) return 'pnpm';
  if (userAgent.startsWith('yarn')) return 'yarn';
  if (userAgent.startsWith('bun')) return 'bun';
  return 'npm';
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
