/**
 * @nextrush/adapter-deno - Context Implementation
 *
 * Deno-specific Context implementation using Web Request/Response APIs.
 *
 * @remarks
 * Extends the shared {@link WebContextBase} (F-08, ADR-0010), which owns the
 * response-building logic (json/send/html/redirect/set/getResponse and body
 * suppression, composed from {@link WebResponseBuilder}), the lazy `raw`/
 * `signal`/`triggerTimeout`, the streaming methods, and
 * `get`/`next`/`throw`/`assert` — defined once across the Web adapters rather
 * than copy-pasted per runtime. This file supplies only what is genuinely
 * Deno-specific: resolving `ip` from the connection's `remoteAddr`.
 *
 * @packageDocumentation
 */

import { getClientIp, getRuntime, WebContextBase } from '@nextrush/runtime';
import { runNDJSONStream, runSSEStream, runTextStream } from '@nextrush/stream';

/**
 * Deno Context implementation
 *
 * @remarks
 * Uses Deno's native Web Request/Response APIs following web standards.
 * The response is built internally (via the inherited {@link WebResponseBuilder}
 * composition) and returned via `getResponse()`.
 *
 * @example
 * ```typescript
 * const ctx = new DenoContext(request);
 * ctx.json({ message: 'Hello from Deno!' });
 * const response = ctx.getResponse();
 * ```
 */
export class DenoContext extends WebContextBase {
  constructor(
    request: Request,
    connInfo?: { remoteAddr?: { hostname: string } },
    trustProxy = false
  ) {
    // Get client IP from connection info or headers.
    //
    // HP-1 trim: when `trustProxy` is false (default) the connection address IS
    // the client IP, so it is returned directly — no per-request header-lookup
    // closure, no `getClientIp` policy call — byte-identical to the policy's own
    // `trustProxy: false` branch. When true, resolution goes through the shared
    // policy so precedence/validation match Node/Bun/Edge.
    const directIp = connInfo?.remoteAddr?.hostname ?? '';
    const ip = trustProxy ? getClientIp(request, directIp, true) : directIp;

    super(request, ip, getRuntime(), { runTextStream, runSSEStream, runNDJSONStream });
  }
}

/**
 * Create a new DenoContext
 */
export function createDenoContext(
  request: Request,
  connInfo?: { remoteAddr?: { hostname: string } },
  trustProxy = false
): DenoContext {
  return new DenoContext(request, connInfo, trustProxy);
}
