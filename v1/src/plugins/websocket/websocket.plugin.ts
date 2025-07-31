/**
 * 🚀 NextRush WebSocket Plugin - Refactored
 * Modular, optimized WebSocket implementation
 */

import { IncomingMessage, Server } from 'http';
import { Socket } from 'net';
import { Application } from '../../core/app/application';
import { NextRushRequest } from '../../types/express';
import { BasePlugin, PluginRegistry } from '../core/base-plugin';

// Import modular components
import { 
  WSOptions, 
  WSHandler, 
  WSMiddleware, 
  WSConnection, 
  WSStats,
  DEFAULT_WS_OPTIONS 
} from './types';
import { WSRoomManager } from './room-manager';
import { WSConnectionHandler } from './connection-handler';
import { WSHandshakeHandler } from './handshake-handler';
import { WSStatsTracker } from './stats-tracker';

/**
 * WebSocket Plugin for NextRush - Refactored for modularity and performance
 */
export class WebSocketPlugin extends BasePlugin {
  name = 'WebSocket';

  private server?: Server;
  private app?: Application;
  private isEnabled = false;
  private options: Required<WSOptions>;
  
  // Modular components
  private roomManager: WSRoomManager;
  private connectionHandler: WSConnectionHandler;
  private statsTracker: WSStatsTracker;
  
  // Connection and route management
  private connections = new Map<string, WSConnection>();
  private routes = new Map<string, WSHandler>();
  private middleware: WSMiddleware[] = [];
  
  // Health monitoring
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(registry: PluginRegistry) {
    super(registry);
    this.options = { ...DEFAULT_WS_OPTIONS };
    
    // Initialize modular components
    this.roomManager = new WSRoomManager(
      this.options.maxRooms, 
      this.options.roomCleanupInterval
    );
    this.connectionHandler = new WSConnectionHandler(this.options.maxMessageSize);
    this.statsTracker = new WSStatsTracker();
    
    this.setupEventListeners();
  }

  /**
   * Install WebSocket plugin into application
   */
  install(app: Application): void {
    // Add WebSocket methods to application
    (app as any).enableWebSocket = (options?: WSOptions) => {
      this.updateOptions(options || {});
      this.app = app;
      this.isEnabled = true;
      return app;
    };

    (app as any).ws = (path: string, handler: WSHandler) => {
      this.routes.set(path, handler);
      return app;
    };

    (app as any).wsUse = (middleware: WSMiddleware) => {
      this.middleware.push(middleware);
      return app;
    };

    (app as any).wsBroadcast = (data: any, room?: string) => {
      this.broadcast(data, room);
      return app;
    };

    (app as any).getWebSocketStats = () => {
      return this.getStats();
    };

    (app as any).getWebSocketConnections = () => {
      return Array.from(this.connections.values());
    };

    // Listen for server creation
    this.registry.on('application:server-created', () => {
      if (this.isEnabled && this.app) {
        this.setupServer(this.app);
      }
    });
  }

  /**
   * Start the WebSocket plugin
   */
  start(): void {
    this.startHealthMonitoring();
    // Room cleanup is handled internally by room manager
    this.emit('websocket:started');
    this.log('info', '🚀 NextRush WebSocket Plugin started');
  }

  /**
   * Stop the WebSocket plugin
   */
  stop(): void {
    this.stopHealthMonitoring();
    this.roomManager.stopCleanupTimer();
    this.closeAllConnections();
    this.emit('websocket:stopped');
    this.log('info', '🛑 NextRush WebSocket Plugin stopped');
  }

  /**
   * Update WebSocket options
   */
  private updateOptions(options: WSOptions): void {
    this.options = { ...this.options, ...options };
    
    // Update component configurations
    this.roomManager = new WSRoomManager(
      this.options.maxRooms, 
      this.options.roomCleanupInterval
    );
    this.connectionHandler = new WSConnectionHandler(this.options.maxMessageSize);
  }

  /**
   * Setup WebSocket server on HTTP upgrade
   */
  private setupServer(app: Application): void {
    const server = (app as any).httpServer;
    if (!server) {
      throw new Error(
        'HTTP server not found. Make sure app.listen() is called first.'
      );
    }

    this.server = server;
    
    if (this.server) {
      // Handle HTTP upgrade to WebSocket
      this.server.on(
        'upgrade',
        (req: IncomingMessage, socket: Socket, head: Buffer) => {
          this.handleUpgrade(req, socket, head);
        }
      );

      this.log('info', '🔌 WebSocket server setup completed');
    }
  }

