/**
 * @nextrush/types - Adapter Context Contracts (F-13)
 *
 * The concrete adapter context classes expose transport/lifecycle primitives
 * that are not part of the runtime-neutral {@link Context} contract:
 * `markResponded()` (all adapters), and `getResponse()` / `waitUntil()` / `env`
 * (the Web/fetch adapters). Consumers typed as `Context` cannot see these, so
 * `@nextrush/stream` and the adapters resort to structural access.
 *
 * These interfaces model that surface **additively** — they extend `Context`,
 * they never weaken it. Adapters (and `@nextrush/stream`) can depend on these
 * instead of coupling to the concrete context classes.
 *
 * @packageDocumentation
 */

import type { Context } from './context';

/**
 * A {@link Context} plus the lifecycle primitive every adapter exposes.
 *
 * @remarks
 * `markResponded()` lets the transport/streaming layer flag that a response has
 * been committed out-of-band (e.g. after wiring a stream), so the adapter's
 * "not responded" fallback path is skipped.
 */
export interface AdapterContext extends Context {
  /**
   * Mark the response as already sent.
   *
   * @remarks
   * Used by streaming and adapter transport code when a response is committed
   * without going through `json()`/`send()`/`html()`/`redirect()`.
   */
  markResponded(): void;
}

/**
 * An {@link AdapterContext} for Web/fetch runtimes (Bun, Deno, Edge).
 *
 * @remarks
 * Adds the fetch-specific surface: `getResponse()` (materialize the built
 * `Response`), and the optional edge primitives `waitUntil()` and `env`
 * (platform bindings — reachable only on runtimes that provide them, e.g.
 * Cloudflare Workers).
 */
export interface FetchContext extends AdapterContext {
  /**
   * Build and return the Web `Response` accumulated by the context.
   *
   * @returns The `Response` to hand back to the runtime.
   */
  getResponse(): Response;

  /**
   * Extend the request's lifetime for fire-and-forget work (logging,
   * analytics, cache writes). Only present on runtimes that expose an
   * execution context (e.g. Cloudflare Workers, Vercel Edge).
   *
   * @param promise - Work that should outlive the response.
   */
  waitUntil?(promise: Promise<unknown>): void;

  /**
   * Platform bindings passed by the runtime (e.g. Cloudflare `env`: KV, D1, R2,
   * Durable Objects, secrets). Typed as `unknown` at the contract level; a
   * concrete adapter may narrow it via a generic.
   */
  env?: unknown;
}
