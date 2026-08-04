import { execFileSync } from 'node:child_process';

import type { PackageManager } from './types.js';

/** Result of validating a package manager before running the install. */
export interface InstallValidation {
  readonly ok: boolean;
  /** When `true`, skip the automatic install entirely but continue the scaffold flow (no abort). */
  readonly skipInstall?: boolean;
  /** When `ok` is false, a friendly, actionable message printed before install is attempted. */
  readonly guidance?: string;
}

/**
 * Reads a tool's version string from `--version`. Some managers write the version to
 * stdout, others to stderr (yarn classic writes to stderr) — so both streams are
 * attempted. Returns '' when the tool is missing or errors — the caller then falls back
 * to a plain install attempt so the package manager's own error message (captured by
 * `runCaptured`) is still shown.
 */
function readToolVersion(command: string): string {
  let stdout = '';
  let stderr = '';
  try {
    stdout = String(execFileSync(command, ['--version'], { stdio: ['pipe', 'pipe', 'pipe'] }));
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'stderr' in error) {
      stderr = String((error as { stderr: Buffer | string }).stderr);
    }
  }

  const combined = `${stdout} ${stderr}`;
  const match = /(\d+)\.(\d+)\.(\d+)/.exec(combined);
  if (!match) {
    return '';
  }
  const major = match[1];
  const minor = match[2];
  const patch = match[3];
  if (major === undefined || minor === undefined || patch === undefined) {
    return '';
  }
  return `${major}.${minor}.${patch}`;
}

/** Returns true when the installed yarn is Classic (1.x), which cannot honor `packageManager: yarn@4`. */
function isYarnClassic(): boolean {
  const version = readToolVersion('yarn');
  return version.startsWith('1.');
}

/** Reads the effective npm `allow-scripts` value from `npm config get allow-scripts` (non-empty = set). */
function readNpmAllowScripts(): string {
  try {
    const stdout = execFileSync('npm', ['config', 'get', 'allow-scripts'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return String(stdout).trim();
  } catch {
    return '';
  }
}

/**
 * Validates the package manager BEFORE install so failures become friendly guidance instead
 * of a cryptic internal error (yarn classic + `packageManager: yarn@4`, npm 11's
 * `EALLOWSCRIPTS` when `allow-scripts` is configured globally).
 */
export function validatePackageManager(pm: PackageManager): InstallValidation {
  switch (pm) {
    case 'yarn': {
      if (isYarnClassic()) {
        return {
          ok: true,
          guidance:
            'Yarn Classic detected.\n\n' +
            'This project works with Yarn Classic, but some tooling may behave differently ' +
            'than under Yarn Berry (v4). If you prefer Yarn 4, run:\n' +
            '  corepack enable\n' +
            '  corepack prepare yarn@stable --activate\n\n' +
            'Continuing the install with Yarn Classic.',
        };
      }
      return { ok: true };
    }

    case 'npm': {
      const allowScripts = readNpmAllowScripts();
      if (allowScripts && allowScripts !== 'null' && allowScripts !== 'undefined') {
        return {
          ok: true,
          skipInstall: true,
          guidance:
            `Detected global npm configuration:\n\n` +
            `  allow-scripts=${allowScripts}\n\n` +
            'Modern npm versions reject automatic installation for new projects when this setting exists.\n\n' +
            'Automatic dependency installation has been skipped.\n\n' +
            'To continue:\n\n' +
            '  1. Remove allow-scripts from ~/.npmrc\n\n' +
            '     or\n\n' +
            '  2. Configure allowScripts inside the project\n\n' +
            'Then run:\n\n' +
            '  npm install',
        };
      }
      return { ok: true };
    }

    default:
      return { ok: true };
  }
}
