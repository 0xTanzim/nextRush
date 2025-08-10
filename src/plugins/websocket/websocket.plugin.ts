/**
 * WebSocket Plugin for NextRush v2 - Context-based Architecture
 * Provides WebSocket functionality through context enhancement
 */

import { BasePlugin } from '@/plugins/core/base-plugin';
import type {
  Application,
  Context,
  Middleware,
  Next,
  WSConnection,
  WSHandler,
  WSMiddleware,
  WebSocketPluginOptions,
} from '@/types/context';
import { DEFAULT_WS_OPTIONS } from '@/types/context';
import { createHash } from 'node:crypto';
import { IncomingMessage, Server } from 'node:http';
import { Socket } from 'node:net';
import { RawWSConnection } from './connection';
import { reject, verifyOrigin } from './handshake';
import { WSRoomManager } from './room-manager';

/**
 * Enhanced Context with WebSocket functionality
 */
export interface WSContext extends Context {
  /** WebSocket connection (available when request is upgraded) */
  ws?: WSConnection;
  /** Check if request is WebSocket upgrade request */
  isWebSocket: boolean;
  /** WebSocket room manager */
  wsRooms: WSRoomManager;
}

/**
 * WebSocket Context for handlers
 */
export interface WebSocketContext {
  connection: WSConnection;
  path: string;
  query: Record<string, string>;
  headers: IncomingMessage['headers'];
  rooms: WSRoomManager;
}

/**
 * WebSocket Plugin for NextRush v2
 *
 * Enhances context with WebSocket functionality following v2 architecture patterns
 */
export class WebSocketPlugin extends BasePlugin {
  public override name = 'WebSocketPlugin';
  public override version = '2.0.0-alpha.1';
  public override description = 'WebSocket server with context integration';

  private options: Required<WebSocketPluginOptions>;
  private roomManager: WSRoomManager;
  private connections = new Set<WSConnection>();
  private routes = new Map<string, WSHandler>(); // Use routes for compatibility
  private middlewares: WSMiddleware[] = []; // Add middlewares for compatibility
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(options: WebSocketPluginOptions = {}) {
    super();

    this.options = {
      ...DEFAULT_WS_OPTIONS,
      ...options,
    } as Required<WebSocketPluginOptions>;

    this.roomManager = new WSRoomManager();
  }

  /**
   * Install WebSocket plugin - adds WebSocket middleware to app
   */
  public override onInstall(app: Application): void {
    // Add WebSocket middleware that enhances every context
    const websocketMiddleware: Middleware = async (
      ctx: Context,
      next: Next
    ) => {
      const wsCtx = ctx as WSContext;

      // Enhance context with WebSocket functionality
      wsCtx.isWebSocket = this.isWebSocketRequest(ctx.req);
      wsCtx.wsRooms = this.roomManager;

      // If this is a WebSocket upgrade request, handle it
      if (wsCtx.isWebSocket && this.matchPath(ctx.path)) {
        await this.handleWebSocketUpgrade(wsCtx);
        return; // Don't call next() for WebSocket upgrades
      }

      await next();
    };

    app.use(websocketMiddleware);

    // Strongly typed augmentation (cast once then assign for clarity)
    const appWithWS = app as Application;

    appWithWS.ws = (path: string, handler: WSHandler): Application => {
      this.routes.set(path, handler);
      return appWithWS;
    };
    appWithWS.wsUse = (middleware: WSMiddleware): Application => {
      this.middlewares.push(middleware);
      return appWithWS;
    };
    appWithWS.wsBroadcast = (message: string, room?: string): Application => {
      this.broadcast(message, room);
      return appWithWS;
    };

    // Setup HTTP upgrade handling
    this.setupUpgradeHandler(app);

    // Start heartbeat timer
    this.startHeartbeat();
  }

  /**
   * Start heartbeat timer for connection cleanup
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      const timeout = this.options.pongTimeoutMs;
      const toRemove: WSConnection[] = [];

      for (const connection of this.connections) {
        if (!connection.isAlive || now - connection.lastPong > timeout) {
          connection.close(1001, 'Ping timeout');
          toRemove.push(connection);
          this.roomManager.leaveAll(connection);
        }
      }

      // Remove dead connections
      for (const connection of toRemove) {
        this.connections.delete(connection);
      }
    }, this.options.heartbeatMs);
  }

  /**
   * Cleanup plugin resources
   */
  public cleanup(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Close all connections
    for (const connection of this.connections) {
      connection.close(1000, 'Server shutdown');
    }
    this.connections.clear();

    // Clear routes and middlewares
    this.routes.clear();
    this.middlewares.length = 0;
  }

  /**
   * Setup HTTP upgrade event handler
   */
  private setupUpgradeHandler(app: Application): void {
    const httpServer =
      (app as any).getServer?.() ?? (app as any).server ?? null;
    if (!httpServer) return;

    const server = httpServer as Server;
    server.on(
      'upgrade',
      (req: IncomingMessage, socket: Socket, _head: Buffer) => {
        this.handleUpgrade(req, socket).catch(error => {
          console.error('WebSocket upgrade error:', error);
          this.rejectConnection(socket, 500, 'Internal Server Error');
        });
      }
    );
  }

