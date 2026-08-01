/**
 * Thin launcher for the `nextrush` meta-package's `bin`.
 *
 * `@nextrush/dev` is an optional dev-time toolkit, not a runtime dependency of `nextrush`
 * (docs/RFC/framework-composition/020-framework-composition-integrity.md §21; ADR-0013). This
 * launcher resolves it on demand: when present it delegates to its CLI transparently; when absent
 * it prints an actionable, package-manager-aware install message and exits non-zero, instead of the
 * shell's raw "command not found". All logic lives inside the exported functions — importing this
 * module has no side effect, so it never executes at install time.
 *
 * @see docs/adr/ADR-0013-nextrush-cli-launcher-discoverability.md
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** The `@nextrush/dev` CLI surface this launcher depends on. `cli()` reads `process.argv` itself. */
export interface DevCliModule {
  readonly cli: (argv?: string[]) => void;
}

/** Package managers whose install command the launcher can name precisely; `null` = inconclusive. */
export type LauncherPackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

/** Injectable seams — the defaults hit the real module loader / environment; tests substitute them. */
export interface DevCliLauncherDeps {
  readonly importDevCli?: () => Promise<DevCliModule>;
  readonly detectPackageManager?: () => LauncherPackageManager | null;
  readonly writeError?: (message: string) => void;
  /**
   * Directory `@nextrush/dev` must resolve relative to — the CONSUMING app's own directory,
   * never this package's. Defaults to `process.cwd()` at the real call site. A bare
   * `import('@nextrush/dev')` from inside this file would resolve against `nextrush`'s own
   * `node_modules`, which deliberately never has `@nextrush/dev` linked (ADR-0013) — so every
   * consumer, regardless of what THEY have installed, would see "not installed." See ADR-0013
   * addendum and the regression test covering this.
   */
  readonly baseDir?: string;
}

const MISSING_DEV_TOOLKIT_PATTERN = /Cannot find (?:module|package) ['"]@nextrush\/dev['"]/;

/**
 * True only when the error is specifically "@nextrush/dev is not installed" — not when
 * `@nextrush/dev` is present but one of ITS OWN dependencies is missing (whose message names that
 * other specifier, even though the `@nextrush/dev` path may appear in the "imported from" clause).
 */
export function isMissingDevToolkitError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return MISSING_DEV_TOOLKIT_PATTERN.test(message);
}

/** The exact `-D`/`-d` install command for a package manager (design D4). */
export function installCommand(pm: LauncherPackageManager | null): string {
  switch (pm) {
    case 'pnpm':
      return 'pnpm add -D @nextrush/dev';
    case 'yarn':
      return 'yarn add -D @nextrush/dev';
    case 'bun':
      return 'bun add -d @nextrush/dev';
    case 'npm':
      return 'npm install -D @nextrush/dev';
    default:
      // Inconclusive detection → package-manager-agnostic phrasing (design D4 fallback).
      return 'install @nextrush/dev as a dev dependency (e.g. `npm install -D @nextrush/dev`)';
  }
}

/** The `<prefix> nextrush …` invocation to suggest re-running, matching the invoking package manager. */
function runHint(pm: LauncherPackageManager | null, attemptedArgv: readonly string[]): string {
  const prefix = pm === 'npm' ? 'npx' : (pm ?? '');
  return [prefix, 'nextrush', ...attemptedArgv].filter(Boolean).join(' ');
}

/**
 * The actionable message shown when the toolkit is absent: brands `@nextrush/dev` as the
 * Development Toolkit, gives the exact install command for the detected package manager, a one-line
 * description of what it provides, and a "then run" hint reflecting the command the user attempted
 * (fed.md Option 1).
 */
export function buildMissingToolkitMessage(
  pm: LauncherPackageManager | null,
  attemptedArgv: readonly string[] = []
): string {
  const lines = [
    'The NextRush Development Toolkit (@nextrush/dev) is not installed in this project.',
    '',
    'Install it:',
    `  ${installCommand(pm)}`,
    '',
    'It provides the hot-reload dev server, production builds, and code generators ' +
      '(nextrush dev / build / generate).',
  ];
  const hint = runHint(pm, attemptedArgv);
  if (attemptedArgv.length > 0) {
    lines.push('', 'Then run:', `  ${hint}`);
  }
  return lines.join('\n');
}

