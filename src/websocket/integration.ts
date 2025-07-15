/**
 * 🚀 NextRush WebSocket Integration
 * Seamless WebSocket integration with NextRush Application
 */

import { Application } from '../core/application';
import { NextRushRequest } from '../types/express';
import {
  NextRushWebSocket,
  WebSocketHandler,
  WebSocketMiddleware,
  WebSocketOptions,
  WebSocketStats,
} from '../types/websocket';
import { WebSocketServer } from './websocket-server';

/**
 * WebSocket integration mixin for Application
 */
export class WebSocketIntegration {
  private wsServer?: WebSocketServer;
  private wsHandlers = new Map<string, WebSocketHandler>();
  private wsMiddleware: WebSocketMiddleware[] = [];

  /**
   * Initialize WebSocket support on the application
   */
  initWebSocket(app: Application, options: WebSocketOptions = {}): void {
    // Wait for server to be available
    const server = (app as any).server;
    if (!server) {
      throw new Error(
        'HTTP server must be initialized before WebSocket support'
      );
    }

    this.wsServer = new WebSocketServer(server, {
      debug: process.env.NODE_ENV === 'development',
      ...options,
    });

    this.setupEventHandlers();
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.wsServer) return;

    this.wsServer.on(
      'connection',
      (socket: NextRushWebSocket, req: NextRushRequest) => {
        // Run middleware chain
        this.runWebSocketMiddleware(socket, req).catch((error) => {
          console.error('WebSocket middleware error:', error);
          socket.close(1011, 'Internal server error');
        });

        // Execute handlers
        this.wsHandlers.forEach((handler, path) => {
          if (this.matchPath(req.url || '/', path)) {
            try {
              const result = handler(socket, req);
              if (result instanceof Promise) {
                result.catch((error) => {
                  console.error('WebSocket handler error:', error);
                  socket.close(1011, 'Handler error');
                });
              }
            } catch (error) {
              console.error('WebSocket handler error:', error);
              socket.close(1011, 'Handler error');
            }
          }
        });
      }
    );

    this.wsServer.on('error', (error: Error, socket?: NextRushWebSocket) => {
      console.error('WebSocket error:', error);
      if (socket) {
        socket.close(1011, 'Server error');
      }
    });
  }

  /**
   * Run WebSocket middleware chain
   */
  private async runWebSocketMiddleware(
    socket: NextRushWebSocket,
    req: NextRushRequest
  ): Promise<void> {
    for (const middleware of this.wsMiddleware) {
      await new Promise<void>((resolve, reject) => {
        try {
          const result = middleware(socket, req, resolve);
          if (result instanceof Promise) {
            result.then(() => resolve()).catch(reject);
          }
        } catch (error) {
          reject(error);
        }
      });
    }
  }

  /**
   * Match WebSocket path
   */
  private matchPath(url: string, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern === url) return true;

    // Simple wildcard matching
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(url);
  }

  /**
   * Register WebSocket handler
   */
  ws(path: string, handler: WebSocketHandler): void {
    this.wsHandlers.set(path, handler);
  }

  /**
   * Add WebSocket middleware
   */
  wsUse(middleware: WebSocketMiddleware): void {
    this.wsMiddleware.push(middleware);
  }

  /**
   * Broadcast to all connections
   */
  broadcast(data: any, room?: string): void {
    if (!this.wsServer) {
      throw new Error('WebSocket server not initialized');
    }

    this.wsServer.getConnections().forEach((socket) => {
      if (!room || socket.rooms.has(room)) {
        socket.send(data);
      }
    });
  }

  /**
   * Broadcast to specific room
   */
  to(room: string) {
    if (!this.wsServer) {
      throw new Error('WebSocket server not initialized');
    }

    // Create a simple room emitter without accessing private methods
    return {
      emit: (event: string, ...args: any[]) => {
        this.wsServer!.getConnections().forEach((socket) => {
          if (socket.rooms.has(room)) {
            socket.emit(event, ...args);
          }
        });
      },
      send: (data: any) => {
        this.broadcast(data, room);
      },
      broadcast: (data: any) => {
        this.broadcast(data, room);
      },
    };
  }

  /**
   * Get WebSocket statistics
   */
  getWebSocketStats(): WebSocketStats | null {
    return this.wsServer?.getStats() || null;
  }

  /**
   * Get all WebSocket connections
   */
  getWebSocketConnections(): NextRushWebSocket[] {
    return this.wsServer?.getConnections() || [];
  }

  /**
   * Close WebSocket server
   */
  async closeWebSocket(): Promise<void> {
    if (this.wsServer) {
      await this.wsServer.close();
    }
  }
}

/**
 * Extend Application with WebSocket methods
 */
declare module '../core/application' {
  interface Application {
    // WebSocket methods
    ws(path: string, handler: WebSocketHandler): this;
    wsUse(middleware: WebSocketMiddleware): this;
    broadcast(data: any, room?: string): void;
    to(room: string): any;

    // WebSocket info methods
    getWebSocketStats(): WebSocketStats | null;
    getWebSocketConnections(): NextRushWebSocket[];

    // Internal WebSocket integration
    _wsIntegration?: WebSocketIntegration;
    enableWebSocket(options?: WebSocketOptions): this;
  }
}

/**
 * Add WebSocket methods to Application prototype
 */
export function enhanceApplicationWithWebSocket(): void {
  const ApplicationPrototype = require('../core/application').Application
    .prototype;

  // Enable WebSocket support
  ApplicationPrototype.enableWebSocket = function (
    options: WebSocketOptions = {}
  ) {
    if (!this._wsIntegration) {
      this._wsIntegration = new WebSocketIntegration();
    }

    // Initialize after server is ready
    const originalListen = this.listen.bind(this);
    this.listen = function (port: number, ...args: any[]) {
      const result = originalListen(port, ...args);

      // Initialize WebSocket after server starts
      setTimeout(() => {
        if (this._wsIntegration && (this as any).server) {
          this._wsIntegration.initWebSocket(this, options);
        }
      }, 100);

      return result;
    };

    return this;
  };

  // WebSocket route handler
  ApplicationPrototype.ws = function (path: string, handler: WebSocketHandler) {
    if (!this._wsIntegration) {
      this._wsIntegration = new WebSocketIntegration();
    }
    this._wsIntegration.ws(path, handler);
    return this;
  };

  // WebSocket middleware
  ApplicationPrototype.wsUse = function (middleware: WebSocketMiddleware) {
    if (!this._wsIntegration) {
      this._wsIntegration = new WebSocketIntegration();
    }
    this._wsIntegration.wsUse(middleware);
    return this;
  };

  // Broadcast methods
  ApplicationPrototype.broadcast = function (data: any, room?: string) {
    if (this._wsIntegration) {
      this._wsIntegration.broadcast(data, room);
    }
  };

  ApplicationPrototype.to = function (room: string) {
    return (
      this._wsIntegration?.to(room) || {
        emit: () => {},
        send: () => {},
        broadcast: () => {},
      }
    );
  };

  // Info methods
  ApplicationPrototype.getWebSocketStats = function () {
    return this._wsIntegration?.getWebSocketStats() || null;
  };

  ApplicationPrototype.getWebSocketConnections = function () {
    return this._wsIntegration?.getWebSocketConnections() || [];
  };

  // Enhance close method
  const originalClose = ApplicationPrototype.close;
  if (originalClose) {
    ApplicationPrototype.close = async function () {
      if (this._wsIntegration) {
        await this._wsIntegration.closeWebSocket();
      }
      if (originalClose) {
        return originalClose.call(this);
      }
    };
  }
}
