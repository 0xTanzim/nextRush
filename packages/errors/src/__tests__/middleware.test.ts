/**
 * @nextrush/errors - Middleware Tests
 */

import { describe, expect, it, vi } from 'vitest';
import { BadRequestError, InternalServerError, NotFoundError } from '../http-errors';
import { catchAsync, errorHandler, notFoundHandler, type ErrorContext } from '../middleware';

function createMockContext(): ErrorContext {
  const ctx = {
    method: 'GET',
    path: '/test',
    status: 200,
    json: vi.fn(),
  };
  return ctx;
}

describe('errorHandler', () => {
  describe('basic functionality', () => {
    it('should pass through when no error', async () => {
      const handler = errorHandler();
      const ctx = createMockContext();

      await handler(ctx, async () => {
        ctx.json({ ok: true });
      });

      expect(ctx.json).toHaveBeenCalledWith({ ok: true });
    });

    it('should catch and handle HttpError', async () => {
      const handler = errorHandler();
      const ctx = createMockContext();

      await handler(ctx, async () => {
        throw new NotFoundError('User not found');
      });

      expect(ctx.status).toBe(404);
      expect(ctx.json).toHaveBeenCalledWith({
        error: 'NotFoundError',
        message: 'User not found',
        code: 'NOT_FOUND',
        status: 404,
      });
    });

    it('should catch and handle regular Error', async () => {
      const handler = errorHandler();
      const ctx = createMockContext();

      await handler(ctx, async () => {
        throw new Error('Something went wrong');
      });

      expect(ctx.status).toBe(500);
      expect(ctx.json).toHaveBeenCalledWith({
        error: 'Error',
        message: 'Internal Server Error',
        code: 'INTERNAL_ERROR',
        status: 500,
      });
    });

    it('should handle non-Error thrown values', async () => {
      const handler = errorHandler();
      const ctx = createMockContext();

      await handler(ctx, async () => {
        throw 'string error';
      });

      expect(ctx.status).toBe(500);
      expect(ctx.json).toHaveBeenCalled();
    });
  });

  describe('includeStack option', () => {
    it('should include stack when enabled', async () => {
      const handler = errorHandler({ includeStack: true });
      const ctx = createMockContext();

      await handler(ctx, async () => {
        throw new BadRequestError('Invalid');
      });

      const jsonCall = (ctx.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(jsonCall.stack).toBeDefined();
      expect(Array.isArray(jsonCall.stack)).toBe(true);
    });

    it('should not include stack by default', async () => {
      const handler = errorHandler();
      const ctx = createMockContext();

      await handler(ctx, async () => {
        throw new BadRequestError('Invalid');
      });

      const jsonCall = (ctx.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(jsonCall.stack).toBeUndefined();
    });
  });

  describe('logger option', () => {
    it('should call custom logger', async () => {
      const logger = vi.fn();
      const handler = errorHandler({ logger });
      const ctx = createMockContext();
      const error = new NotFoundError('Not found');

      await handler(ctx, async () => {
        throw error;
      });

      expect(logger).toHaveBeenCalledWith(error, ctx);
    });

    it('should use default logger', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const handler = errorHandler();
      const ctx = createMockContext();

      await handler(ctx, async () => {
        throw new NotFoundError('Not found');
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log 5xx errors as error level', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const handler = errorHandler();
      const ctx = createMockContext();

      await handler(ctx, async () => {
        throw new InternalServerError('Server error');
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('transform option', () => {
    it('should use custom transform', async () => {
      const transform = vi.fn().mockReturnValue({ customError: true });
      const handler = errorHandler({ transform });
      const ctx = createMockContext();

      await handler(ctx, async () => {
        throw new BadRequestError('Invalid');
      });

      expect(transform).toHaveBeenCalled();
      expect(ctx.json).toHaveBeenCalledWith({ customError: true });
    });
  });

  describe('handlers option', () => {
    it('should use custom handler for specific error type', async () => {
      const customHandler = vi.fn();
      const handlers = new Map<new (...args: unknown[]) => Error, (error: Error, ctx: ErrorContext) => void>([
        [NotFoundError as unknown as new (...args: unknown[]) => Error, customHandler]
      ]);
      const handler = errorHandler({ handlers });
      const ctx = createMockContext();
      const error = new NotFoundError('Not found');

      await handler(ctx, async () => {
        throw error;
      });

      expect(customHandler).toHaveBeenCalledWith(error, ctx);
      expect(ctx.json).not.toHaveBeenCalled();
    });

    it('should fall back to default for unhandled types', async () => {
      const customHandler = vi.fn();
      const handlers = new Map<new (...args: unknown[]) => Error, (error: Error, ctx: ErrorContext) => void>([
        [NotFoundError as unknown as new (...args: unknown[]) => Error, customHandler]
      ]);
      const handler = errorHandler({ handlers });
      const ctx = createMockContext();

      await handler(ctx, async () => {
        throw new BadRequestError('Invalid');
      });

      expect(customHandler).not.toHaveBeenCalled();
      expect(ctx.json).toHaveBeenCalled();
    });
  });

  describe('error details', () => {
    it('should include details for exposed errors', async () => {
      const handler = errorHandler();
      const ctx = createMockContext();

      await handler(ctx, async () => {
        throw new BadRequestError('Invalid', { details: { field: 'email' } });
      });

      const jsonCall = (ctx.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(jsonCall.details).toEqual({ field: 'email' });
    });

    it('should not include details for non-exposed errors', async () => {
      const handler = errorHandler();
      const ctx = createMockContext();

      await handler(ctx, async () => {
        throw new InternalServerError('Error');
      });

      const jsonCall = (ctx.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(jsonCall.details).toBeUndefined();
    });
  });
});

describe('notFoundHandler', () => {
  it('should return 404 response', async () => {
    const handler = notFoundHandler();
    const ctx = createMockContext();

    await handler(ctx);

    expect(ctx.status).toBe(404);
    expect(ctx.json).toHaveBeenCalledWith({
      error: 'NotFoundError',
      message: 'Not Found',
      code: 'NOT_FOUND',
      status: 404,
      path: '/test',
    });
  });

  it('should accept custom message', async () => {
    const handler = notFoundHandler('Resource does not exist');
    const ctx = createMockContext();

    await handler(ctx);

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Resource does not exist' })
    );
  });

  it('should handle 200 status', async () => {
    const handler = notFoundHandler();
    const ctx = createMockContext();
    ctx.status = 200;

    await handler(ctx);

    expect(ctx.status).toBe(404);
    expect(ctx.json).toHaveBeenCalled();
  });

  it('should handle 404 status', async () => {
    const handler = notFoundHandler();
    const ctx = createMockContext();
    ctx.status = 404;

    await handler(ctx);

    expect(ctx.json).toHaveBeenCalled();
  });

  it('should not override non-404/200 status', async () => {
    const handler = notFoundHandler();
    const ctx = createMockContext();
    ctx.status = 201;

    await handler(ctx);

    expect(ctx.status).toBe(201);
    expect(ctx.json).not.toHaveBeenCalled();
  });
});

describe('catchAsync', () => {
  it('should pass through successful handlers', async () => {
    const innerHandler = vi.fn().mockResolvedValue(undefined);
    const handler = catchAsync(innerHandler);
    const ctx = createMockContext();

    await handler(ctx);

    expect(innerHandler).toHaveBeenCalledWith(ctx, undefined);
  });

  it('should re-throw errors', async () => {
    const error = new NotFoundError('Not found');
    const innerHandler = vi.fn().mockRejectedValue(error);
    const handler = catchAsync(innerHandler);
    const ctx = createMockContext();

    await expect(handler(ctx)).rejects.toThrow(error);
  });

  it('should pass next to inner handler', async () => {
    const innerHandler = vi.fn().mockResolvedValue(undefined);
    const handler = catchAsync(innerHandler);
    const ctx = createMockContext();
    const next = vi.fn();

    await handler(ctx, next);

    expect(innerHandler).toHaveBeenCalledWith(ctx, next);
  });
});

describe('Integration scenarios', () => {
  it('should work with errorHandler and notFoundHandler together', async () => {
    const errHandler = errorHandler();
    const notFoundHdlr = notFoundHandler();
    const ctx = createMockContext();

    await errHandler(ctx, async () => {
      await notFoundHdlr(ctx);
    });

    expect(ctx.status).toBe(404);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'NOT_FOUND' })
    );
  });

  it('should handle thrown NotFoundError in route', async () => {
    const errHandler = errorHandler();
    const ctx = createMockContext();

    await errHandler(ctx, async () => {
      throw new NotFoundError('User with ID 123 not found');
    });

    expect(ctx.status).toBe(404);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'User with ID 123 not found' })
    );
  });

  it('should handle validation errors with details', async () => {
    const errHandler = errorHandler();
    const ctx = createMockContext();

    await errHandler(ctx, async () => {
      throw new BadRequestError('Validation failed', {
        details: {
          issues: [
            { path: 'email', message: 'Invalid email' },
            { path: 'name', message: 'Name is required' },
          ],
        },
      });
    });

    const jsonCall = (ctx.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(jsonCall.details.issues).toHaveLength(2);
  });
});
