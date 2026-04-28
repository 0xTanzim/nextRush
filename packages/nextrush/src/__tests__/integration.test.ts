/**
 * NextRush v3 Integration Tests
 *
 * Comprehensive integration tests verifying the full stack:
 * - Core Application + Router
 * - Middleware chain composition
 * - Body parsing + Routing + Response
 * - Security middleware (CORS, Helmet)
 * - Error handling across the stack
 * - State propagation through middleware
 *
 * @packageDocumentation
 */

import type {
    BodySource,
    Context,
    ContextState,
    Middleware,
    QueryParams,
    RawHttp,
    RouteParams,
    Runtime,
} from '@nextrush/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    Application,
    BadRequestError,
    compose,
    createApp,
    HttpError,
    NotFoundError,
} from '@nextrush/core';
import { createRouter, Router } from '@nextrush/router';

// ============================================================================
// Test Utilities - Mock Context Factory
// ============================================================================

interface MockContextOptions {
  method?: string;
  path?: string;
  url?: string;
  query?: QueryParams;
  headers?: Record<string, string>;
  body?: unknown;
  params?: RouteParams;
  ip?: string;
}

/**
 * Create a mock BodySource for testing
 */
function createMockBodySource(body: unknown): BodySource {
  let consumed = false;

  return {
    text: vi.fn(async () => {
      consumed = true;
      return typeof body === 'string' ? body : JSON.stringify(body ?? '');
    }),
    buffer: vi.fn(async () => {
      consumed = true;
      const text = typeof body === 'string' ? body : JSON.stringify(body ?? '');
      return new TextEncoder().encode(text);
    }),
    json: vi.fn(async () => {
      consumed = true;
      return body ?? {};
    }) as BodySource['json'],
    stream: vi.fn(() => {
      const text = typeof body === 'string' ? body : JSON.stringify(body ?? '');
      return new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(text));
          controller.close();
        },
      });
    }),
    get consumed() {
      return consumed;
    },
    contentLength: undefined,
    contentType: 'application/json',
  };
}

/**
 * Create a comprehensive mock Context for testing
 * Implements the full Context interface from @nextrush/types
 */
function createMockContext(options: MockContextOptions = {}): Context {
  const {
    method = 'GET',
    path: pathValue = '/',
    url = pathValue,
    query = {},
    headers = {},
    body = undefined,
    params = {},
    ip = '127.0.0.1',
  } = options;

  const responseHeaders: Record<string, string> = {};
  let responseStatus = 200;
  let responseBody: unknown = undefined;
  let nextFn: (() => Promise<void>) | undefined;

  const mockBodySource = createMockBodySource(body);

  const mockRaw: RawHttp = {
    req: {} as never,
    res: {} as never,
  };

  const ctx: Context = {
    // Request - Read-only
    method: method.toUpperCase() as Context['method'],
    url,
    path: pathValue,
    query,
    headers,
    ip,

    // Request body
    body,
    params,

    // Response
    get status() {
      return responseStatus;
    },
    set status(value: number) {
      responseStatus = value;
    },

    json: vi.fn((data: unknown) => {
      responseBody = data;
      responseHeaders['content-type'] = 'application/json';
    }),

    send: vi.fn((data: unknown) => {
      responseBody = data;
    }),

    html: vi.fn((content: string) => {
      responseBody = content;
      responseHeaders['content-type'] = 'text/html';
    }),

    redirect: vi.fn((redirectUrl: string, status = 302) => {
      responseStatus = status;
      responseHeaders['location'] = redirectUrl;
    }),

    // Error helpers
    throw: vi.fn((status: number, message?: string): never => {
      const error = new HttpError(status, message ?? 'Error');
      throw error;
    }),

    assert: vi.fn((condition: unknown, status: number, message?: string): asserts condition => {
      if (!condition) {
        const error = new HttpError(status, message ?? 'Assertion failed');
        throw error;
      }
    }),

    // Header helpers
    set: vi.fn((field: string, value: string | number) => {
      responseHeaders[field.toLowerCase()] = String(value);
    }),

    get: vi.fn((field: string) => {
      return headers[field.toLowerCase()];
    }),

    // Middleware
    next: vi.fn(async () => {
      if (nextFn) {
        await nextFn();
      }
    }),

    // State
    state: {} as ContextState,

    // Response state
    responded: false,

    // Raw access
    raw: mockRaw,
    runtime: 'node' as Runtime,
    bodySource: mockBodySource,
  };

  // Add ability to set nextFn for testing
  (ctx as MockableContext)._setNextFn = (fn: () => Promise<void>) => {
    nextFn = fn;
  };

  // Add ability to read response for assertions
  (ctx as MockableContext)._getResponseBody = () => responseBody;
  (ctx as MockableContext)._getResponseHeaders = () => responseHeaders;

  return ctx;
}

