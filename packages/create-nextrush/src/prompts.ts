import * as p from '@clack/prompts';

import {
  DEFAULT_MIDDLEWARE,
  DEFAULT_RUNTIME,
  DEFAULT_STYLE,
  MIDDLEWARE_PRESETS,
  RUNTIMES,
  STYLES,
} from './constants.js';
import type { MiddlewarePreset, ParsedArgs, ProjectOptions, Runtime, Style } from './types.js';
import { detectPackageManager, toPackageName, validateProjectName } from './utils.js';

const STYLE_LABELS: Record<Style, string> = {
  functional: 'Functional — routes only, no decorators',
  'class-based': 'Class-based — controllers, DI, decorators',
  full: 'Full — controllers + routes + middleware + error handling',
};

const RUNTIME_LABELS: Record<Runtime, string> = {
  node: 'Node.js',
  bun: 'Bun',
  deno: 'Deno',
};

const MIDDLEWARE_LABELS: Record<MiddlewarePreset, string> = {
  minimal: 'Minimal — no middleware',
  api: 'API — cors, body-parser, helmet',
  full: 'Full — API + rate-limit, compression, request-id',
};

/** Runs interactive prompts, merging with any CLI-provided values. */
export async function runPrompts(args: ParsedArgs): Promise<ProjectOptions | symbol> {
  // When --yes is passed or all values are pre-filled, skip interactive prompts
  if (args.yes || (args.directory && args.style && args.runtime && args.middleware)) {
    return resolveFromArgs(args);
  }

  const group = await p.group(
    {
      directory: () => {
        if (args.directory) return Promise.resolve(args.directory);

        return p.text({
          message: 'Where should we create your project?',
          placeholder: './my-app',
          validate: (value) => {
            if (!value) return 'Please enter a directory';
            return undefined;
          },
        });
      },

      style: () => {
        if (args.style) return Promise.resolve(args.style);

        return p.select({
          message: 'Which style do you want?',
          options: STYLES.map((s) => ({
            value: s,
            label: STYLE_LABELS[s],
          })),
          initialValue: DEFAULT_STYLE,
        });
      },

      runtime: () => {
        if (args.runtime) return Promise.resolve(args.runtime);

        return p.select({
          message: 'Which runtime?',
          options: RUNTIMES.map((r) => ({
            value: r,
            label: RUNTIME_LABELS[r],
          })),
          initialValue: DEFAULT_RUNTIME,
        });
      },

      middleware: () => {
        if (args.middleware) return Promise.resolve(args.middleware);

        return p.select({
          message: 'Middleware preset?',
          options: MIDDLEWARE_PRESETS.map((m) => ({
            value: m,
            label: MIDDLEWARE_LABELS[m],
          })),
          initialValue: DEFAULT_MIDDLEWARE,
        });
      },

      install: () => {
        if (args.yes || !args.install) return Promise.resolve(args.install);

        return p.confirm({
          message: 'Install dependencies?',
          initialValue: true,
        });
      },

      git: () => {
        if (args.yes || !args.git) return Promise.resolve(args.git);

        return p.confirm({
          message: 'Initialize a git repository?',
          initialValue: true,
        });
      },
    },
    {
      onCancel: () => {
        p.cancel('Operation cancelled.');
        process.exit(0);
      },
    }
  );

  const directory = group.directory as string;
  const name = toPackageName(directory.replace(/^\.\//, ''));
  const nameError = validateProjectName(name);

  if (nameError) {
    p.cancel(`Invalid project name "${name}": ${nameError}`);
    process.exit(1);
  }

  return {
    name,
    directory,
    style: group.style as Style,
    runtime: group.runtime as Runtime,
    middleware: group.middleware as MiddlewarePreset,
    packageManager: args.packageManager ?? detectPackageManager(),
    git: group.git as boolean,
    install: group.install as boolean,
  };
}

/** Resolves ProjectOptions directly from CLI args without interactive prompts. */
function resolveFromArgs(args: ParsedArgs): ProjectOptions {
  const directory = args.directory ?? 'my-nextrush-app';
  const name = toPackageName(directory.replace(/^\.\//, ''));
  const nameError = validateProjectName(name);

  if (nameError) {
    p.cancel(`Invalid project name "${name}": ${nameError}`);
    process.exit(1);
  }

  return {
    name,
    directory,
    style: args.style ?? DEFAULT_STYLE,
    runtime: args.runtime ?? DEFAULT_RUNTIME,
    middleware: args.middleware ?? DEFAULT_MIDDLEWARE,
    packageManager: args.packageManager ?? detectPackageManager(),
    git: args.git,
    install: args.install,
  };
}
