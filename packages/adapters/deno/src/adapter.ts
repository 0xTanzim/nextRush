/**
 * @nextrush/adapter-deno - Deno HTTP Adapter
 *
 * Connects NextRush Application to Deno.serve().
 *
 * @packageDocumentation
 */

import type { Application, Logger } from '@nextrush/core';
import {
  DEFAULT_SHUTDOWN_TIMEOUT_MS,
  DEFAULT_TIMEOUT_MS,
  jsonErrorResponse,
  normalizeStartupError,
} from '@nextrush/runtime';
import type { AdapterContextFactory, HandlerOptions, ServerAdapter } from '@nextrush/types';
import { createDenoContext } from './context';
import type { DenoContext } from './context';

// Deno runtime types are declared ambiently in ./deno.d.ts (audit F-17).

/**
 * Server options for Deno adapter
 *
 * @remarks
 * Maintains DX consistency with other NextRush adapters while
 * supporting Deno-specific features.
 */
export interface ServeOptions {
  /**
   * Port to listen on
   * @default 8080
   */
  port?: number;

  /**
   * Host to bind to (canonical option — audit F-05).
   *
   * @remarks
   * Defaults to `0.0.0.0`. Prefer `host` over `hostname`; when both are given,
   * `host` wins.
   *
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
   * TLS certificate (for HTTPS)
   */
  cert?: string;

  /**
   * TLS private key (for HTTPS)
   */
  key?: string;

  /**
   * Grace period in milliseconds to drain in-flight requests during
   * shutdown. Deno's native `server.shutdown()` waits for all in-flight
   * requests but has no timeout — this guards against hanging forever.
   * @default 30000 (30 seconds)
   */
  shutdownTimeout?: number;

  /**
   * Request timeout in milliseconds.
   *
   * Deno.serve has no built-in per-request timeout.
   * This option adds a Promise.race-based timeout at the handler
   * level, returning 504 Gateway Timeout on expiry.
   *
   * Set to 0 to disable.
   * @default 30000 (30 seconds)
   */
  timeout?: number;

  /**
   * Logger for adapter diagnostics. Defaults to app.logger.
   */
  logger?: Logger;

  /**
   * Opt-in: wire OS termination signals to the server's existing connection-drain
   * `close()` logic (F-06/ADR-0010). Same shape and semantics as the Node/Bun
   * adapters' `gracefulShutdown` option — when omitted (the default), NO signal
   * handler is installed and process behavior is unchanged.
   *
   * - `true` — install handlers for the default signal set (`SIGTERM`, `SIGINT`),
   *   using {@link ServeOptions.shutdownTimeout} as the drain timeout.
   * - `{ signals, timeout }` — override the signal set and/or the drain timeout.
   *   `timeout` falls back to `shutdownTimeout` when omitted.
   *
   * Deno 2's Node-compatibility layer provides `process.once`/`removeListener`
   * for the signals this wires (`SIGTERM`/`SIGINT`), so the implementation
   * matches Node/Bun exactly; the handler is removed once `close()` completes,
   * so repeated `serve()`/`close()` cycles never accumulate duplicate listeners.
   *
   * @default undefined (no signal handler installed)
   */
  gracefulShutdown?: boolean | GracefulShutdownOptions;
}

/**
 * Explicit override shape for {@link ServeOptions.gracefulShutdown} (F-06).
 *
 * @remarks
 * Identical shape to the Node/Bun adapters' `GracefulShutdownOptions` so an
 * operator configures shutdown the same way regardless of runtime.
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
 *
 * @remarks
 * Provides consistent interface with other adapters while
 * wrapping Deno.Server internals.
 */
export interface ServerInstance {
  /** Deno server instance */
  server: DenoServer;

  /** Port the server is listening on */
  port: number;

  /** Host the server is bound to (canonical — audit F-05). */
  host: string;

  /** Close the server */
  close(): Promise<void>;

  /** Address info (canonical `{ port, host }`, with `hostname` alias for compat). */
  address(): { port: number; host: string; hostname: string };

