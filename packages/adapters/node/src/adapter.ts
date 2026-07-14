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
   * Hostname to bind to.
   * @deprecated Use {@link ServeOptions.host}. Accepted as an alias for
   * cross-adapter portability (audit F-05); when both are given, `host` wins.
   */
  hostname?: string;

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
}

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
  } = options;

  // F-05: accept both `host` (canonical) and `hostname` (deprecated alias).
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional read of the back-compat alias
  const host = options.host ?? options.hostname ?? '0.0.0.0';

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
        close: async () => {
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
        },
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
