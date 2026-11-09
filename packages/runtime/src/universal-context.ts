/**
 * @nextrush/runtime - Universal Web Context Implementation (RFC-052)
 *
 * Universal Web Context supporting zero-boilerplate exports (`export default app;`)
 * across Cloudflare Workers, Vercel Edge, Bun, Deno, and standard 1-arg fetch.
 *
 * @remarks
 * Extends {@link WebContextBase} (F-08, ADR-0010), composing the shared WebResponseBuilder
 * state machine, lazy `raw`/`signal`/`query`, streaming methods, and `RequestInputs`.
 *
 * Employs RFC-044 getter override for `ctx.ip` to eliminate per-request closure
 * allocations on the hot path, and provides robust `waitUntil` delegation with
 * unhandled rejection protection and deterministic promise tracking.
 *
 * @packageDocumentation
 */

import type { PlatformId, ProxyTrust } from '@nextrush/types';
import { detectPlatform, getRuntime } from './detection';
import { getClientIp, getEdgeClientIp } from './headers';
import { WebContextBase, type WebStreamRunners } from './web-context-base';

/**
 * Host execution context interface (e.g. Cloudflare Workers, Vercel Edge).
 */
export interface UniversalExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException?(): void;
  [key: string]: unknown;
}

/**
 * Structural interface for Bun's Server instance.
 */
export interface BunServerLike {
  requestIP(request: Request): { address?: string } | null;
  [key: string]: unknown;
}

/**
 * Structural interface for Deno's ServeHandlerInfo.
 */
export interface DenoServeHandlerInfoLike {
  remoteAddr?: { hostname?: string; [key: string]: unknown };
  [key: string]: unknown;
}

/**
 * Internal IP resolution mode for monomorphic dispatch.
 */
const enum IpMode {
  None = 0,
  Bun = 1,
  Deno = 2,
  EdgeHeaders = 3,
  StandardHeaders = 4,
}

/**
 * Options for configuring {@link UniversalWebContext}.
 */
export interface UniversalContextOptions {
  /** Proxy trust specification for client IP resolution (default: false). */
  proxy?: ProxyTrust;
  /** Whether the runtime environment is production (default: true). */
  isProduction?: boolean;
  /** Explicit deployment platform override. */
  platform?: PlatformId;
  /** Concrete stream runners for ctx.stream(), ctx.sse(), ctx.ndjson(). */
  streamRunners?: WebStreamRunners;
}

/** Shared empty promises array avoiding allocations when no tasks are tracked. */
const EMPTY_PROMISES: readonly Promise<unknown>[] = Object.freeze([]);

/** Shared resolved void promise avoiding allocations on fallback stream runner calls. */
const RESOLVED_VOID: Promise<void> = Promise.resolve();

/** Shared default stream runners stub (zero allocations). */
const DEFAULT_STREAM_RUNNERS: WebStreamRunners = Object.freeze({
  runTextStream: () => RESOLVED_VOID,
  runSSEStream: () => RESOLVED_VOID,
  runNDJSONStream: () => RESOLVED_VOID,
});

/**
 * Universal Web Context supporting 5-signature runtime invocation normalization.
 *
 * @typeParam Env - Type of platform environment bindings (e.g. Cloudflare Workers KV/D1).
 */
export class UniversalWebContext<Env = unknown> extends WebContextBase {
  /** Platform bindings passed by the runtime (e.g. Cloudflare Workers KV, D1, secrets). */
  declare readonly env?: Env;

  /** Host execution context (for waitUntil, passThroughOnException). */
  declare readonly executionContext?: UniversalExecutionContext;

  declare private readonly _isProduction: boolean;
  declare private readonly _proxy: ProxyTrust;
  declare private readonly _ipMode: IpMode;
  declare private readonly _server?: BunServerLike;
  declare private readonly _info?: DenoServeHandlerInfoLike;

  private _resolvedIp?: string = undefined;
  private _waitUntilWarned = false;
  private _ipWarned = false;
  private _trackedPromises?: Promise<unknown>[] = undefined;

