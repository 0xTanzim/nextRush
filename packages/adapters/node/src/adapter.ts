/**
 * @nextrush/adapter-node - Node.js HTTP Adapter
 *
 * Connects NextRush Application to Node.js HTTP server.
 *
 * @packageDocumentation
 */

import type { Application, Logger } from '@nextrush/core';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { createNodeContext } from './context';

/**
 * Server options
 */
export interface ServeOptions {
  /**
   * Port to listen on
   * @default 3000
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
  onListen?: (info: { port: number; host: string }) => void;

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

  /** Address info */
  address(): { port: number; host: string };
}

/**
 * Create HTTP request handler for Application
 */
export function createHandler(
  app: Application,
  options: { logger?: Logger } = {}
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
      (error: Error) => {
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
 *   port: 3000,
 *   onListen: ({ port }) => console.log(`Server running on port ${port}`)
 * });
 * ```
 */
export async function serve(app: Application, options: ServeOptions = {}): Promise<ServerInstance> {
  const {
    port = 3000,
    host = '0.0.0.0',
    onListen,
    onError,
    timeout = 30000,
    keepAliveTimeout = 5000,
    shutdownTimeout = 30_000,
  } = options;

  const logger = options.logger ?? app.logger;
  const handler = createHandler(app, { logger });
  const server = createServer(handler);

  // Configure timeouts
  server.timeout = timeout;
  server.keepAliveTimeout = keepAliveTimeout;

  // Start listening
  return new Promise((resolve, reject) => {
    // Use a one-time error listener for startup failures (e.g., EADDRINUSE)
    const onStartupError = (error: Error): void => {
      reject(error);
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
      const info = { port: actualPort, host: actualHost };

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
          // 2. Destroy plugins after server is fully drained
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
 * await listen(app, 3000);
 * // Output: 🚀 NextRush listening on http://localhost:3000
 * ```
 */
export async function listen(app: Application, port = 3000): Promise<ServerInstance> {
  return serve(app, {
    port,
    onListen: ({ port: p }) => {
      app.logger.info(`🚀 NextRush listening on http://localhost:${p}`);
    },
  });
}

// Re-export context
export { createNodeContext, NodeContext } from './context';
