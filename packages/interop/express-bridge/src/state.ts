/**
 * @nextrush/express-bridge - Shared request-state projection
 *
 * Ad-hoc `req.<key>` writes project onto `ctx.state` as a single shared
 * namespace (last-write-wins on the same key), guarded by a frozen prototype
 * denylist. `NodeContext.state` is a plain `{}`, so a naive write is a
 * prototype-pollution path — every projection goes through `Object.defineProperty`.
 *
 * @packageDocumentation
 */

import type { Context } from '@nextrush/types';
import { isDenylisted } from './surface';

/**
 * Whether `key` is safe to project onto `ctx.state` (i.e. not denylisted).
 */
export function isSafeStateKey(key: string | symbol): boolean {
  return !isDenylisted(key);
}

/**
 * Project an ad-hoc write onto `ctx.state` using a define-property so a
 * denylisted key never reaches the object's prototype chain.
 */
export function projectState(ctx: Context, key: string | symbol, value: unknown): boolean {
  if (!isSafeStateKey(key)) {
    return false;
  }
  Object.defineProperty(ctx.state, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
  return true;
}

/**
 * Read an ad-hoc value back from `ctx.state`, or `undefined` if absent or denylisted.
 */
export function readState(ctx: Context, key: string | symbol): unknown {
  if (!isSafeStateKey(key)) {
    return undefined;
  }
  return (ctx.state as Record<string | symbol, unknown>)[key];
}