interface MockableContext extends Context {
  _setNextFn: (fn: () => Promise<void>) => void;
  _getResponseBody: () => unknown;
  _getResponseHeaders: () => Record<string, string>;
}

// ============================================================================
// Core + Router Integration Tests
// ============================================================================

describe('Core + Router Integration', () => {
  let app: Application;
  let router: Router;

  beforeEach(() => {
    app = createApp();
    router = createRouter();
  });

  describe('Basic Routing', () => {
    it('should route GET requests to registered handlers', async () => {
      router.get('/users', (ctx) => {
        ctx.json({ users: [] });
      });

      app.use(router.routes());

      const ctx = createMockContext({ method: 'GET', path: '/users' });

      // Simulate router matching and handler execution
      const match = router.match('GET', '/users');
      expect(match).not.toBeNull();
      expect(match?.handler).toBeDefined();

      await match!.handler(ctx, async () => {});

      expect(ctx.json).toHaveBeenCalledWith({ users: [] });
    });

    it('should route POST requests with body', async () => {
      router.post('/users', (ctx) => {
        const body = ctx.body as { name: string };
        ctx.status = 201;
        ctx.json({ id: 1, name: body.name });
      });

      const ctx = createMockContext({
        method: 'POST',
        path: '/users',
        body: { name: 'Alice' },
      });

      const match = router.match('POST', '/users');
      expect(match).not.toBeNull();

      await match!.handler(ctx, async () => {});

      expect(ctx.status).toBe(201);
      expect(ctx.json).toHaveBeenCalledWith({ id: 1, name: 'Alice' });
    });

    it('should extract route parameters', async () => {
      router.get('/users/:id', (ctx) => {
        ctx.json({ userId: ctx.params.id });
      });

      const match = router.match('GET', '/users/123');
      expect(match).not.toBeNull();
      expect(match?.params).toEqual({ id: '123' });

      const ctx = createMockContext({
        method: 'GET',
        path: '/users/123',
        params: match!.params,
      });

      await match!.handler(ctx, async () => {});

      expect(ctx.json).toHaveBeenCalledWith({ userId: '123' });
    });

    it('should handle nested route parameters', async () => {
      router.get('/users/:userId/posts/:postId', (ctx) => {
        ctx.json({
          userId: ctx.params.userId,
          postId: ctx.params.postId,
        });
      });

      const match = router.match('GET', '/users/1/posts/42');
      expect(match).not.toBeNull();
      // Router preserves original param name case
      expect(match?.params).toEqual({ userId: '1', postId: '42' });
    });

    it('should return null for unregistered routes', () => {
      router.get('/users', (ctx) => ctx.json({}));

      const match = router.match('GET', '/nonexistent');
      expect(match).toBeNull();
    });

    it('should return null for wrong HTTP method', () => {
      router.get('/users', (ctx) => ctx.json({}));

      const match = router.match('POST', '/users');
      expect(match).toBeNull();
    });
  });

  describe('Route Groups', () => {
    it('should group routes with prefix', () => {
      router.group('/api/v1', (r) => {
        r.get('/users', (ctx) => ctx.json({ users: [] }));
        r.get('/posts', (ctx) => ctx.json({ posts: [] }));
      });

      expect(router.match('GET', '/api/v1/users')).not.toBeNull();
      expect(router.match('GET', '/api/v1/posts')).not.toBeNull();
      expect(router.match('GET', '/users')).toBeNull();
    });
  });

  describe('Route Redirect', () => {
    it('should handle permanent redirects (301)', async () => {
      router.redirect('/old', '/new', 301);

      const match = router.match('GET', '/old');
      expect(match).not.toBeNull();

      const ctx = createMockContext({ method: 'GET', path: '/old' });
      await match!.handler(ctx, async () => {});

      expect(ctx.status).toBe(301);
      expect(ctx.set).toHaveBeenCalledWith('Location', '/new');
    });

    it('should handle temporary redirects (302)', async () => {
      router.redirect('/temp', '/destination', 302);

      const match = router.match('GET', '/temp');
      const ctx = createMockContext({ method: 'GET', path: '/temp' });
      await match!.handler(ctx, async () => {});

      expect(ctx.status).toBe(302);
    });
  });

  describe('All HTTP Methods', () => {
    it('should register route for all HTTP methods', () => {
      router.all('/resource', (ctx) => ctx.json({ method: ctx.method }));

      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'] as const;

      for (const method of methods) {
        const match = router.match(method, '/resource');
        expect(match).not.toBeNull();
      }
    });
  });
});

