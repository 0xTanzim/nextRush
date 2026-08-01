/**
 * @nextrush/router - Redirect Handler Compilation
 *
 * Single, shared redirect implementation used by both `Router.redirect()` and
 * route groups (audit RT-4). Previously the group variant used a naive
 * `replaceAll(':key', value)` that could mis-substitute overlapping param names
 * and re-scanned the string per request; this precompiles the target template
 * once and only substitutes route-style `:param` slots (a `:` at position 0 or
 * preceded by `/`), so `https://` and other literal colons are never touched.
 *
 * @packageDocumentation
 */

import type { Context, RouteHandler } from '@nextrush/types';

/** HTTP redirect status codes supported by `redirect()`. */
export type RedirectStatus = 301 | 302 | 303 | 307 | 308;

/**
 * Precompile a redirect target into alternating literal / param-name parts.
 *
 * @param to - Target path/URL, possibly containing `:param` placeholders.
 * @returns A parts array (`[literal, paramName, literal, …]`) when `to` has
 *   route-style params, otherwise `undefined` (a static target).
 */
export function compileRedirectTarget(to: string): string[] | undefined {
  const parts: string[] = [];
  let pos = 0;
  let found = false;

  while (pos < to.length) {
    let idx = -1;
    for (let i = pos; i < to.length; i++) {
      if (to[i] === ':' && (i === 0 || to[i - 1] === '/') && i + 1 < to.length && to[i + 1] !== '/') {
        idx = i;
        break;
      }
    }
    if (idx === -1) break;

    found = true;
    parts.push(to.slice(pos, idx)); // literal before ':'
    const end = to.indexOf('/', idx + 1);
    if (end === -1) {
      parts.push(to.slice(idx + 1)); // param name (rest of string)
      pos = to.length;
    } else {
      parts.push(to.slice(idx + 1, end)); // param name
      pos = end;
    }
  }

  if (found) {
    parts.push(to.slice(pos)); // trailing literal
    return parts;
  }
  return undefined;
}

/**
 * Build the redirect route handler for a `to`/`status` pair. Substitutes any
 * `:param` placeholders from `ctx.params` using the precompiled template.
 *
 * @param to - Target path/URL.
 * @param status - Redirect status code.
 * @returns A {@link RouteHandler} that sets `Location` and the status.
 */
export function createRedirectHandler(to: string, status: RedirectStatus): RouteHandler {
  const compiledParts = compileRedirectTarget(to);

  return (ctx: Context) => {
    let targetPath: string;

    if (compiledParts) {
      const params = ctx.params;
      const head = compiledParts[0];
      if (head === undefined) {
        targetPath = to;
      } else {
        let result = head;
        for (let i = 1; i < compiledParts.length - 1; i += 2) {
          const paramKey = compiledParts[i];
          const tail = compiledParts[i + 1];
          if (paramKey === undefined || tail === undefined) break;
          result += (params[paramKey] ?? '') + tail;
        }
        targetPath = result;
      }
    } else {
      targetPath = to;
    }

    ctx.status = status;
    ctx.set('Location', targetPath);
    ctx.body = '';
  };
}
