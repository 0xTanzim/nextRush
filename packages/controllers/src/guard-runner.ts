/**
 * @nextrush/controllers - Guard Runner
 *
 * Executes route guards (function-based and class-based) before the handler
 * runs. Class guards are resolved from the DI container.
 */

import type { CanActivate, Guard, GuardContext } from '@nextrush/decorators';
import { isGuardClass } from '@nextrush/decorators';
import type { Container } from '@nextrush/di';
import type { Context } from '@nextrush/types';
import { GuardRejectionError } from './errors.js';

/**
 * Execute guards and throw if any guard rejects.
 * Supports both function-based and class-based guards.
 * Class guards are resolved from the DI container.
 *
 * GuardContext snapshot contract:
 * - The {@link GuardContext} handed to each guard is a per-guard snapshot built
 *   once here, before any guard runs.
 * - `state` is the **live** `ctx.state` reference (not a copy): guards read and
 *   attach data through it (e.g. `ctx.state.user = ...`), and those mutations are
 *   visible to later guards and to the handler. This is the supported channel for
 *   a guard to pass data forward.
 * - `method`, `path`, `params`, `query`, `headers`, and `body` are captured **by
 *   value** at guard time. Guards see the request as it was when guards began; a
 *   guard cannot mutate the real request through these fields, and if middleware
 *   mutated `ctx` after this snapshot the guard would not observe it. Guards run
 *   before the handler, so this is not currently exploitable — but attach forward
 *   state via `state`, never by mutating the snapshotted fields.
 *
 * Rejection semantics:
 * - A guard that returns `false` throws {@link GuardRejectionError} (403).
 * - A guard that *throws* propagates its error unchanged, so a guard can throw
 *   `UnauthorizedError` (401) — or any other `HttpError` — and get the correct
 *   status and message. Errors are never swallowed or downgraded to a generic
 *   403; a bug in a guard surfaces as its real error rather than a masked 403.
 */
export async function executeGuards(
  guards: Guard[],
  ctx: Context,
  container: Container,
  _controllerName: string,
  _methodName: string
): Promise<void> {
  const guardContext: GuardContext = {
    method: ctx.method,
    path: ctx.path,
    params: ctx.params,
    query: ctx.query,
    headers: ctx.headers,
    body: ctx.body,
    state: ctx.state,
    get: (name: string) => ctx.get(name),
  };

  for (let i = 0; i < guards.length; i++) {
    const guard = guards[i]!;
    let guardName: string;
    let result: boolean;

    // A thrown guard error propagates unchanged (no try/catch conversion), so
    // typed HTTP errors keep their status/message/stack.
    if (isGuardClass(guard)) {
      // Class-based guard - resolve from DI container
      guardName = guard.name || `ClassGuard[${i}]`;
      const guardInstance = container.resolve(guard) as CanActivate;
      result = await guardInstance.canActivate(guardContext);
    } else {
      // Function-based guard
      guardName = guard.name || `Guard[${i}]`;
      result = await guard(guardContext);
    }

    if (!result) {
      throw new GuardRejectionError(guardName);
    }
  }
}
