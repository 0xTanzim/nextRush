/**
 * Tests for Route Registry
 *
 * @packageDocumentation
 */

import { RouteRegistry } from '@/core/orchestration/route-registry';
import { Router as RouterClass } from '@/core/router';
import type { RouteHandler, Router } from '@/types/context';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the router
vi.mock('@/core/router');

describe('RouteRegistry', () => {
  let routeRegistry: RouteRegistry;
  let mockRouter: any;

  beforeEach(() => {
    mockRouter = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      patch: vi.fn(),
      find: vi.fn(),
      routes: {},
    };

    (RouterClass as any).mockImplementation(() => mockRouter);
    routeRegistry = new RouteRegistry();
  });

  describe('constructor', () => {
    it('should create internal router', () => {
      expect(RouterClass).toHaveBeenCalled();
    });
  });

  describe('registerRoute', () => {
    const mockHandler: RouteHandler = async _ctx => {};

    it('should register GET route', () => {
      routeRegistry.registerRoute('GET', '/users', mockHandler);

      expect(mockRouter.get).toHaveBeenCalledWith('/users', mockHandler);
    });

    it('should register POST route', () => {
      routeRegistry.registerRoute('POST', '/users', mockHandler);

      expect(mockRouter.post).toHaveBeenCalledWith('/users', mockHandler);
    });

    it('should register PUT route', () => {
      routeRegistry.registerRoute('PUT', '/users/:id', mockHandler);

      expect(mockRouter.put).toHaveBeenCalledWith('/users/:id', mockHandler);
    });

    it('should register DELETE route', () => {
      routeRegistry.registerRoute('DELETE', '/users/:id', mockHandler);

      expect(mockRouter.delete).toHaveBeenCalledWith('/users/:id', mockHandler);
    });

    it('should register PATCH route', () => {
      routeRegistry.registerRoute('PATCH', '/users/:id', mockHandler);

      expect(mockRouter.patch).toHaveBeenCalledWith('/users/:id', mockHandler);
    });

    it('should handle HEAD method by delegating to GET', () => {
      routeRegistry.registerRoute('HEAD', '/users', mockHandler);

      expect(mockRouter.get).toHaveBeenCalledWith('/users', mockHandler);
    });

    it('should handle OPTIONS method by delegating to GET', () => {
      routeRegistry.registerRoute('OPTIONS', '/users', mockHandler);

      expect(mockRouter.get).toHaveBeenCalledWith('/users', mockHandler);
    });

    it('should throw error for unsupported HTTP method', () => {
      expect(() => {
        routeRegistry.registerRoute('INVALID', '/users', mockHandler);
      }).toThrow('Unsupported HTTP method: INVALID');
    });

    it('should handle route config object', () => {
      const routeConfig = {
        handler: mockHandler,
        middleware: [],
      };

      routeRegistry.registerRoute('GET', '/config', routeConfig);

      expect(mockRouter.get).toHaveBeenCalledWith('/config', routeConfig);
    });
  });

  describe('findRoute', () => {
    it('should find existing route', () => {
      const mockMatch = {
        handler: async (_ctx: any) => {},
        params: { id: '123' },
      };

      mockRouter.find.mockReturnValue(mockMatch);

      const result = routeRegistry.findRoute('GET', '/users/123');

      expect(mockRouter.find).toHaveBeenCalledWith('GET', '/users/123');
      expect(result).toBe(mockMatch);
    });

    it('should return null for non-existing route', () => {
      mockRouter.find.mockReturnValue(null);

      const result = routeRegistry.findRoute('GET', '/nonexistent');

      expect(mockRouter.find).toHaveBeenCalledWith('GET', '/nonexistent');
      expect(result).toBeNull();
    });

    it('should handle route with parameters', () => {
      const mockMatch = {
        handler: async (_ctx: any) => {},
        params: { userId: '456', postId: '789' },
      };

      mockRouter.find.mockReturnValue(mockMatch);

      const result = routeRegistry.findRoute('GET', '/users/456/posts/789');

      expect(result).toEqual(mockMatch);
      expect(result?.params).toEqual({ userId: '456', postId: '789' });
    });
  });

  describe('createRouter', () => {
    it('should create new router instance', () => {
      // Clear previous mock calls to get accurate count
      (RouterClass as any).mockClear();

      const router = routeRegistry.createRouter();

      expect(RouterClass).toHaveBeenCalledTimes(1); // Only this call
      expect(router).toBeTruthy(); // Router should be created
      expect(typeof router).toBe('object'); // Should be an object
    });
  });

  describe('registerRouter', () => {
    it('should register routes from router without prefix', () => {
      const mockSubRouter: Router = {
        routes: {
          'GET:/api/users': async (_ctx: any) => {},
          'POST:/api/users': async (_ctx: any) => {},
        },
      } as any;

      routeRegistry.registerRouter(mockSubRouter);

      expect(mockRouter.get).toHaveBeenCalledWith(
        '/api/users',
        expect.any(Function)
      );
      expect(mockRouter.post).toHaveBeenCalledWith(
        '/api/users',
        expect.any(Function)
      );
    });

    it('should register routes from router with prefix', () => {
      const mockSubRouter: Router = {
        routes: {
          'GET:/users': async (_ctx: any) => {},
          'POST:/users': async (_ctx: any) => {},
        },
      } as any;

      routeRegistry.registerRouter('/api', mockSubRouter);

      expect(mockRouter.get).toHaveBeenCalledWith(
        '/api/users',
        expect.any(Function)
      );
      expect(mockRouter.post).toHaveBeenCalledWith(
        '/api/users',
        expect.any(Function)
      );
    });

    it('should handle routes with complex paths', () => {
      const mockSubRouter: Router = {
        routes: {
          'GET:/users/:id/posts/:postId': async (_ctx: any) => {},
          'PUT:/users/:id/profile': async (_ctx: any) => {},
        },
      } as any;

      routeRegistry.registerRouter('/api/v1', mockSubRouter);

      expect(mockRouter.get).toHaveBeenCalledWith(
        '/api/v1/users/:id/posts/:postId',
        expect.any(Function)
      );
      expect(mockRouter.put).toHaveBeenCalledWith(
        '/api/v1/users/:id/profile',
        expect.any(Function)
      );
    });

    it('should skip malformed route keys', () => {
      const mockSubRouter: Router = {
        routes: {
          'GET:/users': async (_ctx: any) => {},
          INVALID_ROUTE: async (_ctx: any) => {},
          ':/missing-method': async (_ctx: any) => {},
          'POST:': async (_ctx: any) => {}, // Missing path
        },
      } as any;

      routeRegistry.registerRouter(mockSubRouter);

      expect(mockRouter.get).toHaveBeenCalledWith(
        '/users',
        expect.any(Function)
      );
      expect(mockRouter.get).toHaveBeenCalledTimes(1);
      expect(mockRouter.post).not.toHaveBeenCalled();
    });

    it('should handle empty router', () => {
      const mockSubRouter: Router = {
        routes: {},
      } as any;

      expect(() => {
        routeRegistry.registerRouter(mockSubRouter);
      }).not.toThrow();

      expect(mockRouter.get).not.toHaveBeenCalled();
      expect(mockRouter.post).not.toHaveBeenCalled();
    });

    it('should handle router without routes property', () => {
      const mockSubRouter = {} as any;

      expect(() => {
        routeRegistry.registerRouter(mockSubRouter);
      }).not.toThrow();
    });

    it('should handle null/undefined router', () => {
      expect(() => {
        routeRegistry.registerRouter(null as any);
      }).not.toThrow();

      expect(() => {
        routeRegistry.registerRouter(undefined as any);
      }).not.toThrow();
    });
  });

  describe('getRouteStats', () => {
    it('should return basic route statistics', () => {
      const stats = routeRegistry.getRouteStats();

      expect(stats).toEqual({
        totalRoutes: 0,
        routesByMethod: {},
      });
    });

    it('should return consistent statistics', () => {
      // Since the current implementation returns static values,
      // we test that it returns the expected structure
      const stats1 = routeRegistry.getRouteStats();
      const stats2 = routeRegistry.getRouteStats();

      expect(stats1).toEqual(stats2);
      expect(typeof stats1.totalRoutes).toBe('number');
      expect(typeof stats1.routesByMethod).toBe('object');
    });
  });

  describe('edge cases', () => {
    it('should handle case-sensitive HTTP methods', () => {
      const mockHandler: RouteHandler = async _ctx => {};

      // Should throw error for lowercase HTTP method
      expect(() => {
        routeRegistry.registerRoute('get', '/users', mockHandler);
      }).toThrow('Unsupported HTTP method: get');

      // Should not call GET method for lowercase
      expect(mockRouter.get).not.toHaveBeenCalled();
    });

    it('should handle special characters in routes', () => {
      const mockHandler: RouteHandler = async _ctx => {};

      routeRegistry.registerRoute('GET', '/users/@special/path', mockHandler);

      expect(mockRouter.get).toHaveBeenCalledWith(
        '/users/@special/path',
        mockHandler
      );
    });

    it('should handle empty path', () => {
      const mockHandler: RouteHandler = async _ctx => {};

      routeRegistry.registerRoute('GET', '', mockHandler);

      expect(mockRouter.get).toHaveBeenCalledWith('', mockHandler);
    });

    it('should handle root path', () => {
      const mockHandler: RouteHandler = async _ctx => {};

      routeRegistry.registerRoute('GET', '/', mockHandler);

      expect(mockRouter.get).toHaveBeenCalledWith('/', mockHandler);
    });

    it('should handle very long paths', () => {
      const mockHandler: RouteHandler = async _ctx => {};
      const longPath =
        '/api/v1/users/123/posts/456/comments/789/replies/abc/reactions/def';

      routeRegistry.registerRoute('GET', longPath, mockHandler);

      expect(mockRouter.get).toHaveBeenCalledWith(longPath, mockHandler);
    });

    it('should handle unicode characters in paths', () => {
      const mockHandler: RouteHandler = async _ctx => {};

      routeRegistry.registerRoute('GET', '/users/测试/posts', mockHandler);

      expect(mockRouter.get).toHaveBeenCalledWith(
        '/users/测试/posts',
        mockHandler
      );
    });

    it('should handle middleware array in route config', () => {
      const middleware1 = async (_ctx: any, next: any) => await next();
      const middleware2 = async (_ctx: any, next: any) => await next();

      const routeConfig = {
        handler: async (_ctx: any) => {},
        middleware: [middleware1, middleware2],
        name: 'test-route',
      };

      routeRegistry.registerRoute('GET', '/test', routeConfig);

      expect(mockRouter.get).toHaveBeenCalledWith('/test', routeConfig);
    });
  });

  describe('method delegation', () => {
    it('should handle all supported HTTP methods correctly', () => {
      const mockHandler: RouteHandler = async _ctx => {};
      const path = '/test';

      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      const routerMethods = ['get', 'post', 'put', 'delete', 'patch'];

      methods.forEach((method, index) => {
        routeRegistry.registerRoute(method, path, mockHandler);
        expect(
          mockRouter[routerMethods[index] as keyof typeof mockRouter]
        ).toHaveBeenCalledWith(path, mockHandler);
      });
    });

    it('should handle HEAD and OPTIONS fallback to GET', () => {
      const mockHandler: RouteHandler = async _ctx => {};
      const path = '/test';

      routeRegistry.registerRoute('HEAD', path, mockHandler);
      routeRegistry.registerRoute('OPTIONS', path, mockHandler);

      expect(mockRouter.get).toHaveBeenCalledTimes(2);
      expect(mockRouter.get).toHaveBeenCalledWith(path, mockHandler);
    });
  });

  describe('router integration', () => {
    it('should properly integrate with router find method', () => {
      const mockHandler: RouteHandler = async _ctx => {};

      // Register a route
      routeRegistry.registerRoute('GET', '/users/:id', mockHandler);

      // Mock router find to return a match
      const mockMatch = {
        handler: mockHandler,
        params: { id: '123' },
      };
      mockRouter.find.mockReturnValue(mockMatch);

      // Find the route
      const result = routeRegistry.findRoute('GET', '/users/123');

      expect(result).toBe(mockMatch);
      expect(mockRouter.find).toHaveBeenCalledWith('GET', '/users/123');
    });

    it('should maintain handler reference integrity', () => {
      const originalHandler: RouteHandler = async _ctx => {};

      routeRegistry.registerRoute('POST', '/users', originalHandler);

      expect(mockRouter.post).toHaveBeenCalledWith('/users', originalHandler);

      // Verify the exact same handler reference is passed
      const calledWith = mockRouter.post.mock.calls[0];
      expect(calledWith[1]).toBe(originalHandler);
    });
  });
});
