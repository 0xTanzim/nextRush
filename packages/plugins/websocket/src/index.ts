/**
 * @nextrush/websocket - WebSocket for NextRush
 *
 * Simple, powerful WebSocket support with rooms and broadcasting.
 * Uses factory pattern for clean, decoupled design.
 *
 * @example
 * ```typescript
 * import { createApp } from '@nextrush/core';
 * import { createWebSocket } from '@nextrush/websocket';
 *
 * const app = createApp();
 *
 * // Create WebSocket server (explicit, typed)
 * const wss = createWebSocket();
 *
 * // Register routes on wss (not on app!)
 * wss.on('/chat', (conn) => {
 *   conn.join('general');
 *
 *   conn.on('message', (msg) => {
 *     conn.broadcast('general', msg);
 *   });
 * });
 *
 * // Attach to app (just handles upgrade)
 * app.use(wss.upgrade());
 *
 * // Start server - wss auto-attaches to HTTP server
 * const server = app.listen(3000, () => {
 *   wss.attach(server);
 * });
 * ```
 *
 * @packageDocumentation
 */

import type { Server } from 'node:http';
import { WebSocketServer } from './server';
import type { WebSocketOptions } from './types';

/**
 * Create a WebSocket server instance
 *
 * Factory function that creates a WebSocket server with:
 * - Route-based handlers via `wss.on(path, handler)`
 * - Middleware support via `wss.use(middleware)`
 * - Room management for organized messaging
 * - Broadcasting capabilities
 *
 * @example
 * ```typescript
 * // Basic usage
 * const wss = createWebSocket();
 *
 * wss.on('/chat', (conn) => {
 *   conn.on('message', (msg) => {
 *     conn.send(`Echo: ${msg}`);
 *   });
 * });
 *
 * // With options
 * const wss = createWebSocket({
 *   heartbeatInterval: 30000,
 *   maxPayload: 1024 * 1024,
 *   maxConnections: 1000,
 * });
 *
 * // With authentication
 * const wss = createWebSocket({
 *   verifyClient: async (req) => {
 *     const token = req.headers['authorization'];
 *     return validateToken(token);
 *   },
 * });
 * ```
 */
export function createWebSocket(options: WebSocketOptions = {}): WebSocketServer {
  return new WebSocketServer(options);
}

/**
 * Integrate WebSocket server with NextRush app
 *
 * Helper function to auto-attach WebSocket server when app starts.
 *
 * @example
 * ```typescript
 * import { createApp } from '@nextrush/core';
 * import { createWebSocket, withWebSocket } from '@nextrush/websocket';
 *
 * const app = createApp();
 * const wss = createWebSocket();
 *
 * wss.on('/chat', (conn) => {
 *   conn.on('message', (msg) => conn.send(msg));
 * });
 *
 * // Option 1: Manual attachment
 * const server = app.listen(3000);
 * wss.attach(server);
 *
 * // Option 2: Using withWebSocket helper
 * withWebSocket(app, wss, 3000);
 * ```
 */
export async function withWebSocket(
  app: { listen: (port: number, callback?: () => void) => Server },
  wss: WebSocketServer,
  port: number,
  callback?: () => void
): Promise<Server> {
  return new Promise((resolve) => {
    const server = app.listen(port, async () => {
      await wss.attach(server);
      callback?.();
      resolve(server);
    });
  });
}

// Re-export types
export type {
    WebSocketOptions, WSConnection,
    WSHandler,
    WSMiddleware,
    WSRoute
} from './types';

// Re-export constants
export {
    DEFAULT_MAX_ROOMS_PER_CONNECTION,
    DEFAULT_WS_OPTIONS,
    MAX_ROOM_NAME_LENGTH,
    WS_READY_STATE_OPEN
} from './types';

// Re-export classes for advanced usage
export { Connection } from './connection';
export { MaxRoomsExceededError, RoomManager } from './room-manager';
export { WebSocketServer } from './server';
