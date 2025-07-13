import * as http from 'http';
import { Handler, Method, Path, Request, Response } from '../types';
import {
  MethodNotAllowedError,
  NotFoundError,
  TimeoutError,
  ValidationError,
  ZestfxError,
} from '../types/Errors';
import { BodyParser, ErrorHandler, RouteMatcher } from '../utils';
import { RequestHandler } from './RequestHandler';
import { ResponseHandler } from './ResponseHandler';
import { RouteManager } from './RouteManager';

export interface ServerOptions {
  timeout?: number;
  maxBodySize?: number;
  includeStackTrace?: boolean;
  logErrors?: boolean;
  corsEnabled?: boolean;
  corsOrigins?: string[];
}

export class Server {
  private routeManager: RouteManager;
  private readonly methodsWithBody: Method[] = [
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
  ];
  private serverOptions: ServerOptions;
  private server?: http.Server;

  constructor(options: ServerOptions = {}) {
    this.routeManager = new RouteManager();
    this.serverOptions = {
      timeout: 30000,
      maxBodySize: 1024 * 1024, // 1MB
      includeStackTrace: process.env.NODE_ENV !== 'production',
      logErrors: true,
      corsEnabled: false,
      corsOrigins: ['*'],
      ...options,
    };

    // Configure error handler
    ErrorHandler.configure({
      includeStack: this.serverOptions.includeStackTrace,
      maxBodySize: this.serverOptions.maxBodySize,
      timeout: this.serverOptions.timeout,
      logErrors: this.serverOptions.logErrors,
    });
  }

  async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const startTime = Date.now();
    let request: Request;
    let response: Response;