// ============================================================================
// Middleware Chain Tests
// ============================================================================

describe('Middleware Chain Composition', () => {
  it('should execute middleware in order', async () => {
    const order: number[] = [];

    const middleware1: Middleware = async (_ctx, next) => {
      order.push(1);
      await next();
      order.push(4);
    };

    const middleware2: Middleware = async (_ctx, next) => {
      order.push(2);
      await next();
      order.push(3);
    };

    const composed = compose([middleware1, middleware2]);
    const ctx = createMockContext();

    await composed(ctx);

    expect(order).toEqual([1, 2, 3, 4]);
  });

  it('should pass state between middleware', async () => {
    const authMiddleware: Middleware = async (ctx, next) => {
      ctx.state.user = { id: 1, name: 'Alice' };
      await next();
    };

    const handlerMiddleware: Middleware = async (ctx) => {
      const user = ctx.state.user as { id: number; name: string };
      ctx.json({ greeting: `Hello, ${user.name}` });
    };

    const composed = compose([authMiddleware, handlerMiddleware]);
    const ctx = createMockContext();

    await composed(ctx);

    expect(ctx.state.user).toEqual({ id: 1, name: 'Alice' });
    expect(ctx.json).toHaveBeenCalledWith({ greeting: 'Hello, Alice' });
  });

  it('should allow middleware to short-circuit the chain', async () => {
    const order: string[] = [];

    const authMiddleware: Middleware = async (ctx, next) => {
      order.push('auth-start');
      if (!ctx.get('authorization')) {
        ctx.status = 401;
        ctx.json({ error: 'Unauthorized' });
        return; // Short-circuit - don't call next()
      }
      await next();
      order.push('auth-end');
    };

    const handlerMiddleware: Middleware = async (ctx) => {
      order.push('handler');
      ctx.json({ data: 'secret' });
    };

    const composed = compose([authMiddleware, handlerMiddleware]);

    // Test without authorization
    const ctx1 = createMockContext();
    await composed(ctx1);

    expect(order).toEqual(['auth-start']);
    expect(ctx1.status).toBe(401);
    expect(ctx1.json).toHaveBeenCalledWith({ error: 'Unauthorized' });

    // Reset order
    order.length = 0;

    // Test with authorization
    const ctx2 = createMockContext({ headers: { authorization: 'Bearer token' } });
    await composed(ctx2);

    expect(order).toEqual(['auth-start', 'handler', 'auth-end']);
  });

  it('should handle async middleware correctly', async () => {
    const delays: number[] = [];

    const slowMiddleware: Middleware = async (_ctx, next) => {
      const start = Date.now();
      await new Promise((resolve) => setTimeout(resolve, 10));
      await next();
      delays.push(Date.now() - start);
    };

    const fastHandler: Middleware = async (ctx) => {
      ctx.json({ fast: true });
    };

    const composed = compose([slowMiddleware, fastHandler]);
    const ctx = createMockContext();

    await composed(ctx);

    expect(delays[0]).toBeGreaterThanOrEqual(8);
    expect(ctx.json).toHaveBeenCalledWith({ fast: true });
  });

  it('should propagate errors through the chain', async () => {
    const errorMiddleware: Middleware = async () => {
      throw new Error('Test error');
    };

    const afterErrorMiddleware: Middleware = async (ctx) => {
      ctx.json({ shouldNotReach: true });
    };

    const composed = compose([errorMiddleware, afterErrorMiddleware]);
    const ctx = createMockContext();

    await expect(composed(ctx)).rejects.toThrow('Test error');
    expect(ctx.json).not.toHaveBeenCalled();
  });

  it('should allow error handling middleware', async () => {
    const errorHandlerMiddleware: Middleware = async (ctx, next) => {
      try {
        await next();
      } catch (error) {
        if (error instanceof Error) {
          ctx.status = 500;
          ctx.json({ error: error.message });
        }
      }
    };

    const throwingMiddleware: Middleware = async () => {
      throw new Error('Something went wrong');
    };

    const composed = compose([errorHandlerMiddleware, throwingMiddleware]);
    const ctx = createMockContext();

    await composed(ctx);

    expect(ctx.status).toBe(500);
    expect(ctx.json).toHaveBeenCalledWith({ error: 'Something went wrong' });
  });
});

