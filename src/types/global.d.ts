/**
 * Global type augmentation for automatic type inference
 * Eliminates the need to manually import NextRushRequest and NextRushResponse
 */
import { NextRushRequest, NextRushResponse } from './express';
import { RequestContext } from './http';

/**
 * Express-style handler type
 */
type ExpressHandler = (
  req: NextRushRequest,
  res: NextRushResponse
) => void | Promise<void>;

/**
 * Context-style handler type
 */
type ContextHandler = (context: RequestContext) => void | Promise<void>;

/**
 * Express-style middleware type
 */
type ExpressMiddleware = (
  req: NextRushRequest,
  res: NextRushResponse,
  next: () => void
) => void;

/**
 * Context-style middleware type
 */
type ContextMiddleware = (
  context: RequestContext,
  next: () => Promise<void>
) => void | Promise<void>;

/**
 * Global type augmentation for Application methods
 * Enables automatic type inference for HTTP methods and middleware
 */
declare module 'nextrush' {
  interface Application {
    /**
     * Register a GET route with Express-style handler
     */
    get(path: string, handler: ExpressHandler): this;

    /**
     * Register a GET route with context-style handler
     */
    get(path: string, handler: ContextHandler): this;

    /**
     * Register a GET route with Express middleware and handler
     */
    get(
      path: string,
      middleware: ExpressMiddleware,
      handler: ExpressHandler
    ): this;
    get(
      path: string,
      middleware: ExpressMiddleware,
      handler: ContextHandler
    ): this;

    /**
     * Register a GET route with context middleware and handler
     */
    get(
      path: string,
      middleware: ContextMiddleware,
      handler: ExpressHandler
    ): this;
    get(
      path: string,
      middleware: ContextMiddleware,
      handler: ContextHandler
    ): this;

    /**
     * Register a POST route with Express-style handler
     */
    post(path: string, handler: ExpressHandler): this;

    /**
     * Register a POST route with context-style handler
     */
    post(path: string, handler: ContextHandler): this;

    /**
     * Register a POST route with Express middleware and handler
     */
    post(
      path: string,
      middleware: ExpressMiddleware,
      handler: ExpressHandler
    ): this;
    post(
      path: string,
      middleware: ExpressMiddleware,
      handler: ContextHandler
    ): this;

    /**
     * Register a POST route with context middleware and handler
     */
    post(
      path: string,
      middleware: ContextMiddleware,
      handler: ExpressHandler
    ): this;
    post(
      path: string,
      middleware: ContextMiddleware,
      handler: ContextHandler
    ): this;

    /**
     * Register a PUT route with Express-style handler
     */
    put(path: string, handler: ExpressHandler): this;
    put(path: string, handler: ContextHandler): this;

    /**
     * Register a DELETE route with Express-style handler
     */
    delete(path: string, handler: ExpressHandler): this;
    delete(path: string, handler: ContextHandler): this;

    /**
     * Register a PATCH route with Express-style handler
     */
    patch(path: string, handler: ExpressHandler): this;
    patch(path: string, handler: ContextHandler): this;

    /**
     * Register middleware or mount a router
     */
    use(middleware: ExpressMiddleware): this;
    use(middleware: ContextMiddleware): this;
    use(path: string, middleware: ExpressMiddleware): this;
    use(path: string, middleware: ContextMiddleware): this;

    /**
     * Enable WebSocket support
     */
    ws(path: string, handler: (socket: WebSocket, request?: any) => void): this;

    /**
     * Serve static files
     * @param path - Mount path
     * @param directory - Directory to serve
     * @param options - Static file options
     * @returns Application instance for chaining
     */
    static(path: string, directory: string, options?: any): this;

    /**
     * Set template views directory
     * @param path - Views directory path
     * @returns Application instance for chaining
     */
    setViews(path: string): this;

    /**
     * Render template
     * @param template - Template name
     * @param data - Template data
     * @returns Rendered content
     */
    render(template: string, data: Record<string, any>): string;

    /**
     * Start the server
     * @param port - Port number
     * @param hostname - Optional hostname
     * @param callback - Optional callback
     * @returns Promise that resolves when server starts
     */
    listen(
      port: number,
      hostname?: string,
      callback?: () => void
    ): Promise<void>;

    /**
     * Stop the server
     * @returns Promise that resolves when server stops
     */
    close(): Promise<void>;
  }
}

/**
 * Global exports for convenience
 */
declare global {
  namespace NextRush {
    type Request = NextRushRequest;
    type Response = NextRushResponse;
    type Context = RequestContext;
    type Middleware = MiddlewareHandler;
  }
}