    try {
      // Enhance request and response objects
      request = RequestHandler.enhanceRequest(req);
      response = ResponseHandler.enhanceResponse(res);

      // Add request timeout
      if (this.serverOptions.timeout) {
        req.setTimeout(this.serverOptions.timeout, () => {
          if (!response.headersSent) {
            ErrorHandler.handleError(
              new TimeoutError('Request', this.serverOptions.timeout!),
              request,
              response
            );
          }
        });
      }

      // Handle CORS if enabled
      if (this.serverOptions.corsEnabled) {
        this.handleCors(request, response);

        // Handle preflight requests
        if (request.method === 'OPTIONS') {
          response.status(200).json({ message: 'OK' });
          return;
        }
      }

      // Validate request method
      const validMethods: Method[] = [
        'GET',
        'POST',
        'PUT',
        'DELETE',
        'PATCH',
        'OPTIONS',
        'HEAD',
      ];
      if (!validMethods.includes(request.method as Method)) {
        throw new ValidationError(`Invalid HTTP method: ${request.method}`, {
          method: request.method,
          validMethods,
        });
      }

      // Parse body if needed
      if (this.methodsWithBody.includes(request.method as Method)) {
        try {
          request.body = await BodyParser.parseBody(request, {
            maxSize: this.serverOptions.maxBodySize,
            timeout: this.serverOptions.timeout,
          });
        } catch (bodyError) {
          if (bodyError instanceof ZestfxError) {
            throw bodyError;
          }
          throw new ZestfxError(
            'Failed to parse request body',
            'BODY_PARSE_ERROR',
            400,
            { error: (bodyError as Error).message }
          );
        }
      }

      // Find matching route
      const route = RouteMatcher.matchRoute(
        request,
        this.routeManager.getRoutes()
      );

      if (!route) {
        // Check if other methods are available for this path
        const availableMethods = RouteMatcher.findMatchingMethods(
          request,
          this.routeManager.getRoutes()
        );

        if (availableMethods.length > 0) {
          throw new MethodNotAllowedError(request.method!, availableMethods);
        }

        throw new NotFoundError(`Route: ${request.method} ${request.pathname}`);
      }

      // Execute route handler with safety wrapper
      const safeHandler = ErrorHandler.createSafeHandler(route.handler);
      await safeHandler(request, response);

      // Log successful request
      if (this.serverOptions.logErrors) {
        const duration = Date.now() - startTime;
        console.log(
          `[${new Date().toISOString()}] ${request.method} ${
            request.pathname
          } - ${response.statusCode} (${duration}ms)`
        );
      }
    } catch (error) {
      // Handle any errors that occurred during request processing
      try {
        if (request! && response!) {
          ErrorHandler.handleError(error as Error, request!, response!);
        } else {
          // Fallback error handling if request/response objects are not available
          console.error('Critical error before request/response setup:', error);
          try {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                error: 'Internal Server Error',
                message: 'Server failed to process request',
              })
            );
          } catch (fallbackError) {
            console.error(
              'Failed to send fallback error response:',
              fallbackError
            );
          }
        }
      } catch (errorHandlingError) {
        console.error('Error in error handler:', errorHandlingError);
      }
    }
  }

  private handleCors(request: Request, response: Response): void {
    try {
      const origin = request.headers.origin;
      const allowedOrigins = this.serverOptions.corsOrigins || ['*'];

      if (
        allowedOrigins.includes('*') ||
        (origin && allowedOrigins.includes(origin))
      ) {
        response.setHeader('Access-Control-Allow-Origin', origin || '*');
      }

      response.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD'
      );
      response.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Requested-With'
      );
      response.setHeader('Access-Control-Allow-Credentials', 'true');
      response.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    } catch (error) {
      console.warn('Error setting CORS headers:', error);
    }
  }

  listen(port: number, callback?: () => void): http.Server {
    try {
      if (this.server) {
        throw new ZestfxError(
          'Server is already listening',
          'SERVER_ALREADY_LISTENING',
          500
        );
      }

      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res).catch((error) => {
          console.error('Unhandled error in request handler:', error);
        });
      });

      // Handle server errors
      this.server.on('error', (error: Error) => {
        console.error('Server error:', error);
        if ('code' in error) {
          if ((error as any).code === 'EADDRINUSE') {
            console.error(`Port ${port} is already in use`);
          } else if ((error as any).code === 'EACCES') {
            console.error(`Permission denied to bind to port ${port}`);
          }
        }
      });

      // Handle client errors
      this.server.on('clientError', (error: Error, socket) => {
        console.warn('Client error:', error.message);
        if (socket.writable) {
          socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
        }
      });

      this.server.listen(port, callback);

      if (this.serverOptions.logErrors) {
        console.log(`Server listening on port ${port}`);
        console.log(`Server configuration:`, {
          timeout: this.serverOptions.timeout,
          maxBodySize: this.serverOptions.maxBodySize,
          corsEnabled: this.serverOptions.corsEnabled,
          includeStackTrace: this.serverOptions.includeStackTrace,
        });
      }

      return this.server;
    } catch (error) {
      console.error('Error starting server:', error);
      throw error;
    }
  }

  close(callback?: () => void): void {
    if (this.server) {
      this.server.close(callback);
      this.server = undefined;
      if (this.serverOptions.logErrors) {
        console.log('Server closed');
      }
    }
  }

  // Configuration methods
  configure(options: Partial<ServerOptions>): void {
    this.serverOptions = { ...this.serverOptions, ...options };
    ErrorHandler.configure({
      includeStack: this.serverOptions.includeStackTrace,
      maxBodySize: this.serverOptions.maxBodySize,
      timeout: this.serverOptions.timeout,
      logErrors: this.serverOptions.logErrors,
    });
  }

  // Expose route registration methods with error handling
  get(path: Path, handler: Handler): void {
    try {
      this.routeManager.get(path, handler);
    } catch (error) {
      console.error('Error registering GET route:', error);
      throw error;
    }
  }

  post(path: Path, handler: Handler): void {
    try {
      this.routeManager.post(path, handler);
    } catch (error) {
      console.error('Error registering POST route:', error);
      throw error;
    }
  }

  put(path: Path, handler: Handler): void {
    try {
      this.routeManager.put(path, handler);
    } catch (error) {
      console.error('Error registering PUT route:', error);
      throw error;
    }
  }

  delete(path: Path, handler: Handler): void {
    try {
      this.routeManager.delete(path, handler);
    } catch (error) {
      console.error('Error registering DELETE route:', error);
      throw error;
    }
  }

  patch(path: Path, handler: Handler): void {
    try {
      this.routeManager.patch(path, handler);
    } catch (error) {
      console.error('Error registering PATCH route:', error);
      throw error;
    }
  }

  options(path: Path, handler: Handler): void {
    try {
      this.routeManager.options(path, handler);
    } catch (error) {
      console.error('Error registering OPTIONS route:', error);
      throw error;
    }
  }

  head(path: Path, handler: Handler): void {
    try {
      this.routeManager.head(path, handler);
    } catch (error) {
      console.error('Error registering HEAD route:', error);
      throw error;
    }
  }

  // Debug and introspection methods
  getRoutes() {
    return this.routeManager.getRoutes();
  }

  getRouteCount(): number {
    return this.routeManager.getRouteCount();
  }

  printRoutes(): void {
    this.routeManager.printRoutes();
  }

  validateRoutes(): { valid: boolean; errors: string[] } {
    return this.routeManager.validateAllRoutes();
  }
}