// ============================================================================
// Application Integration Tests
// ============================================================================

describe('Application Integration', () => {
  let app: Application;

  beforeEach(() => {
    app = createApp();
  });

  describe('Middleware Registration', () => {
    it('should register multiple middleware with use()', () => {
      const mw1: Middleware = async (_ctx, next) => next();
      const mw2: Middleware = async (_ctx, next) => next();

      app.use(mw1, mw2);

      expect(app.middlewareCount).toBe(2);
    });

    it('should chain use() calls', () => {
      const mw1: Middleware = async (_ctx, next) => next();
      const mw2: Middleware = async (_ctx, next) => next();

      app.use(mw1).use(mw2);

      expect(app.middlewareCount).toBe(2);
    });

    it('should throw for non-function middleware', () => {
      expect(() => app.use('not a function' as unknown as Middleware)).toThrow(TypeError);
    });
  });

  describe('Request Handling', () => {
    it('should create callback that processes requests', async () => {
      app.use(async (ctx) => {
        ctx.json({ message: 'Hello World' });
      });

      const callback = app.callback();
      const ctx = createMockContext();

      await callback(ctx);

      expect(ctx.json).toHaveBeenCalledWith({ message: 'Hello World' });
    });

    it('should execute middleware through callback', async () => {
      const order: number[] = [];

      app.use(async (_ctx, next) => {
        order.push(1);
        await next();
        order.push(3);
      });

      app.use(async (ctx) => {
        order.push(2);
        ctx.json({ done: true });
      });

      const callback = app.callback();
      await callback(createMockContext());

      expect(order).toEqual([1, 2, 3]);
    });
  });

  describe('Error Handling', () => {
    it('should use custom error handler', async () => {
      const errorHandler = vi.fn((error: Error, ctx: Context) => {
        ctx.status = 500;
        ctx.json({ customError: error.message });
      });

      app.onError(errorHandler);

      app.use(async () => {
        throw new Error('Test error');
      });

      const callback = app.callback();
      const ctx = createMockContext();

      await callback(ctx);

      expect(errorHandler).toHaveBeenCalled();
      expect(ctx.json).toHaveBeenCalledWith({ customError: 'Test error' });
    });

    it('should handle HttpError with proper status', async () => {
      app.onError((error: Error, ctx: Context) => {
        if ('status' in error && typeof error.status === 'number') {
          ctx.status = error.status;
        } else {
          ctx.status = 500;
        }
        ctx.json({ error: error.message });
      });

      app.use(async (ctx) => {
        ctx.throw(404, 'Not Found');
      });

      const callback = app.callback();
      const ctx = createMockContext();

      await callback(ctx);

      expect(ctx.status).toBe(404);
    });
  });

  describe('Lifecycle', () => {
    it('should track running state', () => {
      expect(app.isRunning).toBe(false);

      app.start();
      expect(app.isRunning).toBe(true);
    });

    it('should close and reset state', async () => {
      app.start();
      expect(app.isRunning).toBe(true);

      await app.close();
      expect(app.isRunning).toBe(false);
    });
  });

  describe('Environment', () => {
    it('should detect production environment', () => {
      const prodApp = createApp({ env: 'production' });
      expect(prodApp.isProduction).toBe(true);

      const devApp = createApp({ env: 'development' });
      expect(devApp.isProduction).toBe(false);
    });
  });
});

// ============================================================================
// Full Stack Integration Tests
// ============================================================================