  /** Promise that resolves when server finishes */
  finished: Promise<void>;
}

/**
 * Create HTTP request handler for Application
 *
 * @param app - NextRush Application instance
 * @returns Deno-compatible handler function
 *
 * @example
 * ```typescript
 * import { createApp } from '@nextrush/core';
 * import { createHandler } from '@nextrush/adapter-deno';
 *
 * const app = createApp();
 * const handler = createHandler(app);
 *
 * // Use with Deno.serve
 * Deno.serve({ handler, port: 8080 });
 * ```
 */
export function createHandler(
  app: Application,
  options: HandlerOptions = {}
): (request: Request, info: DenoServeHandlerInfo) => Promise<Response> {
  const handler = app.callback();
  const trustProxy = app.options.proxy ?? false;
  const logger = options.logger ?? app.logger;
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
  const TIMEOUT_SENTINEL = Symbol('timeout');

  return async (request: Request, info: DenoServeHandlerInfo): Promise<Response> => {
    const ctx = createDenoContext(
      request,
      {
        remoteAddr: { hostname: info.remoteAddr.hostname },
      },
      trustProxy
    );

    try {
      if (timeout > 0) {
        let timerId: ReturnType<typeof setTimeout> | undefined;
        try {
          const result = await Promise.race([
            handler(ctx).then(() => undefined),
            new Promise<typeof TIMEOUT_SENTINEL>((resolve) => {
              timerId = setTimeout(() => {
                resolve(TIMEOUT_SENTINEL);
              }, timeout);
            }),
          ]);

          if (result === TIMEOUT_SENTINEL) {
            ctx.triggerTimeout(); // F-08: cancel the still-running handler
            return jsonErrorResponse(504, 'Gateway Timeout');
          }
        } finally {
          if (timerId !== undefined) clearTimeout(timerId); // F-08: always clear
        }
      } else {
        await handler(ctx);
      }

      // F-02: finalize through the context so ctx.set() headers survive an
      // implicit/empty response; the 404 body is written through the same builder.
      if (!ctx.responded && ctx.status === 404) {
        ctx.json({ error: 'Not Found' });
      }
      return ctx.getResponse();
    } catch (error) {
      logger.error('Request error:', error);

      return jsonErrorResponse(500, 'Internal Server Error');
    }
  };
}

/**
 * The ONE connection-drain implementation for Deno: signal the server to stop
 * accepting new connections, wait for `server.shutdown()` (with a timeout guard
 * since it could otherwise hang on a stalled connection), then destroy app
 * extensions. Both the manually-called `close()` and the signal-triggered path
 * (via {@link buildCloseWithGracefulShutdown}) invoke this exact function (F-06,
 * mirroring the Node/Bun adapters).
 */
async function drainAndClose(
  abortController: AbortController,
  server: DenoServer,
  app: Application,
  shutdownTimeout: number
): Promise<void> {
  // Signal the server to stop accepting new connections
  abortController.abort();

  // Graceful drain with timeout — Deno's shutdown() waits for
  // in-flight requests but could hang if a connection stalls.
  await Promise.race([
    server.shutdown(),
    new Promise<void>((resolve) => setTimeout(resolve, shutdownTimeout)),
  ]);
  // Bound teardown by the same shutdownTimeout budget so a hung extension
  // destroy() cannot outlast the drain (F-02, D1, RFC-022/ADR-0012).
  await app.close({ timeout: shutdownTimeout });
}

/**
 * Build the `close()` returned by {@link serve}, optionally wiring OS signals to
 * invoke it per {@link ServeOptions.gracefulShutdown} (F-06, ADR-0010) — the same
 * contract as the Node/Bun adapters' `buildCloseWithGracefulShutdown`.
 *
 * When `gracefulShutdown` is omitted/falsy, this is a no-op wrapper: no signal
 * handler is installed, and `close()` behaves exactly as it did before this
 * option existed.
 */
