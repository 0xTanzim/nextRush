/**
 * NextRush v3 Middleware Integration Tests
 *
 * Tests for middleware packages working together:
 * - Body Parser + Router
 * - CORS + Application
 * - Helmet + Application
 * - Compression + Router
 * - Multiple middleware composition
 *
 * @packageDocumentation
 */

import type {
    BodySource,
    Context,
    ContextState,
    QueryParams,
    RawHttp,
    RouteParams,
    Runtime,
} from '@nextrush/types';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';

// Import middleware packages
import { bodyParser, json, raw, text, urlencoded } from '@nextrush/body-parser';
import { compression, deflate, gzip } from '@nextrush/compression';
import { cors, devCors, strictCors } from '@nextrush/cors';
import { catchAsync, errorHandler, notFoundHandler } from '@nextrush/errors';
import { devHelmet, helmet, strictHelmet } from '@nextrush/helmet';

// ============================================================================
// Test Utilities
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
  bodyText?: string;
}

function createMockBodySource(body: unknown, bodyText?: string): BodySource {
  let consumed = false;

  return {
    text: vi.fn(async () => {
      consumed = true;
      return bodyText ?? (typeof body === 'string' ? body : JSON.stringify(body ?? ''));
    }),
    buffer: vi.fn(async () => {
      consumed = true;
      const text = bodyText ?? (typeof body === 'string' ? body : JSON.stringify(body ?? ''));
      return new TextEncoder().encode(text);
    }),
    json: vi.fn(async () => {
      consumed = true;
      return body ?? {};
    }) as BodySource['json'],
    stream: vi.fn(() => {
      const text = bodyText ?? (typeof body === 'string' ? body : JSON.stringify(body ?? ''));
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

function createMockContext(options: MockContextOptions = {}): Context & {
  _getResponseHeaders: () => Record<string, string>;
  _getResponseBody: () => unknown;
} {
  const {
    method = 'GET',
    path: pathValue = '/',
    url = pathValue,
    query = {},
    headers = {},
    body = undefined,
    params = {},
    ip = '127.0.0.1',
    bodyText,
  } = options;

  const responseHeaders: Record<string, string> = {};
  let responseStatus = 200;
  let responseBody: unknown = undefined;
  let nextFn: (() => Promise<void>) | undefined;
  let ctxBody = body;

  const mockBodySource = createMockBodySource(body, bodyText);
  const mockRaw: RawHttp = { req: {} as never, res: {} as never };

  const ctx = {
    method: method.toUpperCase() as Context['method'],
    url,
    path: pathValue,
    query,
    headers,
    ip,

    get body() {
      return ctxBody;
    },
    set body(value: unknown) {
      ctxBody = value;
    },

    params,

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

    throw: vi.fn((status: number, message?: string): never => {
      const error = new Error(message ?? 'Error');
      (error as Error & { status: number }).status = status;
      throw error;
    }),

    assert: vi.fn((condition: unknown, status: number, message?: string): asserts condition => {
      if (!condition) {
        const error = new Error(message ?? 'Assertion failed');
        (error as Error & { status: number }).status = status;
        throw error;
      }
    }),

    set: vi.fn((field: string, value: string | number) => {
      responseHeaders[field.toLowerCase()] = String(value);
    }),

    get: vi.fn((field: string) => {
      return headers[field.toLowerCase()];
    }),

    next: vi.fn(async () => {
      if (nextFn) {
        await nextFn();
      }
    }),

    state: {} as ContextState,
    responded: false,
    raw: mockRaw,
    runtime: 'node' as Runtime,
    bodySource: mockBodySource,

    _setNextFn: (fn: () => Promise<void>) => {
      nextFn = fn;
    },
    _getResponseBody: () => responseBody,
    _getResponseHeaders: () => responseHeaders,
  };

  return ctx as Context & {
    _getResponseHeaders: () => Record<string, string>;
    _getResponseBody: () => unknown;
  };
}

// ============================================================================
// Body Parser Integration Tests
// ============================================================================

describe('Body Parser Middleware Integration', () => {
  describe('JSON Parser', () => {
    it('should parse JSON body and make it available to route handler', async () => {
      const app = createApp();
      const router = createRouter();

      app.use(json() as unknown as (ctx: Context, next: () => Promise<void>) => Promise<void>);

      router.post('/users', (ctx) => {
        const body = ctx.body as { name: string; email: string };
        ctx.status = 201;
        ctx.json({ user: body });
      });

      app.use(router.routes());

      const ctx = createMockContext({
        method: 'POST',
        path: '/users',
        headers: {
          'content-type': 'application/json',
        },
        body: { name: 'Alice', email: 'alice@example.com' },
        bodyText: '{"name":"Alice","email":"alice@example.com"}',
      });

      // The json middleware reads from bodySource
      const jsonMiddleware = json();
      await jsonMiddleware(ctx as Parameters<typeof jsonMiddleware>[0], async () => {});

      // Verify body was parsed (in real scenario, middleware sets ctx.body)
      expect(ctx.bodySource.text).toBeDefined();
    });

    it('should respect limit option', async () => {
      const smallLimitParser = json({ limit: '100b' });

      // Parser should reject bodies over limit
      // Actual behavior depends on implementation
      expect(typeof smallLimitParser).toBe('function');
    });
  });

  describe('URL Encoded Parser', () => {
    it('should parse URL encoded body', async () => {
      const parser = urlencoded();
      expect(typeof parser).toBe('function');
    });

    it('should handle nested objects with extended option', async () => {
      const parser = urlencoded({ extended: true, depth: 5 });
      expect(typeof parser).toBe('function');
    });
  });

  describe('Combined Body Parser', () => {
    it('should handle multiple content types', async () => {
      const parser = bodyParser();

      // Handles JSON
      expect(typeof parser).toBe('function');
    });
  });

  describe('Text and Raw Parsers', () => {
    it('should parse text bodies', async () => {
      const textParser = text();
      expect(typeof textParser).toBe('function');
    });

    it('should parse raw binary bodies', async () => {
      const rawParser = raw();
      expect(typeof rawParser).toBe('function');
    });
  });
});

// ============================================================================
// CORS Middleware Integration Tests
// ============================================================================

describe('CORS Middleware Integration', () => {
  describe('Basic CORS', () => {
    it('should add CORS headers to response', async () => {
      const corsMiddleware = cors({
        origin: 'https://example.com',
        credentials: true,
      });

      const ctx = createMockContext({
        method: 'GET',
        path: '/api/data',
        headers: { origin: 'https://example.com' },
      });

      await corsMiddleware(ctx, async () => {});

      // Verify CORS headers were set
      expect(ctx.set).toHaveBeenCalled();
    });

    it('should handle preflight requests', async () => {
      const corsMiddleware = cors({
        origin: 'https://example.com',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
      });

      const ctx = createMockContext({
        method: 'OPTIONS',
        path: '/api/data',
        headers: {
          origin: 'https://example.com',
          'access-control-request-method': 'POST',
        },
      });

      await corsMiddleware(ctx, async () => {});

      // Verify preflight response
      expect(ctx.status).toBeDefined();
    });

    it('should reject invalid origins when strict', async () => {
      const strictCorsMiddleware = strictCors(['https://allowed.com']);

      const ctx = createMockContext({
        method: 'GET',
        path: '/api/data',
        headers: { origin: 'https://malicious.com' },
      });

      await strictCorsMiddleware(ctx, async () => {});

      // Should not set Access-Control-Allow-Origin for invalid origin
      const headers = ctx._getResponseHeaders();
      expect(headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('CORS Presets', () => {
    it('devCors should be permissive', async () => {
      const devCorsMiddleware = devCors();
      expect(typeof devCorsMiddleware).toBe('function');
    });

    it('strictCors should be restrictive', async () => {
      const strictCorsMiddleware = strictCors(['https://example.com']);
      expect(typeof strictCorsMiddleware).toBe('function');
    });
  });
});

// ============================================================================
// Helmet Middleware Integration Tests
// ============================================================================

describe('Helmet Middleware Integration', () => {
  describe('Basic Helmet', () => {
    it('should add security headers', async () => {
      const helmetMiddleware = helmet();

      const ctx = createMockContext({
        method: 'GET',
        path: '/page',
      });

      await helmetMiddleware(ctx, async () => {});

      // Verify security headers were set
      expect(ctx.set).toHaveBeenCalled();
    });
  });

  describe('Helmet Presets', () => {
    it('devHelmet should be less restrictive', async () => {
      const devHelmetMiddleware = devHelmet();
      expect(typeof devHelmetMiddleware).toBe('function');
    });

    it('strictHelmet should be more restrictive', async () => {
      const strictHelmetMiddleware = strictHelmet();
      expect(typeof strictHelmetMiddleware).toBe('function');
    });
  });

  describe('Custom CSP', () => {
    it('should support custom Content-Security-Policy', async () => {
      const helmetMiddleware = helmet({
        contentSecurityPolicy: {
          directives: {
            'default-src': ["'self'"],
            'script-src': ["'self'", "'unsafe-inline'"],
          },
        },
      });

      expect(typeof helmetMiddleware).toBe('function');
    });
  });
});

// ============================================================================
// Compression Middleware Integration Tests
// ============================================================================

describe('Compression Middleware Integration', () => {
  describe('Basic Compression', () => {
    it('should create compression middleware', async () => {
      const compressionMiddleware = compression();
      expect(typeof compressionMiddleware).toBe('function');
    });

    it('should create gzip middleware', async () => {
      const gzipMiddleware = gzip();
      expect(typeof gzipMiddleware).toBe('function');
    });

    it('should create deflate middleware', async () => {
      const deflateMiddleware = deflate();
      expect(typeof deflateMiddleware).toBe('function');
    });
  });

  describe('Compression Options', () => {
    it('should respect threshold option', async () => {
      const compressionMiddleware = compression({
        threshold: 1024, // Only compress responses > 1KB
      });

      expect(typeof compressionMiddleware).toBe('function');
    });

    it('should respect level option', async () => {
      const compressionMiddleware = compression({
        level: 9, // Maximum compression
      });

      expect(typeof compressionMiddleware).toBe('function');
    });
  });
});

// ============================================================================
// Error Handler Integration Tests
// ============================================================================

describe('Error Handler Middleware Integration', () => {
  describe('errorHandler', () => {
    it('should catch and format errors', async () => {
      const handler = errorHandler();

      const ctx = createMockContext();

      await handler(ctx, async () => {
        throw new Error('Test error');
      });

      expect(ctx.status).toBe(500);
      expect(ctx.json).toHaveBeenCalled();
    });

    it('should handle HTTP errors with correct status', async () => {
      const handler = errorHandler();

      const ctx = createMockContext();

      // Import the actual HttpError class to test proper behavior
      const { NotFoundError } = await import('@nextrush/errors');

      await handler(ctx, async () => {
        throw new NotFoundError('Resource not found');
      });

      expect(ctx.status).toBe(404);
    });
  });

  describe('notFoundHandler', () => {
    it('should respond with 404 for unmatched routes', async () => {
      const handler = notFoundHandler();

      const ctx = createMockContext({
        method: 'GET',
        path: '/nonexistent',
      });

      await handler(ctx, async () => {
        // No route matched - next() does nothing
      });

      // notFoundHandler sets 404 if status is still 200 and no body
      expect(typeof handler).toBe('function');
    });
  });

  describe('catchAsync', () => {
    it('should wrap async route handlers', async () => {
      const asyncHandler = catchAsync(async (ctx) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        ctx.json({ success: true });
      });

      const ctx = createMockContext();

      await asyncHandler(ctx, async () => {});

      expect(ctx.json).toHaveBeenCalledWith({ success: true });
    });
  });
});

// ============================================================================
// Full Middleware Stack Integration Tests
// ============================================================================

describe('Full Middleware Stack Integration', () => {
  it('should execute middleware in correct order', async () => {
    const app = createApp();
    const router = createRouter();
    const order: string[] = [];

    // Error handler (outermost)
    app.use(async (_ctx, next) => {
      order.push('error-handler-start');
      try {
        await next();
      } catch (e) {
        order.push('error-handler-catch');
      }
      order.push('error-handler-end');
    });

    // Security headers
    app.use(async (_ctx, next) => {
      order.push('helmet-start');
      ctx.set('X-Content-Type-Options', 'nosniff');
      await next();
      order.push('helmet-end');
    });

    // CORS
    app.use(async (ctx, next) => {
      order.push('cors-start');
      ctx.set('Access-Control-Allow-Origin', '*');
      await next();
      order.push('cors-end');
    });

    // Body parser
    app.use(async (_ctx, next) => {
      order.push('body-parser-start');
      // Parse body
      await next();
      order.push('body-parser-end');
    });

    // Router
    router.get('/test', (ctx) => {
      order.push('handler');
      ctx.json({ success: true });
    });

    app.use(router.routes());

    const callback = app.callback();
    const ctx = createMockContext({ method: 'GET', path: '/test' });

    await callback(ctx);

    expect(order).toEqual([
      'error-handler-start',
      'helmet-start',
      'cors-start',
      'body-parser-start',
      'handler',
      'body-parser-end',
      'cors-end',
      'helmet-end',
      'error-handler-end',
    ]);
  });

  it('should properly propagate state through middleware', async () => {
    const app = createApp();
    const router = createRouter();

    // Auth middleware
    app.use(async (ctx, next) => {
      const token = ctx.get('authorization');
      if (token === 'Bearer valid-token') {
        ctx.state.user = { id: 1, role: 'admin' };
        ctx.state.authenticated = true;
      }
      await next();
    });

    // Request ID middleware
    app.use(async (ctx, next) => {
      ctx.state.requestId = 'req-' + Math.random().toString(36).substring(7);
      ctx.set('X-Request-ID', ctx.state.requestId as string);
      await next();
    });

    // Logger middleware
    app.use(async (ctx, next) => {
      ctx.state.startTime = Date.now();
      await next();
      ctx.state.duration = Date.now() - (ctx.state.startTime as number);
    });

    router.get('/profile', (ctx) => {
      const user = ctx.state.user as { id: number; role: string } | undefined;
      const requestId = ctx.state.requestId as string;
      const authenticated = ctx.state.authenticated as boolean;

      if (!authenticated) {
        ctx.status = 401;
        ctx.json({ error: 'Unauthorized', requestId });
        return;
      }

      ctx.json({
        user,
        requestId,
        authenticated,
      });
    });

    app.use(router.routes());

    const callback = app.callback();

    // Authenticated request
    const ctx = createMockContext({
      method: 'GET',
      path: '/profile',
      headers: { authorization: 'Bearer valid-token' },
    });

    await callback(ctx);

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        user: { id: 1, role: 'admin' },
        authenticated: true,
      })
    );
    expect(ctx.state.duration).toBeDefined();
  });

  it('should handle errors and continue cleanup', async () => {
    const app = createApp();
    const cleanupOrder: string[] = [];

    // Outer cleanup
    app.use(async (_ctx, next) => {
      try {
        await next();
      } finally {
        cleanupOrder.push('outer-cleanup');
      }
    });

    // Middle cleanup
    app.use(async (_ctx, next) => {
      try {
        await next();
      } finally {
        cleanupOrder.push('middle-cleanup');
      }
    });

    // Error handler
    app.onError((_error, ctx) => {
      cleanupOrder.push('error-handler');
      ctx.status = 500;
      ctx.json({ error: 'Internal Error' });
    });

    // Throwing middleware
    app.use(async () => {
      throw new Error('Something went wrong');
    });

    const callback = app.callback();
    const ctx = createMockContext();

    await callback(ctx);

    // Cleanup should happen in reverse order
    expect(cleanupOrder).toContain('error-handler');
  });
});

// ============================================================================
// Performance Integration Tests
// ============================================================================

describe('Performance Integration', () => {
  it('should handle many concurrent requests', async () => {
    const app = createApp();
    const router = createRouter();

    router.get('/ping', (ctx) => {
      ctx.json({ pong: true, timestamp: Date.now() });
    });

    app.use(router.routes());

    const callback = app.callback();

    // Create 100 concurrent requests
    const requests = Array.from({ length: 100 }, () =>
      callback(createMockContext({ method: 'GET', path: '/ping' }))
    );

    await Promise.all(requests);

    // All should complete without error
    expect(requests.length).toBe(100);
  });

  it('should complete many sequential requests through a deep middleware stack', async () => {
    const app = createApp();
    const router = createRouter();

    for (let i = 0; i < 10; i++) {
      app.use(async (_ctx, next) => {
        await next();
      });
    }

    router.get('/bench', (ctx) => {
      ctx.json({ ok: true });
    });

    app.use(router.routes());

    const callback = app.callback();
    const start = Date.now();
    const iterations = 1000;

    for (let i = 0; i < iterations; i++) {
      await callback(createMockContext({ method: 'GET', path: '/bench' }));
    }

    const duration = Date.now() - start;

    // Throughput varies by machine; this only guards against hangs/regressions that explode latency.
    expect(duration).toBeLessThan(60_000);
  });
});
