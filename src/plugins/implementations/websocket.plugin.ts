/**
 * 🌐 WebSocket Plugin - Enterprise WebSocket Implementation  
 * High-performance WebSocket server with routing and middleware support
 */

import {
  BaseWebSocketPlugin,
  WebSocketRouteDefinition
} from '../types/specialized-plugins';
import { PluginContext, PluginMetadata } from '../core/plugin.interface';
import { WebSocketHandler } from '../../types/websocket';
import { IncomingMessage } from 'http';

/**
 * WebSocket connection interface
 */
interface WebSocketConnection {
  send(data: string | Buffer): void;
  close(code?: number, reason?: string): void;
  on(event: string, listener: (...args: any[]) => void): void;
  off(event: string, listener: (...args: any[]) => void): void;
  readyState: number;
}

/**
 * WebSocket route match
 */
interface WebSocketRouteMatch {
  route: WebSocketRouteDefinition;
  params: Record<string, string>;
}

/**
 * Enterprise WebSocket Plugin
 * Provides WebSocket server functionality with routing
 */
export class WebSocketPlugin extends BaseWebSocketPlugin {
  public readonly metadata: PluginMetadata = {
    name: 'NextRush-WebSocket',
    version: '1.0.0', 
    description: 'Enterprise WebSocket plugin with routing and real-time communication',
    author: 'NextRush Framework',
    category: 'core',
    priority: 90, // High priority - core feature
    dependencies: []
  };

  private server?: any; // WebSocket server instance
  private compiledRoutes = new Map<string, CompiledWebSocketRoute>();

  protected async onInstall(context: PluginContext): Promise<void> {
    const app = context.app;

    // Bind WebSocket method to application
    (app as any).ws = (path: string, handler: WebSocketHandler) => {
      this.addRoute(path, handler);
      return app;
    };

    context.logger.info('WebSocket plugin methods bound to application');
  }

  protected async onStart(context: PluginContext): Promise<void> {
    // Initialize WebSocket server (simplified implementation)
    this.initializeWebSocketServer();
    this.compileRoutes();
    
    context.logger.info(`WebSocket server started with ${this.routes.size} routes`);
  }

  protected async onStop(context: PluginContext): Promise<void> {
    // Close WebSocket server
    if (this.server) {
      await this.closeWebSocketServer();
      this.server = undefined;
    }
    
    this.compiledRoutes.clear();
    context.logger.info('WebSocket server stopped');
  }

  protected async onUninstall(context: PluginContext): Promise<void> {
    // Clean up all routes and server
    this.routes.clear();
    this.compiledRoutes.clear();
    
    if (this.server) {
      await this.closeWebSocketServer();
      this.server = undefined;
    }
    
    context.logger.info('WebSocket plugin uninstalled');
  }

  public override addRoute(path: string, handler: WebSocketHandler): void {
    super.addRoute(path, handler);
    
    // Compile the route for performance
    const compiled = this.compileRoute(path, handler);
    this.compiledRoutes.set(path, compiled);
  }

  public override removeRoute(path: string): boolean {
    const removed = super.removeRoute(path);
    if (removed) {
      this.compiledRoutes.delete(path);
    }
    return removed;
  }

  /**
   * Handle WebSocket upgrade request
   */
  public handleUpgrade(
    request: IncomingMessage,
    socket: any,
    head: Buffer
  ): boolean {
    const url = request.url || '/';
    const match = this.findRoute(url);
    
    if (!match) {
      return false; // No matching route
    }

    try {
      // Create WebSocket connection
      const wsConnection = this.createWebSocketConnection(socket, head);
      
      // Add params to request
      (request as any).params = match.params;
      
      // Execute handler
      match.route.handler(wsConnection as any, request as any);
      
      return true;
    } catch (error) {
      this.getContext().logger.error('WebSocket upgrade error:', error);
      socket.destroy();
      return false;
    }
  }

  /**
   * Find matching WebSocket route
   */
  public findRoute(path: string): WebSocketRouteMatch | null {
    // First try exact match
    const exactRoute = this.routes.get(path);
    if (exactRoute) {
      return {
        route: exactRoute,
        params: {}
      };
    }

    // Try pattern matching
    for (const [, compiled] of this.compiledRoutes) {
      const match = compiled.pattern.exec(path);
      if (match) {
        const params: Record<string, string> = {};
        
        // Extract parameters
        compiled.paramNames.forEach((name, index) => {
          params[name] = match[index + 1] || '';
        });

        return {
          route: compiled.definition,
          params
        };
      }
    }

    return null;
  }

  /**
   * Broadcast message to all connected clients on a path
   */
  public broadcast(path: string, message: string | Buffer): void {
    // Implementation would broadcast to all connections on the path
    this.getContext().logger.debug(`Broadcasting to ${path}:`, message);
  }

  /**
   * Get connection count for a path
   */
  public getConnectionCount(path: string): number {
    // Implementation would return actual connection count
    return 0;
  }

  // Private methods
  private compileRoutes(): void {
    this.compiledRoutes.clear();
    
    for (const [path, route] of this.routes) {
      const compiled = this.compileRoute(path, route.handler);
      this.compiledRoutes.set(path, compiled);
    }
  }

  private compileRoute(path: string, handler: WebSocketHandler): CompiledWebSocketRoute {
    const paramNames: string[] = [];
    let pattern = path;

    // Replace parameter patterns (:param) with regex groups
    pattern = pattern.replace(/:([^/]+)/g, (match, paramName) => {
      paramNames.push(paramName);
      return '([^/]+)';
    });

    // Replace wildcard patterns (*) with regex groups
    pattern = pattern.replace(/\*/g, '(.*)');

    // Escape special regex characters
    pattern = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

    // Create regex with anchors
    const regex = new RegExp(`^${pattern}$`);

    return {
      pattern: regex,
      paramNames,
      definition: { path, handler }
    };
  }

  private initializeWebSocketServer(): void {
    // Simplified WebSocket server initialization
    // In a real implementation, this would create a proper WebSocket server
    this.server = {
      connections: new Map(),
      broadcast: (message: string) => {
        this.getContext().logger.debug('Broadcasting message:', message);
      }
    };
  }

  private async closeWebSocketServer(): Promise<void> {
    if (this.server) {
      // Close all connections
      if (this.server.connections) {
        for (const [, connection] of this.server.connections) {
          try {
            connection.close();
          } catch (error) {
            this.getContext().logger.warn('Error closing WebSocket connection:', error);
          }
        }
      }
      
      this.getContext().logger.info('WebSocket server closed');
    }
  }

  private createWebSocketConnection(socket: any, head: Buffer): WebSocketConnection {
    // Simplified WebSocket connection wrapper
    // In a real implementation, this would create a proper WebSocket instance
    return {
      send: (data: string | Buffer) => {
        socket.write(data);
      },
      close: (code?: number, reason?: string) => {
        socket.end();
      },
      on: (event: string, listener: (...args: any[]) => void) => {
        socket.on(event, listener);
      },
      off: (event: string, listener: (...args: any[]) => void) => {
        socket.off(event, listener);
      },
      readyState: 1 // OPEN
    };
  }
}

/**
 * Compiled WebSocket route interface
 */
interface CompiledWebSocketRoute {
  pattern: RegExp;
  paramNames: string[];
  definition: WebSocketRouteDefinition;
}
