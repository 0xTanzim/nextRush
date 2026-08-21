/**
 * @nextrush/express-bridge - `compat()` entry point
 *
 * Wraps one Connect/Express 3-arity middleware as a NextRush `Middleware`.
 * Registration-time checks (function, arity, not-an-array) throw synchronously
 * so a mistake fails at boot, not on the first request.
 *
 * @packageDocumentation
 */

import type { Context, Middleware } from '@nextrush/types';
import { createContinuation } from './continuation';
import { ExpressBridgeArityError, ExpressBridgeCapabilityError } from './errors';
import { isNodeShapedRaw } from './gate';
import { createRequestProxy } from './request-proxy';
import { createResponseProxy } from './response-proxy';
import type { ExpressMiddleware } from './types';

/**
 * A context whose `markResponded` is duck-called when a raw `res.end()` has
 * committed the response but `ctx.responded` is still false (Node-only).
 */
interface MarkableContext extends Context {
  markResponded?: () => void;
}

/**
 * Wrap one Express/Connect middleware function as a NextRush `Middleware`.
 *
 * The v1 normative contract is the 3-arity `(req, res, next)` signature.
 * 2-arity and 0/1-arity functions are P0-gated and never normative; `.length`
 * is a boot-time guard, not a semantic classifier. Arrays are not flattened.
 *
 * @throws {ExpressBridgeArityError} for an array or a 4+-arity function.
 * @throws {TypeError} for a non-function value.
 */
export function compat(fn: ExpressMiddleware): Middleware {
  if (typeof fn !== 'function') {
    throw new ExpressBridgeArityError('not-a-function');
  }
  if (Array.isArray(fn)) {
    throw new ExpressBridgeArityError('array');
  }
  if (fn.length >= 4) {
    throw new ExpressBridgeArityError('error-middleware');
  }

  return function expressBridgeMiddleware(ctx: Context, downstream: () => Promise<void>): Promise<void> {
    const raw = ctx.raw as { req?: unknown; res?: unknown };
    if (!isNodeShapedRaw(raw)) {
      // Reject rather than throw so the middleware contract is a settled
      // promise even outside `compose()`'s try/catch.
      return Promise.reject(new ExpressBridgeCapabilityError());
    }

    const rawReq = raw.req as Record<string | symbol, unknown>;
    const rawRes = raw.res as { headersSent?: boolean };

    const continuation = createContinuation({
      ctx,
      downstream,
      rawRes,
    });

    const req = createRequestProxy(ctx, rawReq);
    const res = createResponseProxy({
      ctx,
      rawRes,
      onTerminal: () => {
        continuation.markTerminated();
      },
    });

    try {
      const result = fn(req, res, continuation.expressNext);
      continuation.adoptReturn(result);
    } catch (err: unknown) {
      continuation.fail(err);
    } finally {
      // A raw `res.end()` commits headers without setting `ctx.responded`.
      // Duck-call the Node-only `markResponded()` so `compose()` after-hooks and
      // double-response warnings observe the committed state (D8).
      const markable = ctx as MarkableContext;
      if (rawRes.headersSent === true && !ctx.responded && typeof markable.markResponded === 'function') {
        markable.markResponded();
      }
    }

    return continuation.promise;
  };
}
