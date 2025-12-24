/**
 * @nextrush/adapter-node - Node.js HTTP Adapter
 *
 * Connects NextRush Application to Node.js HTTP server.
 *
 * @packageDocumentation
 */

import type { Application } from '@nextrush/core';
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
  app: Application
): (req: IncomingMessage, res: ServerResponse) => void {
  const handler = app.callback();

  return (req: IncomingMessage, res: ServerResponse): void => {
    const ctx = createNodeContext(req, res);

    // Handle the request
    handler(ctx)
      .then(() => {
        // Ensure response is sent
        if (!ctx.responded && !res.headersSent) {
          if (ctx.status === 404) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Not Found' }));
          } else {
            res.statusCode = ctx.status;
            res.end();
          }
        }
      })
      .catch((error: Error) => {
        // Error handling
        console.error('Request error:', error);

        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Internal Server Error' }));
        }
      });
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
  } = options;

  const handler = createHandler(app);
  const server = createServer(handler);

  // Configure timeouts
  server.timeout = timeout;
  server.keepAliveTimeout = keepAliveTimeout;

  // Handle server errors
  server.on('error', (error: Error) => {
    if (onError) {
      onError(error);
    } else {
      console.error('Server error:', error);
    }
  });

  // Start listening
  return new Promise((resolve, reject) => {
    server.listen(port, host, () => {
      // Mark app as running
      app.start();

      const info = { port, host };

      if (onListen) {
        onListen(info);
      }

      resolve({
        server,
        port,
        host,
        address: () => info,
        close: async () => {
          await app.close();
          return new Promise<void>((res, rej) => {
            server.close((err) => {
              if (err) rej(err);
              else res();
            });
          });
        },
      });
    });

    server.on('error', reject);
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
export async function listen(app: Application, port: number = 3000): Promise<ServerInstance> {
  return serve(app, {
    port,
    onListen: ({ port: p }) => {
      console.log(`🚀 NextRush listening on http://localhost:${p}`);
    },
  });
}

// Re-export context
export { createNodeContext, NodeContext } from './context';
