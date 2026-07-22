/**
 * @nextrush/adapter-edge - Context Implementation
 *
 * Edge-specific Context implementation for Cloudflare Workers, Vercel Edge, etc.
 *
 * @remarks
 * Extends the shared {@link WebContextBase} (F-08, ADR-0010), which owns the
 * response-building logic (json/send/html/redirect/set/getResponse and body
 * suppression, composed from {@link WebResponseBuilder}), the lazy `raw`/
 * `signal`/`triggerTimeout`, the streaming methods, and
 * `get`/`next`/`throw`/`assert` — defined once across the Web adapters rather
 * than copy-pasted per runtime. This file supplies only what is genuinely
 * Edge-specific: `cf-connecting-ip`-aware IP resolution, platform bindings
 * (`env`), and `waitUntil`/`executionContext`.
 *
 * @packageDocumentation
 */

import { detectEdgeRuntime, getEdgeClientIp, WebContextBase } from '@nextrush/runtime';
import { runNDJSONStream, runSSEStream, runTextStream } from '@nextrush/stream';

/**
 * Edge execution context interface
 *
 * @remarks
 * Provides access to edge-specific features like `waitUntil` and `passThroughOnException`.
 */
export interface EdgeExecutionContext {
  /** Extend request lifetime for async operations */
  waitUntil(promise: Promise<unknown>): void;

  /** Pass through to origin on exception */
  passThroughOnException?(): void;
}

/**
 * Edge Context implementation
 *
 * @remarks
 * Works with any edge runtime that implements the Web Fetch API:
 * - Cloudflare Workers
 * - Vercel Edge Functions
 * - Netlify Edge Functions
 *
 * The response is built internally (via the inherited {@link WebResponseBuilder}
 * composition) and returned via `getResponse()`.
 *
 * @example
 * ```typescript
 * const ctx = new EdgeContext(request);
 * ctx.json({ message: 'Hello from Edge!' });
 * const response = ctx.getResponse();
 * ```
 */
export class EdgeContext<Env = unknown> extends WebContextBase {
  /** Edge execution context (for waitUntil, etc.) */
  readonly executionContext?: EdgeExecutionContext;

  /**
   * Platform bindings passed by the runtime (audit F-03).
   *
   * @remarks
   * On Cloudflare Workers this is the `env` argument of
   * `fetch(request, env, ctx)` — KV, D1, R2, Durable Objects, Queues, secrets.
   * `undefined` on runtimes that do not supply bindings (e.g. Vercel Edge).
   */
  readonly env?: Env;

  constructor(
    request: Request,
    executionContext?: EdgeExecutionContext,
    trustProxy = false,
    env?: Env
  ) {
    // Get client IP from CF headers or standard headers.
    //
    // HP-1 trim: Edge has no socket, so when `trustProxy` is false (default) the
    // client IP is `''` — returned directly, with no per-request header-lookup
    // closure and no `getEdgeClientIp` policy call (byte-identical to
    // `getEdgeClientIp(request, false)`, whose `directIp` is `''`). When true,
    // resolution still goes through `getEdgeClientIp`, preserving the Cloudflare
    // `cf-connecting-ip` → `x-forwarded-for` → `x-real-ip` precedence.
    const ip = trustProxy ? getEdgeClientIp(request, true) : '';

    // Detect specific edge runtime
    const runtime = detectEdgeRuntime().runtime;

    super(request, ip, runtime, { runTextStream, runSSEStream, runNDJSONStream });

    this.executionContext = executionContext;
    this.env = env;
  }

  // ===========================================================================
  // Edge-Specific Methods
  // ===========================================================================

  /**
   * Extend request lifetime for async operations
   *
   * @remarks
   * Use this for fire-and-forget operations that should complete
   * after the response is sent (logging, analytics, etc.)
   */
  waitUntil(promise: Promise<unknown>): void {
    if (this.executionContext?.waitUntil) {
      this.executionContext.waitUntil(promise);
    }
  }
}

/**
 * Create a new EdgeContext
 */
export function createEdgeContext<Env = unknown>(
  request: Request,
  executionContext?: EdgeExecutionContext,
  trustProxy = false,
  env?: Env
): EdgeContext<Env> {
  return new EdgeContext<Env>(request, executionContext, trustProxy, env);
}