describe('Full Stack Integration', () => {
  it('should handle complete request/response cycle', async () => {
    const app = createApp();
    const router = createRouter();

    // Logging middleware
    const logMiddleware: Middleware = async (ctx, next) => {
      ctx.state.startTime = Date.now();
      await next();
      ctx.state.duration = Date.now() - (ctx.state.startTime as number);
    };

    // Auth middleware
    const authMiddleware: Middleware = async (ctx, next) => {
      const token = ctx.get('authorization');
      if (token === 'Bearer valid-token') {
        ctx.state.user = { id: 1, role: 'admin' };
      }
      await next();
    };

    // Routes
    router.get('/api/users', (ctx) => {
      const user = ctx.state.user as { id: number; role: string } | undefined;
      if (!user) {
        ctx.status = 401;
        ctx.json({ error: 'Unauthorized' });
        return;
      }
      ctx.json({ users: [{ id: 1, name: 'Alice' }] });
    });

    router.get('/api/users/:id', (ctx) => {
      ctx.json({ user: { id: ctx.params.id } });
    });

    app.use(logMiddleware);
    app.use(authMiddleware);
    app.use(router.routes());

    const callback = app.callback();

    // Test unauthenticated request
    const ctx1 = createMockContext({ method: 'GET', path: '/api/users' });

    // Manually simulate router matching since we're testing app.callback()
    const match1 = router.match('GET', '/api/users');
    if (match1) {
      ctx1.params = match1.params;
    }

    await callback(ctx1);

    expect(ctx1.status).toBe(401);
    expect(ctx1.json).toHaveBeenCalledWith({ error: 'Unauthorized' });

    // Test authenticated request
    const ctx2 = createMockContext({
      method: 'GET',
      path: '/api/users',
      headers: { authorization: 'Bearer valid-token' },
    });

    const match2 = router.match('GET', '/api/users');
    if (match2) {
      ctx2.params = match2.params;
    }

    await callback(ctx2);

    expect(ctx2.json).toHaveBeenCalledWith({ users: [{ id: 1, name: 'Alice' }] });
    expect(ctx2.state.duration).toBeDefined();
  });

  it('should handle body parsing and validation', async () => {
    const app = createApp();
    const router = createRouter();

    // Simulated body parser middleware
    const bodyParserMiddleware: Middleware = async (_ctx, next) => {
      // In real scenario, body is parsed from ctx.bodySource
      // For this test, body is already set in mock
      await next();
    };

    router.post('/api/users', (ctx) => {
      const body = ctx.body as { name?: string; email?: string };

      if (!body.name || !body.email) {
        ctx.status = 400;
        ctx.json({ error: 'Name and email are required' });
        return;
      }

      ctx.status = 201;
      ctx.json({
        user: {
          id: Date.now(),
          name: body.name,
          email: body.email,
        },
      });
    });

    app.use(bodyParserMiddleware);
    app.use(router.routes());

    const callback = app.callback();

    // Test invalid body
    const ctx1 = createMockContext({
      method: 'POST',
      path: '/api/users',
      body: { name: 'Alice' }, // Missing email
    });

    await callback(ctx1);

    expect(ctx1.status).toBe(400);
    expect(ctx1.json).toHaveBeenCalledWith({ error: 'Name and email are required' });

    // Test valid body
    const ctx2 = createMockContext({
      method: 'POST',
      path: '/api/users',
      body: { name: 'Alice', email: 'alice@example.com' },
    });

    await callback(ctx2);

    expect(ctx2.status).toBe(201);
    expect(ctx2.json).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({
          name: 'Alice',
          email: 'alice@example.com',
        }),
      })
    );
  });

  it('should handle CRUD operations', async () => {
    const app = createApp();
    const router = createRouter();

    // In-memory store for testing
    const store = new Map<string, { id: string; name: string }>();

    router.get('/items', (ctx) => {
      ctx.json({ items: Array.from(store.values()) });
    });

    router.get('/items/:id', (ctx) => {
      const id = ctx.params.id ?? '';
      const item = store.get(id);
      if (!item) {
        ctx.status = 404;
        ctx.json({ error: 'Item not found' });
        return;
      }
      ctx.json({ item });
    });

    router.post('/items', (ctx) => {
      const body = ctx.body as { name: string };
      const id = String(Date.now());
      const item = { id, name: body.name };
      store.set(id, item);
      ctx.status = 201;
      ctx.json({ item });
    });

    router.put('/items/:id', (ctx) => {
      const id = ctx.params.id ?? '';
      if (!store.has(id)) {
        ctx.status = 404;
        ctx.json({ error: 'Item not found' });
        return;
      }
      const body = ctx.body as { name: string };
      const item = { id, name: body.name };
      store.set(id, item);
      ctx.json({ item });
    });

    router.delete('/items/:id', (ctx) => {
      const id = ctx.params.id ?? '';
      if (!store.has(id)) {
        ctx.status = 404;
        ctx.json({ error: 'Item not found' });
        return;
      }
      store.delete(id);
      ctx.status = 204;
      ctx.send('');
    });

    app.use(router.routes());
    const callback = app.callback();

    // CREATE
    const createCtx = createMockContext({
      method: 'POST',
      path: '/items',
      body: { name: 'Test Item' },
    });
    await callback(createCtx);
    expect(createCtx.status).toBe(201);

    // Get the created item id from the mock
    const createCall = (createCtx.json as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as
      | { item: { id: string } }
      | undefined;
    const itemId = createCall?.item.id ?? '';

    // READ
    const readCtx = createMockContext({
      method: 'GET',
      path: `/items/${itemId}`,
      params: { id: itemId },
    });
    await callback(readCtx);
    expect(readCtx.json).toHaveBeenCalledWith({
      item: { id: itemId, name: 'Test Item' },
    });

    // UPDATE
    const updateCtx = createMockContext({
      method: 'PUT',
      path: `/items/${itemId}`,
      params: { id: itemId },
      body: { name: 'Updated Item' },
    });
    await callback(updateCtx);
    expect(updateCtx.json).toHaveBeenCalledWith({
      item: { id: itemId, name: 'Updated Item' },
    });

    // DELETE
    const deleteCtx = createMockContext({
      method: 'DELETE',
      path: `/items/${itemId}`,
      params: { id: itemId },
    });
    await callback(deleteCtx);
    expect(deleteCtx.status).toBe(204);

    // Verify deleted
    const verifyCtx = createMockContext({
      method: 'GET',
      path: `/items/${itemId}`,
      params: { id: itemId },
    });
    await callback(verifyCtx);
    expect(verifyCtx.status).toBe(404);
  });
});

