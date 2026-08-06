import * as p from '@clack/prompts';

import {
  DEFAULT_MIDDLEWARE,
  DEFAULT_RUNTIME,
  DEFAULT_STYLE,
  MIDDLEWARE_PRESETS,
  RUNTIMES,
  STYLES,
} from './constants.js';
import type {
  MiddlewarePreset,
  PackageManager,
  ParsedArgs,
  ProjectOptions,
  Runtime,
  Style,
} from './types.js';
import { deriveProjectName, resolvePackageManagerWithSource, validateProjectName } from './utils.js';
import { resolveWorkspaceDestination } from './workspace.js';

const STYLE_LABELS: Record<Style, string> = {
  functional: 'Functional — routes only, no decorators',
  'class-based': 'Class-based — controllers, DI, decorators (routes under /api)',
  full: 'Full — controllers + routes + middleware + error handling (controllers under /api)',
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

/** The one-decision recommended Node API starter (F-06): functional + node + api middleware. */
export const RECOMMENDED_STARTER: { style: Style; runtime: Runtime; middleware: MiddlewarePreset } = {
  style: DEFAULT_STYLE,
  runtime: DEFAULT_RUNTIME,
  middleware: DEFAULT_MIDDLEWARE,
};

/**
 * Resolves the full ProjectOptions for the recommended starter with zero architecture prompts.
 * `directory`/`name` still come from the caller (prompted or flagged).
 */
export function recommendedStarterOptions(
  name: string,
  directory: string,
  git = true,
  install = true,
  extras: Partial<Pick<ProjectOptions, 'preset' | 'example' | 'workspace'>> = {}
): ProjectOptions {
  return {
    name,
    directory,
    style: RECOMMENDED_STARTER.style,
    runtime: RECOMMENDED_STARTER.runtime,
    middleware: RECOMMENDED_STARTER.middleware,
    packageManager: resolvePackageManager(RECOMMENDED_STARTER.runtime),
    git,
    install,
    ...extras,
  };
}

/**
 * Decides whether the user needs the Customize group: an explicit architecture flag (style,
 * runtime, or middleware) already encodes a choice, so it always wins. Non-interactive modes
 * (`--yes`/`--json`) bypass the gate entirely.
 */
export function shouldCustomize(args: ParsedArgs): boolean {
  if (args.yes || args.json) return false;
  return args.style !== undefined || args.runtime !== undefined || args.middleware !== undefined;
}

/** Runs interactive prompts, merging with any CLI-provided values. */
export async function runPrompts(args: ParsedArgs): Promise<ProjectOptions | symbol> {
  // When --yes is passed or all values are pre-filled, skip interactive prompts
  if (args.yes || args.json || (args.directory && args.style && args.runtime && args.middleware)) {
    return resolveFromArgs(args);
  }

  const directory =
    args.directory ??
    (await p.text({
      message: 'Where should we create your project?',
      placeholder: './my-app',
      validate: (value) => {
        if (!value) return 'Please enter a directory';
        return undefined;
      },
    }));

  if (typeof directory === 'symbol' || p.isCancel(directory)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }

  const name = deriveProjectName(directory);
  const nameError = validateProjectName(name);
  if (nameError) {
    p.cancel(`Invalid project name "${name}": ${nameError}`);
    process.exit(1);
  }

  // Workspace mode (design decision 6): resolve the apps/<name> destination against the
  // detected pnpm workspace, or fail with actionable guidance before writing.
  if (args.workspace) {
    const ws = resolveWorkspaceDestination(name, process.cwd());
    if (!ws.ok) {
      p.cancel(`Workspace scaffolding unavailable: ${ws.guidance}`);
      process.exit(1);
    }
    return recommendedStarterOptions(name, ws.destination, args.git, args.install, {
      workspace: true,
    });
  }

  // Progressive disclosure (F-06): first-time interactive users get ONE decision — accept the
  // recommended Node API starter, or open the Customize group.
  if (!shouldCustomize(args)) {
    const starterChoice = await p.select({
      message: 'Use the recommended Node API starter?',
      options: [
        { value: 'recommended', label: 'Recommended Node API starter (functional + API middleware)' },
        { value: 'customize', label: 'Customize style, runtime, middleware, and package manager' },
      ],
      initialValue: 'recommended',
    });

    if (p.isCancel(starterChoice)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    if (starterChoice === 'recommended') {
      return recommendedStarterOptions(name, directory, args.git, args.install);
    }
  }

  const group = await p.group(
    {
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

      packageManager: () => {
        if (args.packageManager) return Promise.resolve(args.packageManager);

        return p.select({
          message: 'Which package manager?',
          options: (['npm', 'pnpm', 'yarn', 'bun'] as const).map((pm) => ({
            value: pm,
            label: pm,
          })),
          initialValue: resolvePackageManager('node'),
        });
      },

      install: () => {
        if (args.yes || args.installExplicit) return Promise.resolve(args.install);

        return p.confirm({
          message: 'Install dependencies?',
          initialValue: true,
        });
      },

      git: () => {
        if (args.yes || args.gitExplicit) return Promise.resolve(args.git);

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

  return {
    name,
    directory,
    style: group.style,
    runtime: group.runtime,
    middleware: group.middleware,
    packageManager: group.packageManager,
    git: group.git,
    install: group.install,
    ...(args.preset ? { preset: args.preset } : {}),
    ...(args.example ? { example: args.example } : {}),
  };
}

/** Resolves ProjectOptions directly from CLI args without interactive prompts. */
export function resolveFromArgs(args: ParsedArgs): ProjectOptions {
  const directory = args.directory ?? 'my-nextrush-app';
  const runtime = args.runtime ?? DEFAULT_RUNTIME;
  const name = deriveProjectName(directory);
  const nameError = validateProjectName(name);

  if (nameError) {
    p.cancel(`Invalid project name "${name}": ${nameError}`);
    process.exit(1);
  }

  if (args.workspace) {
    const ws = resolveWorkspaceDestination(name, process.cwd());
    if (!ws.ok) {
      p.cancel(`Workspace scaffolding unavailable: ${ws.guidance}`);
      process.exit(1);
    }
    return recommendedStarterOptions(name, ws.destination, args.git, args.install, {
      workspace: true,
      ...(args.preset ? { preset: args.preset } : {}),
      ...(args.example ? { example: args.example } : {}),
    });
  }

  return {
    name,
    directory,
    style: args.style ?? DEFAULT_STYLE,
    runtime,
    middleware: args.middleware ?? DEFAULT_MIDDLEWARE,
    packageManager: resolvePackageManager(runtime, args.packageManager),
    git: args.git,
    install: args.install,
    ...(args.preset ? { preset: args.preset } : {}),
    ...(args.example ? { example: args.example } : {}),
  };
}

function resolvePackageManager(runtime: Runtime, explicit?: PackageManager): PackageManager {
  return resolvePackageManagerWithSource(runtime, explicit).packageManager;
}
