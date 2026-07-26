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

import { detectEdgeRuntime, detectPlatform, getEdgeClientIp, WebContextBase } from '@nextrush/runtime';
import type { PlatformId } from '@nextrush/types';
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

  /** Whether {@link waitUntil} has already warned once on this context (P2-4). */
  private _waitUntilWarned = false;
  /** Dev-mode gate for the {@link waitUntil} no-op warning (P2-4). */
  private readonly _isProduction: boolean;
  /** Whether the empty-`ctx.ip` warning has already fired once on this context (P2-3). */
  private _ipWarned = false;
  /** Whether the caller opted into trusting proxy headers for IP resolution. */
  private readonly _trustProxy: boolean;

  constructor(
    request: Request,
    executionContext?: EdgeExecutionContext,
    trustProxy = false,
    env?: Env,
    isProduction = true,
    platform?: PlatformId
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

    // RFC-026: an explicitly-supplied platform (from a serverless Tier-1
    // handler, which already knows its own identity) always wins over
    // detection; otherwise fall back to the same three-branch edge-platform
    // probe `detectEdgeRuntime()` already performs.
    const resolvedPlatform = platform ?? detectPlatform().platform;

    super(request, ip, runtime, { runTextStream, runSSEStream, runNDJSONStream }, resolvedPlatform);

    this.executionContext = executionContext;
    this.env = env;
    this._isProduction = isProduction;
    this._trustProxy = trustProxy;
  }

  // ===========================================================================
  // Edge-Specific Methods
  // ===========================================================================

  /**
   * The resolved client IP.
   *
   * @remarks
   * `''` when `trustProxy` is `false` (the default) — Edge has no socket to
   * fall back to, unlike Node. Outside production, the first read of this
   * getter in that state warns once per context (P2-3): a silent empty
   * string is indistinguishable from "resolution ran and found nothing,"
   * which silently degrades IP-keyed middleware (rate limiting, audit
   * logging) with no signal that `trustProxy` is the fix.
   */
  override get ip(): string {
    if (this._ip === '' && !this._trustProxy && !this._isProduction && !this._ipWarned) {
      this._ipWarned = true;
      console.warn(
        '[nextrush/edge] ctx.ip is an empty string because trustProxy is false (the default) — ' +
          'Edge has no socket to fall back to, so no proxy headers means no IP. If this app runs ' +
          'behind a trusted proxy (e.g. Cloudflare, which sets cf-connecting-ip), pass ' +
          "{ proxy: true } to createApp() to resolve it from headers. (This message appears in " +
          'development only.)'
      );
    }
    return this._ip;
  }

  /**
   * Extend request lifetime for async operations
   *
   * @remarks
   * Use this for fire-and-forget operations that should complete
   * after the response is sent (logging, analytics, etc.)
   *
   * Silently does nothing when the platform provides no execution context
   * (e.g. Vercel Edge, or a serverless invocation with no `waitUntil` support)
   * — the same as always. Outside production, the first such call additionally
   * warns once per context, since a dropped promise here is otherwise
   * undebuggable (P2-4).
   */
  waitUntil(promise: Promise<unknown>): void {
    if (this.executionContext?.waitUntil) {
      this.executionContext.waitUntil(promise);
      return;
    }
    if (!this._isProduction && !this._waitUntilWarned) {
      this._waitUntilWarned = true;
      console.warn(
        '[nextrush/edge] ctx.waitUntil() was called, but this platform provided no execution ' +
          'context — the promise was dropped without running. This is expected on platforms with ' +
          'no background-task support (e.g. Vercel Edge); on Cloudflare Workers it usually means ' +
          '`ctx` was not passed through to createCloudflareHandler. (This message appears in ' +
          'development only.)'
      );
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
  env?: Env,
  isProduction = true,
  platform?: PlatformId
): EdgeContext<Env> {
  return new EdgeContext<Env>(request, executionContext, trustProxy, env, isProduction, platform);
}
