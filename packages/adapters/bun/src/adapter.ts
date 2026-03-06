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
   * Hostname to bind to.
   *
   * @remarks
   * Defaults to `0.0.0.0` for convenience in development and container
   * environments. In production, consider binding to a specific interface
   * (e.g. `'127.0.0.1'`) if the server should not be publicly reachable.
   *
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
   * Maximum request body size in bytes.
   *
   * @remarks
   * Bun.serve reads the full body before the framework sees it, so this
   * limit must be set at the server level to prevent memory exhaustion.
   * Matches @nextrush/adapter-node default of 1 MB.
   *
   * @default 1048576 (1 MB)
   */
  maxRequestBodySize?: number;

  /**
   * Request timeout in milliseconds.
   *
   * @remarks
   * Unlike Node.js, Bun.serve has no built-in request timeout.
   * This option adds an AbortController-based timeout at the handler
   * level, returning 504 Gateway Timeout on expiry.
   * Matches @nextrush/adapter-node default of 30 s.
   *
   * @default 30000 (30 seconds)
   */
  timeout?: number;

  /**
   * Development mode (enables additional logging)
   * @default false
   */
  development?: boolean;

  /**
   * Grace period in milliseconds to drain in-flight requests during
   * shutdown before force-closing connections.
   * @default 30000
   */
  shutdownTimeout?: number;
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
  const trustProxy = app.options.proxy ?? false;

  return async (request: Request, server: ReturnType<typeof Bun.serve>): Promise<Response> => {
    // Get client IP from Bun server.
    // Returns '' (empty string) when requestIP returns null — this is
    // intentional. Context.ip is typed as `string`, so undefined would be
    // a type violation. Consumers should check `ctx.ip !== ''` instead of
    // a truthy check.
    const clientIp = server.requestIP(request)?.address ?? '';

    const ctx = createBunContext(request, clientIp, trustProxy);

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
      app.logger.error('Request error:', error);

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
    maxRequestBodySize = 1_048_576,
    timeout = 30_000,
    development = false,
    shutdownTimeout = 30_000,
  } = options;

  // In-flight request tracking for graceful shutdown
  let activeRequests = 0;
  let drainResolve: (() => void) | null = null;

  const appCallback = app.callback();
  const trustProxy = app.options.proxy ?? false;

  // Wrap handler to track in-flight requests
  const trackedHandler = async (
    request: Request,
    bunServer: ReturnType<typeof Bun.serve>
  ): Promise<Response> => {
    activeRequests++;
    try {
      const clientIp = bunServer.requestIP(request)?.address ?? '';
      const ctx = createBunContext(request, clientIp, trustProxy);

      try {
        if (timeout > 0) {
          // Race handler against timeout — mirrors edge adapter pattern
          let timerId: ReturnType<typeof setTimeout> | undefined;
          const TIMEOUT_SENTINEL = Symbol('timeout');

          const result = await Promise.race([
            appCallback(ctx).then(() => {
              if (timerId !== undefined) clearTimeout(timerId);
              return undefined;
            }),
            new Promise<typeof TIMEOUT_SENTINEL>((resolve) => {
              timerId = setTimeout(() => resolve(TIMEOUT_SENTINEL), timeout);
            }),
          ]);

          if (result === TIMEOUT_SENTINEL) {
            return new Response(JSON.stringify({ error: 'Gateway Timeout' }), {
              status: 504,
              headers: { 'Content-Type': 'application/json' },
            });
          }
        } else {
          await appCallback(ctx);
        }

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
        app.logger.error('Request error:', error);

        return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } finally {
      activeRequests--;
      if (activeRequests === 0 && drainResolve) {
        drainResolve();
      }
    }
  };

  // Build Bun.serve options
  const bunOptions: Parameters<typeof Bun.serve>[0] = {
    port,
    hostname,
    fetch: trackedHandler,
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

  // Set max body size (always applied — prevents Bun's 128MB default)
  bunOptions.maxRequestBodySize = maxRequestBodySize;

  // Add error handler
  bunOptions.error = (error: Error): Response => {
    if (onError) {
      onError(error);
    } else {
      app.logger.error('Server error:', error);
    }

    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  // Start server
  let server: ReturnType<typeof Bun.serve>;
  try {
    server = Bun.serve(bunOptions);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('EADDRINUSE') || msg.includes('address already in use')) {
      throw new Error(
        `Port ${options.port ?? 3000} is already in use. ` +
          `Kill the process using that port or choose a different one.`
      );
    }
    throw error;
  }

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
      // 1. Stop accepting new connections
      server.stop();

      // 2. Wait for in-flight requests to drain (with timeout)
      if (activeRequests > 0) {
        await Promise.race([
          new Promise<void>((resolve) => {
            drainResolve = resolve;
          }),
          new Promise<void>((resolve) =>
            setTimeout(() => {
              // Force-close remaining connections
              server.stop(true);
              resolve();
            }, shutdownTimeout)
          ),
        ]);
      }

      // 3. Notify plugins
      await app.close();
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
export function listen(app: Application, port = 3000): ServerInstance {
  return serve(app, {
    port,
    onListen: ({ port: p }) => {
      app.logger.info(`🚀 NextRush listening on http://localhost:${p} (Bun)`);
    },
  });
}
