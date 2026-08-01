/**
 * @nextrush/adapter-bun - Context Implementation
 *
 * Bun-specific Context implementation using Web Request/Response APIs.
 *
 * @remarks
 * Extends the shared {@link WebContextBase} (F-08, ADR-0010), which owns the
 * response-building logic (json/send/html/redirect/set/getResponse and body
 * suppression, composed from {@link WebResponseBuilder}), the lazy `raw`/
 * `signal`/`triggerTimeout`, the streaming methods, and
 * `get`/`next`/`throw`/`assert` — defined once across the Web adapters rather
 * than copy-pasted per runtime. This file supplies only what is genuinely
 * Bun-specific: resolving `ip` from `server.requestIP()`.
 *
 * @packageDocumentation
 */

import { getClientIp, getRuntime, WebContextBase } from '@nextrush/runtime';
import type { ProxyTrust } from '@nextrush/types';
import { runNDJSONStream, runSSEStream, runTextStream } from '@nextrush/stream';

/**
 * Bun Context implementation
 *
 * @remarks
 * Uses Bun's native Web Request/Response APIs for optimal performance.
 * The response is built internally (via the inherited {@link WebResponseBuilder}
 * composition) and returned via `getResponse()`.
 *
 * @example
 * ```typescript
 * const ctx = new BunContext(request);
 * ctx.json({ message: 'Hello from Bun!' });
 * const response = ctx.getResponse();
 * ```
 */
export class BunContext extends WebContextBase {
  constructor(request: Request, clientIp?: string, proxy: ProxyTrust = false) {
    // Get client IP (Bun provides this via server.requestIP).
    //
    // HP-1 trim: when `proxy` is false (default) the Bun-supplied `clientIp`
    // IS the client address, so it is returned directly — no per-request
    // header-lookup closure, no `getClientIp` policy call — byte-identical to
    // the policy's own `trust: false` branch. Otherwise resolution goes
    // through the shared policy (directIp = `clientIp ?? ''`) so
    // precedence/validation match Node/Deno/Edge.
    const directIp = clientIp ?? '';
    const ip = proxy !== false ? getClientIp(request, directIp, proxy) : directIp;

    super(request, ip, getRuntime(), { runTextStream, runSSEStream, runNDJSONStream });
  }
}

/**
 * Create a new BunContext
 *
 * @param request - Web API Request object
 * @param clientIp - Optional client IP address
 * @returns BunContext instance
 */
export function createBunContext(
  request: Request,
  clientIp?: string,
  proxy: ProxyTrust = false
): BunContext {
  return new BunContext(request, clientIp, proxy);
}
