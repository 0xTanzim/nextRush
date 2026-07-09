/**
 * @nextrush/types - Adapter Conformance Contract (F-01)
 *
 * A light, additive compile-time contract that server- and fetch-style adapters
 * `satisfies` at export time, so the *shape* of `serve`/`createHandler`/
 * `createFetchHandler` and the `ServerHandle` cannot drift silently across
 * adapters. This is the cheap secondary guard; a shared behavioral conformance
 * suite is the primary one (see the audit's Adapter Conformance Specification).
 *
 * The contract is generic over the concrete application type because
 * `@nextrush/types` sits below `@nextrush/core` in the package hierarchy and
 * must not import `Application`. Adapters bind `App = Application` when they
 * `satisfies` these shapes.
 *
 * @packageDocumentation
 */

import type { FetchContext } from './adapter-context';
import type { Logger } from './logger';

/**
 * The single canonical network address a server adapter binds to.
 *
 * @remarks
 * Replaces the per-adapter `{ port, host }` vs `{ port, hostname }` divergence
 * (audit F-05). `host` is the canonical key; adapters normalize internally.
 */
export interface ServerAddress {
  /** Port the server is listening on. */
  readonly port: number;
  /** Host/address the server is bound to (canonical key). */
  readonly host: string;
  /**
   * Host alias.
   *
   * @deprecated Use {@link ServerAddress.host}. Retained so Bun/Deno, which
   * historically returned `{ port, hostname }`, keep working during migration.
   */
  readonly hostname?: string;
}

/**
 * Options common to server-style handler factories (node/bun/deno).
 *
 * @remarks
 * Intentionally light. Individual adapters may accept a superset; this pins the
 * shared, portable subset.
 */
export interface HandlerOptions {
  /** Logger for adapter diagnostics. Defaults to the application logger. */
  logger?: Logger;
  /** Per-request timeout in milliseconds. */
  timeout?: number;
}

/**
 * Options for fetch-style handler factories (edge).
 */
export interface FetchHandlerOptions {
  /** Per-request timeout in milliseconds. When omitted, no timeout is enforced. */
  timeout?: number;
  /**
   * Custom error handler. Receives the error and the fetch context and returns
   * the `Response` to send.
   */
  onError?: (error: Error, ctx: FetchContext) => Response | Promise<Response>;
}

/**
 * A running server instance with one canonical address shape and async close.
 *
 * @remarks
 * The canonical handle every server adapter's `serve()` resolves to. Concrete
 * adapters may expose additional fields (e.g. the raw `server`) on a subtype.
 */
export interface ServerHandle {
  /** The address the server is bound to. */
  address(): ServerAddress;
  /** Stop the server, draining in-flight requests. */
  close(): Promise<void>;
}

/**
 * A fetch handler: maps a Web `Request` (plus an optional runtime execution
 * context) to a `Response`.
 *
 * @typeParam Exec - The runtime execution-context type (e.g. an edge
 *   `waitUntil` context). Defaults to `unknown`.
 */
export type FetchHandler<Exec = unknown> = (
  request: Request,
  executionContext?: Exec
) => Response | Promise<Response>;

/**
 * Contract for server-style adapters (node/bun/deno).
 *
 * @typeParam App - The application type (adapters bind `Application`).
 * @typeParam Opts - The adapter's `serve` options type.
 * @typeParam Instance - The `serve` return type (a {@link ServerHandle} subtype).
 */
export interface ServerAdapter<
  App = unknown,
  Opts = unknown,
  Instance extends ServerHandle = ServerHandle,
> {
  /** Start a server for the application. */
  serve(app: App, options?: Opts): Promise<Instance>;
  /** Build a request handler for the application without owning the server. */
  createHandler(app: App, options?: HandlerOptions): unknown;
}

/**
 * Contract for fetch-style adapters (edge).
 *
 * @typeParam App - The application type (adapters bind `Application`).
 */
export interface FetchAdapter<App = unknown, Exec = unknown> {
  /** Build a fetch handler for the application. */
  createFetchHandler(app: App, options?: FetchHandlerOptions): FetchHandler<Exec>;
}
