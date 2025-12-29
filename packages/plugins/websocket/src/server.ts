/**
 * @nextrush/websocket - WebSocket Server
 *
 * Core WebSocket server implementation using the ws library.
 *
 * @packageDocumentation
 */

import type { IncomingMessage, Server } from 'node:http';
import type { Socket } from 'node:net';
import { Connection } from './connection';
import { RoomManager } from './room-manager';
import {
    DEFAULT_WS_OPTIONS,
    escapeRegex,
    type WebSocketOptions,
    type WSConnection,
    type WSHandler,
    type WSMiddleware,
} from './types';

/**
 * ws library types (minimal interface for dynamic import)
 */
interface WsServerInstance {
  handleUpgrade(
    request: IncomingMessage,
    socket: Socket,
    head: Buffer,
    callback: (ws: WsInstance) => void
  ): void;
  close(): void;
}

interface WsInstance {
  readyState: number;
  send(data: string | Buffer): void;
  close(code?: number, reason?: string): void;
  ping(data?: Buffer): void;
  pong(data?: Buffer): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void;
}

interface WsModule {
  WebSocketServer: new (options: {
    noServer: boolean;
    maxPayload?: number;
    perMessageDeflate?: boolean;
  }) => WsServerInstance;
}

/**
 * Load ws library dynamically
 */
async function loadWsLibrary(): Promise<WsModule> {
  try {
    return (await import('ws')) as unknown as WsModule;
  } catch {
    throw new Error(
      '[@nextrush/websocket] The "ws" package is required.\n\n' +
        '  npm install ws\n' +
        '  # or with types\n' +
        '  npm install ws @types/ws\n'
    );
  }
}

/**
 * WebSocket Server implementation
 *
 * Internal class that manages WebSocket connections using the ws library.
 */
export class WebSocketServer {
  private wss: WsServerInstance | null = null;
  private readonly connections = new Map<WSConnection, { isAlive: boolean }>();
  private readonly routes = new Map<string, WSHandler>();
  private readonly middlewares: WSMiddleware[] = [];
  private readonly roomManager: RoomManager;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private initialized = false;

  private readonly resolvedOptions: Required<
    Omit<WebSocketOptions, 'verifyClient' | 'onConnection' | 'onClose' | 'onError'>
  >;
  private readonly customCallbacks: Pick<
    WebSocketOptions,
    'verifyClient' | 'onConnection' | 'onClose' | 'onError'
  >;

  constructor(options: WebSocketOptions = {}) {
    this.resolvedOptions = {
      ...DEFAULT_WS_OPTIONS,
      ...options,
    };
    this.customCallbacks = {
      verifyClient: options.verifyClient,
      onConnection: options.onConnection,
      onClose: options.onClose,
      onError: options.onError,
    };
    this.roomManager = new RoomManager(this.resolvedOptions.maxRoomsPerConnection);
  }

  /**
   * Register a WebSocket route handler
   *
   * @example
   * ```typescript
   * wss.on('/chat', (conn) => {
   *   conn.on('message', (msg) => conn.send(msg));
   * });
   * ```
   */
  on(path: string, handler: WSHandler): this {
    this.routes.set(path, handler);
    return this;
  }

