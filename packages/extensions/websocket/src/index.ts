/**
 * @nextrush/websocket - WebSocket for NextRush
 *
 * Simple, powerful WebSocket support with rooms and broadcasting.
 * Uses factory pattern for clean, decoupled design.
 *
 * @example
 * ```typescript
 * import { createApp } from '@nextrush/core';
 * import { listen } from '@nextrush/adapter-node';
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
 * // Start the server, then attach the WebSocket server to the raw
 * // node:http Server (listen()'s ServerInstance.server, not the wrapper).
 * const { server } = await listen(app, 8080);
 * wss.attach(server);
 * ```
 *
 * For most apps, prefer {@link createWebSocketExtension} instead — it wires
 * disposal into `app.close()` automatically (F-04b). Use the manual
 * `createWebSocket()` factory above only when you need to attach to a server
 * that isn't a NextRush `Application`, or want full manual lifecycle control.
 *
 * @packageDocumentation
 */

import { WebSocketServer } from './server';
import type { WebSocketOptions } from './types';
import type { Extension, ExtensionContext } from '@nextrush/types';

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
 * Create a WebSocket server as a NextRush {@link Extension} — the recommended
 * default (F-04b, D4b). Registering it with `app.extend()` decorates `app.wss`
 * and wires `wss.close()` into `app.close()`'s bounded/isolated teardown, so a
 * missed manual disposal can never leak the heartbeat timer or open sockets.
 *
 * The plain `createWebSocket()` factory is unchanged and still the right
 * choice for manual attach/lifecycle control (e.g. attaching to a server not
 * owned by a NextRush `Application`).
 *
 * @example
 * ```typescript
 * import { createApp } from '@nextrush/core';
 * import { listen } from '@nextrush/adapter-node';
 * import { createWebSocketExtension } from '@nextrush/websocket';
 *
 * const app = createApp().extend(createWebSocketExtension());
 * await app.ready();
 *
 * app.wss.on('/chat', (conn) => {
 *   conn.on('message', (msg) => conn.broadcast('general', msg));
 * });
 *
 * const { server } = await listen(app, 8080);
 * await app.wss.attach(server);
 *
 * // app.close() now also calls app.wss.close() — heartbeat cleared,
 * // connections closed, underlying `ws` server closed.
 * ```
 */
export function createWebSocketExtension(
  options?: WebSocketOptions
): Extension<{ wss: WebSocketServer }> {
  const wss = new WebSocketServer(options);

  return {
    name: 'websocket',
    setup(ctx: ExtensionContext): void {
      ctx.decorate('wss', wss);
    },
    destroy(): void {
      wss.close();
    },
  };
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
