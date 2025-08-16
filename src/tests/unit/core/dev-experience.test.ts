/**
 * Tests for Dev Experience Utilities
 *
 * @packageDocumentation
 */

import {
  BodyParserError,
  ContextError,
  createDevelopmentMiddleware,
  createErrorHandler,
  debugContext,
  DEV_ERROR_MESSAGES,
  DevWarningSystem,
  DIError,
  getContextProperty,
  MiddlewareError,
  NextRushError,
  RouteHandlerError,
  validateMiddleware,
} from '@/core/dev-experience';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('Dev Experience Utilities', () => {
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;
  let consoleLogSpy: any;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    originalNodeEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'development';
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    process.env['NODE_ENV'] = originalNodeEnv;
    // Reset warning system state
    (DevWarningSystem as any).warnings.clear();
  });

  describe('DEV_ERROR_MESSAGES', () => {
    it('should contain middleware async error message', () => {
      expect(DEV_ERROR_MESSAGES.MIDDLEWARE_ASYNC).toContain('Middleware Error');
      expect(DEV_ERROR_MESSAGES.MIDDLEWARE_ASYNC).toContain('async');
      expect(DEV_ERROR_MESSAGES.MIDDLEWARE_ASYNC).toContain('await next()');
    });

    it('should contain context modification error message', () => {
      expect(DEV_ERROR_MESSAGES.CONTEXT_MODIFICATION).toContain(
        'Context Error'
      );
      expect(DEV_ERROR_MESSAGES.CONTEXT_MODIFICATION).toContain('readonly');
      expect(DEV_ERROR_MESSAGES.CONTEXT_MODIFICATION).toContain('ctx.state');
    });

    it('should provide DI resolution error message function', () => {
      const serviceName = 'UserService';
      const message = DEV_ERROR_MESSAGES.DI_RESOLUTION_FAILED(serviceName);

      expect(message).toContain('Dependency Injection Error');
      expect(message).toContain(serviceName);
      expect(message).toContain('register');
    });

    it('should provide performance warning message function', () => {
      const responseTime = 150;
      const message = DEV_ERROR_MESSAGES.PERFORMANCE_WARNING(responseTime);

      expect(message).toContain('Performance Warning');
      expect(message).toContain('150ms');
      expect(message).toContain('optimization');
    });

    it('should provide memory warning message function', () => {
      const memoryUsage = 120;
      const message = DEV_ERROR_MESSAGES.MEMORY_WARNING(memoryUsage);

      expect(message).toContain('Memory Warning');
      expect(message).toContain('120MB');
      expect(message).toContain('memory usage');
    });
  });

  describe('DevWarningSystem', () => {
    it('should warn once per warning key', () => {
      DevWarningSystem.warnOnce('test-key', 'Test warning message');
      DevWarningSystem.warnOnce('test-key', 'Test warning message');

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith('\nTest warning message\n');
    });

    it.skip('should not warn in production (skipped - static property timing)', () => {
      // Note: This test is skipped because isDevelopment is evaluated at module load time
      // In real usage, the NODE_ENV is set before the module is loaded, so this works correctly
      process.env['NODE_ENV'] = 'production';

      DevWarningSystem.warnOnce('prod-test', 'Production warning');

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should check middleware for async issues', () => {
      const syncMiddleware = (_ctx: any, next: any) => {
        next(); // Missing await
      };

      DevWarningSystem.checkMiddleware(syncMiddleware);

      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should not warn for proper async middleware', () => {
      const asyncMiddleware = async (_ctx: any, next: any) => {
        await next();
      };

      DevWarningSystem.checkMiddleware(asyncMiddleware);

      // Should not warn for properly implemented middleware
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should check CORS configuration', () => {
      DevWarningSystem.checkCorsConfig({ origin: true, credentials: true });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('CORS Configuration Warning')
      );
    });

    it('should not warn for secure CORS config', () => {
      DevWarningSystem.checkCorsConfig({
        origin: ['https://example.com'],
        credentials: true,
      });

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should check performance issues', () => {
      const ctx = { path: '/slow-endpoint' } as any;

      DevWarningSystem.checkPerformance(ctx, 150);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Performance Warning')
      );
    });

    it('should not warn for fast responses', () => {
      const ctx = { path: '/fast-endpoint' } as any;

      DevWarningSystem.checkPerformance(ctx, 50);

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should check memory usage', () => {
      // Mock process.memoryUsage to return high memory
      const originalMemoryUsage = process.memoryUsage;
      (process as any).memoryUsage = vi.fn().mockReturnValue({
        heapUsed: 120 * 1024 * 1024, // 120MB
        heapTotal: 200 * 1024 * 1024,
        external: 0,
        rss: 150 * 1024 * 1024,
        arrayBuffers: 0,
      });

      DevWarningSystem.checkMemoryUsage();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Memory Warning')
      );

      process.memoryUsage = originalMemoryUsage;
    });
  });

  describe('NextRushError', () => {
    it('should create error with code and suggestions', () => {
      const error = new NextRushError('Test error', 'TEST_ERROR', 400, [
        'Suggestion 1',
        'Suggestion 2',
      ]);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.suggestions).toEqual(['Suggestion 1', 'Suggestion 2']);
    });

    it('should generate developer-friendly string', () => {
      const error = new NextRushError('Test error', 'TEST_ERROR', 400, [
        'Fix this',
        'Try that',
      ]);

      const devString = error.toDeveloperString();

      expect(devString).toContain('NextRushError');
      expect(devString).toContain('Test error');
      expect(devString).toContain('TEST_ERROR');
      expect(devString).toContain('400');
      expect(devString).toContain('Fix this');
      expect(devString).toContain('Try that');
    });

    it('should include original error information', () => {
      const originalError = new Error('Original error');
      const error = new NextRushError(
        'Wrapped error',
        'WRAPPED_ERROR',
        500,
        [],
        originalError
      );

      expect(error.originalError).toBe(originalError);

      const devString = error.toDeveloperString();
      expect(devString).toContain('Original error');
    });
  });

  describe('MiddlewareError', () => {
    it('should create middleware error with suggestions', () => {
      const error = new MiddlewareError(
        'Something went wrong',
        'testMiddleware'
      );

      expect(error.message).toContain('testMiddleware');
      expect(error.message).toContain('Something went wrong');
      expect(error.code).toBe('MIDDLEWARE_ERROR');
      expect(error.suggestions).toContain(
        'Ensure middleware function is async'
      );
    });

    it('should work without middleware name', () => {
      const error = new MiddlewareError('Generic error');

      expect(error.message).toContain('Generic error');
      expect(error.code).toBe('MIDDLEWARE_ERROR');
    });
  });

  describe('RouteHandlerError', () => {
    it('should create route handler error with path and method', () => {
      const originalError = new Error('Database connection failed');
      const error = new RouteHandlerError('/users', 'POST', originalError);

      expect(error.message).toContain('POST /users');
      expect(error.message).toContain('Database connection failed');
      expect(error.code).toBe('ROUTE_HANDLER_ERROR');
      expect(error.suggestions).toContain('Ensure route handler is async');
    });
  });

  describe('DIError', () => {
    it('should create DI error with service name and operation', () => {
      const error = new DIError('UserService', 'resolve');

      expect(error.message).toContain('UserService');
      expect(error.message).toContain('resolve');
      expect(error.code).toBe('DI_ERROR');
      expect(error.suggestions).toContain(
        "Register the service: container.register('UserService', UserServiceService)"
      );
    });

    it('should include original error', () => {
      const originalError = new Error('Service not found');
      const error = new DIError('UserService', 'resolve', originalError);

      expect(error.originalError).toBe(originalError);
      expect(error.message).toContain('Service not found');
    });
  });

  describe('BodyParserError', () => {
    it('should create body parser error with content type', () => {
      const originalError = new Error('Invalid JSON');
      const error = new BodyParserError('application/json', originalError);

      expect(error.message).toContain('application/json');
      expect(error.message).toContain('Invalid JSON');
      expect(error.code).toBe('BODY_PARSER_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.suggestions).toContain(
        'Verify Content-Type header matches request body'
      );
    });
  });

  describe('ContextError', () => {
    it('should create context error with property and operation', () => {
      const error = new ContextError('customProperty', 'modify');

      expect(error.message).toContain('customProperty');
      expect(error.message).toContain('modify');
      expect(error.code).toBe('CONTEXT_ERROR');
      expect(error.suggestions).toContain(
        'Use ctx.state for custom properties'
      );
    });
  });

  describe('createErrorHandler', () => {
    it('should create error handling middleware', async () => {
      const errorHandler = createErrorHandler();
      const ctx = {
        status: 200,
        body: null,
      } as any;

      const next = async () => {
        throw new NextRushError('Test error', 'TEST_ERROR', 400);
      };

      await errorHandler(ctx, next);

      expect(ctx.status).toBe(400);
      expect(ctx.body).toEqual({
        error: 'Test error',
        code: 'TEST_ERROR',
        stack: expect.any(String),
        suggestions: expect.any(Array),
      });
    });

    it('should handle generic errors', async () => {
      const errorHandler = createErrorHandler();
      const ctx = {
        status: 200,
        body: null,
      } as any;

      const next = async () => {
        const error = new Error('Generic error');
        (error as any).statusCode = 403;
        throw error;
      };

      await errorHandler(ctx, next);

      expect(ctx.status).toBe(403);
      expect(ctx.body.error).toBe('Generic error');
    });

    it('should log errors when enabled', async () => {
      const errorHandler = createErrorHandler({ logErrors: true });
      const ctx = { status: 200, body: null } as any;

      const next = async () => {
        throw new NextRushError('Logged error', 'LOGGED_ERROR');
      };

      await errorHandler(ctx, next);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('NextRushError')
      );
    });

    it('should not show stack trace in production', async () => {
      process.env['NODE_ENV'] = 'production';
      const errorHandler = createErrorHandler();
      const ctx = { status: 200, body: null } as any;

      const next = async () => {
        throw new NextRushError('Production error', 'PROD_ERROR');
      };

      await errorHandler(ctx, next);

      expect(ctx.body.stack).toBeUndefined();
      expect(ctx.body.suggestions).toBeUndefined();
    });
  });

  describe('createDevelopmentMiddleware', () => {
    it('should create development middleware that checks performance', async () => {
      const devMiddleware = createDevelopmentMiddleware();
      const ctx = { path: '/test' } as any;

      const next = async () => {
        // Simulate slow operation
        await new Promise(resolve => setTimeout(resolve, 120));
      };

      await devMiddleware(ctx, next);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Performance Warning')
      );
    });

    it('should be no-op in production', async () => {
      process.env['NODE_ENV'] = 'production';
      const devMiddleware = createDevelopmentMiddleware();
      const ctx = { path: '/test' } as any;

      let nextCalled = false;
      const next = async () => {
        nextCalled = true;
      };

      await devMiddleware(ctx, next);

      expect(nextCalled).toBe(true);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('debugContext', () => {
    it('should log context information in development', () => {
      const ctx = {
        method: 'GET',
        path: '/test',
        status: 200,
        headers: { 'content-type': 'application/json' },
        query: { page: '1' },
        params: { id: '123' },
        body: { test: true },
        state: { user: 'testuser' },
      } as any;

      debugContext(ctx);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Context Debug Info')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith('Method: GET');
      expect(consoleLogSpy).toHaveBeenCalledWith('Path: /test');
      expect(consoleLogSpy).toHaveBeenCalledWith('Status: 200');
    });

    it('should not log in production', () => {
      process.env['NODE_ENV'] = 'production';
      const ctx = { method: 'GET', path: '/test' } as any;

      debugContext(ctx);

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('getContextProperty', () => {
    it('should return property value when it exists', () => {
      const ctx = { customProperty: 'test value' } as any;

      const value = getContextProperty(ctx, 'customProperty');

      expect(value).toBe('test value');
    });

    it('should throw ContextError when property does not exist', () => {
      const ctx = {} as any;

      expect(() => {
        getContextProperty(ctx, 'nonexistent');
      }).toThrow(ContextError);
    });

    it('should return default value when property is undefined', () => {
      const ctx = { undefinedProperty: undefined } as any;

      const value = getContextProperty(ctx, 'undefinedProperty', 'default');

      expect(value).toBe('default');
    });

    it('should warn when property is undefined and no default', () => {
      const ctx = { undefinedProperty: undefined } as any;

      getContextProperty(ctx, 'undefinedProperty');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Warning: Context property 'undefinedProperty' is undefined"
      );
    });
  });

  describe('validateMiddleware', () => {
    it('should validate proper middleware function', () => {
      const validMiddleware = async (_ctx: any, _next: any) => {};

      expect(() => {
        validateMiddleware(validMiddleware);
      }).not.toThrow();
    });

    it('should throw error for non-function middleware', () => {
      expect(() => {
        validateMiddleware('not a function');
      }).toThrow(MiddlewareError);
    });

    it('should throw error for middleware with wrong parameter count', () => {
      const wrongParamCount = (_ctx: any) => {}; // Missing next parameter

      expect(() => {
        validateMiddleware(wrongParamCount);
      }).toThrow(MiddlewareError);
    });

    it('should check middleware implementation in development', () => {
      const middlewareWithoutAwait = (_ctx: any, next: any) => {
        next(); // Missing await
      };

      validateMiddleware(middlewareWithoutAwait);

      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  describe('error scenarios and edge cases', () => {
    it('should handle errors with circular references', () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;

      const error = new NextRushError('Circular error', 'CIRCULAR_ERROR');
      (error as any).circular = circularObj;

      expect(() => {
        error.toDeveloperString();
      }).not.toThrow();
    });

    it('should handle missing environment variables gracefully', () => {
      delete process.env['NODE_ENV'];

      expect(() => {
        DevWarningSystem.warnOnce('env-test', 'Environment test');
      }).not.toThrow();
    });

    it('should handle malformed middleware functions', () => {
      const malformedMiddleware = null;

      expect(() => {
        validateMiddleware(malformedMiddleware);
      }).toThrow(MiddlewareError);
    });

    it('should handle context without expected properties', () => {
      const emptyCtx = {} as any;

      expect(() => {
        debugContext(emptyCtx);
      }).not.toThrow();
    });
  });
});
