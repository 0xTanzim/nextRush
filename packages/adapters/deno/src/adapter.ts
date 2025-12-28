/**
 * @nextrush/adapter-deno - Deno HTTP Adapter
 *
 * Connects NextRush Application to Deno.serve().
 *
 * @packageDocumentation
 */

import type { Application } from '@nextrush/core';
import { createDenoContext } from './context';

// Deno types (simplified for cross-compatibility)
declare const Deno: {
  serve(options: DenoServeInit): DenoServer;
  version: { deno: string };
};

interface DenoServeInit {
  port?: number;
  hostname?: string;
  handler: (request: Request, info: DenoServeHandlerInfo) => Response | Promise<Response>;
  onListen?: (params: { port: number; hostname: string }) => void;
  onError?: (error: unknown) => Response | Promise<Response>;
  cert?: string;
  key?: string;
}

interface DenoServeHandlerInfo {
  remoteAddr: { hostname: string; port: number };
}

interface DenoServer {
  finished: Promise<void>;
  ref(): void;
  unref(): void;
  shutdown(): Promise<void>;
  addr: { port: number; hostname: string };
}

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
   * @default 3000
   */
  port?: number;

  /**
   * Hostname to bind to
   * @default '0.0.0.0'
   */
  hostname?: string;

  /**
   * Callback when server starts listening
   */
  onListen?: (info: { port: number; hostname: string }) => void;

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
}

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

  /** Hostname the server is bound to */
  hostname: string;

  /** Close the server */
  close(): Promise<void>;

  /** Address info */
  address(): { port: number; hostname: string };

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
 * Deno.serve({ handler, port: 3000 });
 * ```
 */
export function createHandler(
  app: Application
): (request: Request, info: DenoServeHandlerInfo) => Promise<Response> {
  const handler = app.callback();

  return async (request: Request, info: DenoServeHandlerInfo): Promise<Response> => {
    const ctx = createDenoContext(request, {
      remoteAddr: { hostname: info.remoteAddr.hostname },
    });

    try {
      await handler(ctx);

      if (!ctx.responded) {
        if (ctx.status === 404) {
          return new Response(JSON.stringify({ error: 'Not Found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(null, { status: ctx.status });
      }

      return ctx.getResponse();
    } catch (error) {
      console.error('Request error:', error);

      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
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
 * import { serve } from '@nextrush/adapter-deno';
 *
 * const app = createApp();
 *
 * app.use(async (ctx) => {
 *   ctx.json({ message: 'Hello from Deno!' });
 * });
 *
 * const server = serve(app, {
 *   port: 3000,
 *   onListen: ({ port }) => console.log(`Server running on port ${port}`)
 * });
 * ```
 */
export function serve(app: Application, options: ServeOptions = {}): ServerInstance {
  const {
    port = 3000,
    hostname = '0.0.0.0',
    onListen,
    onError,
    cert,
    key,
  } = options;

  const handler = createHandler(app);

  // Build Deno.serve options
  const denoOptions: DenoServeInit = {
    port,
    hostname,
    handler,
    onListen: (params) => {
      // Mark app as running
      app.start();

      if (onListen) {
        onListen(params);
      }
    },
    onError: (error) => {
      if (onError) {
        onError(error as Error);
      } else {
        console.error('Server error:', error);
      }

      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  };

  // Add TLS if configured
  if (cert && key) {
    denoOptions.cert = cert;
    denoOptions.key = key;
  }

  // Start server
  const server = Deno.serve(denoOptions);

  return {
    server,
    port: server.addr.port,
    hostname: server.addr.hostname,
    address: () => ({ port: server.addr.port, hostname: server.addr.hostname }),
    close: async () => {
      await app.close();
      await server.shutdown();
    },
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
 * listen(app, 3000);
 * // Output: 🚀 NextRush listening on http://localhost:3000 (Deno)
 * ```
 */
export function listen(app: Application, port: number = 3000): ServerInstance {
  return serve(app, {
    port,
    onListen: ({ port: p }) => {
      console.log(`🚀 NextRush listening on http://localhost:${p} (Deno)`);
    },
  });
}
