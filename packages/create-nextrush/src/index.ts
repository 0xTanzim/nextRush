import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

import * as p from '@clack/prompts';

import { parseArgs, printHelp } from './cli.js';
import { MIN_NODE_MAJOR, NEXTRUSH_VERSION } from './constants.js';
import { generateProject } from './generator.js';
import { validatePackageManager } from './installer.js';
import { resolveVersions } from './npm-version.js';
import { runPrompts } from './prompts.js';
import { getAllPossiblePackageNames } from './templates/index.js';
import {
  getInstallArgv,
  getInstallCommandLabel,
  getRunCommand,
  isDirectoryEmpty,
  writeFiles,
} from './utils.js';
import { setVersionMap } from './version-store.js';

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

  p.intro('create-nextrush');

  // Version probing is gated on install: a --no-install offline scaffold never uses the
  // resolved ranges for anything but display, so skip the network round-trip entirely
  // (fixes F-18 — Doherty Threshold: no dead wait when nothing will be installed).
  if (args.install) {
    const s = p.spinner();
    s.start('Checking latest versions...');
    const versions = await resolveVersions(getAllPossiblePackageNames());
    setVersionMap(versions);
    s.stop(`Using nextrush ${versions.get('nextrush') ?? NEXTRUSH_VERSION}`);
  } else {
    setVersionMap(await resolveVersions(getAllPossiblePackageNames()));
  }

  const options = await runPrompts(args);

  if (typeof options === 'symbol') {
    return;
  }

  const targetDir = resolve(options.directory);
  await confirmNonEmptyTargetOrExit(options.directory, targetDir);

  const s = p.spinner();
  s.start('Scaffolding project...');
  const files = generateProject(options);
  writeFiles(targetDir, files);
  s.stop('Project scaffolded.');

  finishScaffold({
    targetDir,
    directory: options.directory,
    packageManager: options.packageManager,
    git: options.git,
    install: options.install,
    verificationUrl: getVerificationUrl(options.style),
  });
}

/** Shared: warn and confirm before scaffolding into a non-empty directory. */
async function confirmNonEmptyTargetOrExit(directoryLabel: string, targetDir: string): Promise<void> {
  if (isDirectoryEmpty(targetDir)) return;

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
  git: boolean;
  install: boolean;
  verificationUrl: string;
}): void {
  const { targetDir, directory, packageManager, git, install, verificationUrl } = input;
  const s = p.spinner();

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

  p.note(nextSteps.join('\n'), 'Next steps');
  p.outro('Happy coding with NextRush!');
}

/** The URL to open to verify the scaffolded app is running, for the selected style (fixes F-15). */
function getVerificationUrl(style: 'functional' | 'class-based' | 'full'): string {
  if (style === 'functional') return 'http://localhost:8080/health';
  if (style === 'class-based') return 'http://localhost:8080/api/health';
  return 'http://localhost:8080/health';
}

main().catch((error: unknown) => {
  p.cancel('An unexpected error occurred.');
  if (error instanceof Error) {
    console.error(error.message);
  }
  process.exit(1);
});
