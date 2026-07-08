/**
 * @nextrush/dev - Dev command helpers
 *
 * Pure port- and runtime-resolution helpers extracted from the dev command so
 * `commands/dev.ts` stays within the file-size ceiling.
 *
 * @packageDocumentation
 */

import {
    detectRuntime,
    exitProcess,
    getCwd,
    getEnv,
    readFileSync,
    resolvePath,
    type Runtime,
} from '../runtime/index.js';
import { error } from '../utils/logger.js';

/** Default port the dev server binds to when none is provided. */
export const DEFAULT_DEV_PORT = 8080;

/**
 * Parse a CLI flag value as a positive integer, exiting with an error when it
 * is missing or not a positive integer.
 */
export function parsePositiveInteger(value: string | undefined, flag: string): number {
  const parsed = Number(value);

  if (!value || !Number.isInteger(parsed) || parsed <= 0) {
    error(`${flag} expects a positive integer.`);
    exitProcess(1);
  }

  return parsed;
}

/**
 * Resolve the dev server port: explicit option first, then the `PORT` env var,
 * then the default.
 */
export function resolveDevPort(explicitPort: number | undefined): number {
  if (explicitPort !== undefined) {
    return explicitPort;
  }

  const envPort = getEnv('PORT');
  if (!envPort) {
    return DEFAULT_DEV_PORT;
  }

  const parsed = Number(envPort);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_DEV_PORT;
}

/**
 * Detect the project's target runtime from its package.json adapter dependency.
 * Falls back to the CLI process's runtime when not found or on error.
 */
export function detectProjectRuntime(): Runtime {
  try {
    const pkgPath = resolvePath(getCwd(), 'package.json');
    const content = readFileSync(pkgPath);
    const pkg = JSON.parse(content) as Record<string, unknown>;
    const deps: Record<string, string> = {
      ...((pkg.dependencies as Record<string, string> | undefined) ?? {}),
      ...((pkg.devDependencies as Record<string, string> | undefined) ?? {}),
    };
    if (deps['@nextrush/adapter-bun']) return 'bun';
    if (deps['@nextrush/adapter-deno']) return 'deno';
  } catch {
    // package.json may not exist yet; fall through to process runtime
  }
  return detectRuntime();
}
