/**
 * @nextrush/express-bridge - Express-shaped cookie serializer
 *
 * Express `res.cookie` has different units and defaults from NextRush's
 * `ctx.cookies.set`, so the bridge serializes cookies itself rather than
 * passing Express option objects through. No `cookie` npm dependency.
 *
 * @packageDocumentation
 */

import { UnsupportedExpressApiError } from './errors';

/** Express/`cookie`-style options accepted by the bridge's `res.cookie`. */
export interface ExpressCookieOptions {
  domain?: string;
  path?: string;
  expires?: Date;
  maxAge?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none' | boolean;
  priority?: string;
  partitioned?: boolean;
  signed?: boolean;
  encode?: (value: string) => string;
}

/**
 * Serialize a single `Set-Cookie` value with Express defaults.
 *
 * `maxAge` is expressed in **milliseconds** (as Express/`cookie` expect) and
 * serialized to `Max-Age` in seconds. `httpOnly` / `secure` / `sameSite` are
 * omitted unless the caller supplied them — NextRush's secure defaults must
 * not leak into the Express API.
 */
export function serializeCookie(
  name: string,
  value: string,
  options: ExpressCookieOptions = {}
): string {
  if (options.signed === true) {
    throw new UnsupportedExpressApiError('res.cookie({ signed: true })');
  }

  const encode = options.encode ?? encodeURIComponent;
  let out = `${name}=${encode(value)}`;

  if (options.maxAge !== undefined) {
    const maxAge = options.maxAge - 0;
    if (!Number.isNaN(maxAge)) {
      out += `; Max-Age=${Math.floor(maxAge / 1000).toString()}`;
    }
  }

  if (options.domain !== undefined) {
    out += `; Domain=${options.domain}`;
  }

  const path = options.path ?? '/';
  out += `; Path=${path}`;

  if (options.expires !== undefined) {
    out += `; Expires=${options.expires.toUTCString()}`;
  }

  if (options.httpOnly === true) {
    out += '; HttpOnly';
  }

  if (options.secure === true) {
    out += '; Secure';
  }

  if (options.partitioned === true) {
    out += '; Partitioned';
  }

  if (options.priority !== undefined) {
    out += `; Priority=${options.priority}`;
  }

  if (options.sameSite !== undefined) {
    const sameSite = options.sameSite === true ? 'Strict' : options.sameSite === false ? 'None' : options.sameSite;
    out += `; SameSite=${sameSite}`;
  }

  return out;
}
