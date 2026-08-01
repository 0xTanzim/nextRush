/**
 * @nextrush/errors - Middleware Tests
 */

import type { Context } from '@nextrush/types';
import { describe, expect, it, vi } from 'vitest';
import { BadRequestError, InternalServerError, NotFoundError } from '../http-errors';
import { errorHandler, notFoundHandler } from '../middleware';
import { ValidationError } from '../validation';

function createMockContext(): Context {
  const ctx = {
    method: 'GET',
    url: '/test',
    path: '/test',
    query: {},
    headers: {},
    ip: '127.0.0.1',
    body: undefined,
    params: {},
    status: 200,
    json: vi.fn(),
    send: vi.fn(),
    html: vi.fn(),
    redirect: vi.fn(),
    set: vi.fn(),
    get: vi.fn(),
    next: vi.fn().mockResolvedValue(undefined),
    state: {},
    responded: false,
    raw: { req: {} as never, res: {} as never },
  } as unknown as Context;
  return ctx;
}

const noop = async (): Promise<void> => {};

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
        error: 'Internal Server Error',
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

    // SEC-14: includeStack: true must be a no-op in production, not honored
    // unconditionally — a stack trace is a map of internal paths/dependency
    // versions, and the previous behavior handed that map to any client the
    // moment a deploy forgot to flip includeStack off.
    describe('production guard (SEC-14)', () => {
      it('ignores includeStack: true in production and logs exactly one warning', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const handler = errorHandler({ includeStack: true, isProduction: true });
        const ctx = createMockContext();

        await handler(ctx, async () => {
          throw new BadRequestError('Invalid');
        });

        const jsonCall = (ctx.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(jsonCall.stack).toBeUndefined();
        // The default 4xx logger also calls console.warn — isolate the
        // SEC-14 guard's own warning by content rather than call count.
        const sec14Warnings = warnSpy.mock.calls.filter((call) =>
          String(call[0]).includes('includeStack')
        );
        expect(sec14Warnings).toHaveLength(1);
        warnSpy.mockRestore();
      });

      it('warns only once across multiple requests in production, not once per request', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const handler = errorHandler({ includeStack: true, isProduction: true });

        for (let i = 0; i < 3; i++) {
          const ctx = createMockContext();
          await handler(ctx, async () => {
            throw new BadRequestError('Invalid');
          });
        }

        const sec14Warnings = warnSpy.mock.calls.filter((call) =>
          String(call[0]).includes('includeStack')
        );
        expect(sec14Warnings).toHaveLength(1);
        warnSpy.mockRestore();
      });

      it('preserves development behavior — stack is present when isProduction is false', async () => {
        const handler = errorHandler({ includeStack: true, isProduction: false });
        const ctx = createMockContext();

        await handler(ctx, async () => {
          throw new BadRequestError('Invalid');
        });

        const jsonCall = (ctx.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(jsonCall.stack).toBeDefined();
      });

      it('preserves development behavior when isProduction is omitted (default)', async () => {
        const handler = errorHandler({ includeStack: true });
        const ctx = createMockContext();

        await handler(ctx, async () => {
          throw new BadRequestError('Invalid');
        });

        const jsonCall = (ctx.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(jsonCall.stack).toBeDefined();
      });

      it('a plain (non-HttpError) Error never exposes its message in production, with or without includeStack', async () => {
        const handler = errorHandler({ includeStack: true, isProduction: true });
        const ctx = createMockContext();

        await handler(ctx, async () => {
          throw new Error('internal db connection string: postgres://secret');
        });

        const jsonCall = (ctx.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(jsonCall.stack).toBeUndefined();
        expect(JSON.stringify(jsonCall)).not.toContain('postgres://secret');
        expect(jsonCall.message).toBe('Internal Server Error');
      });
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

  describe('ValidationError serialization (regression)', () => {
    it('includes `issues` in the response body for a ValidationError', async () => {
      const handler = errorHandler();
      const ctx = createMockContext();

      await handler(ctx, async () => {
        throw new ValidationError([
          { path: 'body.email', message: 'Invalid email address' },
          { path: 'body.name', message: 'Name is required' },
        ]);
      });

      const jsonCall = (ctx.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(jsonCall.issues).toEqual([
        { path: 'body.email', message: 'Invalid email address' },
        { path: 'body.name', message: 'Name is required' },
      ]);
      expect(jsonCall.code).toBe('VALIDATION_ERROR');
      expect(ctx.status).toBe(400);
    });

    it('never leaks the raw `received` value for a ValidationError', async () => {
      const handler = errorHandler();
      const ctx = createMockContext();

      await handler(ctx, async () => {
        throw new ValidationError([
          { path: 'body.password', message: 'Invalid', received: 'super-secret-value' },
        ]);
      });

      const jsonCall = (ctx.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(JSON.stringify(jsonCall)).not.toContain('super-secret-value');
    });
  });

  describe('handlers option', () => {
    it('should use custom handler for specific error type', async () => {
      const customHandler = vi.fn();
      const handlers = new Map<
        new (...args: unknown[]) => Error,
        (error: Error, ctx: Context) => void
      >([[NotFoundError as unknown as new (...args: unknown[]) => Error, customHandler]]);
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
      const handlers = new Map<
        new (...args: unknown[]) => Error,
        (error: Error, ctx: Context) => void
      >([[NotFoundError as unknown as new (...args: unknown[]) => Error, customHandler]]);
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
    ctx.status = 404;

    await handler(ctx, noop);

    expect(ctx.status).toBe(404);
    expect(ctx.json).toHaveBeenCalledWith({
      error: 'NotFoundError',
      message: 'Not Found',
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  it('should accept custom message', async () => {
    const handler = notFoundHandler('Resource does not exist');
    const ctx = createMockContext();
    ctx.status = 404;

    await handler(ctx, noop);

    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Resource does not exist' })
    );
  });

  it('should not handle 200 status (response was sent)', async () => {
    const handler = notFoundHandler();
    const ctx = createMockContext();
    ctx.status = 200;

    await handler(ctx, noop);

    expect(ctx.status).toBe(200);
    expect(ctx.json).not.toHaveBeenCalled();
  });

  it('should handle 404 status', async () => {
    const handler = notFoundHandler();
    const ctx = createMockContext();
    ctx.status = 404;

    await handler(ctx, noop);

    expect(ctx.json).toHaveBeenCalled();
  });

  it('should not override non-404/200 status', async () => {
    const handler = notFoundHandler();
    const ctx = createMockContext();
    ctx.status = 201;

    await handler(ctx, noop);

    expect(ctx.status).toBe(201);
    expect(ctx.json).not.toHaveBeenCalled();
  });
});

describe('Integration scenarios', () => {
  it('should work with errorHandler and notFoundHandler together', async () => {
    const errHandler = errorHandler();
    const notFoundHdlr = notFoundHandler();
    const ctx = createMockContext();
    ctx.status = 404;

    await errHandler(ctx, async () => {
      await notFoundHdlr(ctx, noop);
    });

    expect(ctx.status).toBe(404);
    expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'NOT_FOUND' }));
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
