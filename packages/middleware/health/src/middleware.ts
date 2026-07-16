/**
 * @nextrush/health - Middleware
 *
 * Liveness and readiness endpoints for orchestrator probes.
 *
 * @packageDocumentation
 */

import type { Context, Middleware, Next } from '@nextrush/types';

import {
  DEFAULT_CHECK_TIMEOUT_MS,
  DEFAULT_LIVEZ_PATH,
  DEFAULT_READYZ_PATH,
  HTTP_OK,
  HTTP_SERVICE_UNAVAILABLE,
  STATUS_ERROR,
  STATUS_OK,
} from './constants';
import type { CheckFn, HealthInstance, HealthOptions } from './types';

// ============================================================================
// Check execution
// ============================================================================

/**
 * Runs a single check with a bounded timeout.
 *
 * A check that throws, returns `false`, or fails to settle within
 * `timeoutMs` all resolve to `false` here — the caller doesn't need to
 * distinguish "hung" from "explicitly failed" (design.md Risks: a hung
 * check must not hang `/readyz` indefinitely).
 */
async function runCheckWithTimeout(check: CheckFn, timeoutMs: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => {
      resolve(false);
    }, timeoutMs);
  });

  const invocation = (async (): Promise<boolean> => {
    try {
      return await check();
    } catch {
      // A throwing check is a failing check, not an error that propagates
      // to the caller — the endpoint reports it as an unhealthy check, it
      // never surfaces an internal stack trace to the client (project-rules
      // §3/§4: no internal detail leaks in production error responses).
      return false;
    }
  })();

  try {
    return await Promise.race([invocation, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Runs every registered check concurrently and returns a name→pass map.
 */
async function runAllChecks(
  checks: Map<string, CheckFn>,
  timeoutMs: number
): Promise<Record<string, boolean>> {
  const entries = Array.from(checks.entries());
  const results = await Promise.all(
    entries.map(async ([name, check]) => [name, await runCheckWithTimeout(check, timeoutMs)] as const)
  );
  return Object.fromEntries(results);
}

// ============================================================================
// Health factory
// ============================================================================

/**
 * Creates the health middleware plus its check registry.
 *
 * Mount the returned `middleware` with `app.use()`. It responds directly to
 * `livezPath` and `readyzPath` and calls `next()` for every other path.
 *
 * @param options - Configuration options.
 * @returns A {@link HealthInstance} — `{ middleware, registerCheck }`.
 *
 * @example Basic usage
 * ```ts
 * import { health } from '@nextrush/health';
 *
 * const { middleware, registerCheck } = health();
 * app.use(middleware);
 *
 * registerCheck('database', async () => {
 *   await db.ping();
 *   return true;
 * });
 * ```
 *
 * @example Custom paths and check timeout
 * ```ts
 * const { middleware, registerCheck } = health({
 *   livezPath: '/health/live',
 *   readyzPath: '/health/ready',
 *   checkTimeoutMs: 2000,
 * });
 * ```
 */
export function health(options: HealthOptions = {}): HealthInstance {
  const {
    livezPath = DEFAULT_LIVEZ_PATH,
    readyzPath = DEFAULT_READYZ_PATH,
    checkTimeoutMs = DEFAULT_CHECK_TIMEOUT_MS,
  } = options;

  const checks = new Map<string, CheckFn>();

  function registerCheck(name: string, check: CheckFn): void {
    checks.set(name, check);
  }

  function respondLive(ctx: Context): void {
    // /livez NEVER evaluates registered checks (design.md D5) — it only
    // reflects that this handler ran, i.e. the process can respond at all.
    ctx.status = HTTP_OK;
    ctx.json({ status: STATUS_OK });
  }

  async function respondReady(ctx: Context): Promise<void> {
    const results = await runAllChecks(checks, checkTimeoutMs);
    const allPassed = Object.values(results).every(Boolean);

    ctx.status = allPassed ? HTTP_OK : HTTP_SERVICE_UNAVAILABLE;
    ctx.json({
      status: allPassed ? STATUS_OK : STATUS_ERROR,
      checks: results,
    });
  }

  const middleware: Middleware = async (ctx: Context, next: Next) => {
    if (ctx.path === livezPath) {
      respondLive(ctx);
      return;
    }

    if (ctx.path === readyzPath) {
      await respondReady(ctx);
      return;
    }

    await next();
  };

  return { middleware, registerCheck };
}