  /**
   * Register WebSocket middleware
   *
   * @example
   * ```typescript
   * wss.use((conn, req, next) => {
   *   console.log('New connection:', conn.id);
   *   next();
   * });
   * ```
   */
  use(middleware: WSMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Create upgrade middleware for NextRush app
   *
   * @example
   * ```typescript
   * app.use(wss.upgrade());
   * ```
   */
  upgrade(): (ctx: unknown, next: () => Promise<void>) => Promise<void> {
    return async (_ctx: unknown, next: () => Promise<void>) => {
      await next();
    };
  }

  /**
   * Attach to HTTP server and start handling WebSocket connections
   *
   * @internal Called automatically when app.listen() is invoked
   */
  async attach(httpServer: Server): Promise<void> {
    if (this.initialized) return;

    const ws = await loadWsLibrary();

    this.wss = new ws.WebSocketServer({
      noServer: true,
      maxPayload: this.resolvedOptions.maxPayload,
      perMessageDeflate: this.resolvedOptions.perMessageDeflate,
    });

    httpServer.on('upgrade', (request, socket, head) => {
      this.handleUpgrade(request, socket as Socket, head as Buffer);
    });

    if (this.resolvedOptions.heartbeatInterval > 0) {
      this.startHeartbeat();
    }

    this.initialized = true;
  }

  /**
   * Handle HTTP upgrade request
   */
  private handleUpgrade(
    request: IncomingMessage,
    socket: Socket,
    head: Buffer
  ): void {
    const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
    const path = url.pathname;

    if (!this.matchPath(path)) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    if (!this.verifyOrigin(request)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    if (
      this.resolvedOptions.maxConnections > 0 &&
      this.connections.size >= this.resolvedOptions.maxConnections
    ) {
      socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
      socket.destroy();
      return;
    }

    this.verifyClient(request)
      .then((allowed) => {
        if (!allowed) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        this.wss!.handleUpgrade(request, socket, head, (ws) => {
          this.onConnection(ws, request, path);
        });
      })
      .catch(() => {
        socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
        socket.destroy();
      });
  }

  /**
   * Verify client connection
   */
  private async verifyClient(request: IncomingMessage): Promise<boolean> {
    if (this.customCallbacks.verifyClient) {
      return this.customCallbacks.verifyClient(request);
    }
    return true;
  }

  /**
   * Verify origin header
   * When allowedOrigins is configured, requests without Origin header are denied
   */
  private verifyOrigin(request: IncomingMessage): boolean {
    if (this.resolvedOptions.allowedOrigins.length === 0) {
      return true;
    }

    const origin = request.headers.origin;

    // When origins are configured, missing Origin header is denied
    // This prevents bypassing CORS by omitting the header
    if (!origin) return false;

    return this.resolvedOptions.allowedOrigins.some((allowed) => {
      if (allowed === '*') return true;
      if (allowed === origin) return true;
      if (allowed.includes('*')) {
        // Escape special regex chars EXCEPT *, then convert * to .*
        const escaped = escapeRegex(allowed).replace(/\\\*/g, '.*');
        const pattern = new RegExp('^' + escaped + '$');
        return pattern.test(origin);
      }
      return false;
    });
  }

  /**
   * Check if path matches registered routes
   */
  private matchPath(requestPath: string): boolean {
    for (const routePath of this.routes.keys()) {
      if (this.pathMatches(routePath, requestPath)) {
        return true;
      }
    }

    const paths = Array.isArray(this.resolvedOptions.path)
      ? this.resolvedOptions.path
      : [this.resolvedOptions.path];

    return paths.some((p) => this.pathMatches(p, requestPath));
  }

  /**
   * Check if a single path pattern matches
   */
  private pathMatches(pattern: string, path: string): boolean {
    if (pattern === path) return true;
    if (pattern === '*' || pattern === '/*') return true;

    if (pattern.includes(':')) {
      const patternParts = pattern.split('/');
      const pathParts = path.split('/');

      if (patternParts.length !== pathParts.length) return false;

      return patternParts.every((part, i) => {
        if (part.startsWith(':')) return true;
        return part === pathParts[i];
      });
    }

    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return path.startsWith(prefix);
    }

    return false;
  }

  /**
   * Handle new WebSocket connection
   */
  private onConnection(
    ws: WsInstance,
    request: IncomingMessage,
    path: string
  ): void {
    const connection = new Connection(ws, request, this.roomManager);

    // Track connection with isAlive for heartbeat
    this.connections.set(connection, { isAlive: true });

    // Track pong responses for heartbeat
    connection.on('pong', () => {
      const state = this.connections.get(connection);
      if (state) {
        state.isAlive = true;
      }
    });

    connection.on('close', (code: number, reason: string) => {
      this.connections.delete(connection);
      this.customCallbacks.onClose?.(connection, code, reason);
    });

    connection.on('error', (error) => {
      this.customCallbacks.onError?.(connection, error);
    });

    this.customCallbacks.onConnection?.(connection);

    this.executeMiddlewares(connection, request, () => {
      const handler = this.findHandler(path);
      if (handler) {
        Promise.resolve(handler(connection, request)).catch((error) => {
          this.customCallbacks.onError?.(connection, error as Error);
        });
      }
    });
  }

  /**
   * Find handler for path
   */
  private findHandler(path: string): WSHandler | undefined {
    if (this.routes.has(path)) {
      return this.routes.get(path);
    }

    for (const [pattern, handler] of this.routes) {
      if (this.pathMatches(pattern, path)) {
        return handler;
      }
    }

    return undefined;
  }

  /**
   * Execute WebSocket middlewares
   */
  private executeMiddlewares(
    connection: WSConnection,
    request: IncomingMessage,
    done: () => void
  ): void {
    let index = 0;

    const next = (): void => {
      if (index >= this.middlewares.length) {
        done();
        return;
      }

      const middleware = this.middlewares[index];
      index++;

      if (!middleware) {
        done();
        return;
      }

      try {
        const result = middleware(connection, request, next);
        if (result instanceof Promise) {
          result.catch((error) => {
            this.customCallbacks.onError?.(connection, error as Error);
          });
        }
      } catch (error) {
        this.customCallbacks.onError?.(connection, error as Error);
      }
    };

    next();
  }

  /**
   * Start heartbeat timer
   * Pings all connections and terminates those that don't respond
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      for (const [conn, state] of this.connections) {
        const connection = conn as Connection;

        if (!connection.isOpen) {
          this.connections.delete(conn);
          continue;
        }

        // If connection didn't respond to previous ping, terminate it
        if (!state.isAlive) {
          connection.close(1001, 'Connection timeout');
          this.connections.delete(conn);
          continue;
        }

        // Mark as not alive until pong received
        state.isAlive = false;
        connection.ping();
      }
    }, this.resolvedOptions.heartbeatInterval);
  }

  // Public API methods

  /**
   * Get all active connections
   */
  getConnections(): WSConnection[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Get connection count
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Broadcast to all connections
   */
  broadcast(data: string | Buffer, exclude?: WSConnection): void {
    for (const conn of this.connections.keys()) {
      if (exclude && conn === exclude) continue;
      try {
        conn.send(data);
      } catch {
        // Ignore send errors
      }
    }
  }

  /**
   * Broadcast JSON to all connections
   */
  broadcastJson(data: unknown, exclude?: WSConnection): void {
    try {
      this.broadcast(JSON.stringify(data), exclude);
    } catch {
      // JSON.stringify can fail on circular references or BigInt
    }
  }

  /**
   * Broadcast to a specific room
   */
  broadcastToRoom(
    room: string,
    data: string | Buffer,
    exclude?: WSConnection
  ): void {
    this.roomManager.broadcast(room, data, exclude);
  }

  /**
   * Broadcast JSON to a specific room
   */
  broadcastJsonToRoom(
    room: string,
    data: unknown,
    exclude?: WSConnection
  ): void {
    this.roomManager.broadcastJson(room, data, exclude);
  }

  /**
   * Get all room names
   */
  getRooms(): string[] {
    return this.roomManager.getAllRooms();
  }

  /**
   * Get connections in a room
   */
  getRoomConnections(room: string): WSConnection[] {
    return this.roomManager.getConnections(room);
  }

  /**
   * Close all connections
   */
  closeAll(code = 1000, reason = 'Server shutdown'): void {
    for (const conn of this.connections.keys()) {
      conn.close(code, reason);
    }
    this.connections.clear();
  }

  /**
   * Cleanup resources
   */
  close(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.closeAll();
    this.roomManager.clear();
    this.wss?.close();
    this.initialized = false;
  }
}