/** Reads the invoking package manager from `npm_config_user_agent`; `null` when inconclusive. */
function detectPackageManagerFromEnv(): LauncherPackageManager | null {
  const userAgent = process.env.npm_config_user_agent ?? '';
  if (userAgent.startsWith('pnpm')) return 'pnpm';
  if (userAgent.startsWith('yarn')) return 'yarn';
  // capability-exempt: 'bun' here identifies a PACKAGE MANAGER (npm/pnpm/yarn/bun), not a NextRush
  // JS-runtime capability — this never branches on which runtime is executing (mirrors
  // create-nextrush's detectPackageManager()).
  if (userAgent.startsWith('bun')) return 'bun';
  if (userAgent.startsWith('npm')) return 'npm';
  return null;
}

async function importDevCliModule(baseDir: string): Promise<DevCliModule> {
  // Resolve relative to `baseDir` (the consuming app's own directory), never this file's own
  // location — a bare `import('@nextrush/dev')` here would resolve against `nextrush`'s own
  // node_modules, which never has `@nextrush/dev` linked by design (see DevCliLauncherDeps.baseDir).
  //
  // Neither `createRequire(baseDir).resolve()` (CJS-only — `@nextrush/dev`'s `exports` map has no
  // `require` condition, per the repo's ESM-only rule) nor `import.meta.resolve(specifier, parent)`
  // (the `parent` override is unreliable across Node versions — verified empirically: it silently
  // resolves against THIS file's own URL instead of `parent` on the Node version this was built
  // against) can do this correctly. Reading the target package's own `package.json` `exports` map
  // directly is the same information Node's resolver would use, without either broken path.
  const manifestPath = path.join(baseDir, 'node_modules', '@nextrush', 'dev', 'package.json');
  let manifestContents: string;
  try {
    manifestContents = await readFile(manifestPath, 'utf8');
  } catch {
    throw new Error(`Cannot find package '@nextrush/dev' imported from ${baseDir}`);
  }

  const manifest = JSON.parse(manifestContents) as { exports?: { '.'?: { import?: string } } };
  const entryRelativePath = manifest.exports?.['.']?.import;
  if (!entryRelativePath) {
    throw new Error(`@nextrush/dev's package.json at ${manifestPath} has no "exports['.'].import" entry`);
  }

  const packageDir = path.dirname(manifestPath);
  const entryAbsolutePath = path.join(packageDir, entryRelativePath);
  return (await import(pathToFileURL(entryAbsolutePath).href)) as DevCliModule;
}

function defaultWriteError(message: string): void {
  process.stderr.write(`${message}\n`);
}

/**
 * Resolve `@nextrush/dev`'s CLI and delegate; on the specific "toolkit not installed" case, print
 * an actionable message and return a non-zero exit code. Any other error propagates unchanged.
 *
 * On the success path the underlying `cli()` reads `process.argv` and self-exits with its own code,
 * so the launcher does not need to re-propagate it; the returned `0` is reached only when `cli()`
 * returns without exiting (e.g. `--help`).
 *
 * @param argv - The CLI arguments (`process.argv.slice(2)`), passed through to the delegate.
 * @param deps - Injectable seams for testing; defaults use the real loader and environment.
 * @returns The exit code the launcher itself controls (non-zero when the toolkit is absent).
 */
export async function runDevCliLauncher(argv: string[], deps: DevCliLauncherDeps = {}): Promise<number> {
  const baseDir = deps.baseDir ?? process.cwd();
  const importDevCli = deps.importDevCli ?? (() => importDevCliModule(baseDir));
  const detectPm = deps.detectPackageManager ?? detectPackageManagerFromEnv;
  const writeError = deps.writeError ?? defaultWriteError;

  let devCli: DevCliModule;
  try {
    devCli = await importDevCli();
  } catch (err: unknown) {
    if (isMissingDevToolkitError(err)) {
      writeError(buildMissingToolkitMessage(detectPm(), argv));
      return 1;
    }
    throw err;
  }

  devCli.cli(argv);
  return 0;
}
