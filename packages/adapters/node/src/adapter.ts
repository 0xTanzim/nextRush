/**
 * @nextrush/adapter-node - Node.js HTTP Adapter
 *
 * Connects NextRush Application to Node.js HTTP server.
 *
 * @packageDocumentation
 */

import type { Application, Logger } from '@nextrush/core';
import {
  DEFAULT_KEEP_ALIVE_TIMEOUT_MS,
  DEFAULT_SHUTDOWN_TIMEOUT_MS,
  DEFAULT_TIMEOUT_MS,
  normalizeStartupError,
} from '@nextrush/runtime';
import type { AdapterContextFactory, HandlerOptions, ServerAdapter } from '@nextrush/types';
import { type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { Http2SecureServer } from 'node:http2';
import { createNodeContext } from './context';
import type { NodeContext, NodeContextOptions } from './context';
import {
  createNodeServer,
  isHttp2Server,
  safeCloseAllConnections,
  safeCloseIdleConnections,
} from './tls-server';

/**
 * TCP accept-queue depth for `server.listen()`.
 *
 * Node's own default is 511, which `report/router-highload-saturation-findings.md`
 * identified as a plausible bottleneck under a connection burst: at high client
 * concurrency (`wrk -c256` in that investigation), throughput collapsed and server idle
 * time INCREASED — the signature of connections queueing at the OS accept queue, not
 * the server running out of CPU. 1024 is a fixed, portable default (not read from this
 * host's live `net.core.somaxconn`, which varies across deployment environments and
 * would silently change behavior per-host if used) — comfortably above Node's default,
 * comfortably below typical OS/container ceilings (see design.md D1 for the full
 * tradeoff: a deeper queue absorbs bursts but can mask real overload by queueing longer
 * instead of failing fast, so this is a deliberate, bounded increase, not "maximize the
 * queue").
 */
const DEFAULT_LISTEN_BACKLOG = 1024;

/**
 * Server options
 */
export interface ServeOptions {
  /**
   * TLS certificate and key for HTTPS + HTTP/2 (ALPN).
   *
   * When provided, the server uses `node:http2`'s `createSecureServer` with
   * ALPN negotiation — clients that negotiate `h2` get HTTP/2; clients that
   * don't fall back to HTTP/1.1 over TLS. When omitted, the server uses
   * plain `node:http` as before.
   *
   * Shape matches `@nextrush/adapter-bun`'s existing `tls` option (the
   * canonical shape for all server adapters — see RFC-028).
   */
  tls?: {
    cert: string | Buffer;
    key: string | Buffer;
    ca?: string | Buffer;
  };

  /**
   * Port to listen on
   * @default 8080
   */
  port?: number;

  /**
   * Host to bind to
   * @default '0.0.0.0'
   */
  host?: string;

  /**
   * Callback when server starts listening
   */
  onListen?: (info: { port: number; host: string; hostname: string }) => void;

  /**
   * Custom error handler for uncaught errors
   */
  onError?: (error: Error) => void;

  /**
   * Request timeout in milliseconds
   * @default 30000 (30 seconds)
   */
  timeout?: number;

  /**
   * Keep-alive timeout in milliseconds
   * @default 5000 (5 seconds)
   */
  keepAliveTimeout?: number;

  /**
   * Logger for adapter diagnostics. Defaults to app.logger.
   */
  logger?: Logger;

  /**
   * Graceful shutdown timeout in milliseconds.
   * Forces closure if open connections don't drain within this time.
   * @default 30000 (30 seconds)
   */
  shutdownTimeout?: number;

  /**
   * Opt-in: wire OS termination signals to the server's existing connection-drain
   * `close()` logic. When omitted (the default), NO signal handler is installed and
   * process behavior is unchanged — this is a deliberate opt-in, not an auto-installed
   * global side effect (see `docs/RFC`'s graceful-shutdown design notes, decision D3).
   *
   * - `true` — install handlers for the default signal set (`SIGTERM`, `SIGINT`),
   *   using {@link ServeOptions.shutdownTimeout} as the drain timeout.
   * - `{ signals, timeout }` — override the signal set and/or the drain timeout for the
   *   signal-triggered path specifically. `timeout` falls back to `shutdownTimeout` when
   *   omitted; there is one timeout concept, not two competing ones.
   *
   * The handler simply invokes the same `close()` this function already returns — it
   * does not duplicate the drain logic. It is removed once that `close()` completes, so
   * repeated `serve()`/`close()` cycles in one process (e.g. in tests) never accumulate
   * duplicate listeners.
   *
   * @remarks
   * Registering a signal handler changes Node's default behavior for that signal
   * (default: immediate process exit). If your own code also listens for the same
   * signal, coordinate directly rather than enabling this option — do not rely on both.
   * `SIGKILL` is deliberately not supported: it cannot be caught, so listing it would be
   * misleading.
   *
   * @default undefined (no signal handler installed)
   */
  gracefulShutdown?: boolean | GracefulShutdownOptions;
}

/**
 * Explicit override shape for {@link ServeOptions.gracefulShutdown}.
 */
export interface GracefulShutdownOptions {
  /**
   * Signals that trigger the drain-and-exit sequence.
   * @default ['SIGTERM', 'SIGINT']
   */
  signals?: readonly NodeJS.Signals[];

  /**
   * Drain timeout in milliseconds for the signal-triggered path. Falls back to
   * {@link ServeOptions.shutdownTimeout} when omitted.
   */
  timeout?: number;
}

/** Default signal set for {@link ServeOptions.gracefulShutdown} when `true`. */
const DEFAULT_GRACEFUL_SHUTDOWN_SIGNALS: readonly NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

/**
 * Server instance returned by serve()
 */
export interface ServerInstance {
  /** Node.js HTTP server (plain `http.Server` or `http2.Http2SecureServer`) */
  server: Server | Http2SecureServer;

  /** Port the server is listening on */
  port: number;

  /** Host the server is bound to */
  host: string;

  /** Close the server */
  close(): Promise<void>;

  /** Address info (canonical `{ port, host }`, with `hostname` alias for compat). */
  address(): { port: number; host: string; hostname: string };
}

/**
 * Create HTTP request handler for Application
 *
 * @remarks
 * Accepts the shared {@link HandlerOptions} for cross-adapter consistency
 * (audit F-06). Node retains `server.timeout` at the socket level in
 * {@link serve} as an independent slow-client/slow-loris guard, AND (F-04, ADR-
 * 0010) races the handler against `options.timeout` here, returning a clean
 * `504 Gateway Timeout` and cancelling the handler via `ctx.signal` — the same
 * observable contract as Bun/Deno/Edge/Serverless. Passing `timeout: 0`
 * disables the handler-level race (pre-F-04 behavior); `server.timeout` is
 * unaffected either way.
 */
export function createHandler(
  app: Application,
  options: HandlerOptions = {}
): (req: IncomingMessage, res: ServerResponse) => void {
  const handler = app.callback();
  const trustProxy = app.options.proxy ?? false;
  const logger = options.logger ?? app.logger;
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;

  // Hoist the constant context-options object out of the per-request path
  // (hot-path review HP-4): `trustProxy` is fixed for the server's lifetime, so the
  // object is built once and reused. Frozen so a stray mutation cannot leak across
  // requests; the NodeContext constructor only reads `options.trustProxy`.
  const contextOptions: NodeContextOptions = Object.freeze({ trustProxy });

  return (req: IncomingMessage, res: ServerResponse): void => {
    const ctx = createNodeContext(req, res, contextOptions);

    const finalizeSuccess = (): void => {
      // Ensure response is sent
      if (!ctx.responded && !res.headersSent) {
        if (ctx.status === 404) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: 'Not Found' }));
        } else {
          // F-09: a handler that resolves without responding (and without
          // throwing) must still carry an explicit Content-Type — a bare
          // status with no header violates project-rules §3 ("every response
          // sets a Content-Type"). text/plain is the honest default: there is
          // no body to type more specifically.
          res.statusCode = ctx.status;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end();
        }
      }
    };

    const finalizeError = (error: unknown): void => {
      logger.error('Request error:', error);

      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Internal Server Error' }));
      }
    };

    if (timeout <= 0) {
      // F-04: timeout disabled — behavior identical to before this change.
      handler(ctx).then(finalizeSuccess, finalizeError);
      return;
    }

    // F-04: race the handler against the configured timeout, mirroring the
    // Bun/Deno/Edge/Serverless handler-race contract. `server.timeout` (set in
    // `serve()`) remains the independent socket-level slow-client guard.
    const TIMEOUT_SENTINEL = Symbol('timeout');
    let timerId: ReturnType<typeof setTimeout> | undefined;

    const handlerPromise = handler(ctx);
    Promise.race([
      handlerPromise.then(() => {
        /* handler settled first */
      }),
      new Promise<typeof TIMEOUT_SENTINEL>((resolve) => {
        timerId = setTimeout(() => {
          resolve(TIMEOUT_SENTINEL);
        }, timeout);
      }),
    ])
      .then((result) => {
        if (timerId !== undefined) clearTimeout(timerId);

        if (result === TIMEOUT_SENTINEL) {
          // F-04: cancel the still-running handler cooperatively via ctx.signal.
          ctx.triggerTimeout();
          // Never clobber a response the handler already committed.
          if (!ctx.responded && !res.headersSent) {
            res.statusCode = 504;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: 'Gateway Timeout' }));
          }
          // Swallow a late handler rejection after the timeout already
          // responded — it has nowhere useful to go, but must not crash the
          // process as an unhandled rejection.
          handlerPromise.catch(() => undefined);
          return;
        }

        finalizeSuccess();
      })
      .catch((error: unknown) => {
        if (timerId !== undefined) clearTimeout(timerId);
        finalizeError(error);
      });
  };
}