  /**
   * Handle HTTP to WebSocket upgrade
   */
  private async handleUpgrade(
    req: IncomingMessage,
    socket: Socket
  ): Promise<void> {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const path = url.pathname;

    // Check if path matches registered WebSocket routes
    if (!this.matchPath(path)) {
      this.rejectConnection(socket, 404, 'WebSocket route not found');
      return;
    }

    // Verify WebSocket upgrade request
    if (!this.verifyUpgrade(req)) {
      this.rejectConnection(socket, 400, 'Bad WebSocket Request');
      return;
    }

    // Verify origin if configured
    if (!verifyOrigin(req, this.options.allowOrigins)) {
      this.rejectConnection(socket, 403, 'Origin Not Allowed');
      return;
    }

    // Verify client using custom verification if provided
    const verificationResult = await Promise.resolve(
      this.options.verifyClient(req)
    );
    if (!verificationResult) {
      this.rejectConnection(socket, 401, 'Unauthorized');
      return;
    }

    // Check connection limit
    if (this.connections.size >= this.options.maxConnections) {
      this.rejectConnection(socket, 503, 'Too Many Connections');
      return;
    }

    // Perform WebSocket handshake
    if (!this.performHandshake(req, socket)) {
      return; // Handshake handles rejection
    }

    // Create WebSocket connection
    const connection = new RawWSConnection(
      socket,
      req,
      this.roomManager,
      this.options.maxMessageSize
    );

    this.connections.add(connection);

    // Setup connection cleanup
    connection.on('close', () => {
      this.connections.delete(connection);
      this.roomManager.leaveAll(connection);
    });

    // Get WebSocket handler for this path
    let handler: WSHandler | undefined;

    // First try exact match
    if (this.routes.has(path)) {
      handler = this.routes.get(path);
    } else {
      // Try wildcard matches
      for (const [routePath, routeHandler] of this.routes.entries()) {
        if (routePath.endsWith('*')) {
          const prefix = routePath.slice(0, -1);
          if (path.startsWith(prefix)) {
            handler = routeHandler;
            break;
          }
        }
      }
    }

    if (handler) {
      // Execute middlewares before calling handler
      try {
        await this.executeMiddlewares(connection, req);
        // Call the WebSocket handler
        await handler(connection, req);
      } catch (error) {
        console.error('WebSocket handler/middleware error:', error);
        connection.close(1011, 'Internal Error');
      }
    }
  }

  /**
   * Execute WebSocket middlewares
   */
  private async executeMiddlewares(
    connection: WSConnection,
    req: IncomingMessage
  ): Promise<void> {
    for (const middleware of this.middlewares) {
      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      await Promise.resolve(middleware(connection, req, next));

      if (!nextCalled) {
        throw new Error('Middleware did not call next()');
      }
    }
  }

  /**
   * Handle WebSocket upgrade in middleware context
   */
  private async handleWebSocketUpgrade(ctx: WSContext): Promise<void> {
    // This method is called when a WebSocket upgrade is detected in middleware
    // The actual upgrade handling is done in the 'upgrade' event handler

    // Set appropriate headers to indicate upgrade will happen
    ctx.res.status(101);
    ctx.res.setHeader('Upgrade', 'websocket');
    ctx.res.setHeader('Connection', 'Upgrade');
  }

  /**
   * Verify WebSocket upgrade request
   */
  private verifyUpgrade(req: IncomingMessage): boolean {
    const upgrade = req.headers.upgrade;
    const connection = req.headers.connection;
    const key = req.headers['sec-websocket-key'];
    const version = req.headers['sec-websocket-version'];

    return !!(
      upgrade?.toLowerCase() === 'websocket' &&
      connection?.toLowerCase().includes('upgrade') &&
      key &&
      version === '13'
    );
  }

  /**
   * Perform WebSocket handshake
   */
  private performHandshake(req: IncomingMessage, socket: Socket): boolean {
    const key = req.headers['sec-websocket-key'];
    if (!key) return false;

    const acceptKey = this.generateAcceptKey(key);

    const responseHeaders = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptKey}`,
      '\r\n',
    ].join('\r\n');

    try {
      socket.write(responseHeaders);
      return true;
    } catch (error) {
      console.error('WebSocket handshake error:', error);
      return false;
    }
  }

  /**
   * Generate WebSocket accept key
   */
  private generateAcceptKey(key: string): string {
    const WEBSOCKET_MAGIC_STRING = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
    return createHash('sha1')
      .update(key + WEBSOCKET_MAGIC_STRING)
      .digest('base64');
  }

  /**
   * Check if request is WebSocket upgrade request
   */
  private isWebSocketRequest(req: IncomingMessage): boolean {
    const upgrade = req.headers.upgrade;
    const connection = req.headers.connection;

    return !!(
      upgrade?.toLowerCase() === 'websocket' &&
      connection?.toLowerCase().includes('upgrade')
    );
  }

  /**
   * Check if path matches registered WebSocket routes
   */
  private matchPath(requestPath: string): boolean {
    // Check exact matches first
    if (this.routes.has(requestPath)) {
      return true;
    }

    // Handle both string and string array paths
    const paths = Array.isArray(this.options.path)
      ? this.options.path
      : [this.options.path];

    return paths.some((path: string) => {
      if (path === requestPath) return true;
      // Simple wildcard matching
      if (path.endsWith('*')) {
        const prefix = path.slice(0, -1);
        return requestPath.startsWith(prefix);
      }
      return false;
    });
  }

  /**
   * Reject WebSocket connection
   */
  private rejectConnection(
    socket: Socket,
    status: number,
    message: string
  ): void {
    reject(socket, status, message);
  }

  /**
   * Get all active connections
   */
  public getConnections(): WSConnection[] {
    return Array.from(this.connections);
  }

  /**
   * Broadcast message to all connections
   */
  public broadcast(message: string, room?: string): void {
    if (room) {
      this.roomManager.broadcast(room, message);
    } else {
      for (const connection of this.connections) {
        connection.send(message);
      }
    }
  }

  /**
   * Get connection statistics
   */
  public getStats() {
    return {
      totalConnections: this.connections.size,
      rooms: this.roomManager.getRooms(),
      handlers: this.routes.size,
    };
  }
}
