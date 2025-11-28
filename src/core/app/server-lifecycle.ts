/**
 * Server Lifecycle Manager for NextRush v2
 *
 * Handles server creation, startup, and graceful shutdown.
 * Follows Single Responsibility Principle.
 *
 * @packageDocumentation
 */

import type { ApplicationOptions } from '@/types/http';
import type { EventEmitter } from 'node:events';
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';

/**
 * Server lifecycle configuration
 */
export interface ServerConfig {
  /** Application options */
  options: Required<ApplicationOptions>;
  /** Request handler function */
  requestHandler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  /** Event emitter for lifecycle events */
  emitter: EventEmitter;
}

/**
 * Server lifecycle manager
 */
export interface ServerLifecycle {
  /** The HTTP server instance */
  server: Server;
  /** Start the server */
  listen: (
    port: number,
    host: string,
    callback?: () => void
  ) => Promise<Server>;
  /** Gracefully shutdown the server */
  shutdown: () => Promise<void>;
}

/**
 * Create an HTTP server with proper timeouts
 *
 * @param config - Server configuration
 * @returns HTTP server instance
 */
export function createHttpServer(config: ServerConfig): Server {
  const { options, requestHandler } = config;

  const server = createServer((req, res) => {
    requestHandler(req, res).catch((error) => {
      console.error('Request handling error:', error);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    });
  });

  // Connection tuning
  server.keepAliveTimeout = options.keepAlive;
  server.requestTimeout = options.timeout;
  server.headersTimeout = options.keepAlive + 1000; // Safety buffer

  return server;
}

/**
 * Start the server listening on the specified port
 *
 * @param server - HTTP server instance
 * @param port - Port number
 * @param host - Host address
 * @param emitter - Event emitter
 * @param callback - Optional callback when listening starts
 * @returns Promise resolving to the server
 */
export function startServer(
  server: Server,
  port: number,
  host: string,
  emitter: EventEmitter,
  callback?: () => void
): Promise<Server> {
  return new Promise((resolve) => {
    server.listen(port, host, () => {
      emitter.emit('listening', { port, host });
      callback?.();
      resolve(server);
    });
  });
}

/**
 * Gracefully shutdown the server
 *
 * @param server - HTTP server instance
 * @param emitter - Event emitter
 * @param timeout - Shutdown timeout in milliseconds
 * @returns Promise resolving when shutdown is complete
 */
export async function shutdownServer(
  server: Server,
  emitter: EventEmitter,
  timeout: number = 5000
): Promise<void> {
  emitter.emit('shutdown');

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Server shutdown timeout'));
    }, timeout);

    server.close(() => {
      clearTimeout(timeoutId);
      emitter.emit('closed');
      resolve();
    });

    // Force close after 3 seconds if normal close doesn't work
    setTimeout(() => {
      try {
        server.unref();
        clearTimeout(timeoutId);
        resolve();
      } catch {
        clearTimeout(timeoutId);
        resolve();
      }
    }, 3000);
  });
}

/**
 * Create a server lifecycle manager
 *
 * @param config - Server configuration
 * @returns Server lifecycle manager
 */
export function createServerLifecycle(config: ServerConfig): ServerLifecycle {
  const server = createHttpServer(config);

  return {
    server,
    listen: (port: number, host: string, callback?: () => void) =>
      startServer(server, port, host, config.emitter, callback),
    shutdown: () => shutdownServer(server, config.emitter),
  };
}