/**
 * Mutable drain-state flag shared between the request listener and
 * {@link drainAndClose}. A plain object (not a module-level variable) so each
 * {@link serve} call gets its own independent flag — required for the
 * repeated `serve()`/`close()` cycles the graceful-shutdown suite already
 * exercises in a single process (no cross-instance leakage).
 */
interface DrainState {
  /** `true` from the moment a drain begins until teardown completes. */
  draining: boolean;
}

/**
 * The ONE connection-drain implementation: stop accepting new connections, force-close
 * if they don't drain within `shutdownTimeout`, then destroy app extensions. Both the
 * manually-called `close()` and the signal-triggered path (via
 * {@link buildCloseWithGracefulShutdown}) invoke this exact function — there is
 * deliberately no second drain implementation for the signal path (T010 1.8).
 *
 * F-05: releases idle keep-alive connections at the START of the drain via the
 * explicit `server.closeIdleConnections()` call below, rather than relying on
 * `server.close()`'s own (Node-version-dependent) idle-connection handling. Flips
 * {@link DrainState.draining} first so any response that completes for a request
 * already in flight advertises `Connection: close` (set in the wrapped handler
 * installed by {@link serve}) — the idle-connections call only releases sockets with
 * NO in-flight request, so an active connection finishing its response during the
 * drain needs this separate signal to tell the client not to reuse the socket.
 */
