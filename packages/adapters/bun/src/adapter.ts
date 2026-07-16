/**
 * @nextrush/adapter-bun - Bun HTTP Adapter
 *
 * Connects NextRush Application to Bun.serve().
 *
 * @packageDocumentation
 */

import type { Application, Logger } from '@nextrush/core';
import {
  DEFAULT_SHUTDOWN_TIMEOUT_MS,
  DEFAULT_TIMEOUT_MS,
  normalizeStartupError,
} from '@nextrush/runtime';
import type { AdapterContextFactory, HandlerOptions, ServerAdapter } from '@nextrush/types';
import { createBunContext } from './context';
import type { BunContext } from './context';

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
   * @default 8080
   */
  port?: number;

  /**
   * Host to bind to (canonical option — audit F-05).
   *
   * @remarks
   * Defaults to `0.0.0.0`. Prefer `host` over `hostname` for portability across
   * NextRush adapters; when both are given, `host` wins.
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
   * @default 30000 (30 seconds)
   */
  shutdownTimeout?: number;

  /**
   * Logger for adapter diagnostics. Defaults to app.logger.
   */
  logger?: Logger;
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

  /** Host the server is bound to (canonical — audit F-05). */
  host: string;

  /** Close the server */
  close(): Promise<void>;

  /** Address info (canonical `{ port, host }`, with `hostname` alias for compat). */
  address(): { port: number; host: string; hostname: string };

  /** Reload server configuration */
  reload(options?: Partial<ServeOptions>): void;
}

/**
 * A Bun fetch handler `(request, server) => Promise<Response>`.
 */
export type BunFetchHandler = (
  request: Request,
  server: ReturnType<typeof Bun.serve>
) => Promise<Response>;

/**
 * Build the shared per-request runner for the Bun adapter.
 *
 * @remarks
 * The single source of truth used by both `createHandler` and `serve` (audit
 * F-07: `serve` previously forked its own `trackedHandler` and the exported
 * `createHandler` silently lacked the timeout). Owns context creation, the
 * timeout race with cooperative cancellation (F-08), the header-preserving
 * finalize path (F-02), and error handling.
 */
function createBunRequestRunner(
  app: Application,
  options: HandlerOptions
): BunFetchHandler {
  const handler = app.callback();
  const trustProxy = app.options.proxy ?? false;
  const logger = options.logger ?? app.logger;
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
  const TIMEOUT_SENTINEL = Symbol('timeout');

  return async (request: Request, server: ReturnType<typeof Bun.serve>): Promise<Response> => {
    const clientIp = server.requestIP(request)?.address ?? '';
    const ctx = createBunContext(request, clientIp, trustProxy);

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
            return new Response(JSON.stringify({ error: 'Gateway Timeout' }), {
              status: 504,
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
            });
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

      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }
  };
}

/**
 * Create HTTP request handler for Application
 *
 * @param app - NextRush Application instance
 * @param options - Handler options (`timeout`, `logger`) — audit F-06/F-07
 * @returns Bun-compatible fetch handler
 *
 * @remarks
 * Now honors `timeout` (default 30 s) so `Bun.serve({ fetch: createHandler(app) })`
 * behaves identically to `serve(app, { timeout })` (audit F-07). Pass
 * `{ timeout: 0 }` to disable.
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
 * Bun.serve({ fetch: handler, port: 8080 });
 * ```
 */
export function createHandler(app: Application, options: HandlerOptions = {}): BunFetchHandler {
  return createBunRequestRunner(app, options);
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
    tls,
    maxRequestBodySize = 1_048_576,
    timeout = DEFAULT_TIMEOUT_MS,
    development = false,
    shutdownTimeout = DEFAULT_SHUTDOWN_TIMEOUT_MS,
  } = options;

  const host = options.host ?? '0.0.0.0';
  const logger = options.logger ?? app.logger;

  // In-flight request tracking for graceful shutdown
  let activeRequests = 0;
  let drainResolve: (() => void) | null = null;

  // Boot extensions before building the request handler (deferred boot barrier).
  await app.ready();

  // F-07: serve composes the SAME handler createHandler produces (with timeout),
  // then wraps it only with in-flight tracking for graceful drain.
  const baseHandler = createHandler(app, { timeout, logger });
  const trackedHandler = async (
    request: Request,
    bunServer: ReturnType<typeof Bun.serve>
  ): Promise<Response> => {
    activeRequests++;
    try {
      return await baseHandler(request, bunServer);
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
    hostname: host,
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
    // F-15: normalize bind/startup failures into one shared typed error so
    // node/bun/deno surface EADDRINUSE (etc.) identically.
    throw normalizeStartupError(error, { port, host });
  }

  // Mark app as running
  app.start();

  // Get actual port and host from server
  const actualPort = server.port ?? port;
  const actualHost = server.hostname ?? host;

  // Call onListen callback
  if (onListen) {
    onListen({ port: actualPort, host: actualHost, hostname: actualHost });
  }

  return {
    server,
    port: actualPort,
    host: actualHost,
    address: () => ({ port: actualPort, host: actualHost, hostname: actualHost }),
    close: async () => {
      // 1. Stop accepting new connections
      void server.stop();

      // 2. Wait for in-flight requests to drain (with timeout)
      if (activeRequests > 0) {
        await Promise.race([
          new Promise<void>((resolve) => {
            drainResolve = resolve;
          }),
          new Promise<void>((resolve) =>
            setTimeout(() => {
              // Force-close remaining connections
              void server.stop(true);
              resolve();
            }, shutdownTimeout)
          ),
        ]);
      }

      // 3. Tear down extensions
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
 * listen(app, 8080);
 * // Output: 🚀 NextRush listening on http://localhost:8080 (Bun)
 * ```
 */
export async function listen(app: Application, port = 8080): Promise<ServerInstance> {
  return serve(app, {
    port,
    onListen: ({ port: p }) => {
      app.logger.info(`🚀 NextRush listening on http://localhost:${String(p)} (Bun)`);
    },
  });
}

// F-01: compile-time conformance guard against the shared server-adapter shape.
const _bunConformance: ServerAdapter<Application, ServeOptions, ServerInstance> = {
  serve,
  createHandler,
};
void _bunConformance;

// RFC-NEXTRUSH-ADAPTER-CONTRACT: prove the context factory produces an
// AdapterContext over the shared Context contract.
const _bunContextFactory: AdapterContextFactory<[Request, string?, boolean?], BunContext> =
  createBunContext;
void _bunContextFactory;
