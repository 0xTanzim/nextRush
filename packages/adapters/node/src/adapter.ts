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
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { createNodeContext } from './context';
import type { NodeContext, NodeContextOptions } from './context';

/**
 * Server options
 */
export interface ServeOptions {
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
  /** Node.js HTTP server */
  server: Server;

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
 * (audit F-06). Node enforces `timeout` at the socket level in {@link serve}
 * (`server.timeout`), not per-handler, so only `logger` is consumed here.
 */
export function createHandler(
  app: Application,
  options: HandlerOptions = {}
): (req: IncomingMessage, res: ServerResponse) => void {
  const handler = app.callback();
  const trustProxy = app.options.proxy ?? false;
  const logger = options.logger ?? app.logger;

  return (req: IncomingMessage, res: ServerResponse): void => {
    const ctx = createNodeContext(req, res, { trustProxy });

    // Single promise chain: .then(onFulfilled, onRejected) avoids extra microtask
    handler(ctx).then(
      () => {
        // Ensure response is sent
        if (!ctx.responded && !res.headersSent) {
          if (ctx.status === 404) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: 'Not Found' }));
          } else {
            res.statusCode = ctx.status;
            res.end();
          }
        }
      },
      (error: unknown) => {
        // Error handling
        logger.error('Request error:', error);

        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: 'Internal Server Error' }));
        }
      }
    );
  };
}

/**
 * The ONE connection-drain implementation: stop accepting new connections, force-close
 * if they don't drain within `shutdownTimeout`, then destroy app extensions. Both the
 * manually-called `close()` and the signal-triggered path (via
 * {@link buildCloseWithGracefulShutdown}) invoke this exact function — there is
 * deliberately no second drain implementation for the signal path (T010 1.8).
 */
async function drainAndClose(server: Server, app: Application, shutdownTimeout: number): Promise<void> {
  // 1. Stop accepting new connections with drain timeout
  await new Promise<void>((res) => {
    const forceTimer = setTimeout(() => {
      // Force-close if connections don't drain in time
      server.closeAllConnections();
      res();
    }, shutdownTimeout);

    server.close(() => {
      clearTimeout(forceTimer);
      res();
    });
  });
  // 2. Destroy extensions after server is fully drained
  await app.close();
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
}): () => Promise<void> {
  const { server, app, shutdownTimeout, gracefulShutdown } = params;

  if (!gracefulShutdown) {
    return () => drainAndClose(server, app, shutdownTimeout);
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
    drainPromise ??= drainAndClose(server, app, effectiveTimeout).finally(removeSignalHandlers);
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
  } = options;

  const host = options.host ?? '0.0.0.0';

  const logger = options.logger ?? app.logger;

  // Boot extensions before building the request handler (deferred boot barrier).
  await app.ready();

  const handler = createHandler(app, { logger });
  const server = createServer(handler);

  // Configure timeouts
  server.timeout = timeout;
  server.keepAliveTimeout = keepAliveTimeout;

  // Start listening
  return new Promise((resolve, reject) => {
    // Use a one-time error listener for startup failures (e.g., EADDRINUSE)
    const onStartupError = (error: Error): void => {
      // F-15: normalize into the shared typed error so all adapters agree.
      reject(normalizeStartupError(error, { port, host }));
    };
    server.once('error', onStartupError);

    server.listen(port, host, () => {
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