async function drainAndClose(
  server: Server,
  app: Application,
  shutdownTimeout: number,
  drainState: DrainState
): Promise<void> {
  drainState.draining = true;
  safeCloseIdleConnections(server);

  // 1. Stop accepting new connections with drain timeout
  await new Promise<void>((res) => {
    const forceTimer = setTimeout(() => {
      // Force-close if connections don't drain in time.
      safeCloseAllConnections(server);
      res();
    }, shutdownTimeout);

    server.close(() => {
      clearTimeout(forceTimer);
      res();
    });
  });
  // 2. Destroy extensions after server is fully drained. Bound teardown by the
  // same shutdownTimeout budget so a hung extension destroy() cannot outlast
  // the drain (F-02, D1, RFC-022/ADR-0012).
  await app.close({ timeout: shutdownTimeout });
}

/**
 * Build the `close()` returned by {@link serve}, optionally wiring OS signals to invoke
 * it per {@link ServeOptions.gracefulShutdown} (design.md D1-D3).
 *
 * When `gracefulShutdown` is omitted/falsy, this is a no-op wrapper: no signal handler
 * is installed, and `close()` behaves exactly as it did before this option existed.
 *
 * When truthy, a signal handler is registered for each configured signal; each handler
 * calls this SAME `drainAndClose`, then all of this call's handlers are removed —
 * whether shutdown was triggered by a signal or by the caller invoking `close()`
 * directly — so repeated `serve()`/`close()` cycles in one process never accumulate
 * duplicate listeners (T010 1.3).
 */
