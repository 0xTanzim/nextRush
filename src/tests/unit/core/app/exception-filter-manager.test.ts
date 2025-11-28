/**
 * Exception Filter Manager Unit Tests
 */

import {
  createExceptionFilterManager,
  EXCEPTION_FILTER_MARK,
} from '@/core/app/exception-filter-manager';
import type { Context, Middleware } from '@/types/context';
import { describe, expect, it, vi } from 'vitest';

describe('Exception Filter Manager', () => {
  describe('createExceptionFilterManager', () => {
    it('should create an exception filter manager', () => {
      const manager = createExceptionFilterManager(() => []);

      expect(manager.findExceptionFilter).toBeDefined();
      expect(manager.createExceptionFilter).toBeDefined();
      expect(manager.invalidateCache).toBeDefined();
    });
  });

  describe('findExceptionFilter', () => {
    it('should return null when no filter is found', () => {
      const middleware: Middleware[] = [
        async (_ctx, next) => next(),
        async (_ctx, next) => next(),
      ];

      const manager = createExceptionFilterManager(() => middleware);
      const filter = manager.findExceptionFilter();

      expect(filter).toBeNull();
    });

    it('should find marked exception filter', () => {
      const exceptionFilter: Middleware = async (_ctx, next) => {
        try {
          await next();
        } catch (error) {
          // Handle error
        }
      };
      (exceptionFilter as any)[EXCEPTION_FILTER_MARK] = true;

      const middleware: Middleware[] = [
        async (_ctx, next) => next(),
        exceptionFilter,
      ];

      const manager = createExceptionFilterManager(() => middleware);
      const filter = manager.findExceptionFilter();

      expect(filter).toBe(exceptionFilter);
    });

    it('should cache the found filter', () => {
      const exceptionFilter: Middleware = async (_ctx, next) => next();
      (exceptionFilter as any)[EXCEPTION_FILTER_MARK] = true;

      const getMiddleware = vi.fn(() => [exceptionFilter]);
      const manager = createExceptionFilterManager(getMiddleware);

      // First call
      manager.findExceptionFilter();
      // Second call (should use cache)
      manager.findExceptionFilter();

      // Middleware getter should only be called once due to caching
      expect(getMiddleware).toHaveBeenCalledTimes(1);
    });
  });

  describe('createExceptionFilter', () => {
    it('should create an exception filter middleware', async () => {
      const manager = createExceptionFilterManager(() => []);
      const filter = manager.createExceptionFilter();

      expect(typeof filter).toBe('function');
      expect((filter as any)[EXCEPTION_FILTER_MARK]).toBe(true);
    });

    it('should handle errors with default global filter', async () => {
      const manager = createExceptionFilterManager(() => []);
      const filter = manager.createExceptionFilter();

      const mockCtx = {
        status: 200,
        path: '/test',
        method: 'GET',
        id: 'test-id',
        res: {
          status: vi.fn().mockReturnThis(),
          json: vi.fn(),
        },
      } as unknown as Context;

      const error = new Error('Test error');
      const next = vi.fn().mockRejectedValue(error);

      await filter(mockCtx, next);

      // GlobalExceptionFilter sets ctx.status, not ctx.res.status()
      expect(mockCtx.status).toBe(500);
      expect(mockCtx.res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Internal Server Error',
            statusCode: 500,
          }),
        })
      );
    });

    it('should cache the created filter', () => {
      const manager = createExceptionFilterManager(() => []);
      const filter = manager.createExceptionFilter();

      // Should be immediately findable
      const found = manager.findExceptionFilter();
      expect(found).toBe(filter);
    });
  });

  describe('invalidateCache', () => {
    it('should invalidate the cached filter', () => {
      const exceptionFilter: Middleware = async (_ctx, next) => next();
      (exceptionFilter as any)[EXCEPTION_FILTER_MARK] = true;

      let middleware: Middleware[] = [exceptionFilter];
      const manager = createExceptionFilterManager(() => middleware);

      // Find and cache
      manager.findExceptionFilter();

      // Invalidate
      manager.invalidateCache();

      // Change middleware
      const newFilter: Middleware = async (_ctx, next) => next();
      (newFilter as any)[EXCEPTION_FILTER_MARK] = true;
      middleware = [newFilter];

      // Should find the new filter
      const found = manager.findExceptionFilter();
      expect(found).toBe(newFilter);
    });
  });
});