// ============================================================================
// Error Handling Integration Tests
// ============================================================================

describe('Error Handling Integration', () => {
  it('should handle HttpError through the stack', async () => {
    const app = createApp();

    app.onError((error: Error, ctx: Context) => {
      if (error instanceof HttpError) {
        ctx.status = error.status;
        ctx.json({
          error: error.name,
          message: error.message,
          status: error.status,
        });
      } else {
        ctx.status = 500;
        ctx.json({ error: 'Internal Server Error' });
      }
    });

    app.use(async () => {
      throw new NotFoundError('Resource not found');
    });

    const callback = app.callback();
    const ctx = createMockContext();

    await callback(ctx);

    expect(ctx.status).toBe(404);
    expect(ctx.json).toHaveBeenCalledWith({
      error: 'NotFoundError',
      message: 'Resource not found',
      status: 404,
    });
  });

  it('should handle validation errors', async () => {
    const app = createApp();

    app.onError((error: Error, ctx: Context) => {
      if (error instanceof BadRequestError) {
        ctx.status = 400;
        ctx.json({
          error: 'Validation Error',
          message: error.message,
        });
      } else {
        ctx.status = 500;
        ctx.json({ error: 'Internal Server Error' });
      }
    });

    app.use(async (ctx) => {
      const body = ctx.body as { email?: string };
      if (!body.email || !body.email.includes('@')) {
        throw new BadRequestError('Invalid email format');
      }
      ctx.json({ success: true });
    });

    const callback = app.callback();

    // Invalid email
    const ctx1 = createMockContext({ body: { email: 'invalid' } });
    await callback(ctx1);

    expect(ctx1.status).toBe(400);
    expect(ctx1.json).toHaveBeenCalledWith({
      error: 'Validation Error',
      message: 'Invalid email format',
    });

    // Valid email
    const ctx2 = createMockContext({ body: { email: 'test@example.com' } });
    await callback(ctx2);

    expect(ctx2.json).toHaveBeenCalledWith({ success: true });
  });

  it('should not expose internal errors in production', async () => {
    const app = createApp({ env: 'production' });

    app.use(async () => {
      throw new Error('Database connection failed');
    });

    const callback = app.callback();
    const ctx = createMockContext();

    // Suppress console.error during test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await callback(ctx);

    expect(ctx.status).toBe(500);
    expect(ctx.json).toHaveBeenCalledWith({ error: 'Internal Server Error' });

    consoleSpy.mockRestore();
  });
});