function buildCloseWithGracefulShutdown(params: {
  server: Server;
  app: Application;
  shutdownTimeout: number;
  gracefulShutdown: ServeOptions['gracefulShutdown'];
  drainState: DrainState;
}): () => Promise<void> {
  const { server, app, shutdownTimeout, gracefulShutdown, drainState } = params;

  if (!gracefulShutdown) {
    return () => drainAndClose(server, app, shutdownTimeout, drainState);
  }

  const config = gracefulShutdown === true ? {} : gracefulShutdown;
  const signals = config.signals ?? DEFAULT_GRACEFUL_SHUTDOWN_SIGNALS;
  const effectiveTimeout = config.timeout ?? shutdownTimeout;

  let drainPromise: Promise<void> | undefined;
  const removeSignalHandlers = (): void => {
    for (const signal of signals) {
      process.removeListener(signal, onSignal);
    }
  };

  const onSignal = (): void => {
    void runClose();
  };

  const runClose = (): Promise<void> => {
    drainPromise ??= drainAndClose(server, app, effectiveTimeout, drainState).finally(
      removeSignalHandlers
    );
    return drainPromise;
  };

  for (const signal of signals) {
    process.once(signal, onSignal);
  }

  return runClose;
}

/**
 * Start HTTP server for Application
 *
 * @param app - NextRush Application instance
 * @param options - Server options
 * @returns Server instance with control methods
 *
 * @example
 * ```typescript
 * import { createApp } from '@nextrush/core';
 * import { serve } from '@nextrush/adapter-node';
 *
 * const app = createApp();
 *
 * app.use(async (ctx) => {
 *   ctx.json({ message: 'Hello World' });
 * });
 *
 * const server = await serve(app, {
 *   port: 8080,
 *   onListen: ({ port }) => console.log(`Server running on port ${port}`)
 * });
 * ```
 */
