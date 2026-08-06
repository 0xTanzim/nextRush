import { execFileSync } from 'node:child_process';

import * as p from '@clack/prompts';

import { CliInputError, parseArgs, printHelp } from './cli.js';
import { MIN_NODE_MAJOR, NEXTRUSH_VERSION } from './constants.js';
import { preflightRuntimeBinary, validatePackageManager } from './installer.js';
import { resolveVersions } from './npm-version.js';
import { runPrompts } from './prompts.js';
import { resolveScaffoldPlan } from './plan.js';
import { createSuccessResult, renderInputError, renderSuccess, requestedJsonOutput } from './result.js';
import { getAllPossiblePackageNames } from './templates/index.js';
import type { PackageManagerSource } from './utils.js';
import {
  getInstallArgv,
  getInstallCommandLabel,
  getRunCommand,
  getStartCommand,
  isDirectoryEmpty,
  resolvePackageManagerWithSource,
  writeFiles,
} from './utils.js';
import type { ParsedArgs, Runtime } from './types.js';
import { setVersionMap } from './version-store.js';

/** Resolves the package-manager provenance for display in the completion output (F-09). */
function resolvePackageManagerSource(args: ParsedArgs, runtime: Runtime): PackageManagerSource {
  return resolvePackageManagerWithSource(runtime, args.packageManager).source;
}

/** Checks the running Node.js version against the framework floor (fixes F-05). */
function assertSupportedNodeVersion(): void {
  const [majorStr] = process.versions.node.split('.');
  const major = Number(majorStr);
  if (Number.isNaN(major) || major < MIN_NODE_MAJOR) {
    console.error(
      `create-nextrush requires Node.js >= ${MIN_NODE_MAJOR.toString()}.0.0, but this environment is running Node.js ${process.versions.node}.\n` +
        `Upgrade Node.js (e.g. via https://nodejs.org or a version manager like nvm/fnm) and try again.`
    );
    process.exit(1);
  }
}

/** Runs a captured command; on failure prints stderr + the exact manual retry command (fixes F-03). */
function runCaptured(
  argv: readonly [string, ...string[]],
  cwd: string,
  retryCommandLabel: string,
  failureContext: string
): boolean {
  try {
    const [command, ...commandArgs] = argv;
    execFileSync(command, commandArgs, { cwd, stdio: ['ignore', 'ignore', 'pipe'] });
    return true;
  } catch (error) {
    const stderr =
      error && typeof error === 'object' && 'stderr' in error
        ? String((error as { stderr: Buffer | string }).stderr)
        : '';
    console.error(`\n${failureContext} failed.`);
    if (stderr.trim()) {
      console.error(stderr.trim());
    }
    console.error(`\nRetry manually with:\n  ${retryCommandLabel}\n`);
    return false;
  }
}

async function main(): Promise<void> {
  assertSupportedNodeVersion();

  const args = parseArgs(process.argv);

  if (args.version) {
    console.log(`create-nextrush v${NEXTRUSH_VERSION}`);
    return;
  }

  if (args.help) {
    printHelp();
    return;
  }

  if (!args.json) p.intro('create-nextrush');

  // Version probing is gated on install: a --no-install offline scaffold never uses the
  // resolved ranges for anything but display, so skip the network round-trip entirely
  // (fixes F-18 — Doherty Threshold: no dead wait when nothing will be installed).
  // `--offline` (design decision 4) skips probes even when install is on; every emitted
  // range then comes from the embedded fallback map and the result states so.
  const { versions, offline } = await resolveVersions(getAllPossiblePackageNames(), {
    offline: args.offline,
  });
  setVersionMap(versions);

  if (args.install) {
    const s = !args.json ? p.spinner() : undefined;
    s?.start('Checking latest versions...');
    s?.stop(`Using nextrush ${versions.get('nextrush') ?? NEXTRUSH_VERSION}`);
  }

  const options = await runPrompts(args);

  if (typeof options === 'symbol') {
    return;
  }

  const plan = resolveScaffoldPlan(options);

  if (args.dryRun) {
    renderSuccess(createSuccessResult(plan, true, offline), args.json);
    return;
  }

  await confirmNonEmptyTargetOrExit({
    directoryLabel: options.directory,
    targetDir: plan.targetDir,
    nonInteractive: args.yes || args.json || !process.stdin.isTTY,
    overwrite: args.overwrite,
    json: args.json,
  });

  const s = !args.json ? p.spinner() : undefined;
  s?.start('Scaffolding project...');
  const executionResult = createSuccessResult(plan, false, offline);
  writeFiles(plan.targetDir, plan.files);
  s?.stop('Project scaffolded.');

  if (args.json) {
    renderSuccess(executionResult, true);
    return;
  }

  finishScaffold({
    targetDir: plan.targetDir,
    directory: options.directory,
    packageManager: options.packageManager,
    runtime: options.runtime,
    pmSource: resolvePackageManagerSource(args, options.runtime),
    skipRuntimeCheck: args.skipRuntimeCheck,
    git: options.git,
    install: options.install,
    verificationUrl: plan.verificationUrl,
  });
}