  constructor(
    request: Request,
    envOrServerOrInfoOrCtx?: unknown,
    executionCtx?: unknown,
    options: UniversalContextOptions = {}
  ) {
    const proxy = options.proxy ?? false;
    let env: Env | undefined;
    let executionContext: UniversalExecutionContext | undefined;
    let server: BunServerLike | undefined;
    let info: DenoServeHandlerInfoLike | undefined;
    let ipMode = IpMode.None;

    // Disambiguate the 5 invocation shapes in O(1)
    if (executionCtx !== undefined) {
      // Shape 1: 3-argument invocation (Cloudflare Workers: req, env, ctx)
      env = envOrServerOrInfoOrCtx as Env;
      if (executionCtx !== null && typeof executionCtx === 'object') {
        executionContext = executionCtx as UniversalExecutionContext;
      }
      ipMode = proxy === false ? IpMode.None : IpMode.EdgeHeaders;
    } else if (
      envOrServerOrInfoOrCtx !== undefined &&
      envOrServerOrInfoOrCtx !== null &&
      typeof envOrServerOrInfoOrCtx === 'object'
    ) {
      // Shape 2: Vercel Edge / ExecutionContext (req, ctx)
      if (typeof (envOrServerOrInfoOrCtx as { waitUntil?: unknown }).waitUntil === 'function') {
        executionContext = envOrServerOrInfoOrCtx as UniversalExecutionContext;
        ipMode = proxy === false ? IpMode.None : IpMode.EdgeHeaders;
      }
      // Shape 3: Bun Server (req, server)
      else if (typeof (envOrServerOrInfoOrCtx as { requestIP?: unknown }).requestIP === 'function') {
        server = envOrServerOrInfoOrCtx as BunServerLike;
        ipMode = IpMode.Bun;
      }
      // Shape 4: Deno ServeHandlerInfo (req, info)
      else if (
        'remoteAddr' in envOrServerOrInfoOrCtx &&
        typeof (envOrServerOrInfoOrCtx as { remoteAddr?: unknown }).remoteAddr === 'object'
      ) {
        info = envOrServerOrInfoOrCtx as DenoServeHandlerInfoLike;
        ipMode = IpMode.Deno;
      }
      // Shape 4-alt: Cloudflare Workers bindings without 3rd ctx argument (req, env)
      else {
        env = envOrServerOrInfoOrCtx as Env;
        ipMode = proxy === false ? IpMode.None : IpMode.EdgeHeaders;
      }
    } else {
      // Shape 5: 1-argument invocation (Standard Web fetch / Node 22+ / Unit tests)
      ipMode = proxy === false ? IpMode.None : IpMode.StandardHeaders;
    }

    // Validate CIDR proxy trust on edge runtimes lacking socket peer address
    if (ipMode === IpMode.EdgeHeaders && Array.isArray(proxy)) {
      throw new Error(
        "proxy: ['<cidr>', ...] is not supported on edge runtimes without a socket peer address. " +
          'Use proxy: <hopCount> instead (e.g. proxy: 1 for Cloudflare).'
      );
    }

    const runtime = getRuntime();
    const resolvedPlatform = options.platform ?? detectPlatform().platform;
    const streamRunners = options.streamRunners ?? DEFAULT_STREAM_RUNNERS;

    // RFC-044: Pass empty string to super; client IP is resolved on-demand in the getter below
    super(request, '', runtime, streamRunners, resolvedPlatform);

    // Monomorphic property assignments
    this.env = env;
    this.executionContext = executionContext;
    this._isProduction = options.isProduction ?? true;
    this._proxy = proxy;
    this._ipMode = ipMode;
    this._server = server;
    this._info = info;
  }

  /**
   * The resolved client IP address.
   *
   * @remarks
   * RFC-044 / HP-1: Resolved lazily upon first read and memoized.
   * If this property is never accessed by a route handler, platform APIs
   * (`server.requestIP()`, `info.remoteAddr`) are never called, and zero
   * closure allocations occur.
   */
  override get ip(): string {
    if (this._resolvedIp !== undefined) {
      return this._resolvedIp;
    }
    return (this._resolvedIp = this._computeClientIp());
  }

  private _computeClientIp(): string {
    switch (this._ipMode) {
      case IpMode.None: {
        if (!this._isProduction && !this._ipWarned) {
          this._ipWarned = true;
          console.warn(
            '[nextrush/universal] ctx.ip is an empty string because proxy is false (the default) ' +
              'on an environment without socket peer fallback. If this application is deployed ' +
              'behind a reverse proxy or Cloudflare, configure { proxy: 1 } to enable header resolution.'
          );
        }
        return '';
      }
      case IpMode.Bun: {
        const direct = this._server?.requestIP(this._req)?.address ?? '';
        return this._proxy === false ? direct : getClientIp(this._req, direct, this._proxy);
      }
      case IpMode.Deno: {
        const direct = this._info?.remoteAddr?.hostname ?? '';
        return this._proxy === false ? direct : getClientIp(this._req, direct, this._proxy);
      }
      case IpMode.EdgeHeaders: {
        return getEdgeClientIp(this._req, this._proxy);
      }
      case IpMode.StandardHeaders: {
        return getClientIp(this._req, '', this._proxy);
      }
    }
  }

  /**
   * Extend request lifetime for async background operations (logging, analytics, cache).
   *
   * @remarks
   * When running on Cloudflare Workers or Vercel Edge, delegates directly to
   * `this.executionContext.waitUntil(promise)`.
   *
   * When running on hosts without native execution context support (Bun, Deno, Node 22+),
   * NextRush catches unhandled rejections to prevent process crashes, issues a one-time
   * warning in development, and tracks the promise in {@link pendingWaitUntils} so test
   * suites and shutdown hooks can deterministically await settlement via {@link drainWaitUntil}.
   */
  waitUntil(promise: Promise<unknown>): void {
    if (this.executionContext && typeof this.executionContext.waitUntil === 'function') {
      this.executionContext.waitUntil(promise);
      return;
    }

    if (!this._isProduction && !this._waitUntilWarned) {
      this._waitUntilWarned = true;
      console.warn(
        '[nextrush/universal] ctx.waitUntil() was called, but the host environment provided no execution context.'
      );
    }

    // Shield against unhandled promise rejection crashing the runtime
    promise.catch((err: unknown) => {
      if (!this._isProduction) {
        console.error(
          '[nextrush/universal] Unhandled rejection in ctx.waitUntil() background task:',
          err
        );
      }
    });

    // Track promise for deterministic lifecycle drain and testing
    (this._trackedPromises ??= []).push(promise);
  }

  /**
   * Pending background tasks tracked when host lacks native execution context.
   */
  get pendingWaitUntils(): readonly Promise<unknown>[] {
    return this._trackedPromises ?? EMPTY_PROMISES;
  }

  /**
   * Await settlement of all tracked background tasks.
   */
  async drainWaitUntil(): Promise<void> {
    if (this._trackedPromises && this._trackedPromises.length > 0) {
      await Promise.allSettled(this._trackedPromises);
    }
  }
}

/**
 * Factory helper for constructing {@link UniversalWebContext}.
 */
export function createUniversalWebContext<Env = unknown>(
  request: Request,
  envOrServerOrInfoOrCtx?: unknown,
  executionCtx?: unknown,
  options?: UniversalContextOptions
): UniversalWebContext<Env> {
  return new UniversalWebContext<Env>(request, envOrServerOrInfoOrCtx, executionCtx, options);
}