export async function serve(app: Application, options: ServeOptions = {}): Promise<ServerInstance> {
  const {
    port = 8080,
    onListen,
    onError,
    timeout = DEFAULT_TIMEOUT_MS,
    keepAliveTimeout = DEFAULT_KEEP_ALIVE_TIMEOUT_MS,
    shutdownTimeout = DEFAULT_SHUTDOWN_TIMEOUT_MS,
    gracefulShutdown,
    tls,
  } = options;

  const host = options.host ?? '0.0.0.0';

  const logger = options.logger ?? app.logger;

  // Boot extensions before building the request handler (deferred boot barrier).
  await app.ready();

  const handler = createHandler(app, { logger, timeout });

  // F-05: a response that completes WHILE a drain is in progress advertises
  // `Connection: close`, so the client (and any intermediary) knows not to
  // reuse this socket — `server.closeIdleConnections()` (called at drain
  // start in `drainAndClose`) only releases sockets with NO in-flight
  // request; it does not touch a socket that is actively finishing one. The
  // wrapped handler below intercepts `res.writeHead` per-request so this is
  // decided at RESPONSE time (a request already in flight when the drain
  // begins must still see it), not at request-arrival time.
  // `createHandler`'s own signature/`HandlerOptions` (a cross-adapter shared
  // type in `@nextrush/types`) is untouched — this wraps its output.
  const drainState: DrainState = { draining: false };
  const wrappedHandler = (req: IncomingMessage, res: ServerResponse): void => {
    // F-05: checked lazily, at the moment headers are actually about to be
    // sent — not once at request-arrival time — because a request already
    // in flight when the drain begins must still pick up `Connection: close`
    // on ITS eventual response. `res.writeHead` covers every response path
    // in this adapter (`ctx.json`, `ctx.send`, streaming) since they all
    // call it before `res.end`; wrapping only `writeHead` (not `end`) avoids
    // double-invoking user response logic and needs no `context.ts` change.
    const originalWriteHead = res.writeHead.bind(res);
    res.writeHead = ((...args: Parameters<ServerResponse['writeHead']>) => {
      if (drainState.draining && !res.headersSent) {
        res.setHeader('Connection', 'close');
      }
      return originalWriteHead(...args);
    }) as ServerResponse['writeHead'];
    handler(req, res);
  };

  // D4: when `tls` is present, use `node:http2.createSecureServer` with
  // `allowHTTP1: true` so clients that don't negotiate h2 via ALPN fall
  // back to HTTP/1.1 over TLS transparently.
  const server = createNodeServer(wrappedHandler, tls);

  // Configure timeouts. F-04/ADR-0010: server.timeout is the independent
  // socket-level slow-client/slow-loris guard; createHandler's own handler-race
  // (fed the same `timeout`) is what actually produces the clean 504.
  // HTTP/2 servers manage timeouts per-session; skip server-level timeout.
  if (!isHttp2Server(server)) {
    server.timeout = timeout;
    server.keepAliveTimeout = keepAliveTimeout;
  }

  // Start listening
  return new Promise((resolve, reject) => {
    // Use a one-time error listener for startup failures (e.g., EADDRINUSE)
    const onStartupError = (error: Error): void => {
      // F-15: normalize into the shared typed error so all adapters agree.
      reject(normalizeStartupError(error, { port, host }));
    };
    server.once('error', onStartupError);

    server.listen(port, host, DEFAULT_LISTEN_BACKLOG, () => {
      // Remove startup-only listener, replace with persistent runtime handler
      server.removeListener('error', onStartupError);
      server.on('error', (error: Error) => {
        if (onError) {
          onError(error);
        } else {
          logger.error('Server error:', error);
        }
      });

      // Mark app as running
      app.start();

      // Use actual address from server (handles port 0 auto-assignment)
      const addr = server.address();
      const actualPort = typeof addr === 'object' && addr !== null ? addr.port : port;
      const actualHost = typeof addr === 'object' && addr !== null ? addr.address : host;
      const info = { port: actualPort, host: actualHost, hostname: actualHost };

      if (onListen) {
        onListen(info);
      }

      resolve({
        server,
        port: actualPort,
        host: actualHost,
        address: () => info,
        close: buildCloseWithGracefulShutdown({
          server,
          app,
          shutdownTimeout,
          gracefulShutdown,
          drainState,
        }),
      });
    });
  });
}

/**
 * Listen shorthand - starts server and logs
 *
 * @param app - NextRush Application instance
 * @param port - Port to listen on
 * @returns Server instance
 *
 * @example
 * ```typescript
 * await listen(app, 8080);
 * // Output: 🚀 NextRush listening on http://localhost:8080
 * ```
 */
export async function listen(app: Application, port = 8080): Promise<ServerInstance> {
  return serve(app, {
    port,
    onListen: ({ port: p }) => {
      app.logger.info(`🚀 NextRush listening on http://localhost:${String(p)}`);
    },
  });
}

// Re-export context
export { createNodeContext, NodeContext } from './context';

// F-01: compile-time conformance guard against the shared server-adapter shape.
const _nodeConformance: ServerAdapter<Application, ServeOptions, ServerInstance> = {
  serve,
  createHandler,
};
void _nodeConformance;

// RFC-NEXTRUSH-ADAPTER-CONTRACT: prove the context factory produces an
// AdapterContext over the shared Context contract (not just the serve/handler
// shape above). A drift in createNodeContext's return type stops compiling here.
const _nodeContextFactory: AdapterContextFactory<
  [IncomingMessage, ServerResponse, NodeContextOptions?],
  NodeContext
> = createNodeContext;
void _nodeContextFactory;