/** Shared: warn and confirm before scaffolding into a non-empty directory. */
async function confirmNonEmptyTargetOrExit(input: {
  directoryLabel: string;
  targetDir: string;
  nonInteractive: boolean;
  overwrite: boolean;
  json: boolean;
}): Promise<void> {
  const { directoryLabel, targetDir, nonInteractive, overwrite, json } = input;
  if (isDirectoryEmpty(targetDir)) return;

  if (overwrite) {
    if (!json) p.log.warn(`Directory "${directoryLabel}" is not empty; generated files may be replaced.`);
    return;
  }

  if (nonInteractive) {
    throw new CliInputError({
      // Stable automation code (ADR-0024): machine-readable, never auto-overwrites.
      code: 'TARGET_DIRECTORY_NOT_EMPTY',
      message: `Target directory "${directoryLabel}" is not empty.`,
      remediation:
        'No files were changed. Choose an empty directory, or rerun with --overwrite after reviewing the planned files.',
    });
  }

  const shouldContinue = await p.confirm({
    message: `Directory "${directoryLabel}" is not empty. Continue anyway?`,
    initialValue: false,
  });

  if (p.isCancel(shouldContinue) || !shouldContinue) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }
}

/** Shared tail: git init, dependency install, and the final "Next steps" note. */
function finishScaffold(input: {
  targetDir: string;
  directory: string;
  packageManager: Parameters<typeof getInstallArgv>[0];
  runtime: Runtime;
  pmSource: PackageManagerSource;
  skipRuntimeCheck: boolean;
  git: boolean;
  install: boolean;
  verificationUrl: string;
}): void {
  const { targetDir, directory, packageManager, runtime, pmSource, skipRuntimeCheck, git, install, verificationUrl } =
    input;
  const s = p.spinner();

  // Provenance (F-09): state how the package manager was chosen so machine and human
  // readers alike can tell `--pm` from an environment guess.
  console.log(`\nUsing ${packageManager} package manager (${pmSource}).\n`);

  if (git) {
    s.start('Initializing git repository...');
    const initOk = runCaptured(['git', 'init'], targetDir, 'git init', 'Git initialization');
    const addOk =
      initOk && runCaptured(['git', 'add', '-A'], targetDir, 'git add -A', 'Git staging');
    const commitOk =
      addOk &&
      runCaptured(
        ['git', 'commit', '-m', 'chore: initial commit from create-nextrush'],
        targetDir,
        'git commit -m "chore: initial commit from create-nextrush"',
        'Git initial commit'
      );

    s.stop(
      commitOk ? 'Git repository initialized.' : 'Git initialization incomplete — see the error above.'
    );
  }

  let installSkipped = false;
  if (install) {
    // Local runtime preflight (F-08): before an install/run, a selected bun/deno runtime
    // must be on PATH or we give actionable guidance; `--skip-runtime-check` opts out for
    // remote/container targets.
    if (!skipRuntimeCheck) {
      const preflight = preflightRuntimeBinary(runtime);
      if (!preflight.ok && preflight.guidance) {
        console.warn(`\n${preflight.guidance}\n`);
        p.cancel('Dependency installation aborted — install the runtime or skip the check.');
        return;
      }
    }

    const validation = validatePackageManager(packageManager);
    if (!validation.ok && validation.guidance) {
      console.error(`\n${validation.guidance}\n`);
      p.cancel('Dependency installation aborted — see guidance above.');
      return;
    }
    if (validation.ok && validation.guidance) {
      console.warn(`\n${validation.guidance}\n`);
    }

    if (!validation.skipInstall) {
      const argv = getInstallArgv(packageManager);
      s.start(`Installing dependencies via ${packageManager}...`);
      const installOk = runCaptured(
        argv,
        targetDir,
        getInstallCommandLabel(packageManager),
        'Dependency installation'
      );
      s.stop(installOk ? 'Dependencies installed.' : 'Dependency installation failed — see the error above.');
    } else {
      installSkipped = true;
      s.stop('Dependency installation skipped.');
    }
  }

  const runCmd = getRunCommand(packageManager);
  const nextSteps = [];

  if (directory !== '.') {
    nextSteps.push(`cd ${directory}`);
  }
  if (!install || installSkipped) {
    nextSteps.push(getInstallCommandLabel(packageManager));
  }
  nextSteps.push(`${runCmd} dev`);
  nextSteps.push(`# then open ${verificationUrl}`);
  nextSteps.push('');
  nextSteps.push('Production validation:');
  nextSteps.push(`${runCmd} build && ${getStartCommand(packageManager)}`);
  nextSteps.push('# then open the health endpoint and check https://nextrush.dev/docs/production');

  p.note(nextSteps.join('\n'), 'Next steps');
  p.outro('Happy coding with NextRush!');
}

main().catch((error: unknown) => {
  if (error instanceof CliInputError) {
    renderInputError(error.toPayload(), requestedJsonOutput(process.argv));
    process.exitCode = 1;
    return;
  }

  p.cancel('An unexpected error occurred.');
  if (error instanceof Error) {
    console.error(error.message);
  }
  process.exit(1);
});