function buildCloseWithGracefulShutdown(params: {
  abortController: AbortController;
  server: DenoServer;
  app: Application;
  shutdownTimeout: number;
  gracefulShutdown: ServeOptions['gracefulShutdown'];
}): () => Promise<void> {
  const { abortController, server, app, shutdownTimeout, gracefulShutdown } = params;

  const close = (): Promise<void> => drainAndClose(abortController, server, app, shutdownTimeout);

  if (!gracefulShutdown) {
    return close;
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
    drainPromise ??= drainAndClose(abortController, server, app, effectiveTimeout).finally(
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
 * import { serve } from '@nextrush/adapter-deno';
 *
 * const app = createApp();
 *
 * app.use(async (ctx) => {
 *   ctx.json({ message: 'Hello from Deno!' });
 * });
 *
 * const server = serve(app, {
 *   port: 8080,
 *   onListen: ({ port }) => console.log(`Server running on port ${port}`)
 * });
 * ```
 */
export async function serve(
  app: Application,
  options: ServeOptions = {}
): Promise<ServerInstance> {
  const {
    port = 8080,
    onListen,
    onError,
    cert,
    key,
    shutdownTimeout = DEFAULT_SHUTDOWN_TIMEOUT_MS,
    timeout = DEFAULT_TIMEOUT_MS,
    gracefulShutdown,
  } = options;

  const host = options.host ?? '0.0.0.0';

  // Boot extensions before building the request handler (deferred boot barrier).
  await app.ready();

  const handler = createHandler(app, { timeout, logger: options.logger });

  // AbortController for signal-based shutdown support
  const abortController = new AbortController();

  // Build Deno.serve options
  const denoOptions: DenoServeInit = {
    port,
    hostname: host,
    signal: abortController.signal,
    handler,
    onListen: (params) => {
      // Mark app as running
      app.start();

      if (onListen) {
        onListen({ port: params.port, host: params.hostname, hostname: params.hostname });
      }
    },
    onError: (error) => {
      if (onError) {
        onError(error as Error);
      } else {
        app.logger.error('Server error:', error);
      }

      return jsonErrorResponse(500, 'Internal Server Error');
    },
  };

  // Add TLS if configured
  if (cert && key) {
    denoOptions.cert = cert;
    denoOptions.key = key;
  }

  // Start server
  // F-15: normalize bind/startup failures into one shared typed error so
  // node/bun/deno surface EADDRINUSE (etc.) identically.
  let server: DenoServer;
  try {
    server = Deno.serve(denoOptions);
  } catch (error: unknown) {
    throw normalizeStartupError(error, { port, host });
  }

  return {
    server,
    port: server.addr.port,
    host: server.addr.hostname,
    address: () => ({
      port: server.addr.port,
      host: server.addr.hostname,
      hostname: server.addr.hostname,
    }),
    close: buildCloseWithGracefulShutdown({
      abortController,
      server,
      app,
      shutdownTimeout,
      gracefulShutdown,
    }),
    finished: server.finished,
  };
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
 * import { createApp } from '@nextrush/core';
 * import { listen } from '@nextrush/adapter-deno';
 *
 * const app = createApp();
 * listen(app, 8080);
 * // Output: 🚀 NextRush listening on http://localhost:8080 (Deno)
 * ```
 */
export async function listen(app: Application, port = 8080): Promise<ServerInstance> {
  return serve(app, {
    port,
    onListen: ({ port: p }) => {
      app.logger.info(`🚀 NextRush listening on http://localhost:${String(p)} (Deno)`);
    },
  });
}

// F-01: compile-time conformance guard against the shared server-adapter shape.
const _denoConformance: ServerAdapter<Application, ServeOptions, ServerInstance> = {
  serve,
  createHandler,
};
void _denoConformance;

// RFC-NEXTRUSH-ADAPTER-CONTRACT: prove the context factory produces an
// AdapterContext over the shared Context contract.
const _denoContextFactory: AdapterContextFactory<
  [Request, { remoteAddr?: { hostname: string } }?, boolean?],
  DenoContext
> = createDenoContext;
void _denoContextFactory;
