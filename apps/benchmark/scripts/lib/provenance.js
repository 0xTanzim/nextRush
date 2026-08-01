/**
 * Run-time provenance capture — git commit/dirty-flag and the NextRush
 * adapter's effective (post-default) options, captured by the process that
 * runs the benchmark, never re-derived later by the report generator
 * (design.md D3). A version or config value read after the fact is not
 * evidence about what was actually measured.
 */

import { execSync } from 'node:child_process';

import { DEFAULT_KEEP_ALIVE_TIMEOUT_MS, DEFAULT_SHUTDOWN_TIMEOUT_MS, DEFAULT_TIMEOUT_MS } from '@nextrush/runtime';

/**
 * @param {{ cwd?: string }} [options]
 * @returns {{ commit: string | null, dirty: boolean | null }}
 */
export function captureGitProvenance(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  try {
    const commit = execSync('git rev-parse HEAD', { cwd, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    const status = execSync('git status --porcelain', { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    return { commit, dirty: status.trim().length > 0 };
  } catch {
    return { commit: null, dirty: null };
  }
}

const DEFAULT_HOST = '0.0.0.0';

/**
 * Mirrors `@nextrush/adapter-node`'s `serve()` defaulting exactly (imports the
 * real constants from `@nextrush/runtime` rather than duplicating their
 * values, so a future default change can never silently drift this capture
 * out of sync) so a benchmark server that passes no options — the common
 * case — still records what was actually in effect, not a silent, unrecorded
 * default.
 * @param {{ timeout?: number, keepAliveTimeout?: number, shutdownTimeout?: number, host?: string }} passedOptions
 */
export function captureNextRushEffectiveOptions(passedOptions = {}) {
  return {
    timeout: passedOptions.timeout ?? DEFAULT_TIMEOUT_MS,
    keepAliveTimeout: passedOptions.keepAliveTimeout ?? DEFAULT_KEEP_ALIVE_TIMEOUT_MS,
    shutdownTimeout: passedOptions.shutdownTimeout ?? DEFAULT_SHUTDOWN_TIMEOUT_MS,
    host: passedOptions.host ?? DEFAULT_HOST,
  };
}

/**
 * Captures effective timeout/keepAliveTimeout settings from a running server
 * instance (Node.js http.Server or any object exposing the same property
 * shape). Returns null with a stated reason when the object lacks timeout
 * introspection, so every framework in the benchmark matrix is treated
 * symmetrically rather than silently omitted.
 *
 * This is the framework-agnostic counterpart of
 * `captureNextRushEffectiveOptions` — it reads the *actual* values in effect
 * at runtime rather than re-deriving the declared defaults.
 *
 * @param {{ timeout?: number, keepAliveTimeout?: number } | null | undefined} server
 * @returns {{ timeout: number, keepAliveTimeout: number, _note?: string } | null}
 */
export function captureEffectiveServerOptions(server) {
  if (!server || typeof server.timeout === 'undefined') {
    return null;
  }
  return {
    timeout: server.timeout,
    keepAliveTimeout: server.keepAliveTimeout,
  };
}
