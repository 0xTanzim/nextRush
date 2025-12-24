/**
 * Route Registry Unit Tests
 */

import {
  addMiddleware,
  createRouteHelpers,
  mountSubRouter,
  registerRoute,
  type RouteRegistrationConfig,
} from '@/core/app/route-registry';
import type { Middleware, RouteHandler } from '@/types/context';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Route Registry', () => {
  let mockRouter: any;
  let middleware: Middleware[];
  let invalidateCacheFn: ReturnType<typeof vi.fn>;
  let config: RouteRegistrationConfig;

  beforeEach(() => {
    mockRouter = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      patch: vi.fn(),
    };
    middleware = [];
    invalidateCacheFn = vi.fn();
    config = {
      router: mockRouter,
      middleware,
      invalidateExceptionFilterCache: invalidateCacheFn,
    };
  });

  describe('registerRoute', () => {
    const handler: RouteHandler = async () => {};

    it('should register GET route', () => {
      registerRoute(config, 'GET', '/test', handler);
      expect(mockRouter.get).toHaveBeenCalledWith('/test', handler);
    });

    it('should register POST route', () => {
      registerRoute(config, 'POST', '/test', handler);
      expect(mockRouter.post).toHaveBeenCalledWith('/test', handler);
    });

    it('should register PUT route', () => {
      registerRoute(config, 'PUT', '/test', handler);
      expect(mockRouter.put).toHaveBeenCalledWith('/test', handler);
    });

    it('should register DELETE route', () => {
      registerRoute(config, 'DELETE', '/test', handler);
      expect(mockRouter.delete).toHaveBeenCalledWith('/test', handler);
    });

    it('should register PATCH route', () => {
      registerRoute(config, 'PATCH', '/test', handler);
      expect(mockRouter.patch).toHaveBeenCalledWith('/test', handler);
    });

    it('should throw for unsupported HTTP method', () => {
      expect(() => {
        registerRoute(config, 'OPTIONS' as any, '/test', handler);
      }).toThrow('Unsupported HTTP method: OPTIONS');
    });

    it('should register route with config object', () => {
      const routeConfig = {
        handler,
        middleware: [async () => {}] as Middleware[],
      };
      registerRoute(config, 'GET', '/test', routeConfig);
      expect(mockRouter.get).toHaveBeenCalledWith('/test', routeConfig);
    });
  });

  describe('mountSubRouter', () => {
    it('should mount sub-router with prefix', () => {
      const subHandler: RouteHandler = async () => {};
      const subMiddleware: Middleware = async (_ctx, next) => next();

      const subRouter = {
        getRoutes: () =>
          new Map([
            ['GET:/users', { handler: subHandler, middleware: [] }],
            ['POST:/users', { handler: subHandler, middleware: [subMiddleware] }],
          ]),
        getMiddleware: () => [subMiddleware],
      };

      mountSubRouter(config, '/api', subRouter as any);

      expect(middleware).toContain(subMiddleware);
      expect(invalidateCacheFn).toHaveBeenCalled();
      expect(mockRouter.get).toHaveBeenCalled();
      expect(mockRouter.post).toHaveBeenCalled();
    });

    it('should skip routes without valid format', () => {
      const subRouter = {
        getRoutes: () => new Map([['invalid-format', { handler: async () => {}, middleware: [] }]]),
        getMiddleware: () => [],
      };

      mountSubRouter(config, '/api', subRouter as any);

      expect(mockRouter.get).not.toHaveBeenCalled();
    });
  });

  describe('addMiddleware', () => {
    it('should add middleware and invalidate cache', () => {
      const newMiddleware: Middleware = async (_ctx, next) => next();

      addMiddleware(middleware, newMiddleware, invalidateCacheFn);

      expect(middleware).toContain(newMiddleware);
      expect(invalidateCacheFn).toHaveBeenCalled();
    });
  });

  describe('createRouteHelpers', () => {
    it('should create route helper methods', () => {
      const helpers = createRouteHelpers(config);

      expect(typeof helpers.get).toBe('function');
      expect(typeof helpers.post).toBe('function');
      expect(typeof helpers.put).toBe('function');
      expect(typeof helpers.delete).toBe('function');
      expect(typeof helpers.patch).toBe('function');
    });

    it('should register routes using helper methods', () => {
      const helpers = createRouteHelpers(config);
      const handler: RouteHandler = async () => {};

      helpers.get('/test', handler);
      helpers.post('/test', handler);

      expect(mockRouter.get).toHaveBeenCalledWith('/test', handler);
      expect(mockRouter.post).toHaveBeenCalledWith('/test', handler);
    });
  });
});
