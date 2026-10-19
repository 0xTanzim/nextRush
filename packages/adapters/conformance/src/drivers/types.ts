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
import type { ProxyTrust } from '@nextrush/types';

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
  /**
   * Put `path` in the request line exactly as given, over a real socket, instead
   * of sending it through a client that parses it into a `URL`.
   *
   * @remarks
   * Every `fetch` implementation resolves a dot segment on the client before the
   * request leaves — measured: `fetch('http://h/files/../admin')` arrives at the
   * server as `/admin` on Node, Bun and Deno alike — so a scenario about what the
   * *server* does with the target can only be observed by writing the request
   * line directly. A driver on a real listener satisfies this with a raw write;
   * one that cannot is already refused by the scenario's socket requirement.
   */
  verbatimTarget?: boolean;
  /** Proxy-trust specification the app boots with (`app.options.proxy`, RFC-030). */
  proxy?: ProxyTrust;
  /**
   * The direct/socket IP the runtime reports. Node observes its real loopback
   * socket; the Web adapters take this stub so `ctx.ip` (no-proxy path) is
   * deterministic across runtimes.
   */
  directIp?: string;
  /**
   * Dispatch through an entry point that was built BEFORE the application
   * booted, and never call `ready()`.
   *
   * @remarks
   * The documented Web form is `Bun.serve({ fetch: createHandler(app) })` with no
   * explicit boot, so the handler itself must boot the application before
   * dispatching. A driver that ignores this flag would boot eagerly and let a
   * pre-boot entry point pass the assertion without ever proving it — a false
   * positive, which is why every driver honors it.
   *
   * The application is built through the router-owning factory so a scenario can
   * declare routes with `app.get(...)` and observe both the routing and the
   * not-found path: with no boot, the application's own router is never mounted,
   * so the declared route cannot be reached and an unrouted path is not a 404.
   */
  beforeBoot?: boolean;
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
 * Which runtime a driver's request actually executes on.
 *
 * @remarks
 * `real-runtime` — the adapter's own runtime executes the handler, in-process
 * with the test (the native Node driver, `bun-runner/`, `deno-runner/`).
 * `simulated` — the adapter is driven from another runtime's test process, which
 * is what `web-driver.ts` always does under Node/vitest.
 */
export type RuntimeFidelity = 'real-runtime' | 'simulated';

/**
 * How a driver reaches the adapter under test.
 *
 * @remarks
 * `socket` — a real HTTP listener, spoken to over loopback.
 * `in-process` — the adapter's handler function is invoked directly. Anything
 * that lives in the transport rather than in the handler — response framing,
 * connection teardown, the request target exactly as the platform delivered it —
 * is then not observable at all, so a scenario that depends on one of those is
 * NOT proven by an `in-process` driver. See `../scenario.ts`.
 */
export type Transport = 'socket' | 'in-process';

/**
 * Drives one adapter through its real handler and normalizes the outcome.
 */
export interface ConformanceDriver {
  /** Adapter name (used as the `describe.each` label). */
  readonly name: string;

  /** How this driver reaches the adapter — see {@link Transport}. */
  readonly transport: Transport;

  /** Which runtime this driver's request executes on — see {@link RuntimeFidelity}. */
  readonly runtimeFidelity: RuntimeFidelity;

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

  /**
   * Whether the platform this driver runs on hands the application the request
   * target un-reshaped — the capability the dot-segment scenarios are derived
   * from.
   *
   * @remarks
   * Read from the runtime capability matrix, never hard-coded per driver, so a
   * driver and the framework's own claim cannot disagree by accident. The
   * scenario asserts the *observed* behaviour matches this declaration, which is
   * what catches a platform that changed under us: a driver that claims the
   * target is preserved and then answers `200` for `/files/../admin` fails.
   */
  readonly rawRequestTarget: boolean;

  /**
   * Whether the adapter consults Cloudflare's `cf-connecting-ip` at the front of
   * the client-IP precedence when proxies are trusted. Only the edge adapter
   * (and serverless, which reuses the edge engine) honor it; Node/Bun/Deno
   * ignore it and fall through to `x-forwarded-for`/`x-real-ip`. An encoded
   * difference (F-11), so a future edit cannot silently drop the precedence.
   */
  readonly honorsCloudflareIp: boolean;

  /** Configure an app, dispatch one request, and return the normalized result. */
  dispatch(configure: Configure, init?: DispatchInit): Promise<DispatchResult>;

  /**
   * Whether `ctx.signal` fires when the transport aborts mid-request (#15).
   * Node: real client disconnect closes the socket. Web: the platform
   * `Request.signal` aborts. Both must propagate to `ctx.signal`.
   */
  abortFiresSignal(): Promise<boolean>;

  /**
   * Whether the runtime can deliver a mid-request transport abort at all (#15).
   * Node/Bun/Deno/Edge: yes — a socket close or `Request.signal` abort reaches
   * `ctx.signal`. Serverless: no — the platform delivers a fully-buffered event,
   * so there is no mid-request transport to abort; cancellation is timeout-driven
   * (#13), where `ctx.signal` still fires. An encoded difference, not a skip.
   */
  readonly transportAbortFiresSignal: boolean;

  /**
   * Handler-level timeout outcome (#13, F-08): the Web adapters race the
   * handler against a timer, return 504, and cancel the still-running handler
   * via `ctx.signal`. Returns `null` for Node (socket-level timeout).
   */
  timeoutResult(): Promise<{ status: number; signalFired: boolean } | null>;

  /**
   * Deliver a response the handler committed before it ran past the configured
   * timeout (#30).
   *
   * @remarks
   * The 504 is reserved for a request that produced nothing. A handler that
   * answers and then keeps working has already produced the response the client
   * is owed, so every adapter must deliver it rather than replace it with the
   * timeout envelope. Asserted on the client-visible outcome only: whether a
   * timer was armed for the request is an adapter-internal detail, and Node's
   * synchronous fast path arms none at all.
   */
  committedResponseOutlivesTimeout(): Promise<{ status: number; body: unknown }>;
}
