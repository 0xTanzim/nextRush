/**
 * @nextrush/cookies - secure: 'auto' resolution (SEC-08)
 *
 * Resolves the effective `Secure` attribute for `secure: 'auto'` (the
 * default): `Secure` is emitted unless the request is demonstrably
 * plaintext loopback. An untrusted `X-Forwarded-Proto: https` claim never
 * suppresses `Secure` — the framework fails closed toward the safer
 * attribute rather than trusting an unauthenticated header.
 *
 * @packageDocumentation
 */

import type { Context } from '@nextrush/types';
import type { CookieOptions } from './types.js';

/** Loopback addresses recognized for the plaintext-loopback dev carve-out. */
const LOOPBACK_IPS = new Set(['127.0.0.1', '::1', '::', '::ffff:127.0.0.1']);

function isLoopbackIp(ip: string): boolean {
  return LOOPBACK_IPS.has(ip);
}

/**
 * Duck-types the Node adapter's `req.socket.encrypted` (and the analogous
 * shape on any adapter that surfaces one) without importing `node:*` or any
 * runtime-specific type — this package stays dependency-free and runtime-
 * agnostic (project-rules.instructions.md §2).
 */
function isTransportEncrypted(ctx: Context): boolean {
  const req = (ctx.raw as { req?: unknown } | undefined)?.req as
    | { socket?: { encrypted?: boolean }; encrypted?: boolean }
    | undefined;
  if (!req) return false;
  return req.socket?.encrypted === true || req.encrypted === true;
}

function hasTrustedForwardedHttps(ctx: Context, trustProxy: boolean): boolean {
  if (!trustProxy) return false;
  const header = ctx.get('x-forwarded-proto') ?? ctx.headers['x-forwarded-proto'];
  const value = Array.isArray(header) ? header[0] : header;
  return typeof value === 'string' && (value.split(',')[0] ?? '').trim().toLowerCase() === 'https';
}

/**
 * Resolves whether `Secure` should be emitted for `secure: 'auto'`.
 *
 * Precedence: real TLS wins outright; otherwise a trusted-forwarded HTTPS
 * claim wins; otherwise plaintext loopback is the sole carve-out that omits
 * `Secure`; every other case emits `Secure` (fail closed, SEC-08).
 */
function resolveAutoSecure(ctx: Context, trustProxy: boolean): boolean {
  if (isTransportEncrypted(ctx)) return true;
  if (hasTrustedForwardedHttps(ctx, trustProxy)) return true;
  if (isLoopbackIp(ctx.ip)) return false;
  return true;
}

/**
 * Resolves the wire `secure` option for a single cookie: an explicit
 * `true`/`false` is honored as-is; `'auto'` (including the merged default)
 * is resolved per-request via {@link resolveAutoSecure} (SEC-08).
 */
export function resolveSecureOption(
  ctx: Context,
  cookieOptions: CookieOptions,
  trustProxy: boolean
): boolean {
  const requested = cookieOptions.secure ?? 'auto';
  if (requested === 'auto') {
    return resolveAutoSecure(ctx, trustProxy);
  }
  return requested;
}
