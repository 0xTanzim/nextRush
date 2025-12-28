/**
 * @nextrush/adapter-bun - Bun HTTP Adapter
 *
 * Connects NextRush Application to Bun.serve().
 *
 * @packageDocumentation
 */

import type { Application } from '@nextrush/core';
import { createBunContext } from './context';

/**
 * Server options for Bun adapter
 *
 * @remarks
 * Maintains DX consistency with @nextrush/adapter-node while
 * supporting Bun-specific features.
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
   * Enable TLS/HTTPS
   */
  tls?: {
    cert: string | Buffer;
    key: string | Buffer;
    ca?: string | Buffer;
  };

  /**
   * Maximum request body size in bytes
   * @default 128MB (Bun default)
   */
  maxRequestBodySize?: number;

  /**
   * Development mode (enables additional logging)
   * @default false
   */
  development?: boolean;
}

/**
 * Server instance returned by serve()
 *
 * @remarks
 * Provides consistent interface with adapter-node while
 * wrapping Bun.Server internals.
 */
export interface ServerInstance {
  /** Bun server instance */
  server: ReturnType<typeof Bun.serve>;

  /** Port the server is listening on */
  port: number;

  /** Hostname the server is bound to */
  hostname: string;

  /** Close the server */
  close(): Promise<void>;

  /** Address info */
  address(): { port: number; hostname: string };

  /** Reload server configuration */
  reload(options?: Partial<ServeOptions>): void;
}

/**
 * Create HTTP request handler for Application
 *
 * @param app - NextRush Application instance
 * @returns Bun-compatible fetch handler
 *
 * @example
 * ```typescript
 * import { createApp } from '@nextrush/core';
 * import { createHandler } from '@nextrush/adapter-bun';
 *
 * const app = createApp();
 * const handler = createHandler(app);
 *
 * // Use with Bun.serve
 * Bun.serve({ fetch: handler, port: 3000 });
 * ```
 */
export function createHandler(
  app: Application
): (request: Request, server: ReturnType<typeof Bun.serve>) => Promise<Response> {
  const handler = app.callback();

  return async (request: Request, server: ReturnType<typeof Bun.serve>): Promise<Response> => {
    // Get client IP from Bun server
    const clientIp = server.requestIP(request)?.address ?? '';

    const ctx = createBunContext(request, clientIp);

    try {
      await handler(ctx);

      // If not responded, send appropriate response
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
 * import { serve } from '@nextrush/adapter-bun';
 *
 * const app = createApp();
 *
 * app.use(async (ctx) => {
 *   ctx.json({ message: 'Hello from Bun!' });
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
    tls,
    maxRequestBodySize,
    development = false,
  } = options;

  const handler = createHandler(app);

  // Build Bun.serve options
  const bunOptions: Parameters<typeof Bun.serve>[0] = {
    port,
    hostname,
    fetch: handler,
    development,
  };

  // Add TLS if configured
  if (tls) {
    bunOptions.tls = {
      cert: tls.cert,
      key: tls.key,
      ca: tls.ca,
    };
  }

  // Add max body size if configured
  if (maxRequestBodySize !== undefined) {
    bunOptions.maxRequestBodySize = maxRequestBodySize;
  }

  // Add error handler
  bunOptions.error = (error: Error): Response => {
    if (onError) {
      onError(error);
    } else {
      console.error('Server error:', error);
    }

    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  // Start server
  const server = Bun.serve(bunOptions);

  // Mark app as running
  app.start();

  // Get actual port and hostname from server
  const actualPort = server.port ?? options.port ?? 3000;
  const actualHostname = server.hostname ?? options.hostname ?? 'localhost';

  // Call onListen callback
  if (onListen) {
    onListen({ port: actualPort, hostname: actualHostname });
  }

  return {
    server,
    port: actualPort,
    hostname: actualHostname,
    address: () => ({ port: actualPort, hostname: actualHostname }),
    close: async () => {
      await app.close();
      server.stop();
    },
    reload: (newOptions?: Partial<ServeOptions>) => {
      server.reload({
        ...bunOptions,
        ...newOptions,
      });
    },
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
 * import { listen } from '@nextrush/adapter-bun';
 *
 * const app = createApp();
 * listen(app, 3000);
 * // Output: 🚀 NextRush listening on http://localhost:3000 (Bun)
 * ```
 */
export function listen(app: Application, port: number = 3000): ServerInstance {
  return serve(app, {
    port,
    onListen: ({ port: p }) => {
      console.log(`🚀 NextRush listening on http://localhost:${p} (Bun)`);
    },
  });
}
