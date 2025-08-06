/**
 * Application Orchestrator for NextRush v2
 * Coordinates between different application components
 *
 * @packageDocumentation
 */

import { createContext, releaseContext } from '@/core/app/context';
import { RequestEnhancer } from '@/core/enhancers/request-enhancer';
import { ResponseEnhancer } from '@/core/enhancers/response-enhancer';
import {
  GlobalExceptionFilter,
  type ExceptionFilter,
} from '@/errors/custom-errors';
import type { Context } from '@/types/context';
import type {
  ApplicationOptions,
  NextRushRequest,
  NextRushResponse,
} from '@/types/http';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { MiddlewareChain } from './middleware-chain';
import { RouteRegistry } from './route-registry';
import { ServerManager } from './server-manager';

/**
 * Application Orchestrator that coordinates all application components
 * Following Single Responsibility Principle for orchestration
 */
export class ApplicationOrchestrator extends EventEmitter {
  private routeRegistry: RouteRegistry;
  private middlewareChain: MiddlewareChain;
  private serverManager: ServerManager;
  private options: Required<ApplicationOptions>;

  constructor(options: Required<ApplicationOptions>) {
    super();
    this.options = options;

    // Initialize components
    this.routeRegistry = new RouteRegistry();
    this.middlewareChain = new MiddlewareChain();
    this.serverManager = new ServerManager(
      options,
      (req: IncomingMessage, res: ServerResponse) => {
        this.handleRequest(req, res).catch(error => {
          this.emit('error', error);
        });
      }
    );

    // Forward server events
    this.serverManager.on('error', error => this.emit('error', error));
    this.serverManager.on('listening', () => this.emit('listening'));
    this.serverManager.on('close', () => this.emit('close'));
    this.serverManager.on('shutdown', signal => this.emit('shutdown', signal));
  }

  /**
   * Get the route registry
   */
  public getRouteRegistry(): RouteRegistry {
    return this.routeRegistry;
  }

  /**
   * Get the middleware chain
   */
  public getMiddlewareChain(): MiddlewareChain {
    return this.middlewareChain;
  }

  /**
   * Get the server manager
   */
  public getServerManager(): ServerManager {
    return this.serverManager;
  }

  /**
   * Start the application
   */
  public async listen(
    port?: number,
    hostname?: string,
    callback?: () => void
  ): Promise<void> {
    return this.serverManager.listen(port, hostname, callback);
  }

  /**
   * Stop the application
   */
  public async close(): Promise<void> {
    return this.serverManager.close();
  }

  /**
   * Handle HTTP requests
   */
  private async handleRequest(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    let ctx: Context | undefined;

    try {
      // Create context
      const enhancedReq = RequestEnhancer.enhance(req) as NextRushRequest;
      const enhancedRes = ResponseEnhancer.enhance(
        res
      ) as unknown as NextRushResponse;

      ctx = createContext(enhancedReq, enhancedRes, this.options);

      // Find exception filter
      const exceptionFilter = this.findExceptionFilter();

      if (exceptionFilter) {
        try {
          await this.executeMiddlewareWithBoundary(ctx);
          await this.executeRouteWithBoundary(ctx);
        } catch (error) {
          await exceptionFilter.catch(error as Error, ctx);
        }
      } else {
        await this.executeMiddlewareWithBoundary(ctx);
        await this.executeRouteWithBoundary(ctx);
      }

      // Ensure response is sent
      if (!res.headersSent && ctx) {
        if (ctx.body !== undefined) {
          if (typeof ctx.body === 'string') {
            res.end(ctx.body);
          } else {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(ctx.body));
          }
        } else {
          res.statusCode = 404;
          res.end('Not Found');
        }
      }
    } catch (error) {
      this.handleError(error, res);
    } finally {
      if (ctx) {
        releaseContext(ctx);
      }
    }
  }

  /**
   * Execute middleware chain with error boundary
   */
  private async executeMiddlewareWithBoundary(ctx: Context): Promise<void> {
    if (this.middlewareChain.isEmpty()) {
      return;
    }

    await this.middlewareChain.execute(ctx);
  }

  /**
   * Execute route handler with error boundary
   */
  private async executeRouteWithBoundary(ctx: Context): Promise<void> {
    const match = this.routeRegistry.findRoute(ctx.method, ctx.path);

    if (match) {
      // Set route parameters
      Object.assign(ctx.params, match.params);

      // Execute route handler
      await match.handler(ctx);
    }
  }

  /**
   * Handle uncaught errors
   */
  private handleError(error: unknown, res: ServerResponse): void {
    this.emit('error', error);

    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      );
    }
  }

  /**
   * Find exception filter from middleware chain
   */
  private findExceptionFilter(): ExceptionFilter | null {
    // This is a simplified implementation
    // In practice, you might want to register exception filters explicitly
    return new GlobalExceptionFilter();
  }

  /**
   * Get application statistics
   */
  public getStats(): {
    routes: ReturnType<RouteRegistry['getRouteStats']>;
    middleware: ReturnType<MiddlewareChain['getStats']>;
    server: ReturnType<ServerManager['getServerInfo']>;
  } {
    return {
      routes: this.routeRegistry.getRouteStats(),
      middleware: this.middlewareChain.getStats(),
      server: this.serverManager.getServerInfo(),
    };
  }
}
