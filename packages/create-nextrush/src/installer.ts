import { execFileSync } from 'node:child_process';

import type { PackageManager, Runtime } from './types.js';

/** Result of validating a package manager before running the install. */
export interface InstallValidation {
  readonly ok: boolean;
  /** When `true`, skip the automatic install entirely but continue the scaffold flow (no abort). */
  readonly skipInstall?: boolean;
  /** When `ok` is false, a friendly, actionable message printed before install is attempted. */
  readonly guidance?: string;
}

/** The binary each generated runtime needs on PATH for a LOCAL install/run (F-08). */
export const RUNTIME_BINARY: Record<Runtime, string> = {
  node: 'node',
  bun: 'bun',
  deno: 'deno',
};

/** Result of the local runtime-binary preflight. */
export interface RuntimePreflight {
  readonly ok: boolean;
  /** Actionable install/remoting guidance when the binary is missing. */
  readonly guidance?: string;
}

/**
 * Preflights a locally-targeted runtime before an install/run action: the selected runtime's
 * binary must be on PATH, or the CLI explains how to install it (or to skip the check when
 * the project targets another machine — the caller decides whether to consult this).
 *
 * Only bun/deno are checked: the CLI itself is running on Node, so `node` is always present.
 */
export function preflightRuntimeBinary(runtime: Runtime): RuntimePreflight {
  if (runtime === 'node') { // capability-exempt: this CLI itself runs on Node, so the 'node' binary is always present; the check targets the GENERATED project's runtime
    return { ok: true };
  }

  const binary = RUNTIME_BINARY[runtime];
  try {
    execFileSync(binary, ['--version'], { stdio: ['ignore', 'ignore', 'pipe'] });
    return { ok: true };
  } catch {
    // capability-exempt: per-runtime install URL for the GENERATED project's runtime (user choice)
    const installUrl = runtime === 'bun' ? 'https://bun.sh' : 'https://deno.land';
    return {
      ok: false,
      guidance:
        `The selected ${runtime} runtime is not available on this machine.\n` +
        `Install it from ${installUrl}, or run create-nextrush with --no-install and ` +
        `--skip-runtime-check to scaffold for a remote/container target.`,
    };
  }
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
