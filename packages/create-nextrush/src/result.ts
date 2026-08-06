import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { CliErrorPayload } from './types.js';
import type { ScaffoldPlan } from './plan.js';

/** Increment only for incompatible changes to the JSON automation contract. */
export const RESULT_SCHEMA_VERSION = 1;

export interface ScaffoldErrorResult {
  readonly schemaVersion: typeof RESULT_SCHEMA_VERSION;
  readonly ok: false;
  readonly error: CliErrorPayload;
}

export interface ScaffoldSuccessResult {
  readonly schemaVersion: typeof RESULT_SCHEMA_VERSION;
  readonly ok: true;
  readonly dryRun: boolean;
  /** True when `--offline` was used: every emitted range is an embedded fallback range. */
  readonly offline: boolean;
  readonly project: {
    readonly name: string;
    readonly directory: string;
    readonly targetDirectory: string;
    readonly style: string;
    readonly runtime: string;
    readonly middleware: string;
    readonly packageManager: string;
    readonly install: boolean;
    readonly git: boolean;
    readonly verificationUrl: string;
  };
  readonly files: readonly { readonly path: string; readonly action: 'create' | 'replace' }[];
}

export function createErrorResult(error: CliErrorPayload): ScaffoldErrorResult {
  return { schemaVersion: RESULT_SCHEMA_VERSION, ok: false, error };
}

export function createSuccessResult(plan: ScaffoldPlan, dryRun: boolean, offline = false): ScaffoldSuccessResult {
  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    ok: true,
    dryRun,
    offline,
    project: {
      name: plan.options.name,
      directory: plan.options.directory,
      targetDirectory: plan.targetDir,
      style: plan.options.style,
      runtime: plan.options.runtime,
      middleware: plan.options.middleware,
      packageManager: plan.options.packageManager,
      install: plan.options.install,
      git: plan.options.git,
      verificationUrl: plan.verificationUrl,
    },
    files: [...plan.files.keys()]
      .sort()
      .map((path) => ({ path, action: existsSync(join(plan.targetDir, path)) ? ('replace' as const) : ('create' as const) })),
  };
}

/** Emits a single JSON document or an actionable human error, never both. */
export function renderInputError(error: CliErrorPayload, json: boolean): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(createErrorResult(error))}\n`);
    return;
  }

  // The stable code is part of the human contract too (e.g. `error [TARGET_DIRECTORY_NOT_EMPTY]:`),
  // so terminal users and automation can agree on the same failure identity.
  process.stderr.write(`error [${error.code}]: ${error.message}\nHow to fix: ${error.remediation}\n`);
}

export function renderSuccess(result: ScaffoldSuccessResult, json: boolean): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }

  if (result.dryRun) {
    const lines = [
      'Dry run — no files were written.',
      `Target: ${result.project.targetDirectory}`,
      `Files: ${result.files.length.toString()}`,
      `Health check: ${result.project.verificationUrl}`,
    ];
    if (result.offline) lines.push('Offline mode: emitted version ranges are embedded fallback ranges.');
    process.stdout.write(lines.join('\n') + '\n');
  }
}

/** Detect JSON mode even when parsing fails before a ParsedArgs object exists. */
export function requestedJsonOutput(argv: readonly string[]): boolean {
  return argv.includes('--json');
}
