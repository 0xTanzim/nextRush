/**
 * Server Listen Helpers for NextRush v2 Application
 *
 * Handles server startup logic including parameter parsing
 * and production mode compilation.
 *
 * @packageDocumentation
 */

import type { ApplicationCompiler } from '@/core/compiler';
import type { DIContainer } from '@/core/di';
import type { OptimizedRouter } from '@/core/router';
import type { ApplicationOptions } from '@/types/http';
import type { EventEmitter } from 'node:events';
import type { Server } from 'node:http';

/**
 * Configuration for server listen
 */
export interface ListenConfig {
  /** Application options */
  options: Required<ApplicationOptions>;
  /** HTTP server instance */
  server: Server;
  /** Event emitter for lifecycle events */
  emitter: EventEmitter;
  /** Application compiler for production mode */
  compiler: ApplicationCompiler;
  /** Internal router for route compilation */
  router: OptimizedRouter;
  /** DI container for dependency compilation */
  container: DIContainer;
}

/**
 * Parsed listen parameters
 */
export interface ListenParams {
  port: number;
  host: string;
  callback: (() => void) | undefined;
}

/**
 * Parse listen method parameters into a normalized structure
 *
 * Handles three overload signatures:
 * - listen(port, callback)
 * - listen(port, host, callback)
 * - listen(port)
 *
 * @param options - Application options for defaults
 * @param port - Optional port number
 * @param hostOrCallback - Optional host string or callback function
 * @param callback - Optional callback function
 * @returns Normalized listen parameters
 */
export function parseListenParams(
  options: Required<ApplicationOptions>,
  port?: number,
  hostOrCallback?: string | (() => void),
  callback?: () => void
): ListenParams {
  let actualPort: number;
  let actualHost: string;
  let actualCallback: (() => void) | undefined;

  // Handle overloaded parameters
  if (typeof hostOrCallback === 'function') {
    // listen(port, callback)
    actualPort = port ?? options.port;
    actualHost = options.host;
    actualCallback = hostOrCallback;
  } else {
    // listen(port, host, callback)
    actualPort = port ?? options.port;
    actualHost = hostOrCallback ?? options.host;
    actualCallback = callback;
  }

  return {
    port: actualPort,
    host: actualHost,
    callback: actualCallback,
  };
}

/**
 * Start server with optional pre-compilation in production mode
 *
 * @param config - Server listen configuration
 * @param params - Parsed listen parameters
 * @returns HTTP server instance
 */
export function startServerWithCompilation(
  config: ListenConfig,
  params: ListenParams
): Server {
  const { server, emitter, compiler, router, container } = config;
  const { port, host, callback } = params;

  // Pre-compile routes and dependencies for maximum performance
  if (process.env['NODE_ENV'] === 'production') {
    compiler
      .compile(router, container)
      .then(() => {
        // Start server AFTER compilation
        server.listen(port, host, () => {
          emitter.emit('listening', { port, host });
          callback?.();
        });
      })
      .catch(err => {
        console.error('❌ Compilation failed:', err);
        // Start server anyway
        server.listen(port, host, () => {
          emitter.emit('listening', { port, host });
          callback?.();
        });
      });
  } else {
    // Development mode: skip compilation, start immediately
    server.listen(port, host, () => {
      emitter.emit('listening', { port, host });
      callback?.();
    });
  }

  return server;
}

/**
 * Create a listen handler function
 *
 * @param config - Server listen configuration
 * @returns Listen function with proper overloads
 */
export function createListenHandler(config: ListenConfig): {
  (port?: number, callback?: () => void): Server;
  (port?: number, host?: string, callback?: () => void): Server;
} {
  return function listen(
    port?: number,
    hostOrCallback?: string | (() => void),
    callback?: () => void
  ): Server {
    const params = parseListenParams(config.options, port, hostOrCallback, callback);
    return startServerWithCompilation(config, params);
  };
}
