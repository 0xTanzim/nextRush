/**
 * Shared driver contract for the cross-adapter conformance suite (audit F-01).
 *
 * @remarks
 * Each adapter (Node/Bun/Deno/Edge) provides one {@link ConformanceDriver} that
 * knows how to drive a request through that adapter's real request handler and
 * normalize the result into a {@link DispatchResult}. The suite then runs the
 * SAME assertions against every driver via `describe.each`, operationalizing the
 * project rule "every adapter must behave identically".
 *
 * Behaviors that legitimately cannot be identical are encoded as capability
 * flags rather than skipped (e.g. Node's timeout is socket-level, not a 504).
 *
 * @packageDocumentation
 */

import type { Application } from '@nextrush/core';

/** Options for a single conformance request. */
export interface DispatchInit {
  /** HTTP method (default GET). */
  method?: string;
  /** Request path including any query string (default `/`). */
  path?: string;
  /** Request headers. */
  headers?: Record<string, string>;
  /** Request body (POST/PUT). */
  body?: string;
  /** Whether the app trusts proxy headers (`app.options.proxy`). */
  proxy?: boolean;
  /**
   * The direct/socket IP the runtime reports. Node observes its real loopback
   * socket; the Web adapters take this stub so `ctx.ip` (no-proxy path) is
   * deterministic across runtimes.
   */
  directIp?: string;
}

/** Normalized, runtime-agnostic view of an adapter's response. */
export interface DispatchResult {
  /** Response status code. */
  readonly status: number;
  /** Case-insensitive response header lookup. */
  header(name: string): string | undefined;
  /** Accumulated `Set-Cookie` values. */
  setCookies(): string[];
  /** Response body as text. */
  text(): string;
}

/** Registers middleware/extensions on the app before a request is dispatched. */
export type Configure = (app: Application) => void;

/**
 * Drives one adapter through its real handler and normalizes the outcome.
 */
export interface ConformanceDriver {
  /** Adapter name (used as the `describe.each` label). */
  readonly name: string;

  /**
   * Whether the adapter enforces the request `timeout` at the handler level and
   * returns a 504 (Bun/Deno/Edge). Node enforces timeout at the socket level
   * (`server.timeout`) and does not emit a 504 — a documented difference (F-08).
   */
  readonly handlerTimeout504: boolean;

  /**
   * Whether the adapter runs extension `destroy()` teardown on shutdown.
   * Edge has no server lifetime, so teardown is intentionally never run — a
   * documented exception (F-14).
   */
  readonly teardownOnShutdown: boolean;

  /** Configure an app, dispatch one request, and return the normalized result. */
  dispatch(configure: Configure, init?: DispatchInit): Promise<DispatchResult>;

  /**
   * Whether `ctx.signal` fires when the transport aborts mid-request (#15).
   * Node: real client disconnect closes the socket. Web: the platform
   * `Request.signal` aborts. Both must propagate to `ctx.signal`.
   */
  abortFiresSignal(): Promise<boolean>;

  /**
   * Handler-level timeout outcome (#13, F-08): the Web adapters race the
   * handler against a timer, return 504, and cancel the still-running handler
   * via `ctx.signal`. Returns `null` for Node (socket-level timeout).
   */
  timeoutResult(): Promise<{ status: number; signalFired: boolean } | null>;
}