  /**
   * Handle HTTP upgrade to WebSocket
   */
  private async handleUpgrade(
    req: IncomingMessage,
    socket: Socket,
    _head: Buffer
  ): Promise<void> {
    try {
      // Find matching route
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      const handler = this.findHandler(url.pathname);

      if (!handler) {
        WSHandshakeHandler.rejectConnection(socket, 404, 'WebSocket route not found');
        return;
      }

      // Check connection limit
      if (this.connections.size >= this.options.maxConnections) {
        WSHandshakeHandler.rejectConnection(socket, 503, 'Too Many Connections');
        return;
      }

      // Verify client if callback provided
      if (this.options.verifyClient) {
        const isValid = await this.options.verifyClient(req);
        if (!isValid) {
          WSHandshakeHandler.rejectConnection(socket, 401, 'Unauthorized');
          return;
        }
      }

      // Check origin if specified
      if (!WSHandshakeHandler.verifyOrigin(req, this.options.allowOrigins)) {
        WSHandshakeHandler.rejectConnection(socket, 403, 'Forbidden Origin');
        return;
      }

      // Perform WebSocket handshake
      const handshakeSuccess = WSHandshakeHandler.performHandshake(
        req, 
        socket, 
        this.options.protocols
      );

      if (!handshakeSuccess) {
        return;
      }

      // Create WebSocket connection
      const wsSocket = this.connectionHandler.createConnection(
        socket, 
        req, 
        this.roomManager
      );
      
      this.connections.set(wsSocket.id, wsSocket);
      this.statsTracker.incrementConnections();

      this.log('info', `WebSocket connection established: ${wsSocket.id}`);

      // Setup connection cleanup
      wsSocket.socket.on('close', () => {
        this.handleConnectionClose(wsSocket);
      });

      // Run middleware chain
      await this.runMiddleware(wsSocket, req as NextRushRequest);

      // Call the route handler
      await handler(wsSocket, req as NextRushRequest);
      
    } catch (error) {
      this.log('error', 'WebSocket upgrade failed', error);
      WSHandshakeHandler.rejectConnection(socket, 500, 'Internal Server Error');
      this.statsTracker.incrementErrors();
    }
  }

  /**
   * Find WebSocket handler for path
   */
  private findHandler(path: string): WSHandler | undefined {
    // Exact match first
    if (this.routes.has(path)) {
      return this.routes.get(path);
    }

    // Wildcard matching
    for (const [routePath, handler] of Array.from(this.routes.entries())) {
      if (routePath.includes('*')) {
        const regex = new RegExp('^' + routePath.replace(/\*/g, '.*') + '$');
        if (regex.test(path)) {
          return handler;
        }
      }
    }

    return undefined;
  }

  /**
   * Handle connection close
   */
  private async handleConnectionClose(wsSocket: WSConnection): Promise<void> {
    this.connections.delete(wsSocket.id);
    this.statsTracker.decrementConnections();
    
    // Remove from all rooms
    await this.roomManager.leaveAllRooms(wsSocket);
    
    this.log('info', `WebSocket connection closed: ${wsSocket.id}`);
  }

  /**
   * Run middleware chain
   */
  private async runMiddleware(
    wsSocket: WSConnection,
    req: NextRushRequest
  ): Promise<void> {
    for (const middleware of this.middleware) {
      await new Promise<void>((resolve, reject) => {
        const next = () => resolve();
        try {
          const result = middleware(wsSocket, req, next);
          if (result instanceof Promise) {
            result.catch(reject);
          }
        } catch (error) {
          reject(error);
        }
      });
    }
  }

  /**
   * Broadcast message
   */
  private broadcast(data: any, roomName?: string, excludeSocketId?: string): void {
    if (roomName) {
      this.roomManager.broadcastToRoom(roomName, data, excludeSocketId);
    } else {
      // Global broadcast
      for (const socket of Array.from(this.connections.values())) {
        if (excludeSocketId && socket.id === excludeSocketId) continue;
        socket.send(data);
      }
    }
    
    this.statsTracker.incrementMessagesSent();
  }

  /**
   * Setup event listeners for components
   */
  private setupEventListeners(): void {
    // Room manager events
    this.roomManager.on('room:created', (roomName: string) => {
      this.statsTracker.setRoomCount(this.roomManager.getRoomCount());
      this.emit('room:created', roomName);
    });

    this.roomManager.on('room:destroyed', (roomName: string) => {
      this.statsTracker.setRoomCount(this.roomManager.getRoomCount());
      this.emit('room:destroyed', roomName);
    });

    // Stats events
    this.statsTracker.on('stats:error:increment', () => {
      this.emit('websocket:error');
    });
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.pingInterval = setInterval(() => {
      // Ping all connections
      const now = Date.now();
      for (const socket of Array.from(this.connections.values())) {
        if (now - socket.lastPing > this.options.pongTimeout) {
          socket.isAlive = false;
          socket.close(1001, 'Ping timeout');
        } else {
          socket.ping();
        }
      }

      // Log statistics periodically
      if (this.options.debug) {
        this.statsTracker.logStats();
      }
    }, this.options.pingInterval);
  }

  /**
   * Stop health monitoring
   */
  private stopHealthMonitoring(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Close all connections
   */
  private closeAllConnections(): void {
    for (const socket of Array.from(this.connections.values())) {
      socket.close(1001, 'Server shutdown');
    }
    this.connections.clear();
    this.roomManager.clearAllRooms();
  }

  /**
   * Get WebSocket statistics
   */
  private getStats(): WSStats {
    return this.statsTracker.getStats();
  }

  /**
   * Log message
   */
  private log(level: string, message: string, ...args: any[]): void {
    if (this.options.debug) {
      console.log(`[WebSocket] ${message}`, ...args);
    }
  }
}