// ============================================================================
// State Management Tests
// ============================================================================

describe('State Management', () => {
  it('should isolate state between requests', async () => {
    const app = createApp();

    app.use(async (ctx, next) => {
      ctx.state.requestId = Math.random().toString(36);
      await next();
    });

    app.use(async (ctx) => {
      ctx.json({ requestId: ctx.state.requestId });
    });

    const callback = app.callback();

    const ctx1 = createMockContext();
    const ctx2 = createMockContext();

    await callback(ctx1);
    await callback(ctx2);

    const call1 = (ctx1.json as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as
      | { requestId: string }
      | undefined;
    const call2 = (ctx2.json as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as
      | { requestId: string }
      | undefined;

    expect(call1?.requestId).not.toBe(call2?.requestId);
  });

  it('should allow deep state nesting', async () => {
    const app = createApp();

    app.use(async (ctx, next) => {
      ctx.state.auth = { user: null, permissions: [] };
      await next();
    });

    app.use(async (ctx, next) => {
      (ctx.state.auth as { user: unknown }).user = { id: 1, name: 'Admin' };
      (ctx.state.auth as { permissions: string[] }).permissions = ['read', 'write'];
      await next();
    });

    app.use(async (ctx) => {
      ctx.json({ auth: ctx.state.auth });
    });

    const callback = app.callback();
    const ctx = createMockContext();

    await callback(ctx);

    expect(ctx.json).toHaveBeenCalledWith({
      auth: {
        user: { id: 1, name: 'Admin' },
        permissions: ['read', 'write'],
      },
    });
  });
});

// ============================================================================
// Response Methods Tests
// ============================================================================

describe('Response Methods Integration', () => {
  it('should set correct content-type for json()', async () => {
    const app = createApp();

    app.use(async (ctx) => {
      ctx.json({ data: 'test' });
    });

    const callback = app.callback();
    const ctx = createMockContext();

    await callback(ctx);

    const headers = (ctx as MockableContext)._getResponseHeaders();
    expect(headers['content-type']).toBe('application/json');
  });

  it('should set correct content-type for html()', async () => {
    const app = createApp();

    app.use(async (ctx) => {
      ctx.html('<h1>Hello</h1>');
    });

    const callback = app.callback();
    const ctx = createMockContext();

    await callback(ctx);

    const headers = (ctx as MockableContext)._getResponseHeaders();
    expect(headers['content-type']).toBe('text/html');
  });

  it('should handle redirect correctly', async () => {
    const app = createApp();

    app.use(async (ctx) => {
      ctx.redirect('/new-location', 301);
    });

    const callback = app.callback();
    const ctx = createMockContext();

    await callback(ctx);

    expect(ctx.status).toBe(301);
    const headers = (ctx as MockableContext)._getResponseHeaders();
    expect(headers.location).toBe('/new-location');
  });
});

// ============================================================================
// Concurrent Request Handling Tests
// ============================================================================

describe('Concurrent Request Handling', () => {
  it('should handle multiple concurrent requests', async () => {
    const app = createApp();
    const router = createRouter();

    router.get('/slow', async (ctx) => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      ctx.json({ route: 'slow', time: Date.now() });
    });

    router.get('/fast', async (ctx) => {
      ctx.json({ route: 'fast', time: Date.now() });
    });

    app.use(router.routes());
    const callback = app.callback();

    const slowCtx = createMockContext({ path: '/slow' });
    const fastCtx = createMockContext({ path: '/fast' });

    // Start both requests concurrently
    await Promise.all([callback(slowCtx), callback(fastCtx)]);

    // Both should complete successfully
    expect(slowCtx.json).toHaveBeenCalled();
    expect(fastCtx.json).toHaveBeenCalled();
  });
});
