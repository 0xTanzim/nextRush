import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

import * as p from '@clack/prompts';

import { parseArgs, printHelp } from './cli.js';
import { NEXTRUSH_VERSION } from './constants.js';
import { generateProject } from './generator.js';
import { runPrompts } from './prompts.js';
import { getInstallCommand, getRunCommand, isDirectoryEmpty, writeFiles } from './utils.js';

async function main(): Promise<void> {
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

  const options = await runPrompts(args);

  if (typeof options === 'symbol') {
    return;
  }

  const targetDir = resolve(options.directory);

  // Validate target directory
  if (!isDirectoryEmpty(targetDir)) {
    const shouldContinue = await p.confirm({
      message: `Directory "${options.directory}" is not empty. Continue anyway?`,
      initialValue: false,
    });

    if (p.isCancel(shouldContinue) || !shouldContinue) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }
  }

  // Generate files
  const s = p.spinner();
  s.start('Scaffolding project...');

  const files = generateProject(options);
  writeFiles(targetDir, files);

  s.stop('Project scaffolded.');

  // Initialize git
  if (options.git) {
    s.start('Initializing git repository...');
    try {
      execSync('git init', { cwd: targetDir, stdio: 'ignore' });
      execSync('git add -A', { cwd: targetDir, stdio: 'ignore' });
      s.stop('Git repository initialized.');
    } catch {
      s.stop('Git initialization failed (git may not be installed).');
    }
  }

  // Install dependencies
  if (options.install) {
    const cmd = getInstallCommand(options.packageManager);
    s.start(`Installing dependencies via ${options.packageManager}...`);
    try {
      execSync(cmd, { cwd: targetDir, stdio: 'ignore' });
      s.stop('Dependencies installed.');
    } catch {
      s.stop('Dependency installation failed. Run install manually.');
    }
  }

  // Done
  const runCmd = getRunCommand(options.packageManager);
  const nextSteps = [];

  if (options.directory !== '.') {
    nextSteps.push(`cd ${options.directory}`);
  }

  if (!options.install) {
    nextSteps.push(getInstallCommand(options.packageManager));
  }

  nextSteps.push(`${runCmd} dev`);

  p.note(nextSteps.join('\n'), 'Next steps');
  p.outro('Happy hacking!');
}

main().catch((error: unknown) => {
  p.cancel('An unexpected error occurred.');
  if (error instanceof Error) {
    console.error(error.message);
  }
  process.exit(1);
});
